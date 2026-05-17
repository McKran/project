/**
 * Farming Plan Route
 *
 * All plans are generated using:
 *   1. Open-Meteo Historical Weather API — local GDD rates from real ERA5 reanalysis data
 *   2. Open-Meteo Forecast API — 16-day weather outlook
 *   3. Wikipedia REST API — crop information
 *   4. World Bank Open Data API — country context
 *   5. GDD-based rule engine — scientifically grounded, no AI calls
 *
 * PSGC STRICT MODE: location is resolved exclusively from PSGC codes.
 * No free-text location is accepted. Missing PSGC data blocks plan generation.
 *
 * NO AI models, NO hardcoded timelines, NO paid or restricted APIs.
 * Plans are persisted in PostgreSQL to avoid redundant data fetches.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { farmingPlans } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import {
  fetchHistoricalWeather,
  buildClimateProfile,
  fetchForecast,
  fetchCropWikiInfo,
  fetchCountryContext,
  type GeoResult,
} from "../lib/open-data-fetcher";
import { generateFarmingPlan, listAvailableCrops } from "../lib/gdd-engine";

const router = Router();

const PLAN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Check PostgreSQL for a cached plan by PSGC code + crop + plantingDate.
 */
async function getCachedPlan(crop: string, locationKey: string, plantingDate: string) {
  try {
    const rows = await db
      .select()
      .from(farmingPlans)
      .where(
        and(
          eq(farmingPlans.crop, crop.toLowerCase()),
          eq(farmingPlans.location, locationKey),
          eq(farmingPlans.plantingDate, plantingDate),
          gt(farmingPlans.expiresAt, new Date())
        )
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist a generated plan to PostgreSQL keyed by PSGC code.
 */
async function savePlan(
  crop: string,
  locationKey: string,
  plantingDate: string,
  planData: any,
  climateProfile: any,
  dataSourcesUsed: string[]
) {
  try {
    await db.insert(farmingPlans).values({
      crop: crop.toLowerCase(),
      location: locationKey,
      plantingDate,
      planData,
      climateProfile,
      dataSourcesUsed,
      expiresAt: new Date(Date.now() + PLAN_TTL_MS),
    });
  } catch {
    // Non-fatal
  }
}

/**
 * POST /api/farming-plan/generate
 *
 * PSGC-strict: requires regionCode + provinceCode. cityCode preferred.
 * Rejects requests with missing PSGC location data.
 *
 * Body:
 *   crop, plantingDate (required)
 *   regionCode, provinceCode (required — PSGC)
 *   cityCode, cityName, provinceName, regionName (from onboarding)
 *   lat, lon (from PSGC geocoding, preferred over name-based geocoding)
 */
router.post("/farming-plan/generate", async (req, res) => {
  const {
    crop,
    plantingDate,
    regionCode,
    provinceCode,
    cityCode,
    cityName,
    provinceName,
    regionName,
    lat,
    lon,
  } = req.body as {
    crop?: string;
    plantingDate?: string;
    regionCode?: string;
    provinceCode?: string;
    cityCode?: string;
    cityName?: string;
    provinceName?: string;
    regionName?: string;
    lat?: number | null;
    lon?: number | null;
  };

  if (!crop || !plantingDate) {
    res.status(400).json({ error: "crop and plantingDate are required" });
    return;
  }

  // PSGC strict validation
  if (!regionCode || !provinceCode) {
    res.status(422).json({
      error:
        "PSGC location data is required. Please complete onboarding to set your region and province.",
      code: "PSGC_MISSING",
    });
    return;
  }

  // Use PSGC code as stable cache key
  const locationKey = cityCode || provinceCode;
  const locationDisplay = [cityName, provinceName, regionName, "Philippines"]
    .filter(Boolean)
    .join(", ");

  try {
    // 1. Check PostgreSQL cache first
    const cached = await getCachedPlan(crop, locationKey, plantingDate);
    if (cached) {
      req.log.info({ crop, locationKey }, "Returning cached farming plan from PostgreSQL");
      return res.json({
        plan: cached.planData,
        weatherData: null,
        generatedAt: cached.generatedAt.toISOString(),
        cached: true,
        dataSourcesUsed: cached.dataSourcesUsed,
        location: { display: locationDisplay, cityCode, provinceCode, regionCode },
      });
    }

    // 2. Resolve coordinates — prefer PSGC-geocoded lat/lon from onboarding
    let geo: GeoResult | null = null;

    if (lat != null && lon != null) {
      geo = {
        lat,
        lon,
        name: cityName || provinceName || regionName || "Philippines",
        country: "Philippines",
        countryCode: "PH",
        elevation: 0,
        timezone: "Asia/Manila",
      };
    } else {
      // Fallback: geocode by name derived from PSGC labels
      const searchTerm = [cityName, provinceName, "Philippines"].filter(Boolean).join(", ");
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=en&format=json`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (geoRes.ok) {
          const geoData: any = await geoRes.json();
          const r = geoData.results?.[0];
          if (r) {
            geo = {
              lat: r.latitude,
              lon: r.longitude,
              name: r.name,
              country: "Philippines",
              countryCode: "PH",
              elevation: r.elevation ?? 0,
              timezone: r.timezone ?? "Asia/Manila",
            };
          }
        }
      } catch {
        // Geocoding failed — continue, will error below
      }
    }

    if (!geo) {
      return res.status(422).json({
        error: `Could not resolve coordinates for ${locationDisplay}. Ensure location coordinates are set during onboarding.`,
        code: "GEOCODE_FAILED",
      });
    }

    // 3. Fetch all open data sources in parallel
    const [historical, forecast, wikiInfo, countryCtx] = await Promise.allSettled([
      fetchHistoricalWeather(geo.lat, geo.lon),
      fetchForecast(geo.lat, geo.lon),
      fetchCropWikiInfo(crop),
      fetchCountryContext("PH"),
    ]);

    const historicalData = historical.status === "fulfilled" ? historical.value : null;
    const forecastData = forecast.status === "fulfilled" ? forecast.value : [];
    const wiki = wikiInfo.status === "fulfilled" ? wikiInfo.value : null;
    const country = countryCtx.status === "fulfilled" ? countryCtx.value : null;

    // 4. Build climate profile from historical weather
    const climateProfile = buildClimateProfile(
      geo,
      historicalData ?? { dates: [], tempMax: [], tempMin: [], precipitation: [] }
    );

    // 5. Generate farming plan using GDD engine (rule-based, no AI)
    const plan = generateFarmingPlan(
      crop,
      plantingDate,
      locationDisplay,
      climateProfile,
      forecastData,
      wiki?.extract ?? null
    );

    if (country) {
      (plan as any).countryContext = {
        name: country.name,
        region: country.region,
        incomeLevel: country.incomeLevel,
        source: country.source,
      };
    }

    // Embed PSGC location metadata in plan
    (plan as any).psgcLocation = {
      regionCode,
      provinceCode,
      cityCode: cityCode || null,
      cityName: cityName || null,
      provinceName: provinceName || null,
      regionName: regionName || null,
      display: locationDisplay,
    };

    // 6. Save to PostgreSQL
    await savePlan(crop, locationKey, plantingDate, plan, climateProfile, plan.dataSourcesUsed);

    // 7. Build forecast response
    const forecastResponse =
      forecastData.length > 0
        ? {
            daily: {
              dates: forecastData.map((d) => d.date),
              maxTemps: forecastData.map((d) => d.tempMax),
              minTemps: forecastData.map((d) => d.tempMin),
              precipitation: forecastData.map((d) => d.precipitation),
              precipitationProbability: forecastData.map((d) => d.precipProbability),
              uvIndex: forecastData.map((d) => d.uvIndex),
            },
          }
        : null;

    req.log.info(
      { crop, cityCode, provinceCode, regionCode, totalDays: plan.totalGrowingDays },
      "Generated farming plan from PSGC-bound location"
    );

    res.json({
      plan,
      weatherData: forecastResponse,
      generatedAt: new Date().toISOString(),
      cached: false,
      dataSourcesUsed: plan.dataSourcesUsed,
      location: { display: locationDisplay, cityCode, provinceCode, regionCode },
    });
  } catch (err: any) {
    req.log.error({ err }, "Error generating farming plan");
    res.status(500).json({ error: "Failed to generate farming plan. Please try again." });
  }
});

/**
 * GET /api/farming-plan/crops
 */
router.get("/farming-plan/crops", (_req, res) => {
  res.json(listAvailableCrops());
});

/**
 * GET /api/farming-plan/data-sources
 */
router.get("/farming-plan/data-sources", (_req, res) => {
  res.json({
    description: "All agricultural intelligence is generated from free, open-source data only.",
    sources: [
      {
        name: "Open-Meteo Historical Weather API",
        url: "https://archive-api.open-meteo.com",
        description: "ERA5 reanalysis data — 1-year historical daily weather. Used for local GDD rates.",
        license: "CC BY 4.0",
        apiKey: false,
      },
      {
        name: "Open-Meteo Forecast API",
        url: "https://api.open-meteo.com",
        description: "16-day weather forecast for weather risk assessment.",
        license: "CC BY 4.0",
        apiKey: false,
      },
      {
        name: "PSGC (Philippine Standard Geographic Code)",
        url: "https://psgc.gitlab.io/api",
        description: "Official Philippine location codes. Farm location is locked to PSGC.",
        license: "Open Government Data",
        apiKey: false,
      },
      {
        name: "Wikipedia REST API",
        url: "https://en.wikipedia.org/api/rest_v1",
        description: "Crop information and descriptions.",
        license: "CC BY-SA 3.0",
        apiKey: false,
      },
      {
        name: "World Bank Open Data API",
        url: "https://api.worldbank.org/v2",
        description: "Country-level agricultural and economic context.",
        license: "CC BY 4.0",
        apiKey: false,
      },
      {
        name: "FAO Paper No. 56 + GDD Crop Parameters",
        url: "https://www.fao.org/3/x0490e/x0490e00.htm",
        description: "Scientific basis for ET₀ calculation and crop coefficients from FAO, USDA, CIMMYT, IRRI.",
        license: "Open access",
        apiKey: false,
      },
    ],
  });
});

export default router;

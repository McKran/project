/**
 * Farming Plan Route
 *
 * All plans are generated using:
 *   1. Open-Meteo Historical Weather API — local GDD rates from real ERA5 reanalysis data
 *   2. Open-Meteo Forecast API — 16-day weather outlook
 *   3. Open-Meteo Geocoding API — coordinates from location name
 *   4. Wikipedia REST API — crop information
 *   5. World Bank Open Data API — country context
 *   6. GDD-based rule engine — scientifically grounded, no AI calls
 *
 * NO AI models, NO hardcoded timelines, NO paid or restricted APIs.
 * Plans are persisted in PostgreSQL to avoid redundant data fetches.
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { farmingPlans } from "@workspace/db";
import { and, eq, gt } from "drizzle-orm";
import {
  geocodeLocation,
  fetchHistoricalWeather,
  buildClimateProfile,
  fetchForecast,
  fetchCropWikiInfo,
  fetchCountryContext,
  type GeoResult,
} from "../lib/open-data-fetcher";
import { generateFarmingPlan, listAvailableCrops } from "../lib/gdd-engine";

const router = Router();

const PLAN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — recalculate when new data is available

/**
 * Check PostgreSQL for a cached plan that is still valid.
 */
async function getCachedPlan(crop: string, location: string, plantingDate: string) {
  try {
    const rows = await db
      .select()
      .from(farmingPlans)
      .where(
        and(
          eq(farmingPlans.crop, crop.toLowerCase()),
          eq(farmingPlans.location, location.toLowerCase()),
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
 * Persist a generated plan to PostgreSQL for future reuse.
 */
async function savePlan(
  crop: string,
  location: string,
  plantingDate: string,
  planData: any,
  climateProfile: any,
  dataSourcesUsed: string[]
) {
  try {
    await db.insert(farmingPlans).values({
      crop: crop.toLowerCase(),
      location: location.toLowerCase(),
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
 * Generates a farming plan using open-source data only:
 *   - Historical climate data → local GDD rates
 *   - Forecast data → weather risk assessment
 *   - GDD rule engine → stage timings (no hardcoded day numbers)
 *   - Wikipedia API → crop info
 *   - World Bank API → country context
 *   - Results cached in PostgreSQL for 7 days
 */
router.post("/farming-plan/generate", async (req, res) => {
  const { crop, plantingDate, location, lat, lon } = req.body as {
    crop?: string;
    plantingDate?: string;
    location?: string;
    lat?: number | null;
    lon?: number | null;
  };

  if (!crop || !plantingDate || !location) {
    res.status(400).json({ error: "crop, plantingDate, and location are required" });
    return;
  }

  try {
    // 1. Check PostgreSQL cache first
    const cached = await getCachedPlan(crop, location, plantingDate);
    if (cached) {
      req.log.info({ crop, location }, "Returning cached farming plan from PostgreSQL");
      return res.json({
        plan: cached.planData,
        weatherData: null,
        generatedAt: cached.generatedAt.toISOString(),
        cached: true,
        dataSourcesUsed: cached.dataSourcesUsed,
      });
    }

    // 2. Resolve coordinates from Open-Meteo Geocoding API (free, no key)
    let geo: GeoResult | null = null;
    if (lat && lon) {
      geo = { lat, lon, name: location, country: "", countryCode: "", elevation: 0, timezone: "UTC" };
    } else {
      geo = await geocodeLocation(location);
    }

    if (!geo) {
      return res.status(422).json({ error: `Could not resolve location: "${location}". Try a more specific place name.` });
    }

    // 3. Fetch all open data sources in parallel (no sequential blocking)
    const [historical, forecast, wikiInfo, countryCtx] = await Promise.allSettled([
      fetchHistoricalWeather(geo.lat, geo.lon),         // Open-Meteo Historical (ERA5, free)
      fetchForecast(geo.lat, geo.lon),                  // Open-Meteo Forecast (free)
      fetchCropWikiInfo(crop),                          // Wikipedia REST API (free)
      geo.countryCode ? fetchCountryContext(geo.countryCode) : Promise.resolve(null),  // World Bank (free)
    ]);

    const historicalData = historical.status === "fulfilled" ? historical.value : null;
    const forecastData = forecast.status === "fulfilled" ? forecast.value : [];
    const wiki = wikiInfo.status === "fulfilled" ? wikiInfo.value : null;
    const country = countryCtx.status === "fulfilled" ? countryCtx.value : null;

    // 4. Build climate profile from historical weather
    const climateProfile = buildClimateProfile(geo, historicalData ?? { dates: [], tempMax: [], tempMin: [], precipitation: [] });

    // 5. Generate farming plan using GDD engine (rule-based, no AI)
    const wikiExtract = wiki?.extract ?? null;
    const plan = generateFarmingPlan(crop, plantingDate, location, climateProfile, forecastData, wikiExtract);

    // Add country context if available
    if (country) {
      (plan as any).countryContext = {
        name: country.name,
        region: country.region,
        incomeLevel: country.incomeLevel,
        source: country.source,
      };
    }

    // 6. Save to PostgreSQL for persistence (avoids refetching for 7 days)
    await savePlan(crop, location, plantingDate, plan, climateProfile, plan.dataSourcesUsed);

    // 7. Build forecast response
    const forecastResponse = forecastData.length > 0 ? {
      daily: {
        dates: forecastData.map(d => d.date),
        maxTemps: forecastData.map(d => d.tempMax),
        minTemps: forecastData.map(d => d.tempMin),
        precipitation: forecastData.map(d => d.precipitation),
        precipitationProbability: forecastData.map(d => d.precipProbability),
        uvIndex: forecastData.map(d => d.uvIndex),
      },
    } : null;

    req.log.info({ crop, location, totalDays: plan.totalGrowingDays, sources: plan.dataSourcesUsed.length }, "Generated farming plan from open data");

    res.json({
      plan,
      weatherData: forecastResponse,
      generatedAt: new Date().toISOString(),
      cached: false,
      dataSourcesUsed: plan.dataSourcesUsed,
    });
  } catch (err: any) {
    req.log.error({ err }, "Error generating farming plan");
    res.status(500).json({ error: "Failed to generate farming plan. Please try again." });
  }
});

/**
 * GET /api/farming-plan/crops
 *
 * Returns the list of supported crops with their GDD data sources.
 * All crop parameters are sourced from open agronomic literature.
 */
router.get("/farming-plan/crops", (_req, res) => {
  res.json(listAvailableCrops());
});

/**
 * GET /api/farming-plan/data-sources
 *
 * Returns the list of open data sources used by this system.
 */
router.get("/farming-plan/data-sources", (_req, res) => {
  res.json({
    description: "All agricultural intelligence is generated from free, open-source data only.",
    sources: [
      {
        name: "Open-Meteo Historical Weather API",
        url: "https://archive-api.open-meteo.com",
        description: "ERA5 reanalysis data — 1-year historical daily weather for any location. Used to compute local GDD accumulation rates.",
        license: "CC BY 4.0",
        apiKey: false,
      },
      {
        name: "Open-Meteo Forecast API",
        url: "https://api.open-meteo.com",
        description: "16-day weather forecast. Used for weather risk assessment.",
        license: "CC BY 4.0",
        apiKey: false,
      },
      {
        name: "Open-Meteo Geocoding API",
        url: "https://geocoding-api.open-meteo.com",
        description: "Location name to coordinates. Free, no API key.",
        license: "Open",
        apiKey: false,
      },
      {
        name: "Wikipedia REST API",
        url: "https://en.wikipedia.org/api/rest_v1",
        description: "Crop information and descriptions. Fully open.",
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
        name: "FAO Irrigation and Drainage Paper No. 56",
        url: "https://www.fao.org/3/x0490e/x0490e00.htm",
        description: "Scientific basis for ET₀ calculation (Hargreaves method) and crop coefficients.",
        license: "Open access",
        apiKey: false,
      },
      {
        name: "GDD Crop Parameters",
        url: "https://www.fao.org",
        description: "Crop base temperatures and GDD phase thresholds from FAO Paper 56, USDA Agronomy Handbook, CIMMYT, IRRI, CIP, and ICRISAT open-access publications.",
        license: "Open access scientific literature",
        apiKey: false,
      },
    ],
  });
});

export default router;

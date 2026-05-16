import { Router } from "express";

const router = Router();

const geoCache = new Map<string, { data: any[]; ts: number }>();
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000;

interface OpenMeteoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country_code: string;
  country: string;
  admin1?: string;
  admin2?: string;
  population?: number;
}

async function searchCitiesInRegion(countryCode: string, region: string): Promise<any[]> {
  const cacheKey = `${countryCode}_${region}`.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < GEO_CACHE_TTL) return cached.data;

  const results: Map<string, any> = new Map();

  const queries = region
    ? [region, region.split(" ")[0]]
    : ["a", "b", "c", "m", "k", "s", "n", "l", "d", "t"];

  for (const query of queries) {
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=100&language=en&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data: any = await res.json();
      const items: OpenMeteoResult[] = data.results ?? [];

      for (const item of items) {
        if (
          item.country_code?.toUpperCase() !== countryCode.toUpperCase()
        ) continue;
        if (region && item.admin1 && !item.admin1.toLowerCase().includes(region.toLowerCase()) && !region.toLowerCase().includes(item.admin1.toLowerCase())) continue;

        const key = item.name.toLowerCase();
        if (!results.has(key)) {
          results.set(key, {
            name: item.name,
            lat: item.latitude,
            lon: item.longitude,
            country_code: item.country_code,
            admin1: item.admin1 ?? region ?? "",
            population: item.population ?? 0,
          });
        }
      }
    } catch {}
  }

  const sorted = Array.from(results.values()).sort((a, b) => (b.population ?? 0) - (a.population ?? 0));
  const top = sorted.slice(0, 50);

  if (top.length > 0) {
    geoCache.set(cacheKey, { data: top, ts: Date.now() });
  }

  return top;
}

router.get("/geo/cities", async (req, res) => {
  const countryCode = (req.query.country_code as string ?? "").toUpperCase();
  const region = (req.query.region as string ?? "").trim();

  if (!countryCode) {
    res.status(400).json({ error: "country_code is required" });
    return;
  }

  try {
    const cities = await searchCitiesInRegion(countryCode, region);

    if (cities.length > 0) {
      res.json(cities);
      return;
    }

    const fallbackUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(region || countryCode)}&count=50&language=en&format=json`;
    const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(5000) });
    if (fallbackRes.ok) {
      const data: any = await fallbackRes.json();
      const items: OpenMeteoResult[] = (data.results ?? []).filter(
        (r: OpenMeteoResult) => r.country_code?.toUpperCase() === countryCode
      );
      const mapped = items.map(r => ({
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        country_code: r.country_code,
        admin1: r.admin1 ?? region,
        population: r.population ?? 0,
      }));
      res.json(mapped);
      return;
    }

    res.json([]);
  } catch (err) {
    req.log.error({ err }, "Error fetching geo cities");
    res.json([]);
  }
});

export default router;

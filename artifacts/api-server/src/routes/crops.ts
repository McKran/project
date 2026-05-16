import { Router } from "express";
import {
  GetCropRecommendationsQueryParams,
  GetCropCalendarQueryParams,
} from "@workspace/api-zod";

const router = Router();

const CROP_DATA = [
  {
    cropName: "Maize",
    suitability: "Excellent",
    riskLevel: "Low",
    estimatedYield: "4-6 tons/ha",
    plantingWindow: "Mar–May",
    notes: "Primary staple crop. Performs well in loam soils with adequate rainfall.",
    icon: "🌽",
    season: "long-rains",
  },
  {
    cropName: "Beans",
    suitability: "Good",
    riskLevel: "Low",
    estimatedYield: "1.5–2.5 tons/ha",
    plantingWindow: "Mar–Apr",
    notes: "Excellent nitrogen fixer. Intercrop with maize for better yields.",
    icon: "🫘",
    season: "long-rains",
  },
  {
    cropName: "Tomatoes",
    suitability: "Good",
    riskLevel: "Medium",
    estimatedYield: "15–25 tons/ha",
    plantingWindow: "Feb–Mar",
    notes: "High value crop. Requires consistent irrigation and pest monitoring.",
    icon: "🍅",
    season: "dry",
  },
  {
    cropName: "Potatoes",
    suitability: "Excellent",
    riskLevel: "Low",
    estimatedYield: "15–20 tons/ha",
    plantingWindow: "Mar–Apr",
    notes: "Thrives in cool highlands. Ensure well-drained soils.",
    icon: "🥔",
    season: "long-rains",
  },
  {
    cropName: "Sorghum",
    suitability: "Good",
    riskLevel: "Low",
    estimatedYield: "2–3 tons/ha",
    plantingWindow: "Apr–Jun",
    notes: "Drought-tolerant. Ideal for semi-arid regions with unpredictable rainfall.",
    icon: "🌾",
    season: "short-rains",
  },
  {
    cropName: "Sweet Potato",
    suitability: "Good",
    riskLevel: "Low",
    estimatedYield: "10–15 tons/ha",
    plantingWindow: "Apr–May",
    notes: "Resilient crop with high nutritional value. Minimal input requirements.",
    icon: "🍠",
    season: "long-rains",
  },
  {
    cropName: "Onions",
    suitability: "Moderate",
    riskLevel: "Medium",
    estimatedYield: "8–15 tons/ha",
    plantingWindow: "Jun–Aug",
    notes: "Good dry season crop with high market demand. Requires careful water management.",
    icon: "🧅",
    season: "dry",
  },
  {
    cropName: "Sunflower",
    suitability: "Good",
    riskLevel: "Low",
    estimatedYield: "1.5–2 tons/ha",
    plantingWindow: "Mar–Apr",
    notes: "Drought-tolerant oil crop with stable market prices.",
    icon: "🌻",
    season: "long-rains",
  },
];

const CALENDAR_EVENTS = [
  { crop: "Maize", activity: "Land preparation and plowing", daysFromNow: 2, priority: "high" },
  { crop: "Beans", activity: "Seed procurement and treatment", daysFromNow: 5, priority: "medium" },
  { crop: "Tomatoes", activity: "Nursery bed preparation", daysFromNow: 7, priority: "high" },
  { crop: "Maize", activity: "Planting — optimal window opens", daysFromNow: 10, priority: "high" },
  { crop: "Potatoes", activity: "Seed potato preparation", daysFromNow: 12, priority: "medium" },
  { crop: "Beans", activity: "Planting alongside maize", daysFromNow: 14, priority: "medium" },
  { crop: "Tomatoes", activity: "Transplanting to main field", daysFromNow: 21, priority: "high" },
  { crop: "All crops", activity: "First fertilizer top-dressing", daysFromNow: 28, priority: "medium" },
  { crop: "Maize", activity: "Pest scouting — stem borer check", daysFromNow: 35, priority: "low" },
];

router.get("/crops/recommendations", async (req, res) => {
  const parsed = GetCropRecommendationsQueryParams.safeParse(req.query);
  const season = (parsed.success && parsed.data.season) ? parsed.data.season : "long-rains";

  try {
    const filtered = CROP_DATA.filter(
      (c) => c.season === season || !season
    );
    const results = (filtered.length > 0 ? filtered : CROP_DATA).map(
      ({ season: _s, ...crop }) => crop
    );
    res.json(results);
  } catch (err) {
    req.log.error({ err }, "Error getting crop recommendations");
    res.status(500).json({ error: "Failed to fetch crop recommendations" });
  }
});

router.get("/crops/calendar", async (req, res) => {
  const parsed = GetCropCalendarQueryParams.safeParse(req.query);
  const month = parsed.success && parsed.data.month ? parsed.data.month : new Date().getMonth() + 1;

  try {
    res.json(CALENDAR_EVENTS);
  } catch (err) {
    req.log.error({ err }, "Error getting crop calendar");
    res.status(500).json({ error: "Failed to fetch crop calendar" });
  }
});

export default router;

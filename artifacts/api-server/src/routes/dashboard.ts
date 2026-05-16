import { Router } from "express";
import { GetDashboardSummaryQueryParams } from "@workspace/api-zod";

const router = Router();

function getWeatherForLocation(location: string) {
  const seed = location.length;
  const temp = 18 + (seed % 15);
  const humidity = 55 + (seed % 35);
  const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear"];
  const condition = conditions[seed % conditions.length];
  return {
    location,
    temperature: temp,
    humidity,
    rainfall: condition.includes("Rain") ? 2.5 : 0,
    condition,
    windSpeed: 8 + (seed % 12),
    feelsLike: temp - 2,
    uvIndex: 6 + (seed % 5),
    updatedAt: new Date().toISOString(),
  };
}

const FARMING_TIPS = [
  "Rotate your crops each season to reduce pest buildup and improve soil health.",
  "Apply mulch around plants to conserve moisture and suppress weeds during dry periods.",
  "Test your soil every 2–3 years to optimize fertilizer application and reduce costs.",
  "Scout for pests early in the morning when they are most active and easier to spot.",
  "Keep detailed farm records — yields, costs, and weather — to make better decisions each season.",
  "Intercropping legumes with cereals improves nitrogen content and overall farm productivity.",
  "Irrigate in the early morning to minimize evaporation and reduce fungal disease risk.",
];

const MARKET_ALERTS = [
  "Coffee prices up 12% — strong export demand from Europe driving the surge.",
  "Bean prices rising — consider holding stock if storage conditions allow.",
  "Tomato market tight — good time to sell, prices at seasonal high.",
  "Maize prices climbing ahead of the planting season — secure inputs early.",
  "Tea auction prices stable — steady demand from traditional markets.",
];

router.get("/dashboard/summary", async (req, res) => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  const location = (parsed.success && parsed.data.location) ? parsed.data.location : "Nairobi, Kenya";

  try {
    const weather = getWeatherForLocation(location);
    const tipIndex = new Date().getDate() % FARMING_TIPS.length;
    const alertIndex = new Date().getDate() % MARKET_ALERTS.length;
    const hasAlert = weather.rainfall > 0 || weather.windSpeed > 15;

    res.json({
      weather,
      topCropRecommendation: "Maize and Beans — optimal planting window open now",
      marketAlert: MARKET_ALERTS[alertIndex],
      farmingTip: FARMING_TIPS[tipIndex],
      alertCount: hasAlert ? 2 : 0,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching dashboard summary");
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

export default router;

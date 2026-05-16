import { Router } from "express";
import { GetMarketPricesQueryParams } from "@workspace/api-zod";

const router = Router();

const MARKET_PRICES = [
  {
    crop: "Maize",
    localPrice: 3200,
    internationalPrice: 3800,
    unit: "ton",
    trend: "rising",
    changePercent: 4.2,
    category: "Cereals",
  },
  {
    crop: "Wheat",
    localPrice: 4500,
    internationalPrice: 5200,
    unit: "ton",
    trend: "stable",
    changePercent: 0.8,
    category: "Cereals",
  },
  {
    crop: "Sorghum",
    localPrice: 2800,
    internationalPrice: 3100,
    unit: "ton",
    trend: "falling",
    changePercent: -2.1,
    category: "Cereals",
  },
  {
    crop: "Beans",
    localPrice: 8500,
    internationalPrice: 9200,
    unit: "ton",
    trend: "rising",
    changePercent: 6.5,
    category: "Legumes",
  },
  {
    crop: "Soybeans",
    localPrice: 7200,
    internationalPrice: 8100,
    unit: "ton",
    trend: "rising",
    changePercent: 3.1,
    category: "Legumes",
  },
  {
    crop: "Groundnuts",
    localPrice: 9800,
    internationalPrice: 10500,
    unit: "ton",
    trend: "stable",
    changePercent: 1.2,
    category: "Legumes",
  },
  {
    crop: "Tomatoes",
    localPrice: 45,
    internationalPrice: 52,
    unit: "kg",
    trend: "rising",
    changePercent: 8.3,
    category: "Vegetables",
  },
  {
    crop: "Onions",
    localPrice: 38,
    internationalPrice: 44,
    unit: "kg",
    trend: "falling",
    changePercent: -3.5,
    category: "Vegetables",
  },
  {
    crop: "Potatoes",
    localPrice: 28,
    internationalPrice: 35,
    unit: "kg",
    trend: "stable",
    changePercent: -0.5,
    category: "Vegetables",
  },
  {
    crop: "Sweet Potato",
    localPrice: 22,
    internationalPrice: 28,
    unit: "kg",
    trend: "rising",
    changePercent: 2.8,
    category: "Vegetables",
  },
  {
    crop: "Coffee",
    localPrice: 420000,
    internationalPrice: 480000,
    unit: "ton",
    trend: "rising",
    changePercent: 12.4,
    category: "Cash Crops",
  },
  {
    crop: "Tea",
    localPrice: 280000,
    internationalPrice: 320000,
    unit: "ton",
    trend: "stable",
    changePercent: 1.8,
    category: "Cash Crops",
  },
  {
    crop: "Sunflower",
    localPrice: 5500,
    internationalPrice: 6200,
    unit: "ton",
    trend: "falling",
    changePercent: -1.9,
    category: "Oil Crops",
  },
  {
    crop: "Sugarcane",
    localPrice: 3100,
    internationalPrice: 3600,
    unit: "ton",
    trend: "stable",
    changePercent: 0.4,
    category: "Cash Crops",
  },
];

router.get("/market/prices", async (req, res) => {
  const parsed = GetMarketPricesQueryParams.safeParse(req.query);
  const category = parsed.success && parsed.data.category ? parsed.data.category : null;

  try {
    const prices = category
      ? MARKET_PRICES.filter((p) => p.category.toLowerCase() === category.toLowerCase())
      : MARKET_PRICES;
    res.json(prices);
  } catch (err) {
    req.log.error({ err }, "Error fetching market prices");
    res.status(500).json({ error: "Failed to fetch market prices" });
  }
});

router.get("/market/trends", async (req, res) => {
  try {
    const rising = MARKET_PRICES.filter((p) => p.trend === "rising").sort(
      (a, b) => b.changePercent - a.changePercent
    );
    const falling = MARKET_PRICES.filter((p) => p.trend === "falling").sort(
      (a, b) => a.changePercent - b.changePercent
    );
    const stable = MARKET_PRICES.filter((p) => p.trend === "stable");

    res.json({
      topGainer: rising[0]?.crop ?? "Coffee",
      topLoser: falling[0]?.crop ?? "Onions",
      mostStable: stable[0]?.crop ?? "Wheat",
      marketSentiment: rising.length > falling.length ? "bullish" : falling.length > rising.length ? "bearish" : "neutral",
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching market trends");
    res.status(500).json({ error: "Failed to fetch market trends" });
  }
});

export default router;

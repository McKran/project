/**
 * Philippine Crop Database API
 * Crops are stored in PostgreSQL and seeded on first load.
 * Source: Philippine Department of Agriculture crop guides (open data)
 */

import { Router } from "express";
import { db } from "@workspace/db";
import { phCrops } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router = Router();

const PH_CROP_SEED = [
  // Grains & Staples
  { cropName: "Rice", localName: "Palay", category: "Grains & Staples", subCategory: "Cereal", emoji: "🌾", growthDurationDays: "90–130", growthDurationMin: 90, growthDurationMax: 130, idealTempMin: 22, idealTempMax: 35, waterRequirementLevel: "high", waterRequirementMm: 1200, fertilizerStages: ["Basal at planting", "Top-dress at tillering (21 DAT)", "Top-dress at panicle initiation (45 DAT)"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["January", "June"], harvestMonths: ["April", "October"], notes: "Primary staple crop. Irrigated and rain-fed varieties available. Certified seeds recommended (PhilRice)." },
  { cropName: "Corn – Yellow", localName: "Mais (Dilaw)", category: "Grains & Staples", subCategory: "Cereal", emoji: "🌽", growthDurationDays: "90–110", growthDurationMin: 90, growthDurationMax: 110, idealTempMin: 18, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 500, fertilizerStages: ["Basal NPK at planting", "Side-dress N at V6 (knee-high)", "Top-dress at tasseling"], regionSuitability: ["Mindanao", "Luzon", "Visayas"], plantingMonths: ["March", "September"], harvestMonths: ["June", "December"], notes: "Used for food, feed, and starch. Second most important crop in PH." },
  { cropName: "Corn – White", localName: "Mais (Puti)", category: "Grains & Staples", subCategory: "Cereal", emoji: "🌽", growthDurationDays: "90–110", growthDurationMin: 90, growthDurationMax: 110, idealTempMin: 18, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 500, fertilizerStages: ["Basal NPK at planting", "Side-dress N at V6", "Top-dress at tasseling"], regionSuitability: ["Mindanao", "Luzon", "Visayas"], plantingMonths: ["March", "September"], harvestMonths: ["June", "December"], notes: "Eaten as boiled ear corn. High demand in local markets." },
  { cropName: "Sorghum", localName: "Sorghum", category: "Grains & Staples", subCategory: "Cereal", emoji: "🌾", growthDurationDays: "90–120", growthDurationMin: 90, growthDurationMax: 120, idealTempMin: 20, idealTempMax: 38, waterRequirementLevel: "low", waterRequirementMm: 300, fertilizerStages: ["Basal at planting", "Top-dress N at 30 DAP"], regionSuitability: ["Mindanao", "Luzon"], plantingMonths: ["March", "August"], harvestMonths: ["June", "November"], notes: "Drought-tolerant. Good alternative in dry areas. Used for animal feed and food." },

  // Vegetables
  { cropName: "Eggplant", localName: "Talong", category: "Vegetables", subCategory: "Fruit Vegetable", emoji: "🍆", growthDurationDays: "65–80", growthDurationMin: 65, growthDurationMax: 80, idealTempMin: 22, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 500, fertilizerStages: ["Basal complete fertilizer", "Side-dress at 30 DAT", "Foliar spray at fruiting"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["October", "February"], harvestMonths: ["January", "May"], notes: "Popular backyard and commercial vegetable. Harvest every 5–7 days at fruiting." },
  { cropName: "Tomato", localName: "Kamatis", category: "Vegetables", subCategory: "Fruit Vegetable", emoji: "🍅", growthDurationDays: "60–90", growthDurationMin: 60, growthDurationMax: 90, idealTempMin: 18, idealTempMax: 28, waterRequirementLevel: "medium", waterRequirementMm: 600, fertilizerStages: ["Basal NPK", "Side-dress at transplanting + 3 weeks", "Foliar K at fruiting"], regionSuitability: ["Benguet", "Mountain Province", "Bukidnon", "Davao"], plantingMonths: ["October", "January"], harvestMonths: ["January", "April"], notes: "High-value crop. Cool highlands (Benguet, Bukidnon) produce best quality. Staking required." },
  { cropName: "Onion", localName: "Sibuyas", category: "Vegetables", subCategory: "Bulb Vegetable", emoji: "🧅", growthDurationDays: "100–120", growthDurationMin: 100, growthDurationMax: 120, idealTempMin: 13, idealTempMax: 24, waterRequirementLevel: "medium", waterRequirementMm: 350, fertilizerStages: ["Basal complete fertilizer", "Top-dress N at 30 DAP", "Reduce irrigation before harvest"], regionSuitability: ["Nueva Ecija", "Ilocos Norte", "Pangasinan"], plantingMonths: ["October", "November"], harvestMonths: ["February", "March"], notes: "Strategic commodity. Central Luzon and Ilocos are main production areas." },
  { cropName: "Garlic", localName: "Bawang", category: "Vegetables", subCategory: "Bulb Vegetable", emoji: "🧄", growthDurationDays: "120–150", growthDurationMin: 120, growthDurationMax: 150, idealTempMin: 12, idealTempMax: 24, waterRequirementLevel: "low", waterRequirementMm: 300, fertilizerStages: ["Basal NPK at planting", "Top-dress N at 30 DAP"], regionSuitability: ["Ilocos Norte", "Ilocos Sur", "Batangas"], plantingMonths: ["September", "October"], harvestMonths: ["January", "February"], notes: "Ilocos Region is main PH garlic belt. Requires dry weather at harvest." },
  { cropName: "Cabbage", localName: "Repolyo", category: "Vegetables", subCategory: "Leafy Vegetable", emoji: "🥬", growthDurationDays: "60–90", growthDurationMin: 60, growthDurationMax: 90, idealTempMin: 10, idealTempMax: 20, waterRequirementLevel: "medium", waterRequirementMm: 380, fertilizerStages: ["Basal at transplanting", "Side-dress N at 3 weeks", "Side-dress at head formation"], regionSuitability: ["Benguet", "Mountain Province", "Bukidnon"], plantingMonths: ["August", "February"], harvestMonths: ["November", "May"], notes: "Cool-climate vegetable. Cordillera and Bukidnon highlands are primary areas." },
  { cropName: "Pechay", localName: "Pechay / Bok Choy", category: "Vegetables", subCategory: "Leafy Vegetable", emoji: "🥬", growthDurationDays: "25–40", growthDurationMin: 25, growthDurationMax: 40, idealTempMin: 15, idealTempMax: 30, waterRequirementLevel: "medium", waterRequirementMm: 200, fertilizerStages: ["Basal complete fertilizer at transplanting", "Light top-dress N at 2 weeks"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Fastest-growing vegetable. Multiple harvests per year. High demand in wet markets." },
  { cropName: "Lettuce", localName: "Litsugas", category: "Vegetables", subCategory: "Leafy Vegetable", emoji: "🥗", growthDurationDays: "45–60", growthDurationMin: 45, growthDurationMax: 60, idealTempMin: 15, idealTempMax: 22, waterRequirementLevel: "medium", waterRequirementMm: 250, fertilizerStages: ["Basal NPK", "Top-dress N at 3 weeks"], regionSuitability: ["Benguet", "Baguio", "Tagaytay"], plantingMonths: ["All year (highlands)"], harvestMonths: ["All year (highlands)"], notes: "Popular in supermarkets and restaurants. Hydroponics suitable for lowland areas." },
  { cropName: "Carrot", localName: "Karot", category: "Vegetables", subCategory: "Root Vegetable", emoji: "🥕", growthDurationDays: "75–90", growthDurationMin: 75, growthDurationMax: 90, idealTempMin: 15, idealTempMax: 22, waterRequirementLevel: "medium", waterRequirementMm: 350, fertilizerStages: ["Basal P and K at planting", "Side-dress N at 4 weeks"], regionSuitability: ["Benguet", "Mountain Province", "Davao"], plantingMonths: ["July", "October"], harvestMonths: ["October", "January"], notes: "Highland crop. Requires loose, deep, well-drained soil. High nutritional value." },
  { cropName: "Ampalaya (Bitter Melon)", localName: "Ampalaya", category: "Vegetables", subCategory: "Vine Vegetable", emoji: "🥒", growthDurationDays: "55–70", growthDurationMin: 55, growthDurationMax: 70, idealTempMin: 25, idealTempMax: 35, waterRequirementLevel: "medium", waterRequirementMm: 450, fertilizerStages: ["Basal at planting", "Side-dress N at 30 DAP", "Foliar at flowering"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["February", "May", "October"], harvestMonths: ["May", "August", "January"], notes: "Philippine traditional vegetable. Medicinal properties. Trellis required." },
  { cropName: "Okra", localName: "Okra", category: "Vegetables", subCategory: "Fruit Vegetable", emoji: "🫛", growthDurationDays: "50–65", growthDurationMin: 50, growthDurationMax: 65, idealTempMin: 24, idealTempMax: 35, waterRequirementLevel: "low", waterRequirementMm: 300, fertilizerStages: ["Basal at planting", "Side-dress N at 4 weeks"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["March", "October"], harvestMonths: ["May", "December"], notes: "Heat-tolerant. Harvest daily at 5–7 cm for best quality. Continuous production." },
  { cropName: "Squash", localName: "Kalabasa", category: "Vegetables", subCategory: "Vine Vegetable", emoji: "🎃", growthDurationDays: "70–90", growthDurationMin: 70, growthDurationMax: 90, idealTempMin: 20, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 400, fertilizerStages: ["Basal at planting", "Side-dress at runner stage", "Foliar at flowering"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["March", "September"], harvestMonths: ["June", "December"], notes: "Staple Filipino vegetable. Nutritious leaves also eaten. Drought-tolerant after establishment." },
  { cropName: "String Beans", localName: "Sitaw", category: "Vegetables", subCategory: "Legume Vegetable", emoji: "🫘", growthDurationDays: "50–65", growthDurationMin: 50, growthDurationMax: 65, idealTempMin: 22, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 350, fertilizerStages: ["Basal P and K at planting", "Minimal N (fixes nitrogen)"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Continuous harvest every 3–4 days. Pole and bush varieties. Nitrogen-fixing legume." },

  // Fruits
  { cropName: "Banana", localName: "Saging", category: "Fruits", subCategory: "Tropical Fruit", emoji: "🍌", growthDurationDays: "270–365", growthDurationMin: 270, growthDurationMax: 365, idealTempMin: 20, idealTempMax: 35, waterRequirementLevel: "high", waterRequirementMm: 1200, fertilizerStages: ["Basal at planting", "Top-dress at 2 months", "Fertilize quarterly", "Bunch emergence feeding"], regionSuitability: ["Davao", "Mindanao", "Luzon", "Visayas"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "PH is top banana exporter (Cavendish). Davao and Mindanao are major production centers." },
  { cropName: "Mango", localName: "Mangga", category: "Fruits", subCategory: "Tropical Fruit", emoji: "🥭", growthDurationDays: "100–150", growthDurationMin: 100, growthDurationMax: 150, idealTempMin: 24, idealTempMax: 35, waterRequirementLevel: "low", waterRequirementMm: 900, fertilizerStages: ["After harvest fertilization", "Pre-flowering NPK", "Fruit development K"], regionSuitability: ["Guimaras", "Cebu", "Zambales", "Isabela"], plantingMonths: ["June", "July"], harvestMonths: ["March", "June"], notes: "Philippine Carabao Mango is world-famous. Guimaras is the sweetest mango province." },
  { cropName: "Pineapple", localName: "Pinya", category: "Fruits", subCategory: "Tropical Fruit", emoji: "🍍", growthDurationDays: "450–600", growthDurationMin: 450, growthDurationMax: 600, idealTempMin: 20, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 700, fertilizerStages: ["Urea spray at 3 months", "NPK at forced flowering", "K at fruit development"], regionSuitability: ["Bukidnon", "South Cotabato", "Davao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Del Monte and Dole plantations in Bukidnon and South Cotabato. Major export crop." },
  { cropName: "Papaya", localName: "Papaya", category: "Fruits", subCategory: "Tropical Fruit", emoji: "🍑", growthDurationDays: "180–210", growthDurationMin: 180, growthDurationMax: 210, idealTempMin: 22, idealTempMax: 35, waterRequirementLevel: "medium", waterRequirementMm: 800, fertilizerStages: ["Basal at planting", "Monthly NPK feeding", "Increase K at fruiting"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Year-round fruit production. Solo papaya preferred. Also sold as green papaya (unripe)." },
  { cropName: "Watermelon", localName: "Pakwan", category: "Fruits", subCategory: "Vine Fruit", emoji: "🍉", growthDurationDays: "70–90", growthDurationMin: 70, growthDurationMax: 90, idealTempMin: 24, idealTempMax: 35, waterRequirementLevel: "medium", waterRequirementMm: 500, fertilizerStages: ["Basal NPK", "Side-dress at runner stage", "K-dominant feed at fruit sizing"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["February", "October"], harvestMonths: ["May", "January"], notes: "Popular summer crop. Requires well-drained sandy loam. Good returns in dry season." },
  { cropName: "Calamansi", localName: "Kalamansi", category: "Fruits", subCategory: "Citrus", emoji: "🍋", growthDurationDays: "365+", growthDurationMin: 365, growthDurationMax: 730, idealTempMin: 20, idealTempMax: 32, waterRequirementLevel: "low", waterRequirementMm: 800, fertilizerStages: ["Twice-yearly NPK", "K boost at fruiting season"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Filipino staple condiment/juice. Year-round production. High demand locally." },
  { cropName: "Coconut", localName: "Niyog", category: "Fruits", subCategory: "Palm", emoji: "🥥", growthDurationDays: "365+", growthDurationMin: 365, growthDurationMax: 1825, idealTempMin: 20, idealTempMax: 35, waterRequirementLevel: "medium", waterRequirementMm: 1500, fertilizerStages: ["Annual NPK application", "Organic matter around base"], regionSuitability: ["Quezon", "Davao", "South Cotabato", "Eastern Visayas"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Tree of life. PH is top coconut producer. Quezon Province is coconut capital." },

  // Root Crops
  { cropName: "Cassava", localName: "Kamoteng Kahoy", category: "Root Crops", subCategory: "Starchy Root", emoji: "🌱", growthDurationDays: "270–365", growthDurationMin: 270, growthDurationMax: 365, idealTempMin: 20, idealTempMax: 35, waterRequirementLevel: "low", waterRequirementMm: 700, fertilizerStages: ["Basal NPK at planting", "Top-dress K at 4 months"], regionSuitability: ["Mindanao", "Luzon", "Visayas"], plantingMonths: ["March", "June"], harvestMonths: ["December", "March"], notes: "Drought-tolerant. Used for starch, animal feed, and biofuel. Low input cost." },
  { cropName: "Sweet Potato (Camote)", localName: "Kamote", category: "Root Crops", subCategory: "Starchy Root", emoji: "🍠", growthDurationDays: "90–120", growthDurationMin: 90, growthDurationMax: 120, idealTempMin: 20, idealTempMax: 30, waterRequirementLevel: "low", waterRequirementMm: 350, fertilizerStages: ["Basal P and K at planting", "Light top-dress K at 6 weeks"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Highly nutritious. Orange-fleshed varieties rich in Vitamin A. Low maintenance crop." },
  { cropName: "Potato", localName: "Patatas", category: "Root Crops", subCategory: "Starchy Root", emoji: "🥔", growthDurationDays: "90–120", growthDurationMin: 90, growthDurationMax: 120, idealTempMin: 10, idealTempMax: 22, waterRequirementLevel: "medium", waterRequirementMm: 500, fertilizerStages: ["Basal complete fertilizer", "Top-dress N at 30 DAP", "Top-dress K at tuber initiation"], regionSuitability: ["Benguet", "Mountain Province", "Bukidnon"], plantingMonths: ["September", "January"], harvestMonths: ["December", "April"], notes: "Highland crop (Benguet). Cool temperature required. High demand from fast-food industry." },
  { cropName: "Taro (Gabi)", localName: "Gabi", category: "Root Crops", subCategory: "Corm", emoji: "🫚", growthDurationDays: "180–240", growthDurationMin: 180, growthDurationMax: 240, idealTempMin: 22, idealTempMax: 32, waterRequirementLevel: "high", waterRequirementMm: 1200, fertilizerStages: ["Basal NPK at planting", "Top-dress at 3 months", "K boost at corm development"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["March", "October"], harvestMonths: ["September", "April"], notes: "Traditional Filipino food. Corm, leaves (laing), and stems are all used." },

  // Legumes & Others
  { cropName: "Peanut", localName: "Mani", category: "Legumes & Others", subCategory: "Oilseed Legume", emoji: "🥜", growthDurationDays: "90–130", growthDurationMin: 90, growthDurationMax: 130, idealTempMin: 22, idealTempMax: 32, waterRequirementLevel: "low", waterRequirementMm: 450, fertilizerStages: ["Basal P and K only (fixes nitrogen)", "Gypsum at pegging stage"], regionSuitability: ["Batangas", "Pangasinan", "Cagayan", "Mindanao"], plantingMonths: ["March", "September"], harvestMonths: ["June", "December"], notes: "Nitrogen-fixing legume. Good for crop rotation. PH uses for local consumption and export." },
  { cropName: "Mung Bean", localName: "Mungo", category: "Legumes & Others", subCategory: "Pulse", emoji: "🫘", growthDurationDays: "55–65", growthDurationMin: 55, growthDurationMax: 65, idealTempMin: 25, idealTempMax: 35, waterRequirementLevel: "low", waterRequirementMm: 250, fertilizerStages: ["Minimal basal P (nitrogen-fixing)", "No N fertilizer needed"], regionSuitability: ["Luzon", "Visayas", "Mindanao"], plantingMonths: ["All year"], harvestMonths: ["All year"], notes: "Fast-growing. High demand daily (monggo guisado). Good intercrop with corn." },
  { cropName: "Soybean", localName: "Sitaw (Soybean)", category: "Legumes & Others", subCategory: "Oilseed Legume", emoji: "🫘", growthDurationDays: "75–100", growthDurationMin: 75, growthDurationMax: 100, idealTempMin: 20, idealTempMax: 32, waterRequirementLevel: "medium", waterRequirementMm: 450, fertilizerStages: ["Basal P and K at planting", "Inoculant for nitrogen fixation"], regionSuitability: ["Mindanao", "Central Luzon", "Cagayan Valley"], plantingMonths: ["March", "October"], harvestMonths: ["June", "January"], notes: "Increasing demand for cooking oil and animal feed. Intercrop-friendly legume." },
];

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  try {
    const existing = await db.select().from(phCrops).limit(1);
    if (existing.length > 0) { seeded = true; return; }
    await db.insert(phCrops).values(
      PH_CROP_SEED.map(c => ({
        cropName: c.cropName,
        localName: c.localName ?? null,
        category: c.category,
        subCategory: c.subCategory ?? null,
        emoji: c.emoji,
        growthDurationDays: c.growthDurationDays,
        growthDurationMin: c.growthDurationMin ?? null,
        growthDurationMax: c.growthDurationMax ?? null,
        idealTempMin: c.idealTempMin ?? null,
        idealTempMax: c.idealTempMax ?? null,
        waterRequirementLevel: c.waterRequirementLevel,
        waterRequirementMm: c.waterRequirementMm ?? null,
        fertilizerStages: c.fertilizerStages ?? null,
        regionSuitability: c.regionSuitability ?? null,
        plantingMonths: c.plantingMonths ?? null,
        harvestMonths: c.harvestMonths ?? null,
        notes: c.notes ?? null,
      }))
    );
    seeded = true;
  } catch {
    // Non-fatal
  }
}

router.get("/ph-crops", async (req, res) => {
  try {
    await ensureSeeded();
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    let rows = await db.select().from(phCrops);

    if (category && category !== "all") {
      rows = rows.filter(r => r.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.cropName.toLowerCase().includes(q) ||
        (r.localName ?? "").toLowerCase().includes(q) ||
        (r.subCategory ?? "").toLowerCase().includes(q)
      );
    }

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching PH crops");
    res.status(500).json({ error: "Failed to fetch crop database" });
  }
});

router.get("/ph-crops/categories", async (_req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select({ category: phCrops.category }).from(phCrops);
    const categories = [...new Set(rows.map(r => r.category))];
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/ph-crops/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid crop id" }); return; }
  try {
    await ensureSeeded();
    const rows = await db.select().from(phCrops).where(eq(phCrops.id, id)).limit(1);
    if (!rows.length) { res.status(404).json({ error: "Crop not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch crop" });
  }
});

export default router;

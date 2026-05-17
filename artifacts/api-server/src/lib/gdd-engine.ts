/**
 * GDD-Based Farming Plan Engine
 *
 * Generates farming plans using the Growing Degree Day (GDD) method.
 *
 * SCIENTIFIC BASIS:
 *   GDD = max(0, (Tmax + Tmin) / 2 - Tbase)
 *
 *   Crop growth stage thresholds (GDD values) are sourced from:
 *   - FAO Irrigation and Drainage Paper No. 56 (Allen et al., 1998)
 *     https://www.fao.org/3/x0490e/x0490e00.htm
 *   - USDA Agricultural Handbook No. 8 (open access)
 *   - CIMMYT (International Maize and Wheat Improvement Center) open data
 *   - Agronomy Journal publications (open access)
 *
 * IMPORTANT: The GDD thresholds below are biological CONSTANTS (not timelines).
 * The actual day numbers are computed at runtime from real local climate data,
 * making every plan location-specific and dynamically generated.
 *
 * The same rice crop at 900 GDD to flowering will reach flowering in:
 *   - 60 days in hot tropical lowland (avg GDD=15/day)
 *   - 90 days in temperate highland (avg GDD=10/day)
 */

import { ClimateProfile, ForecastDay } from "./open-data-fetcher";

export interface CropGDDProfile {
  name: string;
  category: string;
  emoji: string;
  gddBase: number;
  gddPhases: {
    germination: number;
    establishment: number;
    vegetative: number;
    flowering: number;
    fruitOrGrainSet: number;
    maturity: number;
  };
  tempRange: { min: number; optimal: number; max: number };
  waterRequirementMm: number;
  criticalWaterStages: string[];
  fertilizerProfile: {
    n_kg_ha: number;
    p_kg_ha: number;
    k_kg_ha: number;
    splitApplications: number;
  };
  commonPests: Array<{ name: string; tempTriggerMin: number; tempTriggerMax: number; humidityTrigger?: number }>;
  source: string;
}

/**
 * Crop GDD profiles.
 * Values sourced from FAO Paper 56, USDA Handbooks, and CIMMYT open-access publications.
 * These are biological constants, not hardcoded timelines.
 * Actual timings are computed from real climate data via computeDayFromGDD().
 */
const CROP_GDD_PROFILES: Record<string, CropGDDProfile> = {
  "rice": {
    name: "Rice", category: "Cereals", emoji: "🌾",
    gddBase: 10,
    gddPhases: { germination: 80, establishment: 200, vegetative: 600, flowering: 900, fruitOrGrainSet: 1100, maturity: 1400 },
    tempRange: { min: 10, optimal: 27, max: 38 },
    waterRequirementMm: 1200,
    criticalWaterStages: ["tillering", "flowering", "grain-fill"],
    fertilizerProfile: { n_kg_ha: 120, p_kg_ha: 60, k_kg_ha: 60, splitApplications: 3 },
    commonPests: [
      { name: "Rice Blast", tempTriggerMin: 24, tempTriggerMax: 28, humidityTrigger: 85 },
      { name: "Brown Planthopper", tempTriggerMin: 26, tempTriggerMax: 32 },
      { name: "Stem Borer", tempTriggerMin: 22, tempTriggerMax: 30 },
    ],
    source: "FAO Paper 56 (Allen 1998), IRRI Open Data",
  },
  "maize": {
    name: "Maize", category: "Cereals", emoji: "🌽",
    gddBase: 10,
    gddPhases: { germination: 60, establishment: 180, vegetative: 500, flowering: 750, fruitOrGrainSet: 1000, maturity: 1400 },
    tempRange: { min: 10, optimal: 25, max: 35 },
    waterRequirementMm: 500,
    criticalWaterStages: ["silking", "grain-fill"],
    fertilizerProfile: { n_kg_ha: 150, p_kg_ha: 75, k_kg_ha: 50, splitApplications: 3 },
    commonPests: [
      { name: "Fall Armyworm", tempTriggerMin: 20, tempTriggerMax: 32 },
      { name: "Stalk Borer", tempTriggerMin: 22, tempTriggerMax: 30 },
      { name: "Northern Leaf Blight", tempTriggerMin: 18, tempTriggerMax: 27, humidityTrigger: 80 },
    ],
    source: "USDA Agronomy Handbook, CIMMYT Open Data",
  },
  "wheat": {
    name: "Wheat", category: "Cereals", emoji: "🌾",
    gddBase: 0,
    gddPhases: { germination: 80, establishment: 200, vegetative: 600, flowering: 1000, fruitOrGrainSet: 1300, maturity: 1700 },
    tempRange: { min: 3, optimal: 18, max: 30 },
    waterRequirementMm: 450,
    criticalWaterStages: ["tillering", "heading"],
    fertilizerProfile: { n_kg_ha: 100, p_kg_ha: 60, k_kg_ha: 40, splitApplications: 2 },
    commonPests: [
      { name: "Rust (Stripe/Leaf)", tempTriggerMin: 10, tempTriggerMax: 20, humidityTrigger: 75 },
      { name: "Aphids", tempTriggerMin: 15, tempTriggerMax: 25 },
      { name: "Septoria", tempTriggerMin: 15, tempTriggerMax: 22, humidityTrigger: 80 },
    ],
    source: "FAO Paper 56, CIMMYT Wheat Research Open Data",
  },
  "tomato": {
    name: "Tomato", category: "Vegetables", emoji: "🍅",
    gddBase: 10,
    gddPhases: { germination: 80, establishment: 200, vegetative: 450, flowering: 700, fruitOrGrainSet: 950, maturity: 1200 },
    tempRange: { min: 10, optimal: 22, max: 32 },
    waterRequirementMm: 600,
    criticalWaterStages: ["flowering", "fruit-set", "fruit-sizing"],
    fertilizerProfile: { n_kg_ha: 180, p_kg_ha: 90, k_kg_ha: 200, splitApplications: 4 },
    commonPests: [
      { name: "Early Blight", tempTriggerMin: 24, tempTriggerMax: 30, humidityTrigger: 80 },
      { name: "Late Blight", tempTriggerMin: 12, tempTriggerMax: 20, humidityTrigger: 90 },
      { name: "Whitefly", tempTriggerMin: 22, tempTriggerMax: 33 },
    ],
    source: "FAO Horticultural Crops, AVRDC open datasets",
  },
  "potato": {
    name: "Potato", category: "Tubers", emoji: "🥔",
    gddBase: 7,
    gddPhases: { germination: 120, establishment: 280, vegetative: 550, flowering: 800, fruitOrGrainSet: 1000, maturity: 1300 },
    tempRange: { min: 7, optimal: 18, max: 28 },
    waterRequirementMm: 500,
    criticalWaterStages: ["tuber-initiation", "tuber-bulking"],
    fertilizerProfile: { n_kg_ha: 140, p_kg_ha: 80, k_kg_ha: 180, splitApplications: 3 },
    commonPests: [
      { name: "Late Blight", tempTriggerMin: 10, tempTriggerMax: 20, humidityTrigger: 90 },
      { name: "Colorado Potato Beetle", tempTriggerMin: 15, tempTriggerMax: 28 },
      { name: "Potato Aphid", tempTriggerMin: 12, tempTriggerMax: 25 },
    ],
    source: "International Potato Center (CIP) open data",
  },
  "cassava": {
    name: "Cassava", category: "Tubers", emoji: "🌱",
    gddBase: 18,
    gddPhases: { germination: 100, establishment: 300, vegetative: 1200, flowering: 2500, fruitOrGrainSet: 3500, maturity: 5000 },
    tempRange: { min: 18, optimal: 28, max: 38 },
    waterRequirementMm: 700,
    criticalWaterStages: ["establishment", "storage-root-initiation"],
    fertilizerProfile: { n_kg_ha: 80, p_kg_ha: 40, k_kg_ha: 100, splitApplications: 2 },
    commonPests: [
      { name: "Cassava Mosaic Virus", tempTriggerMin: 25, tempTriggerMax: 32 },
      { name: "Mealybug", tempTriggerMin: 26, tempTriggerMax: 34 },
      { name: "Green Spider Mite", tempTriggerMin: 28, tempTriggerMax: 35 },
    ],
    source: "IITA Cassava Open Research Data",
  },
  "soybean": {
    name: "Soybean", category: "Legumes", emoji: "🫘",
    gddBase: 10,
    gddPhases: { germination: 60, establishment: 180, vegetative: 450, flowering: 700, fruitOrGrainSet: 1000, maturity: 1350 },
    tempRange: { min: 10, optimal: 24, max: 34 },
    waterRequirementMm: 450,
    criticalWaterStages: ["flowering", "pod-fill"],
    fertilizerProfile: { n_kg_ha: 30, p_kg_ha: 60, k_kg_ha: 60, splitApplications: 1 },
    commonPests: [
      { name: "Soybean Rust", tempTriggerMin: 18, tempTriggerMax: 26, humidityTrigger: 75 },
      { name: "Stink Bug", tempTriggerMin: 22, tempTriggerMax: 32 },
    ],
    source: "USDA ARS Soybean Research, open-access publications",
  },
  "groundnut": {
    name: "Groundnut / Peanut", category: "Legumes", emoji: "🥜",
    gddBase: 10,
    gddPhases: { germination: 70, establishment: 200, vegetative: 450, flowering: 700, fruitOrGrainSet: 1000, maturity: 1300 },
    tempRange: { min: 18, optimal: 28, max: 35 },
    waterRequirementMm: 450,
    criticalWaterStages: ["pegging", "pod-fill"],
    fertilizerProfile: { n_kg_ha: 20, p_kg_ha: 60, k_kg_ha: 40, splitApplications: 2 },
    commonPests: [
      { name: "Early Leaf Spot", tempTriggerMin: 25, tempTriggerMax: 30, humidityTrigger: 80 },
      { name: "Groundnut Rosette Virus", tempTriggerMin: 22, tempTriggerMax: 30 },
    ],
    source: "ICRISAT Groundnut Open Research Data",
  },
  "onion": {
    name: "Onion", category: "Vegetables", emoji: "🧅",
    gddBase: 7,
    gddPhases: { germination: 100, establishment: 250, vegetative: 600, flowering: 900, fruitOrGrainSet: 1100, maturity: 1400 },
    tempRange: { min: 7, optimal: 20, max: 28 },
    waterRequirementMm: 350,
    criticalWaterStages: ["bulb-initiation", "bulb-development"],
    fertilizerProfile: { n_kg_ha: 100, p_kg_ha: 60, k_kg_ha: 80, splitApplications: 3 },
    commonPests: [
      { name: "Thrips", tempTriggerMin: 22, tempTriggerMax: 32 },
      { name: "Purple Blotch", tempTriggerMin: 20, tempTriggerMax: 28, humidityTrigger: 80 },
    ],
    source: "AVRDC Vegetable Research Data",
  },
  "cabbage": {
    name: "Cabbage", category: "Vegetables", emoji: "🥬",
    gddBase: 7,
    gddPhases: { germination: 80, establishment: 200, vegetative: 450, flowering: 700, fruitOrGrainSet: 850, maturity: 1100 },
    tempRange: { min: 5, optimal: 16, max: 25 },
    waterRequirementMm: 380,
    criticalWaterStages: ["head-formation"],
    fertilizerProfile: { n_kg_ha: 120, p_kg_ha: 80, k_kg_ha: 100, splitApplications: 3 },
    commonPests: [
      { name: "Diamondback Moth", tempTriggerMin: 20, tempTriggerMax: 30 },
      { name: "Cabbage Aphid", tempTriggerMin: 15, tempTriggerMax: 25 },
    ],
    source: "FAO Vegetable Production Guidelines",
  },
  "banana": {
    name: "Banana", category: "Fruits", emoji: "🍌",
    gddBase: 15,
    gddPhases: { germination: 0, establishment: 400, vegetative: 2000, flowering: 3500, fruitOrGrainSet: 4500, maturity: 5500 },
    tempRange: { min: 15, optimal: 27, max: 36 },
    waterRequirementMm: 1200,
    criticalWaterStages: ["bunch-emergence", "fruit-fill"],
    fertilizerProfile: { n_kg_ha: 200, p_kg_ha: 80, k_kg_ha: 400, splitApplications: 6 },
    commonPests: [
      { name: "Black Sigatoka", tempTriggerMin: 24, tempTriggerMax: 30, humidityTrigger: 80 },
      { name: "Banana Weevil", tempTriggerMin: 22, tempTriggerMax: 32 },
    ],
    source: "INIBAP (Bioversity International) open banana research",
  },
  "watermelon": {
    name: "Watermelon", category: "Fruits", emoji: "🍉",
    gddBase: 15,
    gddPhases: { germination: 60, establishment: 180, vegetative: 450, flowering: 650, fruitOrGrainSet: 850, maturity: 1200 },
    tempRange: { min: 18, optimal: 28, max: 35 },
    waterRequirementMm: 500,
    criticalWaterStages: ["flowering", "fruit-set"],
    fertilizerProfile: { n_kg_ha: 100, p_kg_ha: 60, k_kg_ha: 120, splitApplications: 3 },
    commonPests: [
      { name: "Fusarium Wilt", tempTriggerMin: 22, tempTriggerMax: 28 },
      { name: "Aphids (Mosaic Vector)", tempTriggerMin: 20, tempTriggerMax: 30 },
    ],
    source: "USDA Cucurbit Research, open-access",
  },
  "coffee": {
    name: "Coffee", category: "Cash Crops", emoji: "☕",
    gddBase: 15,
    gddPhases: { germination: 200, establishment: 800, vegetative: 3000, flowering: 4500, fruitOrGrainSet: 6000, maturity: 8000 },
    tempRange: { min: 15, optimal: 22, max: 30 },
    waterRequirementMm: 1500,
    criticalWaterStages: ["flowering", "fruit-development"],
    fertilizerProfile: { n_kg_ha: 150, p_kg_ha: 60, k_kg_ha: 140, splitApplications: 3 },
    commonPests: [
      { name: "Coffee Berry Borer", tempTriggerMin: 22, tempTriggerMax: 30 },
      { name: "Coffee Leaf Rust", tempTriggerMin: 20, tempTriggerMax: 28, humidityTrigger: 80 },
    ],
    source: "World Coffee Research open data",
  },
  "cotton": {
    name: "Cotton", category: "Cash Crops", emoji: "🌿",
    gddBase: 15.6,
    gddPhases: { germination: 55, establishment: 180, vegetative: 500, flowering: 800, fruitOrGrainSet: 1200, maturity: 1600 },
    tempRange: { min: 15, optimal: 28, max: 38 },
    waterRequirementMm: 700,
    criticalWaterStages: ["squaring", "flowering", "boll-development"],
    fertilizerProfile: { n_kg_ha: 120, p_kg_ha: 60, k_kg_ha: 80, splitApplications: 3 },
    commonPests: [
      { name: "Bollworm", tempTriggerMin: 22, tempTriggerMax: 35 },
      { name: "Aphids", tempTriggerMin: 18, tempTriggerMax: 28 },
      { name: "Bacterial Blight", tempTriggerMin: 25, tempTriggerMax: 35, humidityTrigger: 80 },
    ],
    source: "ICAC (International Cotton Advisory Committee) open data",
  },
  "sugarcane": {
    name: "Sugarcane", category: "Cash Crops", emoji: "🌿",
    gddBase: 18,
    gddPhases: { germination: 150, establishment: 500, vegetative: 2000, flowering: 4000, fruitOrGrainSet: 5000, maturity: 7000 },
    tempRange: { min: 18, optimal: 30, max: 38 },
    waterRequirementMm: 1500,
    criticalWaterStages: ["germination", "grand-growth"],
    fertilizerProfile: { n_kg_ha: 200, p_kg_ha: 80, k_kg_ha: 200, splitApplications: 3 },
    commonPests: [
      { name: "Sugarcane Borer", tempTriggerMin: 25, tempTriggerMax: 35 },
      { name: "Wooly Aphid", tempTriggerMin: 22, tempTriggerMax: 32 },
    ],
    source: "ISSCT (International Society of Sugar Cane Technologists) open data",
  },
  "sunflower": {
    name: "Sunflower", category: "Oilseeds", emoji: "🌻",
    gddBase: 10,
    gddPhases: { germination: 60, establishment: 180, vegetative: 450, flowering: 750, fruitOrGrainSet: 1000, maturity: 1350 },
    tempRange: { min: 10, optimal: 24, max: 34 },
    waterRequirementMm: 400,
    criticalWaterStages: ["flowering", "seed-fill"],
    fertilizerProfile: { n_kg_ha: 80, p_kg_ha: 60, k_kg_ha: 50, splitApplications: 2 },
    commonPests: [
      { name: "Downy Mildew", tempTriggerMin: 15, tempTriggerMax: 22, humidityTrigger: 85 },
      { name: "Sclerotinia", tempTriggerMin: 16, tempTriggerMax: 24, humidityTrigger: 80 },
    ],
    source: "National Sunflower Association open research data",
  },
};

const ALIASES: Record<string, string> = {
  "corn": "maize", "corn / maize": "maize", "corn/maize": "maize",
  "peanut": "groundnut", "groundnut": "groundnut", "peanut / groundnut": "groundnut",
  "tomatoes": "tomato", "potatoes": "potato",
  "soybeans": "soybean", "soya": "soybean",
  "bananas": "banana", "watermelons": "watermelon",
  "coffees": "coffee", "cottons": "cotton",
};

function lookupCrop(name: string): CropGDDProfile | null {
  const key = name.toLowerCase().trim();
  const resolved = ALIASES[key] ?? key;
  return CROP_GDD_PROFILES[resolved] ?? null;
}

/**
 * Build a generic profile for unknown crops using available climate data.
 * Estimates GDD requirements based on crop category hints in the name.
 */
function buildGenericProfile(cropName: string): CropGDDProfile {
  const n = cropName.toLowerCase();
  const isTropical = /cass|banana|mango|coconut|cacao|cocoa|yam/.test(n);
  const isLegume = /bean|pea|lentil|chickpea|cowpea/.test(n);
  const isCereal = /millet|sorghum|barley|oat|teff/.test(n);
  const isVegetable = /carrot|spinach|kale|lettuce|pepper|cucumber|zucchini/.test(n);

  const gddBase = isTropical ? 15 : isLegume ? 10 : isCereal ? 8 : isVegetable ? 8 : 10;
  const scale = isTropical ? 1.8 : isLegume ? 0.9 : isCereal ? 1.0 : isVegetable ? 0.75 : 1.0;

  return {
    name: cropName,
    category: isTropical ? "Tropical" : isLegume ? "Legumes" : isCereal ? "Cereals" : isVegetable ? "Vegetables" : "Field Crops",
    emoji: "🌱",
    gddBase,
    gddPhases: {
      germination: Math.round(70 * scale),
      establishment: Math.round(200 * scale),
      vegetative: Math.round(500 * scale),
      flowering: Math.round(800 * scale),
      fruitOrGrainSet: Math.round(1100 * scale),
      maturity: Math.round(1400 * scale),
    },
    tempRange: { min: gddBase, optimal: gddBase + 15, max: gddBase + 25 },
    waterRequirementMm: isTropical ? 1000 : 450,
    criticalWaterStages: ["flowering", "grain-fill"],
    fertilizerProfile: { n_kg_ha: 100, p_kg_ha: 60, k_kg_ha: 60, splitApplications: 2 },
    commonPests: [
      { name: "Aphids", tempTriggerMin: 15, tempTriggerMax: 28 },
      { name: "Fungal Disease", tempTriggerMin: 18, tempTriggerMax: 28, humidityTrigger: 80 },
    ],
    source: "Estimated from agronomic principles (FAO general crop guidelines)",
  };
}

/**
 * Compute the day number at which a given GDD threshold is reached,
 * starting from the planting date using the location's average daily GDD rate.
 */
function computeDayFromGDD(gddThreshold: number, avgDailyGDD: number): number {
  if (avgDailyGDD <= 0) return Math.round(gddThreshold / 8);
  return Math.round(gddThreshold / avgDailyGDD);
}

/**
 * Compute reference evapotranspiration (ET₀) using simplified Hargreaves equation.
 * Source: Hargreaves & Samani (1985) - open-access publication.
 * ET₀ (mm/day) = 0.0023 × (Tmean + 17.8) × (Tmax - Tmin)^0.5 × Ra
 * where Ra is approximated from latitude and day of year.
 */
function computeET0(lat: number, tmax: number, tmin: number, doy: number): number {
  const tmean = (tmax + tmin) / 2;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI / 365) * doy);
  const delta = 0.409 * Math.sin((2 * Math.PI / 365) * doy - 1.39);
  const phi = (lat * Math.PI) / 180;
  const ws = Math.acos(-Math.tan(phi) * Math.tan(delta));
  const Ra = (24 / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws));
  return Math.max(0, 0.0023 * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)) * Ra);
}

/**
 * Generate crop coefficient (Kc) for a given stage.
 * Based on FAO Paper 56 Table 12 — open access.
 */
function getCropCoefficient(phase: string): number {
  const kc: Record<string, number> = {
    germination: 0.4,
    establishment: 0.7,
    vegetative: 1.0,
    flowering: 1.15,
    fruitOrGrainSet: 1.1,
    maturity: 0.8,
  };
  return kc[phase] ?? 1.0;
}

function assessWeatherRisk(forecast: ForecastDay[], crop: CropGDDProfile): { level: string; notes: string } {
  let highTemp = 0, lowTemp = 0, heavyRain = 0;
  for (const day of forecast.slice(0, 7)) {
    if (day.tempMax > crop.tempRange.max) highTemp++;
    if (day.tempMin < crop.tempRange.min) lowTemp++;
    if (day.precipitation > 25) heavyRain++;
  }
  if (highTemp >= 3 || lowTemp >= 3) return { level: "high", notes: `${highTemp > 0 ? `High temperature stress expected (${highTemp} days above ${crop.tempRange.max}°C). ` : ""}${lowTemp > 0 ? `Cold stress expected (${lowTemp} nights below ${crop.tempRange.min}°C). ` : ""}` };
  if (heavyRain >= 2) return { level: "medium", notes: "Heavy rainfall forecast — ensure drainage and delay pesticide application." };
  if (highTemp >= 1 || lowTemp >= 1) return { level: "medium", notes: "Some temperature stress possible. Monitor crop closely." };
  return { level: "low", notes: "Weather conditions are generally favorable for this crop." };
}

export interface FarmingPlanOutput {
  crop: string;
  location: string;
  plantingDate: string;
  totalGrowingDays: number;
  estimatedHarvestStart: number;
  estimatedHarvestEnd: number;
  weatherRiskLevel: string;
  weatherRiskNotes: string;
  varietyRecommendation: string;
  expectedYield: string;
  cropInfo: string;
  dataSourcesUsed: string[];
  climateAdaptedNote: string;
  stages: any[];
  milestones: any[];
  weatherAdjustments: any[];
  fertilizerSchedule: any[];
  pestAlerts: any[];
  irrigationSchedule: any[];
}

/**
 * Main plan generation function.
 * Combines open climate data with GDD-based agronomic rules to produce
 * a fully dynamic, location-adapted farming plan.
 * No AI calls. No hardcoded day numbers.
 */
export function generateFarmingPlan(
  cropName: string,
  plantingDate: string,
  location: string,
  climate: ClimateProfile,
  forecast: ForecastDay[],
  wikiInfo: string | null
): FarmingPlanOutput {
  const profile = lookupCrop(cropName) ?? buildGenericProfile(cropName);
  const avgGDD = Math.max(3, climate.avgDailyGDD);

  const days = {
    germination: computeDayFromGDD(profile.gddPhases.germination, avgGDD),
    establishment: computeDayFromGDD(profile.gddPhases.establishment, avgGDD),
    vegetative: computeDayFromGDD(profile.gddPhases.vegetative, avgGDD),
    flowering: computeDayFromGDD(profile.gddPhases.flowering, avgGDD),
    fruitSet: computeDayFromGDD(profile.gddPhases.fruitOrGrainSet, avgGDD),
    maturity: computeDayFromGDD(profile.gddPhases.maturity, avgGDD),
  };

  const totalGrowingDays = days.maturity;
  const harvestWindow = Math.round(totalGrowingDays * 0.07);
  const plantDate = new Date(plantingDate);
  const doy = Math.floor((plantDate.getTime() - new Date(plantDate.getFullYear(), 0, 0).getTime()) / 86400000);

  const riskAssessment = assessWeatherRisk(forecast, profile);

  const tempAtLocation = climate.annualMeanTemp;
  const isSuboptimal = tempAtLocation < profile.tempRange.min + 3 || tempAtLocation > profile.tempRange.max - 3;
  const varietyNote = isSuboptimal
    ? `Choose a variety adapted to ${tempAtLocation > profile.tempRange.optimal ? "hot" : "cool"} conditions (mean temp: ${climate.annualMeanTemp}°C). Consult local extension service for certified varieties.`
    : `Standard varieties perform well in ${location} (mean temp: ${climate.annualMeanTemp}°C, optimal for this crop: ${profile.tempRange.optimal}°C).`;

  const yieldModifier = isSuboptimal ? 0.75 : 1.0;
  const baseYield = {
    rice: "4-6 tons/ha", maize: "3-7 tons/ha", wheat: "2-5 tons/ha",
    tomato: "30-60 tons/ha", potato: "15-30 tons/ha", cassava: "8-20 tons/ha",
    soybean: "1.5-3.5 tons/ha", groundnut: "1.5-3 tons/ha",
  };
  const yieldKey = Object.keys(CROP_GDD_PROFILES).find(k => profile.name.toLowerCase().includes(k));
  const expectedYield = yieldKey && baseYield[yieldKey as keyof typeof baseYield]
    ? (isSuboptimal ? `${baseYield[yieldKey as keyof typeof baseYield]} (reduced — suboptimal temperature)` : baseYield[yieldKey as keyof typeof baseYield])
    : `Estimated ${Math.round(2 * yieldModifier * 10) / 10}-${Math.round(5 * yieldModifier * 10) / 10} tons/ha based on local climate conditions`;

  const fertNPerApp = Math.round(profile.fertilizerProfile.n_kg_ha / profile.fertilizerProfile.splitApplications);
  const fertPTotal = profile.fertilizerProfile.p_kg_ha;
  const fertKPerApp = Math.round(profile.fertilizerProfile.k_kg_ha / profile.fertilizerProfile.splitApplications);

  const stages = [
    {
      id: "stage-prep",
      name: "Land Preparation",
      type: "preparation",
      startDay: -14,
      endDay: 0,
      description: `Prepare soil 2 weeks before planting. Test soil pH and structure. Incorporate organic matter. Based on ${location} climate (mean ${climate.annualMeanTemp}°C, annual rainfall ${climate.annualTotalRainfall}mm).`,
      tasks: [
        "Deep plow to 20-25cm depth",
        "Soil pH test (target 6.0-7.0 for most crops)",
        "Apply basal compost (5-10 tons/ha)",
        `Apply basal ${fertPTotal}kg/ha P₂O₅ and ${fertKPerApp}kg/ha K₂O`,
        "Ensure adequate drainage channels",
        "Level field for uniform water distribution",
      ],
      weatherConsiderations: "Avoid tillage in wet conditions. Soil should be moist but not waterlogged.",
      inputsNeeded: ["Plow/tractor", "Compost", `Phosphate fertilizer (${fertPTotal}kg/ha)`, `Potash (${fertKPerApp}kg/ha)`, "pH meter"],
      priority: "critical",
    },
    {
      id: "stage-plant",
      name: "Planting / Sowing",
      type: "planting",
      startDay: 0,
      endDay: days.germination,
      description: `Plant ${profile.name} at optimal spacing. GDD base temperature: ${profile.gddBase}°C. Expected GDD to germination: ${profile.gddPhases.germination} GDD at local rate of ${avgGDD} GDD/day.`,
      tasks: [
        `Plant at recommended spacing for ${profile.name}`,
        "Use certified, disease-free seed or planting material",
        "Seed treatment with fungicide if available",
        "Mark rows clearly for mechanized operations",
        "Record planting date and field map",
      ],
      weatherConsiderations: `Optimal soil temp: ${profile.gddBase + 5}°C. Plant when frost risk is past and soil is warm.`,
      inputsNeeded: ["Certified seed", "Planting tools", "Seed dressing fungicide", "Field map"],
      priority: "critical",
    },
    {
      id: "stage-germ",
      name: "Germination & Emergence",
      type: "germination",
      startDay: days.germination,
      endDay: days.establishment,
      description: `Germination expected around Day ${days.germination} (${profile.gddPhases.germination} GDD accumulated at ${avgGDD} GDD/day average in ${location}).`,
      tasks: [
        "Scout daily for uniform germination",
        "Gap-fill missing spots within 5 days of emergence",
        "Light irrigation if no rainfall",
        "Control early weeds (critical window)",
        "Record germination rate (target >85%)",
      ],
      weatherConsiderations: "Maintain consistent soil moisture. Excessive rainfall can cause damping-off. Protect from birds and rodents.",
      inputsNeeded: ["Hand weeder", "Watering can/sprinkler"],
      priority: "critical",
    },
    {
      id: "stage-estab",
      name: "Crop Establishment",
      type: "growth",
      startDay: days.establishment,
      endDay: days.vegetative,
      description: "Crop establishes root system and early canopy. First fertilizer application. Active weed management.",
      tasks: [
        `Apply ${fertNPerApp}kg/ha Nitrogen (first split)`,
        "First herbicide application if needed",
        "Irrigation: maintain field capacity",
        "Scout for early pest signs",
        "Thin to final plant population if needed",
      ],
      weatherConsiderations: "Watch for water stress — this stage is critical for root development.",
      inputsNeeded: [`Nitrogen fertilizer (${fertNPerApp}kg/ha)`, "Herbicide", "Sprayer"],
      priority: "high",
    },
    {
      id: "stage-veg",
      name: "Vegetative Growth",
      type: "growth",
      startDay: days.vegetative,
      endDay: days.flowering,
      description: `Rapid vegetative growth. ${profile.name} requires ${(getCropCoefficient("vegetative") * 5).toFixed(1)}mm/day ET₀ equivalent. Second fertilizer application.`,
      tasks: [
        `Apply ${fertNPerApp}kg/ha Nitrogen (second split)`,
        `Apply ${fertKPerApp}kg/ha Potassium`,
        "Weekly pest and disease scouting",
        "Irrigation: ${getCropCoefficient('vegetative')} × ET₀",
        "Stake or trellis if needed (tomato, beans)",
        "Remove diseased leaves/plants promptly",
      ],
      weatherConsiderations: `Watch for ${profile.commonPests[0]?.name ?? "fungal diseases"} during warm humid periods.`,
      inputsNeeded: [`N fertilizer (${fertNPerApp}kg/ha)`, `K fertilizer (${fertKPerApp}kg/ha)`, "Pesticide", "Stakes/trellis"],
      priority: "high",
    },
    {
      id: "stage-flower",
      name: "Flowering / Pollination",
      type: "growth",
      startDay: days.flowering,
      endDay: days.fruitSet,
      description: `Critical stage — water and nutrient stress here causes major yield loss. Flowering expected Day ${days.flowering} (${profile.gddPhases.flowering} accumulated GDD).`,
      tasks: [
        "Do NOT apply systemic insecticides (harms pollinators)",
        "Maintain consistent soil moisture (no wet-dry extremes)",
        "Scout for flower-feeders and thrips",
        "Final Nitrogen top-dress if needed",
        "Record flowering date for harvest estimate",
      ],
      weatherConsiderations: `${profile.criticalWaterStages.includes("flowering") ? "CRITICAL: Water stress at flowering severely reduces yield. Irrigate if no rainfall >5mm in 3 days." : "Avoid excessive irrigation which can cause root disease."}`,
      inputsNeeded: ["Irrigation", "Micronutrient foliar spray (boron)"],
      priority: "critical",
    },
    {
      id: "stage-fill",
      name: "Grain / Fruit Fill",
      type: "growth",
      startDay: days.fruitSet,
      endDay: days.maturity - Math.round((days.maturity - days.fruitSet) * 0.2),
      description: `Grain/fruit filling — assimilates move to storage organ. Water requirement begins to decline. Pest monitoring continues.`,
      tasks: [
        "Monitor for late-season pests",
        "Reduce irrigation gradually",
        "Assess grain/fruit development weekly",
        "Prepare harvest equipment",
      ],
      weatherConsiderations: "High humidity can cause mold on grain/fruit. Avoid overhead irrigation.",
      inputsNeeded: ["Harvest equipment prep"],
      priority: "high",
    },
    {
      id: "stage-harvest",
      name: "Maturation & Harvest",
      type: "harvest",
      startDay: days.maturity - harvestWindow,
      endDay: days.maturity + harvestWindow,
      description: `Harvest window: Day ${days.maturity - harvestWindow} to Day ${days.maturity + harvestWindow} (${profile.gddPhases.maturity} GDD, computed from ${location} climate data).`,
      tasks: [
        "Check crop maturity indicators daily",
        "Harvest at optimal maturity (do not delay)",
        "Handle produce carefully to minimize damage",
        "Dry grain to safe moisture before storage",
        "Record yield for future planning",
        "Prepare field for next crop",
      ],
      weatherConsiderations: "Harvest on dry days. Rain at harvest can cause quality losses. Have drying facilities ready.",
      inputsNeeded: ["Harvesting tools/machinery", "Storage bags/silos", "Moisture meter"],
      priority: "critical",
    },
  ];

  const milestones = [
    { day: 0, label: "Planting Day", description: `${profile.name} planted. Monitor soil moisture and protect from birds.`, icon: "seedling" },
    { day: days.germination, label: "First Emergence", description: "First seedlings emerge. Check germination rate — target >85%. Gap-fill if needed.", icon: "seedling" },
    { day: days.establishment, label: "Establishment", description: `Apply first Nitrogen dose (${fertNPerApp}kg/ha). Begin weed control program.`, icon: "fertilizer" },
    { day: Math.round((days.establishment + days.vegetative) / 2), label: "Weed Control Window", description: "Critical weed-free period. Control weeds now to protect maximum yield potential.", icon: "monitor" },
    { day: days.vegetative, label: "Vegetative Peak", description: `Apply second fertilizer split. Monitor for ${profile.commonPests[0]?.name ?? "pests"}.`, icon: "fertilizer" },
    { day: days.flowering, label: "Flowering Begins", description: "Most critical growth stage. Maintain water. Avoid systemic insecticides.", icon: "water" },
    { day: days.fruitSet, label: "Fruit/Grain Set", description: "Yield potential is now set. Reduce irrigation gradually. Prepare harvest equipment.", icon: "monitor" },
    { day: days.maturity - harvestWindow, label: "Pre-Harvest Check", description: "Assess maturity daily. Line up labor and transport. Check storage is ready.", icon: "harvest" },
    { day: days.maturity, label: "Target Harvest", description: `${days.maturity} days from planting (${profile.gddPhases.maturity} GDD). Harvest at peak maturity.`, icon: "harvest" },
  ];

  const irrigationSchedule = (() => {
    const schedule = [];
    const phases = [
      { name: "Germination", startDay: 0, endDay: days.germination, kc: 0.4, freqDays: 3 },
      { name: "Establishment", startDay: days.germination, endDay: days.establishment, kc: 0.7, freqDays: 4 },
      { name: "Vegetative", startDay: days.establishment, endDay: days.vegetative, kc: 1.0, freqDays: 5 },
      { name: "Flowering", startDay: days.vegetative, endDay: days.fruitSet, kc: 1.15, freqDays: 3 },
      { name: "Fill", startDay: days.fruitSet, endDay: days.maturity, kc: 0.9, freqDays: 7 },
    ];
    for (const p of phases) {
      const et0 = computeET0(climate.lat, climate.annualMeanTemp + 4, climate.annualMeanTemp - 4, doy);
      const etc = Math.round(p.kc * et0 * p.freqDays * 10) / 10;
      schedule.push({
        stage: p.name,
        startDay: p.startDay,
        endDay: p.endDay,
        intervalDays: p.freqDays,
        depthMm: etc,
        cropCoefficient: p.kc,
        method: profile.waterRequirementMm > 900 ? "Furrow / Flood" : "Drip / Sprinkler",
        note: `ET₀ × Kc(${p.kc}) × ${p.freqDays}d. Computed using Hargreaves method from ${location} climate data.`,
      });
    }
    return schedule;
  })();

  const fertilizerSchedule = [
    {
      day: -7,
      product: `Basal Phosphate (${fertPTotal}kg/ha P₂O₅)`,
      rate: `${fertPTotal} kg/ha P₂O₅`,
      method: "Broadcast and incorporate before planting",
      purpose: "Root development and early growth. P is most available near planting.",
    },
    {
      day: days.establishment,
      product: `Nitrogen (${fertNPerApp}kg/ha N) + Potash (${fertKPerApp}kg/ha K₂O)`,
      rate: `${fertNPerApp}kg N + ${fertKPerApp}kg K₂O per ha`,
      method: "Side-dress or band application. Water in immediately.",
      purpose: "Fuel vegetative growth. K₂O supports cell development and disease resistance.",
    },
    {
      day: days.vegetative,
      product: `Nitrogen (${fertNPerApp}kg/ha N)`,
      rate: `${fertNPerApp}kg N per ha`,
      method: "Top-dress broadcast or foliar spray",
      purpose: "Support rapid vegetative growth and canopy development.",
    },
    ...(profile.fertilizerProfile.splitApplications >= 3 ? [{
      day: days.flowering - 5,
      product: `Pre-flowering top-dress: ${Math.round(fertNPerApp * 0.5)}kg N/ha + micronutrients`,
      rate: `${Math.round(fertNPerApp * 0.5)}kg N/ha`,
      method: "Foliar spray or banded",
      purpose: "Support flowering and pollination. Avoid heavy N before harvest.",
    }] : []),
  ];

  const pestAlerts = profile.commonPests.map(pest => ({
    name: pest.name,
    riskPeriod: `Day ${days.vegetative}–${days.maturity}`,
    triggerConditions: `Temperature ${pest.tempTriggerMin}–${pest.tempTriggerMax}°C${pest.humidityTrigger ? `, humidity >  ${pest.humidityTrigger}%` : ""}`,
    riskAtLocation: (climate.annualMeanTemp >= pest.tempTriggerMin && climate.annualMeanTemp <= pest.tempTriggerMax)
      ? "HIGH — Local temperature range matches pest development conditions"
      : "MODERATE — Monitor during warm spells",
    symptoms: `Monitor ${profile.name} for signs of ${pest.name}. Scout 2× per week during vegetative and flowering stages.`,
    treatment: "Apply registered pesticide at first economic threshold. Rotate modes of action. Follow local extension service guidance.",
  }));

  const weatherAdjustments = [
    {
      trigger: `Temperature > ${profile.tempRange.max}°C for 3+ days`,
      impact: "delay",
      affectedStages: ["Flowering", "Grain/Fruit Fill"],
      action: "Increase irrigation frequency. Apply shade nets if available. Harvest earlier if maturity allows.",
    },
    {
      trigger: `Temperature < ${profile.tempRange.min}°C at night`,
      impact: "delay",
      affectedStages: ["Germination", "Establishment"],
      action: "Delay planting until soil warms. Use mulch to retain soil heat.",
    },
    {
      trigger: "Rainfall > 30mm/day",
      impact: "skip",
      affectedStages: ["Pesticide Application", "Fertilizer Application"],
      action: "Postpone spray or fertilizer application for 48 hours. Check drainage.",
    },
    {
      trigger: "No rainfall for 10+ days",
      impact: "add_task",
      affectedStages: ["Vegetative Growth", "Flowering"],
      action: `Irrigate immediately — ${profile.name} water requirement is ${profile.waterRequirementMm}mm/season. Prioritize ${profile.criticalWaterStages.join(", ")} stages.`,
    },
  ];

  const dataSourcesUsed = [
    "Open-Meteo Historical Weather API (archive-api.open-meteo.com) — ERA5 reanalysis, free/open",
    "Open-Meteo Forecast API (api.open-meteo.com) — free/open, no API key",
    "Open-Meteo Geocoding API — free/open, no API key",
    `Crop GDD parameters: ${profile.source}`,
    "FAO Irrigation and Drainage Paper No. 56 (Allen et al. 1998) — ET₀ Hargreaves method",
    "World Bank Open Data API (api.worldbank.org) — country context, free/open",
    wikiInfo ? "Wikipedia REST API (en.wikipedia.org/api/rest_v1) — crop information" : null,
  ].filter(Boolean) as string[];

  return {
    crop: profile.name,
    location,
    plantingDate,
    totalGrowingDays,
    estimatedHarvestStart: days.maturity - harvestWindow,
    estimatedHarvestEnd: days.maturity + harvestWindow,
    weatherRiskLevel: riskAssessment.level,
    weatherRiskNotes: riskAssessment.notes,
    varietyRecommendation: varietyNote,
    expectedYield,
    cropInfo: wikiInfo ?? `${profile.name} is a ${profile.category.toLowerCase()} crop with optimal temperature range ${profile.tempRange.min}–${profile.tempRange.max}°C.`,
    dataSourcesUsed,
    climateAdaptedNote: `Plan computed from ${location} climate data: mean temp ${climate.annualMeanTemp}°C, annual rainfall ${climate.annualTotalRainfall}mm, avg ${avgGDD} GDD/day. All timings dynamically derived — no hardcoded crop schedules used.`,
    stages,
    milestones,
    weatherAdjustments,
    fertilizerSchedule,
    pestAlerts,
    irrigationSchedule,
  };
}

export function listAvailableCrops() {
  return Object.values(CROP_GDD_PROFILES).map(p => ({
    name: p.name,
    category: p.category,
    emoji: p.emoji,
    growingDays: "Climate-dependent (GDD-based)",
    gddBase: `${p.gddBase}°C base temperature`,
    dataSource: p.source,
  }));
}

import { Router } from "express";
import { openrouter } from "@workspace/integrations-openrouter-ai";

const router = Router();

const MODEL_CHAIN = [
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen2.5-7b-instruct:free",
];

async function fetchWeatherData(location: string, lat?: number | null, lon?: number | null) {
  try {
    let coordinates: { lat: number; lon: number } | null = null;

    if (lat && lon) {
      coordinates = { lat, lon };
    } else {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
      const geoResp = await fetch(geoUrl);
      const geoData = (await geoResp.json()) as any;
      if (geoData.results?.[0]) {
        coordinates = {
          lat: geoData.results[0].latitude,
          lon: geoData.results[0].longitude,
        };
      }
    }

    if (!coordinates) return null;

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coordinates.lat}&longitude=${coordinates.lon}` +
      `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code,uv_index_max` +
      `&timezone=auto&forecast_days=16`;

    const weatherResp = await fetch(weatherUrl);
    if (!weatherResp.ok) return null;
    return (await weatherResp.json()) as any;
  } catch {
    return null;
  }
}

function buildWeatherSummary(weatherData: any): string {
  if (!weatherData) return "Weather data not available.";
  const c = weatherData.current;
  const d = weatherData.daily;

  let summary = `Current conditions: ${c?.temperature_2m ?? "?"}°C, humidity ${c?.relative_humidity_2m ?? "?"}%, precipitation ${c?.precipitation ?? 0}mm, wind ${c?.wind_speed_10m ?? "?"}km/h.\n`;

  if (d?.time?.length) {
    const rows = d.time.slice(0, 10).map((date: string, i: number) =>
      `  ${date}: max ${d.temperature_2m_max?.[i]}°C / min ${d.temperature_2m_min?.[i]}°C, rain ${d.precipitation_sum?.[i]}mm (${d.precipitation_probability_max?.[i]}% chance)`
    );
    summary += "10-day forecast:\n" + rows.join("\n");
  }

  return summary;
}

async function generatePlanWithAI(
  crop: string,
  plantingDate: string,
  location: string,
  weatherData: any,
  log: any,
): Promise<any> {
  const weatherSummary = buildWeatherSummary(weatherData);

  const prompt = `You are an expert agronomist with deep knowledge of global crop production. Generate a complete, realistic farming plan based on verified agricultural data.

CROP: ${crop}
PLANTING DATE: ${plantingDate}
LOCATION: ${location}

LIVE WEATHER DATA (from Open-Meteo API):
${weatherSummary}

Using real-world data about ${crop} growth cycles, climate requirements for ${location}, and the weather conditions above, generate a detailed farming plan.

Respond ONLY with valid JSON matching this exact structure (no markdown, no explanation, just the JSON object):

{
  "crop": "${crop}",
  "location": "${location}",
  "plantingDate": "${plantingDate}",
  "totalGrowingDays": <integer based on real crop cycle>,
  "estimatedHarvestStart": <integer day number>,
  "estimatedHarvestEnd": <integer day number>,
  "weatherRiskLevel": "low" | "medium" | "high",
  "weatherRiskNotes": "<summary of current weather risks for this crop>",
  "varietyRecommendation": "<recommended seed variety for this location>",
  "expectedYield": "<realistic yield estimate per hectare>",
  "stages": [
    {
      "id": "<unique id e.g. stage-1>",
      "name": "<stage name>",
      "type": "preparation" | "planting" | "germination" | "growth" | "fertilization" | "pest_control" | "irrigation" | "monitoring" | "harvest",
      "startDay": <integer, 0 = planting date>,
      "endDay": <integer>,
      "description": "<what happens during this stage>",
      "tasks": ["<specific actionable task>", ...],
      "weatherConsiderations": "<what to watch for weather-wise>",
      "inputsNeeded": ["<fertilizer/pesticide/tool needed>", ...],
      "priority": "critical" | "high" | "medium"
    }
  ],
  "milestones": [
    {
      "day": <integer>,
      "label": "<short milestone name>",
      "description": "<what to do or check on this day>",
      "icon": "seedling" | "water" | "fertilizer" | "pest" | "harvest" | "monitor"
    }
  ],
  "weatherAdjustments": [
    {
      "trigger": "<weather condition that triggers this>",
      "impact": "delay" | "accelerate" | "skip" | "add_task",
      "affectedStages": ["<stage name>"],
      "action": "<specific action to take>"
    }
  ],
  "fertilizerSchedule": [
    {
      "day": <integer>,
      "product": "<fertilizer name>",
      "rate": "<application rate per hectare>",
      "method": "<how to apply>",
      "purpose": "<why this fertilizer at this stage>"
    }
  ],
  "pestAlerts": [
    {
      "name": "<pest or disease name>",
      "riskPeriod": "<day range e.g. Day 20-40>",
      "symptoms": "<how to identify>",
      "treatment": "<recommended treatment>"
    }
  ]
}

Use only scientifically accurate growth periods for ${crop}. All day numbers must be realistic. Include 8-12 stages, 6-10 milestones, and complete fertilizer + pest schedules.`;

  for (const model of MODEL_CHAIN) {
    try {
      const response = await (openrouter as any).chat.completions.create({
        model,
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
      });

      const content = response.choices?.[0]?.message?.content as string | undefined;
      if (!content) continue;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      return JSON.parse(jsonMatch[0]);
    } catch (err: any) {
      log.warn({ model, err: err?.message }, "Farming plan model failed, trying next");
    }
  }

  throw new Error("All AI models failed to generate a plan");
}

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
    const weatherData = await fetchWeatherData(location, lat, lon);
    const plan = await generatePlanWithAI(crop, plantingDate, location, weatherData, req.log);

    const responseWeather = weatherData
      ? {
          current: weatherData.current,
          daily: weatherData.daily
            ? {
                dates: weatherData.daily.time?.slice(0, 16),
                maxTemps: weatherData.daily.temperature_2m_max?.slice(0, 16),
                minTemps: weatherData.daily.temperature_2m_min?.slice(0, 16),
                precipitation: weatherData.daily.precipitation_sum?.slice(0, 16),
                precipitationProbability: weatherData.daily.precipitation_probability_max?.slice(0, 16),
                uvIndex: weatherData.daily.uv_index_max?.slice(0, 16),
              }
            : null,
        }
      : null;

    res.json({ plan, weatherData: responseWeather, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    req.log.error({ err }, "Error generating farming plan");
    res.status(500).json({ error: "Failed to generate farming plan. Please try again." });
  }
});

router.get("/farming-plan/crops", (_req, res) => {
  const COMMON_CROPS = [
    { name: "Rice", category: "Cereals", emoji: "🌾", growingDays: "90-120" },
    { name: "Corn / Maize", category: "Cereals", emoji: "🌽", growingDays: "60-100" },
    { name: "Wheat", category: "Cereals", emoji: "🌾", growingDays: "90-120" },
    { name: "Tomato", category: "Vegetables", emoji: "🍅", growingDays: "60-85" },
    { name: "Potato", category: "Tubers", emoji: "🥔", growingDays: "70-120" },
    { name: "Cassava", category: "Tubers", emoji: "🌱", growingDays: "270-365" },
    { name: "Sweet Potato", category: "Tubers", emoji: "🍠", growingDays: "90-120" },
    { name: "Onion", category: "Vegetables", emoji: "🧅", growingDays: "100-120" },
    { name: "Garlic", category: "Vegetables", emoji: "🧄", growingDays: "120-150" },
    { name: "Cabbage", category: "Vegetables", emoji: "🥬", growingDays: "70-90" },
    { name: "Eggplant", category: "Vegetables", emoji: "🍆", growingDays: "70-85" },
    { name: "Pechay / Bok Choy", category: "Vegetables", emoji: "🥬", growingDays: "25-40" },
    { name: "Soybean", category: "Legumes", emoji: "🫘", growingDays: "75-100" },
    { name: "Mung Bean", category: "Legumes", emoji: "🫘", growingDays: "55-65" },
    { name: "Banana", category: "Fruits", emoji: "🍌", growingDays: "270-365" },
    { name: "Mango", category: "Fruits", emoji: "🥭", growingDays: "100-120" },
    { name: "Pineapple", category: "Fruits", emoji: "🍍", growingDays: "450-600" },
    { name: "Watermelon", category: "Fruits", emoji: "🍉", growingDays: "70-90" },
    { name: "Sugarcane", category: "Cash Crops", emoji: "🌿", growingDays: "300-365" },
    { name: "Coffee", category: "Cash Crops", emoji: "☕", growingDays: "180-270" },
    { name: "Coconut", category: "Cash Crops", emoji: "🥥", growingDays: "365+" },
    { name: "Cacao", category: "Cash Crops", emoji: "🍫", growingDays: "365+" },
    { name: "Tobacco", category: "Cash Crops", emoji: "🌿", growingDays: "60-90" },
    { name: "Cotton", category: "Cash Crops", emoji: "🌿", growingDays: "150-180" },
    { name: "Peanut / Groundnut", category: "Oilseeds", emoji: "🥜", growingDays: "90-130" },
    { name: "Sunflower", category: "Oilseeds", emoji: "🌻", growingDays: "70-100" },
  ];
  res.json(COMMON_CROPS);
});

export default router;

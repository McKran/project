import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  GetWeatherQueryParams,
  GetWeatherForecastQueryParams,
  GetFarmingAdviceQueryParams,
} from "@workspace/api-zod";

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

function getDayForecast(location: string, daysAhead: number) {
  const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Light Rain", "Clear", "Windy", "Overcast"];
  const farmingNotes = [
    "Ideal for planting and field work",
    "Good conditions for irrigation",
    "Monitor crops for wind stress",
    "Delay pesticide application",
    "Excellent harvest conditions",
    "Good for soil preparation",
    "Check drainage systems",
  ];
  const seed = location.length + daysAhead;
  const condition = conditions[seed % conditions.length];
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    date: date.toISOString().split("T")[0],
    dayName: daysAhead === 0 ? "Today" : daysAhead === 1 ? "Tomorrow" : dayNames[date.getDay()],
    high: 22 + (seed % 12),
    low: 12 + (seed % 8),
    condition,
    humidity: 50 + (seed % 40),
    rainfall: condition.includes("Rain") ? 3 + (seed % 8) : 0,
    farmingNote: farmingNotes[seed % farmingNotes.length],
  };
}

router.get("/weather/current", async (req, res) => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  const location = (parsed.success && parsed.data.location) ? parsed.data.location : "Nairobi, Kenya";
  try {
    const weather = getWeatherForLocation(location);
    res.json(weather);
  } catch (err) {
    req.log.error({ err }, "Error fetching weather");
    res.status(500).json({ error: "Failed to fetch weather data" });
  }
});

router.get("/weather/forecast", async (req, res) => {
  const parsed = GetWeatherForecastQueryParams.safeParse(req.query);
  const location = (parsed.success && parsed.data.location) ? parsed.data.location : "Nairobi, Kenya";
  try {
    const forecast = Array.from({ length: 7 }, (_, i) => getDayForecast(location, i));
    res.json(forecast);
  } catch (err) {
    req.log.error({ err }, "Error fetching forecast");
    res.status(500).json({ error: "Failed to fetch forecast" });
  }
});

router.get("/weather/farming-advice", async (req, res) => {
  const parsed = GetFarmingAdviceQueryParams.safeParse(req.query);
  const location = (parsed.success && parsed.data.location) ? parsed.data.location : "Nairobi, Kenya";
  const crop = (parsed.success && parsed.data.crop) ? parsed.data.crop : "";
  try {
    const weather = getWeatherForLocation(location);
    const prompt = `You are an expert agricultural advisor. Based on the following weather conditions for ${location}, provide concise farming advice${crop ? ` specifically for ${crop}` : ""}.

Weather: ${weather.condition}, Temperature: ${weather.temperature}°C, Humidity: ${weather.humidity}%, Wind: ${weather.windSpeed} km/h, Rainfall: ${weather.rainfall}mm

Respond ONLY with a JSON object (no markdown) with this exact structure:
{
  "location": "${location}",
  "advice": "2-3 sentences of overall farming advice",
  "urgentAlerts": ["alert1 if any", "alert2 if any"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const advice = JSON.parse(cleaned);
    res.json(advice);
  } catch (err) {
    req.log.error({ err }, "Error getting farming advice");
    res.json({
      location,
      advice: "Weather conditions are favorable for general farming activities. Monitor soil moisture levels and adjust irrigation accordingly.",
      urgentAlerts: [],
      recommendations: [
        "Check soil moisture before irrigation",
        "Monitor crop health daily",
        "Prepare for upcoming weather changes",
      ],
    });
  }
});

export default router;

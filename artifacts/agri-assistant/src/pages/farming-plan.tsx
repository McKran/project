import { useState, useCallback } from "react";
import { useSettings } from "@/hooks/use-settings";
import { COUNTRIES } from "@/lib/country-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sprout, Calendar, MapPin, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Droplets, Bug, Wheat, Sun, Cloud, CloudRain, Wind, ThermometerSun,
  CheckCircle2, Clock, Zap, Leaf, FlaskConical, Shield, Activity,
  TriangleAlert, Info, RefreshCw, ClipboardList
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STAGE_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  preparation:   { color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",   icon: Sprout },
  planting:      { color: "text-green-700 dark:text-green-400",   bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",   icon: Leaf },
  germination:   { color: "text-lime-700 dark:text-lime-400",     bg: "bg-lime-50 dark:bg-lime-950/30 border-lime-200 dark:border-lime-800",       icon: Sprout },
  growth:        { color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", icon: Leaf },
  fertilization: { color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",     icon: FlaskConical },
  pest_control:  { color: "text-rose-700 dark:text-rose-400",     bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800",     icon: Shield },
  irrigation:    { color: "text-cyan-700 dark:text-cyan-400",     bg: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800",     icon: Droplets },
  monitoring:    { color: "text-violet-700 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800", icon: Activity },
  harvest:       { color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800", icon: Wheat },
};

const MILESTONE_ICON_MAP: Record<string, React.ElementType> = {
  seedling: Sprout,
  water: Droplets,
  fertilizer: FlaskConical,
  pest: Bug,
  harvest: Wheat,
  monitor: Activity,
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Moderate showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
};

function WeatherIcon({ code, className }: { code?: number; className?: string }) {
  if (!code && code !== 0) return <Sun className={className} />;
  if (code <= 1) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 67) return <CloudRain className={className} />;
  return <CloudRain className={className} />;
}

const COMMON_CROPS = [
  { name: "Rice", emoji: "🌾", category: "Cereals" },
  { name: "Corn / Maize", emoji: "🌽", category: "Cereals" },
  { name: "Wheat", emoji: "🌾", category: "Cereals" },
  { name: "Tomato", emoji: "🍅", category: "Vegetables" },
  { name: "Potato", emoji: "🥔", category: "Tubers" },
  { name: "Cassava", emoji: "🌱", category: "Tubers" },
  { name: "Onion", emoji: "🧅", category: "Vegetables" },
  { name: "Eggplant", emoji: "🍆", category: "Vegetables" },
  { name: "Soybean", emoji: "🫘", category: "Legumes" },
  { name: "Banana", emoji: "🍌", category: "Fruits" },
  { name: "Mango", emoji: "🥭", category: "Fruits" },
  { name: "Watermelon", emoji: "🍉", category: "Fruits" },
  { name: "Sugarcane", emoji: "🌿", category: "Cash Crops" },
  { name: "Coffee", emoji: "☕", category: "Cash Crops" },
  { name: "Peanut / Groundnut", emoji: "🥜", category: "Oilseeds" },
  { name: "Sweet Potato", emoji: "🍠", category: "Tubers" },
];

interface FarmingStage {
  id: string;
  name: string;
  type: string;
  startDay: number;
  endDay: number;
  description: string;
  tasks: string[];
  weatherConsiderations: string;
  inputsNeeded?: string[];
  priority: string;
}

interface Milestone {
  day: number;
  label: string;
  description: string;
  icon: string;
}

interface WeatherAdjustment {
  trigger: string;
  impact: string;
  affectedStages: string[];
  action: string;
}

interface FertilizerItem {
  day: number;
  product: string;
  rate: string;
  method: string;
  purpose: string;
}

interface PestAlert {
  name: string;
  riskPeriod: string;
  symptoms: string;
  treatment: string;
}

interface FarmingPlan {
  crop: string;
  location: string;
  plantingDate: string;
  totalGrowingDays: number;
  estimatedHarvestStart: number;
  estimatedHarvestEnd: number;
  weatherRiskLevel: "low" | "medium" | "high";
  weatherRiskNotes: string;
  varietyRecommendation?: string;
  expectedYield?: string;
  stages: FarmingStage[];
  milestones: Milestone[];
  weatherAdjustments: WeatherAdjustment[];
  fertilizerSchedule?: FertilizerItem[];
  pestAlerts?: PestAlert[];
}

interface PlanResponse {
  plan: FarmingPlan;
  weatherData: {
    current: Record<string, number>;
    daily: {
      dates: string[];
      maxTemps: number[];
      minTemps: number[];
      precipitation: number[];
      precipitationProbability: number[];
      uvIndex?: number[];
    } | null;
  } | null;
  generatedAt: string;
}

function RiskBadge({ level }: { level: string }) {
  if (level === "high") return (
    <Badge className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 gap-1">
      <TriangleAlert className="h-3 w-3" /> High Risk
    </Badge>
  );
  if (level === "medium") return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 gap-1">
      <TriangleAlert className="h-3 w-3" /> Medium Risk
    </Badge>
  );
  return (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Low Risk
    </Badge>
  );
}

function PriorityDot({ priority }: { priority: string }) {
  if (priority === "critical") return <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />;
  if (priority === "high") return <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />;
  return <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />;
}

function StageCard({ stage, plantingDate }: { stage: FarmingStage; plantingDate: string }) {
  const [expanded, setExpanded] = useState(false);
  const config = STAGE_TYPE_CONFIG[stage.type] ?? STAGE_TYPE_CONFIG.monitoring;
  const Icon = config.icon;

  const startDate = new Date(plantingDate);
  startDate.setDate(startDate.getDate() + stage.startDay);
  const endDate = new Date(plantingDate);
  endDate.setDate(endDate.getDate() + stage.endDay);

  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={`rounded-2xl border p-4 ${config.bg} transition-all`}>
      <div
        className="flex items-start gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${config.color} bg-white/60 dark:bg-black/20`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{stage.name}</span>
            <PriorityDot priority={stage.priority} />
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs font-medium ${config.color}`}>
              Day {stage.startDay}–{stage.endDay}
            </span>
            <span className="text-xs text-muted-foreground">
              · {fmt(startDate)} → {fmt(endDate)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
            {stage.description}
          </p>
        </div>
        <button className={`shrink-0 mt-1 ${config.color} opacity-60`}>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-white/40 dark:border-black/20 pt-4">
          {stage.tasks.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tasks</div>
              <ul className="space-y-1.5">
                {stage.tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.color}`} />
                    <span>{task}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {stage.inputsNeeded && stage.inputsNeeded.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Inputs Needed</div>
              <div className="flex flex-wrap gap-1.5">
                {stage.inputsNeeded.map((input, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-normal">{input}</Badge>
                ))}
              </div>
            </div>
          )}
          {stage.weatherConsiderations && (
            <div className="flex items-start gap-2 text-xs bg-white/50 dark:bg-black/20 rounded-xl p-3">
              <Cloud className="h-3.5 w-3.5 mt-0.5 text-blue-500 shrink-0" />
              <span className="text-muted-foreground">{stage.weatherConsiderations}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WeatherCard({ weatherData }: { weatherData: PlanResponse["weatherData"] }) {
  if (!weatherData) return null;
  const { current, daily } = weatherData;
  const code = current?.weather_code as number | undefined;

  return (
    <Card className="border-none shadow-sm bg-gradient-to-br from-sky-50 to-blue-100/60 dark:from-sky-950/40 dark:to-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <WeatherIcon code={code} className="h-4 w-4 text-blue-500" />
          Live Weather Conditions
        </CardTitle>
        <CardDescription className="text-xs">
          {WEATHER_CODE_LABELS[code ?? 0] ?? "Current conditions"} · Used to calibrate your plan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-3 text-center">
            <ThermometerSun className="h-4 w-4 mx-auto mb-1 text-orange-500" />
            <div className="text-lg font-bold">{current?.temperature_2m ?? "—"}°C</div>
            <div className="text-xs text-muted-foreground">Temperature</div>
          </div>
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-3 text-center">
            <Droplets className="h-4 w-4 mx-auto mb-1 text-blue-500" />
            <div className="text-lg font-bold">{current?.relative_humidity_2m ?? "—"}%</div>
            <div className="text-xs text-muted-foreground">Humidity</div>
          </div>
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-3 text-center">
            <CloudRain className="h-4 w-4 mx-auto mb-1 text-cyan-500" />
            <div className="text-lg font-bold">{current?.precipitation ?? 0}mm</div>
            <div className="text-xs text-muted-foreground">Precipitation</div>
          </div>
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-3 text-center">
            <Wind className="h-4 w-4 mx-auto mb-1 text-slate-500" />
            <div className="text-lg font-bold">{current?.wind_speed_10m ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Wind km/h</div>
          </div>
        </div>

        {daily && (
          <div className="overflow-x-auto -mx-1">
            <div className="flex gap-2 pb-1 min-w-max px-1">
              {daily.dates?.slice(0, 10).map((date, i) => {
                const d = new Date(date);
                const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                return (
                  <div key={date} className="bg-white/60 dark:bg-black/20 rounded-xl p-2.5 text-center min-w-[80px]">
                    <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                    <div className="text-xs font-semibold">{daily.maxTemps?.[i]}°</div>
                    <div className="text-[10px] text-muted-foreground">{daily.minTemps?.[i]}°</div>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      <Droplets className="h-2.5 w-2.5 text-blue-400" />
                      <span className="text-[10px] text-blue-600 dark:text-blue-400">{daily.precipitation?.[i]}mm</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{daily.precipitationProbability?.[i]}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineBar({ plan }: { plan: FarmingPlan }) {
  const total = plan.totalGrowingDays;
  const colors: Record<string, string> = {
    preparation: "bg-amber-400",
    planting: "bg-green-500",
    germination: "bg-lime-400",
    growth: "bg-emerald-500",
    fertilization: "bg-blue-500",
    pest_control: "bg-rose-400",
    irrigation: "bg-cyan-400",
    monitoring: "bg-violet-400",
    harvest: "bg-orange-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Day 0 · Planting</span>
        <span>Day {total} · Harvest</span>
      </div>
      <div className="relative h-6 bg-muted rounded-full overflow-hidden flex">
        {plan.stages.map((stage) => {
          const width = ((stage.endDay - stage.startDay) / total) * 100;
          const left = (stage.startDay / total) * 100;
          const color = colors[stage.type] ?? "bg-gray-400";
          return (
            <div
              key={stage.id}
              className={`absolute h-full ${color} opacity-80`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${stage.name} (Day ${stage.startDay}–${stage.endDay})`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(colors).map(([type, color]) => {
          if (!plan.stages.some(s => s.type === type)) return null;
          return (
            <span key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground capitalize">
              <span className={`h-2 w-2 rounded-full ${color} opacity-80`} />
              {type.replace("_", " ")}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function FarmingPlan() {
  const { settings } = useSettings();
  const selectedCountry = COUNTRIES.find(c => c.code === settings.countryCode);

  const [crop, setCrop] = useState("");
  const [plantingDate, setPlantingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [location, setLocation] = useState(
    [settings.cityName, settings.regionName, selectedCountry?.name].filter(Boolean).join(", ")
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "weather" | "fertilizer" | "pests" | "adjustments">("timeline");

  const handleGenerate = useCallback(async () => {
    if (!crop || !plantingDate || !location) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${BASE_URL}/api/farming-plan/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop,
          plantingDate,
          location,
          lat: settings.cityLat ?? null,
          lon: settings.cityLon ?? null,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? "Failed to generate plan");
      }

      const data = await resp.json() as PlanResponse;
      setResult(data);
      setActiveTab("timeline");
    } catch (err: any) {
      setError(err.message ?? "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [crop, plantingDate, location, settings.cityLat, settings.cityLon]);

  const plan = result?.plan;

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Farming Plan System
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Generate a complete agricultural timeline based on live weather data and real crop growth cycles
        </p>
      </div>

      {/* Plan Generator Form */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Create Your Farming Plan</CardTitle>
          <CardDescription>Select a crop, planting date, and location to generate a full seasonal schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Crop Quick Select */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Select Crop</div>
            <div className="flex flex-wrap gap-2">
              {COMMON_CROPS.map(c => (
                <button
                  key={c.name}
                  onClick={() => setCrop(c.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    crop === c.name
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted/50 border-transparent hover:border-primary/30 hover:bg-primary/5 text-muted-foreground"
                  }`}
                >
                  <span>{c.emoji}</span>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <Input
                value={crop}
                onChange={e => setCrop(e.target.value)}
                placeholder="Or type any crop name..."
                className="h-9 bg-muted/50 border-transparent focus-visible:bg-background text-sm"
              />
            </div>
          </div>

          {/* Date + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                <Calendar className="h-3 w-3 inline mr-1" />
                Planting Date
              </label>
              <Input
                type="date"
                value={plantingDate}
                onChange={e => setPlantingDate(e.target.value)}
                className="h-9 bg-muted/50 border-transparent focus-visible:bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                <MapPin className="h-3 w-3 inline mr-1" />
                Farm Location
              </label>
              <Input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="City, Region, Country..."
                className="h-9 bg-muted/50 border-transparent focus-visible:bg-background text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!crop || !plantingDate || !location || loading}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating your farming plan...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Generate Farming Plan
              </>
            )}
          </Button>

          {loading && (
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>Fetching live weather data from Open-Meteo...</p>
              <p>Generating agricultural timeline based on real crop data...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Failed to generate plan</p>
            <p className="text-xs mt-1 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Plan Result */}
      {plan && result && (
        <div className="space-y-5 animate-in fade-in duration-500">
          {/* Plan Summary Header */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{plan.crop} Farming Plan</h2>
                    <RiskBadge level={plan.weatherRiskLevel} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {plan.location}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Planting: {new Date(plan.plantingDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                    <div className="text-lg font-bold text-primary">{plan.totalGrowingDays}</div>
                    <div className="text-xs text-muted-foreground">Total Days</div>
                  </div>
                  <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {plan.estimatedHarvestStart}–{plan.estimatedHarvestEnd}
                    </div>
                    <div className="text-xs text-muted-foreground">Harvest Days</div>
                  </div>
                  <div className="bg-white/70 dark:bg-black/20 rounded-xl p-3">
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{plan.stages.length}</div>
                    <div className="text-xs text-muted-foreground">Stages</div>
                  </div>
                </div>
              </div>

              {plan.weatherRiskNotes && (
                <div className="mt-4 flex items-start gap-2 text-xs bg-white/50 dark:bg-black/20 rounded-xl p-3">
                  <Info className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                  <span>{plan.weatherRiskNotes}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {plan.varietyRecommendation && (
                  <div className="flex items-start gap-2 text-xs bg-white/50 dark:bg-black/20 rounded-xl p-3">
                    <Sprout className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                    <div>
                      <span className="font-semibold">Recommended Variety: </span>
                      {plan.varietyRecommendation}
                    </div>
                  </div>
                )}
                {plan.expectedYield && (
                  <div className="flex items-start gap-2 text-xs bg-white/50 dark:bg-black/20 rounded-xl p-3">
                    <Wheat className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-semibold">Expected Yield: </span>
                      {plan.expectedYield}
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline Bar */}
              <div className="mt-5">
                <TimelineBar plan={plan} />
              </div>

              {/* Harvest Estimate Call-out */}
              <div className="mt-4 flex items-center gap-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
                <Wheat className="h-8 w-8 text-orange-500 shrink-0" />
                <div>
                  <div className="font-semibold text-sm text-orange-800 dark:text-orange-300">
                    Estimated Harvest Window
                  </div>
                  <div className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                    Day {plan.estimatedHarvestStart}–{plan.estimatedHarvestEnd} depending on weather conditions ·{" "}
                    {(() => {
                      const start = new Date(plan.plantingDate);
                      start.setDate(start.getDate() + plan.estimatedHarvestStart);
                      const end = new Date(plan.plantingDate);
                      end.setDate(end.getDate() + plan.estimatedHarvestEnd);
                      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      return `${fmt(start)} → ${fmt(end)}`;
                    })()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
            {([
              { id: "timeline", label: "Timeline", icon: Clock },
              { id: "weather", label: "Weather", icon: Cloud },
              { id: "fertilizer", label: "Fertilizer", icon: FlaskConical },
              { id: "pests", label: "Pest Alerts", icon: Bug },
              { id: "adjustments", label: "Adjustments", icon: RefreshCw },
            ] as const).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              {/* Key Milestones */}
              {plan.milestones.length > 0 && (
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Key Milestones
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                      <div className="space-y-4">
                        {plan.milestones.map((m, i) => {
                          const Icon = MILESTONE_ICON_MAP[m.icon] ?? Activity;
                          const date = new Date(plan.plantingDate);
                          date.setDate(date.getDate() + m.day);
                          return (
                            <div key={i} className="flex items-start gap-4 pl-10 relative">
                              <div className="absolute left-0 h-7 w-7 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">{m.label}</span>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                    Day {m.day}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stages */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  All Stages ({plan.stages.length})
                </div>
                <div className="space-y-3">
                  {plan.stages.map(stage => (
                    <StageCard key={stage.id} stage={stage} plantingDate={plan.plantingDate} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Weather Tab */}
          {activeTab === "weather" && (
            <WeatherCard weatherData={result.weatherData} />
          )}

          {/* Fertilizer Tab */}
          {activeTab === "fertilizer" && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                  Fertilizer Schedule
                </CardTitle>
                <CardDescription>Application timing based on crop growth stages</CardDescription>
              </CardHeader>
              <CardContent>
                {plan.fertilizerSchedule && plan.fertilizerSchedule.length > 0 ? (
                  <div className="space-y-3">
                    {plan.fertilizerSchedule.map((item, i) => {
                      const date = new Date(plan.plantingDate);
                      date.setDate(date.getDate() + item.day);
                      return (
                        <div key={i} className="flex items-start gap-4 p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 rounded-2xl">
                          <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">D{item.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm">{item.product}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {item.rate} · {item.method}
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">{item.purpose}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No fertilizer schedule in this plan.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pests Tab */}
          {activeTab === "pests" && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-rose-500" />
                  Pest & Disease Alerts
                </CardTitle>
                <CardDescription>Common threats to monitor during the growing cycle</CardDescription>
              </CardHeader>
              <CardContent>
                {plan.pestAlerts && plan.pestAlerts.length > 0 ? (
                  <div className="space-y-3">
                    {plan.pestAlerts.map((pest, i) => (
                      <div key={i} className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/40 rounded-2xl">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                          <div className="font-semibold text-sm flex items-center gap-2">
                            <Bug className="h-4 w-4 text-rose-500" />
                            {pest.name}
                          </div>
                          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-300">
                            {pest.riskPeriod}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><span className="font-medium">Symptoms:</span> {pest.symptoms}</p>
                          <p><span className="font-medium">Treatment:</span> {pest.treatment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No specific pest alerts for this plan.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Adjustments Tab */}
          {activeTab === "adjustments" && (
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-amber-500" />
                  Weather Adjustment Rules
                </CardTitle>
                <CardDescription>How your plan automatically adapts to changing weather conditions</CardDescription>
              </CardHeader>
              <CardContent>
                {plan.weatherAdjustments.length > 0 ? (
                  <div className="space-y-3">
                    {plan.weatherAdjustments.map((adj, i) => (
                      <div key={i} className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge className={`text-[10px] ${
                            adj.impact === "delay" ? "bg-amber-100 text-amber-700 border-amber-200" :
                            adj.impact === "add_task" ? "bg-blue-100 text-blue-700 border-blue-200" :
                            "bg-rose-100 text-rose-700 border-rose-200"
                          }`}>
                            {adj.impact?.replace("_", " ")}
                          </Badge>
                          <span className="text-xs font-semibold">{adj.trigger}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{adj.action}</p>
                        {adj.affectedStages?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {adj.affectedStages.map((s, j) => (
                              <Badge key={j} variant="secondary" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">No weather adjustment rules in this plan.</p>
                )}
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            Plan generated {new Date(result.generatedAt).toLocaleString()} · Weather data from Open-Meteo · Agricultural data from verified crop research.
            Always validate with a local agronomist before making major farming decisions.
          </p>
        </div>
      )}
    </div>
  );
}

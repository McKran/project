import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sprout, MapPin, Building2, Wheat, ShoppingCart, Check,
  ArrowLeft, Scale, Search, Loader2, AlertCircle, TreePine, Banana
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CROP_OPTIONS, WEIGHT_UNIT_LABELS } from "@/lib/country-data";
import type { WeightUnit, TargetMarket } from "@/lib/country-data";
import { useSettings } from "@/hooks/use-settings";
import { useLocationStore } from "@/hooks/use-location";

const PH_COUNTRY_CODE = "PH";
const PH_COUNTRY_NAME = "Philippines";

interface PSGCRegion {
  code: string;
  name: string;
  regionName: string;
  islandGroup: string;
}

interface PSGCCity {
  code: string;
  name: string;
  isCity: boolean;
  isMunicipality: boolean;
  isCapital: boolean;
  provinceCode: string | null;
}

interface CityWithCoords extends PSGCCity {
  lat: number | null;
  lon: number | null;
}

async function fetchPSGCRegions(): Promise<PSGCRegion[]> {
  const res = await fetch(`/api/psgc/regions`);
  if (!res.ok) throw new Error("Failed to fetch regions from PSGC");
  return res.json();
}

async function fetchPSGCCities(regionCode: string): Promise<PSGCCity[]> {
  const res = await fetch(`/api/psgc/cities?region_code=${encodeURIComponent(regionCode)}`);
  if (!res.ok) throw new Error("Failed to fetch cities from PSGC");
  return res.json();
}

async function geocodeCity(cityName: string): Promise<{ lat: number; lon: number } | null> {
  const res = await fetch(`/api/psgc/geocode?city=${encodeURIComponent(cityName)}`);
  if (!res.ok) return null;
  return res.json();
}

const STEPS = [
  { id: 1, label: "Region", icon: MapPin },
  { id: 2, label: "City", icon: Building2 },
  { id: 3, label: "Crops", icon: Wheat },
  { id: 4, label: "Market", icon: ShoppingCart },
];

const ISLAND_GROUP_LABELS: Record<string, string> = {
  luzon: "Luzon",
  visayas: "Visayas",
  mindanao: "Mindanao",
};

export default function Onboarding() {
  const { completeOnboarding } = useSettings();
  const { setLocation } = useLocationStore();
  const [step, setStep] = useState(1);
  const [regionSearch, setRegionSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<PSGCRegion | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityWithCoords | null>(null);
  const [isGeocodingCity, setIsGeocodingCity] = useState(false);
  const [preferredCrops, setPreferredCrops] = useState<string[]>([]);
  const [targetMarket, setTargetMarket] = useState<TargetMarket>("local");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kilogram");

  const {
    data: regions = [],
    isLoading: regionsLoading,
    error: regionsError,
  } = useQuery<PSGCRegion[]>({
    queryKey: ["psgc-regions"],
    queryFn: fetchPSGCRegions,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const {
    data: cities = [],
    isLoading: citiesLoading,
    error: citiesError,
  } = useQuery<PSGCCity[]>({
    queryKey: ["psgc-cities", selectedRegion?.code],
    queryFn: () => fetchPSGCCities(selectedRegion!.code),
    enabled: !!selectedRegion && step === 2,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const ISLAND_GROUP_ORDER = ["Luzon", "Visayas", "Mindanao", "Other"];

  const groupedRegions = useMemo(() => {
    const filtered = regions.filter(r =>
      r.name.toLowerCase().includes(regionSearch.toLowerCase()) ||
      r.regionName.toLowerCase().includes(regionSearch.toLowerCase())
    );
    const groups: Record<string, PSGCRegion[]> = {};
    for (const r of filtered) {
      const group = ISLAND_GROUP_LABELS[r.islandGroup] ?? "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(r);
    }
    return ISLAND_GROUP_ORDER
      .filter(g => groups[g])
      .reduce((acc, g) => { acc[g] = groups[g]; return acc; }, {} as Record<string, PSGCRegion[]>);
  }, [regions, regionSearch]);

  const filteredCities = useMemo(() =>
    cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())),
    [cities, citySearch]
  );

  const toggleCrop = (name: string) => {
    setPreferredCrops(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const handleRegionSelect = (region: PSGCRegion) => {
    setSelectedRegion(region);
    setSelectedCity(null);
    setCitySearch("");
  };

  const handleCitySelect = useCallback(async (city: PSGCCity) => {
    setIsGeocodingCity(true);
    const coords = await geocodeCity(city.name);
    setSelectedCity({ ...city, lat: coords?.lat ?? null, lon: coords?.lon ?? null });
    setIsGeocodingCity(false);
  }, []);

  const handleFinish = () => {
    const cityName = selectedCity?.name ?? "";
    const regionName = selectedRegion?.regionName ?? selectedRegion?.name ?? "";
    const fullLocation = [cityName, regionName, PH_COUNTRY_NAME].filter(Boolean).join(", ");
    if (fullLocation) setLocation(fullLocation);

    completeOnboarding({
      countryCode: PH_COUNTRY_CODE,
      regionName,
      stateName: regionName,
      cityName,
      cityLat: selectedCity?.lat ?? null,
      cityLon: selectedCity?.lon ?? null,
      currency: "PHP",
      preferredCrops,
      targetMarket,
      weightUnit,
    });
  };

  const canProceed =
    step === 1 ? !!selectedRegion :
    step === 2 ? true :
    step === 3 ? preferredCrops.length > 0 :
    true;

  const cropCategories = [...new Set(CROP_OPTIONS.map(c => c.category))];

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-green-50 via-background to-blue-50 dark:from-green-950/20 dark:via-background dark:to-blue-950/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Logo + Philippines Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sprout className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-primary">AgriAssist</div>
              <div className="text-xs text-muted-foreground font-medium tracking-wide">Smart Farming Platform</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary">
            <span className="text-base">🇵🇭</span>
            <span>Philippines · ₱ PHP</span>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-4 h-px transition-colors ${step > s.id ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-card border rounded-3xl shadow-xl overflow-hidden">

          {/* Step 1: Region */}
          {step === 1 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Where is your farm?</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                Select your region — sourced from the official PSGC (Philippine Standard Geographic Code).
              </p>

              {regionsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading Philippine regions from PSGC…</p>
                </div>
              ) : regionsError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-muted-foreground">Could not load regions. Check your connection and try again.</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search regions…"
                      value={regionSearch}
                      onChange={e => setRegionSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                      autoFocus
                    />
                  </div>

                  <div className="h-72 overflow-y-auto space-y-3 pr-1">
                    {Object.entries(groupedRegions).map(([group, groupRegions]) => (
                      <div key={group}>
                        <div className="flex items-center gap-2 mb-2 ml-1">
                          {group === "Luzon" && <TreePine className="h-3.5 w-3.5 text-green-600" />}
                          {group === "Visayas" && <span className="text-sm">🌊</span>}
                          {group === "Mindanao" && <Banana className="h-3.5 w-3.5 text-yellow-600" />}
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group}</span>
                        </div>
                        <div className="space-y-1">
                          {groupRegions.map(r => {
                            const isSelected = selectedRegion?.code === r.code;
                            return (
                              <button
                                key={r.code}
                                onClick={() => handleRegionSelect(r)}
                                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border ${
                                  isSelected
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "hover:bg-muted/60 border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                    <MapPin className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm">{r.name}</div>
                                    {r.regionName !== r.name && (
                                      <div className="text-xs text-muted-foreground">{r.regionName}</div>
                                    )}
                                  </div>
                                </div>
                                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {Object.keys(groupedRegions).length === 0 && regionSearch && (
                      <p className="text-center text-muted-foreground text-sm py-8">No regions match "{regionSearch}"</p>
                    )}
                  </div>
                </>
              )}

              {selectedRegion && (
                <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{selectedRegion.name}</div>
                    {selectedRegion.regionName !== selectedRegion.name && (
                      <div className="text-xs text-muted-foreground">{selectedRegion.regionName}</div>
                    )}
                  </div>
                  <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Step 2: City/Municipality */}
          {step === 2 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Select your city or municipality</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                Official PSGC data for {selectedRegion?.regionName ?? selectedRegion?.name}. Coordinates are verified for weather accuracy.
              </p>

              {citiesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading cities for {selectedRegion?.name}…</p>
                </div>
              ) : citiesError || cities.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-muted-foreground">Could not load cities. You can skip this step.</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Search ${cities.length} cities & municipalities…`}
                      value={citySearch}
                      onChange={e => setCitySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                      autoFocus
                    />
                  </div>

                  <div className="h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredCities.map(city => {
                      const isSelected = selectedCity?.code === city.code;
                      const isGeocoding = isGeocodingCity && isSelected;
                      return (
                        <button
                          key={city.code}
                          onClick={() => handleCitySelect(city)}
                          disabled={isGeocodingCity}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "hover:bg-muted/60 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              {isGeocoding
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Building2 className="h-4 w-4" />
                              }
                            </div>
                            <div>
                              <div className="font-medium text-sm">{city.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {city.isCapital ? "Provincial Capital · " : ""}
                                {city.isCity ? "City" : "Municipality"}
                              </div>
                            </div>
                          </div>
                          {isSelected && !isGeocoding && (
                            <div className="flex items-center gap-1.5">
                              {selectedCity?.lat != null && (
                                <span className="text-xs text-primary/60 hidden sm:inline">GPS verified</span>
                              )}
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {filteredCities.length === 0 && citySearch && (
                      <p className="text-center text-muted-foreground text-sm py-8">No cities match "{citySearch}"</p>
                    )}
                  </div>
                </>
              )}

              {selectedCity && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{selectedCity.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedRegion?.regionName ?? selectedRegion?.name} · Philippines
                      {selectedCity.lat != null && <span className="ml-2 text-primary/60">· GPS verified</span>}
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                </div>
              )}

              {!selectedCity && !citiesLoading && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  City selection is optional — you can continue with region-level data
                </p>
              )}
            </div>
          )}

          {/* Step 3: Crops */}
          {step === 3 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Anong mga pananim mo?</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                Select the crops you grow — we'll personalize recommendations, DA pricing alerts, and AI advice around them. Pick at least one.
              </p>

              <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
                {cropCategories.map(category => (
                  <div key={category}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 ml-1">{category}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CROP_OPTIONS.filter(c => c.category === category).map(crop => {
                        const isSelected = preferredCrops.includes(crop.name);
                        return (
                          <button
                            key={crop.name}
                            onClick={() => toggleCrop(crop.name)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-all border ${
                              isSelected
                                ? "bg-primary/10 border-primary/40 text-primary font-medium"
                                : "bg-muted/30 border-transparent hover:bg-muted/60 text-foreground"
                            }`}
                          >
                            <span className="text-lg leading-none">{crop.emoji}</span>
                            <span className="truncate">{crop.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {preferredCrops.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  {preferredCrops.length} crop{preferredCrops.length !== 1 ? "s" : ""} selected
                </div>
              )}
            </div>
          )}

          {/* Step 4: Market & Units */}
          {step === 4 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Market & units</h1>
              <p className="text-muted-foreground mb-6 text-sm">
                We'll show farmgate prices in ₱ PHP and let you compare in USD when useful.
              </p>

              <div className="space-y-6">
                {/* Currency Info */}
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🇵🇭</span>
                    <div>
                      <div className="font-semibold text-sm">Philippine Peso (PHP)</div>
                      <div className="text-xs text-muted-foreground">All prices shown in ₱ · USD comparison available on request</div>
                    </div>
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  </div>
                </div>

                {/* Target Market */}
                <div>
                  <label className="text-sm font-semibold mb-3 block">Target market</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["local", "regional", "international"] as TargetMarket[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setTargetMarket(m)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl text-sm text-center transition-all border ${
                          targetMarket === m
                            ? "bg-primary/10 border-primary/40 text-primary font-medium"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <span className="text-xl">
                          {m === "local" ? "🏪" : m === "regional" ? "🚛" : "🌍"}
                        </span>
                        <span className="capitalize">{m}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {m === "local" ? "Palengke / wet market"
                            : m === "regional" ? "Trading centers"
                            : "Export / PSX"}
                        </span>
                        {targetMarket === m && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weight Unit */}
                <div>
                  <label className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Scale className="h-4 w-4" /> Weight unit
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(WEIGHT_UNIT_LABELS) as [WeightUnit, string][]).map(([unit, label]) => (
                      <button
                        key={unit}
                        onClick={() => setWeightUnit(unit)}
                        className={`p-3 rounded-xl text-sm text-center transition-all border ${
                          weightUnit === unit
                            ? "bg-primary/10 border-primary/40 text-primary font-medium"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        {label}
                        {weightUnit === unit && <Check className="h-3 w-3 text-primary mx-auto mt-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={() => setStep(s => s - 1)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < STEPS.length ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="gap-2 min-w-32"
              >
                {step === 1
                  ? selectedRegion ? `Continue with ${selectedRegion.name}` : "Select a Region"
                  : step === 2
                  ? selectedCity ? `Continue with ${selectedCity.name}` : "Skip (use region)"
                  : "Continue"}
                {canProceed && <Check className="h-4 w-4" />}
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                className="gap-2 min-w-32 bg-green-600 hover:bg-green-700"
              >
                <Sprout className="h-4 w-4" />
                Start Farming!
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Location data sourced from the Official PSGC · Weather via Open-Meteo · AI by DeepSeek
        </p>
      </div>
    </div>
  );
}

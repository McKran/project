import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sprout, Globe, Wheat, ShoppingCart, Check, ChevronRight, ArrowLeft, Scale, MapPin, Building2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRIES, CROP_OPTIONS, WEIGHT_UNIT_LABELS } from "@/lib/country-data";
import type { WeightUnit, TargetMarket } from "@/lib/country-data";
import { useSettings } from "@/hooks/use-settings";
import { useLocationStore } from "@/hooks/use-location";

interface GeoRegion {
  name: string;
  code: string;
}

async function fetchRegions(countryCode: string, countryName: string): Promise<GeoRegion[]> {
  const params = new URLSearchParams({ country_code: countryCode, country_name: countryName });
  const res = await fetch(`/api/geo/regions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch regions");
  return res.json();
}

const STEPS = [
  { id: 1, label: "Country", icon: Globe },
  { id: 2, label: "Region", icon: MapPin },
  { id: 3, label: "City", icon: Building2 },
  { id: 4, label: "Crops", icon: Wheat },
  { id: 5, label: "Market", icon: ShoppingCart },
];

interface GeoCity {
  name: string;
  lat: number;
  lon: number;
  country_code: string;
  admin1?: string;
  population?: number;
}

async function fetchCities(countryCode: string, region: string): Promise<GeoCity[]> {
  const params = new URLSearchParams({ country_code: countryCode });
  if (region) params.set("region", region);
  const res = await fetch(`/api/geo/cities?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch cities");
  return res.json();
}

export default function Onboarding() {
  const { completeOnboarding } = useSettings();
  const { setLocation } = useLocationStore();
  const [step, setStep] = useState(1);
  const [countryCode, setCountryCode] = useState("KE");
  const [search, setSearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [regionName, setRegionName] = useState("");
  const [stateName, setStateName] = useState("");
  const [selectedCity, setSelectedCity] = useState<GeoCity | null>(null);
  const [preferredCrops, setPreferredCrops] = useState<string[]>([]);
  const [targetMarket, setTargetMarket] = useState<TargetMarket>("local");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kilogram");

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  );

  const {
    data: regions = [],
    isLoading: regionsLoading,
    error: regionsError,
  } = useQuery<GeoRegion[]>({
    queryKey: ["geo-regions", countryCode],
    queryFn: () => fetchRegions(countryCode, selectedCountry?.name ?? countryCode),
    enabled: step === 2,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const filteredRegions = useMemo(() =>
    regions.filter(r => r.name.toLowerCase().includes(regionSearch.toLowerCase())),
    [regions, regionSearch]
  );

  const {
    data: cities = [],
    isLoading: citiesLoading,
    error: citiesError,
  } = useQuery<GeoCity[]>({
    queryKey: ["geo-cities", countryCode, regionName],
    queryFn: () => fetchCities(countryCode, regionName),
    enabled: step === 3,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });

  const filteredCities = useMemo(() =>
    cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())),
    [cities, citySearch]
  );

  const toggleCrop = (name: string) => {
    setPreferredCrops(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const handleFinish = () => {
    const cityName = selectedCity?.name ?? "";
    const fullLocation = [cityName, stateName || regionName, selectedCountry?.name].filter(Boolean).join(", ");
    if (fullLocation) setLocation(fullLocation);

    completeOnboarding({
      countryCode,
      regionName,
      stateName,
      cityName,
      cityLat: selectedCity?.lat ?? null,
      cityLon: selectedCity?.lon ?? null,
      currency: selectedCountry?.currency ?? "USD",
      preferredCrops,
      targetMarket,
      weightUnit,
    });
  };

  const canProceed = step === 1
    ? !!countryCode
    : step === 2
    ? true
    : step === 3
    ? true
    : step === 4
    ? preferredCrops.length > 0
    : true;

  const cropCategories = [...new Set(CROP_OPTIONS.map(c => c.category))];

  const handleCountrySelect = (code: string) => {
    setCountryCode(code);
    setRegionName("");
    setStateName("");
    setSelectedCity(null);
    setSearch("");
    setRegionSearch("");
    setCitySearch("");
  };

  const handleRegionSelect = (name: string) => {
    setRegionName(name);
    setStateName(name);
    setSelectedCity(null);
    setCitySearch("");
  };

  return (
    <div className="min-h-[100dvh] w-full bg-gradient-to-br from-green-50 via-background to-emerald-50 dark:from-green-950/20 dark:via-background dark:to-emerald-950/10 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Sprout className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-left">
              <div className="text-2xl font-bold text-primary">AgriAssist</div>
              <div className="text-xs text-muted-foreground font-medium tracking-wide">Smart Farming Platform</div>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
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
                  <div className={`w-4 h-px ${step > s.id ? "bg-primary" : "bg-muted"} transition-colors`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-card border rounded-3xl shadow-xl overflow-hidden">

          {/* Step 1: Country */}
          {step === 1 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Where is your farm?</h1>
              <p className="text-muted-foreground mb-6">
                We'll configure currency, climate data, and crop availability for your region.
              </p>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search country or region..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                />
              </div>

              <div className="h-72 overflow-y-auto space-y-1 pr-1">
                {filteredCountries.map(country => {
                  const isSelected = countryCode === country.code;
                  return (
                    <button
                      key={country.code}
                      onClick={() => handleCountrySelect(country.code)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30 text-primary"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{country.flag}</span>
                        <div>
                          <div className="font-semibold text-sm">{country.name}</div>
                          <div className="text-xs text-muted-foreground">{country.region}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-primary/80">{country.currencySymbol}</div>
                        <div className="text-xs text-muted-foreground">{country.currency}</div>
                      </div>
                    </button>
                  );
                })}
                {filteredCountries.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-8">No countries found</p>
                )}
              </div>

              {selectedCountry && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-4">
                  <span className="text-3xl">{selectedCountry.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{selectedCountry.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedCountry.currencyName} ({selectedCountry.currencySymbol}) · {selectedCountry.climate} climate
                    </div>
                  </div>
                  <Check className="h-5 w-5 text-primary shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Region — dynamically fetched from Open-Meteo geocoding */}
          {step === 2 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Select your region</h1>
              <p className="text-muted-foreground mb-6">
                Choose your province, state, or region in {selectedCountry?.name} for more precise local data.
              </p>

              {regionsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading regions for {selectedCountry?.name}…</p>
                </div>
              ) : regionsError || regions.length === 0 ? (
                <div className="space-y-4">
                  {regionsError && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                      Could not load regions automatically. Enter your region manually below.
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Type your region, province, or state name:</p>
                  <input
                    type="text"
                    placeholder="e.g. Oromia, Kigali Province, Northern Region..."
                    value={regionName}
                    onChange={e => { setRegionName(e.target.value); setStateName(e.target.value); }}
                    className="w-full px-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Search ${regions.length} regions…`}
                      value={regionSearch}
                      onChange={e => setRegionSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                      autoFocus
                    />
                  </div>
                  <div className="h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredRegions.map(r => {
                      const isSelected = regionName === r.name;
                      return (
                        <button
                          key={r.code}
                          onClick={() => handleRegionSelect(r.name)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "hover:bg-muted/60 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div className="font-medium text-sm">{r.name}</div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                    {filteredRegions.length === 0 && regionSearch && (
                      <p className="text-center text-muted-foreground text-sm py-8">No regions match "{regionSearch}"</p>
                    )}
                  </div>
                </>
              )}

              {regionName && (
                <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium">{regionName}, {selectedCountry?.name}</span>
                  <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                </div>
              )}

              {!regionName && !regionsLoading && (
                <p className="text-xs text-muted-foreground mt-3 text-center">You can skip this step and continue</p>
              )}
            </div>
          )}

          {/* Step 3: City — hierarchical picker from Open-Meteo */}
          {step === 3 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Select your nearest city</h1>
              <p className="text-muted-foreground mb-6">
                Pick from verified cities in {regionName ? `${regionName}, ` : ""}{selectedCountry?.name}. We use exact coordinates for weather accuracy.
              </p>

              {citiesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Loading cities for {regionName || selectedCountry?.name}…</p>
                </div>
              ) : citiesError || cities.length === 0 ? (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-200">
                    No verified cities found for this region. Enter your city name manually below.
                  </div>
                  <input
                    type="text"
                    placeholder={`e.g. ${selectedCountry?.code === "KE" ? "Nakuru" : selectedCountry?.code === "NG" ? "Ibadan" : "Enter city name"}`}
                    value={selectedCity?.name ?? citySearch}
                    onChange={e => {
                      setCitySearch(e.target.value);
                      if (e.target.value) {
                        setSelectedCity({ name: e.target.value, lat: 0, lon: 0, country_code: countryCode });
                      } else {
                        setSelectedCity(null);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                    autoFocus
                  />
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Search ${cities.length} cities…`}
                      value={citySearch}
                      onChange={e => setCitySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-colors"
                      autoFocus
                    />
                  </div>

                  <div className="h-72 overflow-y-auto space-y-1 pr-1">
                    {filteredCities.map(city => {
                      const isSelected = selectedCity?.name === city.name;
                      return (
                        <button
                          key={`${city.name}-${city.lat}`}
                          onClick={() => setSelectedCity(city)}
                          className={`w-full flex items-center justify-between p-3.5 rounded-xl text-left transition-all border ${
                            isSelected
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "hover:bg-muted/60 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <Building2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{city.name}</div>
                              {city.admin1 && (
                                <div className="text-xs text-muted-foreground">{city.admin1}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {city.population && city.population > 100000 && (
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                {city.population > 1_000_000
                                  ? `${(city.population / 1_000_000).toFixed(1)}M`
                                  : `${Math.round(city.population / 1000)}K`}
                              </span>
                            )}
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </div>
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
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <div className="font-semibold text-sm">{selectedCity.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[selectedCity.admin1 || regionName, selectedCountry?.name].filter(Boolean).join(", ")}
                        {selectedCity.lat !== 0 && (
                          <span className="ml-2 text-primary/60">· GPS verified</span>
                        )}
                      </div>
                    </div>
                    <Check className="h-4 w-4 text-primary ml-auto shrink-0" />
                  </div>
                </div>
              )}

              {!selectedCity && !citiesLoading && (
                <p className="text-xs text-muted-foreground mt-4 text-center">You can skip this and use country-level data</p>
              )}
            </div>
          )}

          {/* Step 4: Crops */}
          {step === 4 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">What do you grow?</h1>
              <p className="text-muted-foreground mb-6">
                Select your crops — we'll personalize recommendations, pricing alerts, and AI advice around them. Pick at least one.
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
                <div className="mt-4 text-sm text-muted-foreground">
                  <span className="text-primary font-semibold">{preferredCrops.length}</span> crop{preferredCrops.length !== 1 ? "s" : ""} selected: {preferredCrops.slice(0, 4).join(", ")}{preferredCrops.length > 4 ? ` +${preferredCrops.length - 4} more` : ""}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Market + Weight Unit */}
          {step === 5 && (
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-bold mb-1">Market setup</h1>
              <p className="text-muted-foreground mb-6">
                Configure how prices and profitability are displayed across the platform.
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" /> Target Market
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {([
                      { value: "local", label: "Local Market", desc: "Village / town buyers", emoji: "🏘️" },
                      { value: "regional", label: "Regional", desc: "County / district trade", emoji: "🗺️" },
                      { value: "international", label: "Export / International", desc: "Cross-border trade", emoji: "🌍" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTargetMarket(opt.value)}
                        className={`flex flex-col items-start p-4 rounded-2xl border text-left transition-all ${
                          targetMarket === opt.value
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <span className="text-2xl mb-2">{opt.emoji}</span>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Scale className="h-4 w-4 text-primary" /> Default Pricing Unit
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(["gram", "kilogram", "metric_ton"] as const).map(unit => (
                      <button
                        key={unit}
                        onClick={() => setWeightUnit(unit)}
                        className={`flex flex-col items-center p-4 rounded-2xl border text-center transition-all ${
                          weightUnit === unit
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <div className="font-bold text-lg mb-1">
                          {unit === "gram" ? "g" : unit === "kilogram" ? "kg" : "MT"}
                        </div>
                        <div className="text-xs text-muted-foreground">{WEIGHT_UNIT_LABELS[unit]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/40 rounded-2xl p-4 text-sm space-y-2">
                  <div className="font-semibold mb-3">Your configuration summary</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Country</span>
                    <span className="font-medium">{selectedCountry?.flag} {selectedCountry?.name}</span>
                  </div>
                  {regionName && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Region</span>
                      <span className="font-medium">{regionName}</span>
                    </div>
                  )}
                  {selectedCity && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">City</span>
                      <span className="font-medium flex items-center gap-1">
                        {selectedCity.name}
                        {selectedCity.lat !== 0 && <span className="text-xs text-primary/60">(GPS)</span>}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium">{selectedCountry?.currencySymbol} {selectedCountry?.currency}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pricing unit</span>
                    <span className="font-medium">{WEIGHT_UNIT_LABELS[weightUnit]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Selected crops</span>
                    <span className="font-medium">{preferredCrops.length} crops</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 flex items-center justify-between gap-4">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <div />
            )}
            {step < 5 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="gap-2 px-6"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="gap-2 px-8 bg-primary">
                <Sprout className="h-4 w-4" /> Launch AgriAssist
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          You can update all of these preferences anytime in Settings.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Sprout, Globe, Wheat, ShoppingCart, Check, ChevronRight, ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COUNTRIES, CROP_OPTIONS, WEIGHT_UNIT_LABELS } from "@/lib/country-data";
import type { WeightUnit, TargetMarket } from "@/lib/country-data";
import { useSettings } from "@/hooks/use-settings";

const STEPS = [
  { id: 1, label: "Country", icon: Globe },
  { id: 2, label: "Crops", icon: Wheat },
  { id: 3, label: "Market", icon: ShoppingCart },
];

export default function Onboarding() {
  const { completeOnboarding } = useSettings();
  const [step, setStep] = useState(1);
  const [countryCode, setCountryCode] = useState("KE");
  const [search, setSearch] = useState("");
  const [preferredCrops, setPreferredCrops] = useState<string[]>([]);
  const [targetMarket, setTargetMarket] = useState<TargetMarket>("local");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kilogram");

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.region.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCrop = (name: string) => {
    setPreferredCrops(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  };

  const handleFinish = () => {
    completeOnboarding({
      countryCode,
      currency: selectedCountry?.currency ?? "USD",
      preferredCrops,
      targetMarket,
      weightUnit,
    });
  };

  const canProceed = step === 1
    ? !!countryCode
    : step === 2
    ? preferredCrops.length > 0
    : true;

  const cropCategories = [...new Set(CROP_OPTIONS.map(c => c.category))];

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
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive ? "bg-primary text-primary-foreground shadow-sm" :
                  isDone ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-px ${step > s.id ? "bg-primary" : "bg-muted"} transition-colors`} />
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

              <input
                type="text"
                placeholder="Search country or region..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background mb-4 transition-colors"
              />

              <div className="h-72 overflow-y-auto space-y-1 pr-1">
                {filteredCountries.map(country => {
                  const isSelected = countryCode === country.code;
                  return (
                    <button
                      key={country.code}
                      onClick={() => setCountryCode(country.code)}
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

          {/* Step 2: Crops */}
          {step === 2 && (
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

          {/* Step 3: Market + Weight Unit */}
          {step === 3 && (
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
                  <p className="text-xs text-muted-foreground mt-2 ml-1">
                    Defaults to kilogram. You can change this anytime in Settings.
                  </p>
                </div>

                <div className="bg-muted/40 rounded-2xl p-4 text-sm space-y-2">
                  <div className="font-semibold mb-3">Your configuration summary</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Country</span>
                    <span className="font-medium">{selectedCountry?.flag} {selectedCountry?.name}</span>
                  </div>
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
            {step < 3 ? (
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

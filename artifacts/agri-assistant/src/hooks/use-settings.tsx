import React, { createContext, useContext, useState, useEffect } from "react";
import type { WeightUnit, TargetMarket } from "@/lib/country-data";
import { getCountryByCode, convertFromTon, convertCurrency, getCurrencySymbol } from "@/lib/country-data";

export type { WeightUnit, TargetMarket };

export interface AppSettings {
  onboardingCompleted: boolean;
  countryCode: string;
  currency: string;
  weightUnit: WeightUnit;
  preferredCrops: string[];
  targetMarket: TargetMarket;
  theme: "light" | "dark" | "system";
}

const DEFAULT_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  countryCode: "KE",
  currency: "KES",
  weightUnit: "kilogram",
  preferredCrops: [],
  targetMarket: "local",
  theme: "system",
};

const STORAGE_KEY = "agri_settings_v2";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  completeOnboarding: (data: Partial<AppSettings>) => void;
  resetOnboarding: () => void;
  formatPrice: (usdPricePerTon: number) => string;
  currencySymbol: string;
  unitLabel: string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      if (partial.theme) applyTheme(partial.theme);
      if (partial.countryCode) {
        const country = getCountryByCode(partial.countryCode);
        if (country) next.currency = country.currency;
      }
      return next;
    });
  };

  const completeOnboarding = (data: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...data, onboardingCompleted: true };
      saveSettings(next);
      return next;
    });
  };

  const resetOnboarding = () => {
    setSettings(prev => {
      const next = { ...prev, onboardingCompleted: false };
      saveSettings(next);
      return next;
    });
  };

  const currencySymbol = getCurrencySymbol(settings.currency);

  const unitLabel = settings.weightUnit === "gram"
    ? "g"
    : settings.weightUnit === "kilogram"
    ? "kg"
    : "MT";

  const formatPrice = (usdPricePerTon: number): string => {
    const converted = convertCurrency(convertFromTon(usdPricePerTon, settings.weightUnit), settings.currency);
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: converted < 1 ? 4 : 0,
      maximumFractionDigits: converted < 1 ? 4 : 2,
    }).format(converted);
    return `${currencySymbol}${formatted}`;
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, completeOnboarding, resetOnboarding, formatPrice, currencySymbol, unitLabel }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}

function applyTheme(theme: "light" | "dark" | "system") {
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } else {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}

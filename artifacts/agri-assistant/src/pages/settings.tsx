import { useState, useEffect } from "react";
import { Moon, Sun, Monitor, MapPin, Globe, DollarSign, Database, Brain, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLocationStore } from "@/hooks/use-location";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function SettingsGroup({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground ml-4 mb-2 uppercase tracking-wider">{title}</h2>
      <div className="bg-card border rounded-2xl overflow-hidden shadow-sm divide-y">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ 
  icon: Icon, 
  label, 
  value, 
  control 
}: { 
  icon: React.ElementType, 
  label: string, 
  value?: React.ReactNode, 
  control?: React.ReactNode 
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-medium text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        {value && <span className="text-sm">{value}</span>}
        {control || <ChevronRight className="h-4 w-4 opacity-50" />}
      </div>
    </div>
  );
}

export default function Settings() {
  const { location, setLocation } = useLocationStore();
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [currency, setCurrency] = useState("USD");
  const [country, setCountry] = useState("US");
  
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) setTheme(savedTheme);
    
    const savedCurrency = localStorage.getItem("currency");
    if (savedCurrency) setCurrency(savedCurrency);
    
    const savedCountry = localStorage.getItem("country");
    if (savedCountry) setCountry(savedCountry);
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  };

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your farm preferences and app experience</p>
      </div>

      <SettingsGroup title="Appearance">
        <SettingsRow 
          icon={isDark ? Moon : Sun} 
          label="Dark Mode" 
          control={
            <Switch 
              checked={isDark} 
              onCheckedChange={(checked) => handleThemeChange(checked ? "dark" : "light")} 
            />
          } 
        />
        <SettingsRow 
          icon={Monitor} 
          label="Theme Preference" 
          control={
            <Select value={theme} onValueChange={(v: any) => handleThemeChange(v)}>
              <SelectTrigger className="w-[120px] h-8 border-transparent bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          } 
        />
      </SettingsGroup>

      <SettingsGroup title="Location & Region">
        <SettingsRow 
          icon={MapPin} 
          label="Farm Location" 
          control={
            <Input 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              className="h-8 w-40 text-right border-transparent bg-muted/50 focus-visible:bg-background"
            />
          } 
        />
        <SettingsRow 
          icon={Globe} 
          label="Country" 
          value={country}
          control={
            <Select value={country} onValueChange={(v) => { setCountry(v); localStorage.setItem("country", v); }}>
              <SelectTrigger className="w-[120px] h-8 border-transparent bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="KE">Kenya</SelectItem>
                <SelectItem value="IN">India</SelectItem>
                <SelectItem value="BR">India</SelectItem>
              </SelectContent>
            </Select>
          }
        />
        <SettingsRow 
          icon={DollarSign} 
          label="Currency" 
          value={currency}
          control={
            <Select value={currency} onValueChange={(v) => { setCurrency(v); localStorage.setItem("currency", v); }}>
              <SelectTrigger className="w-[100px] h-8 border-transparent bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="KES">KES (KSh)</SelectItem>
                <SelectItem value="INR">INR (₹)</SelectItem>
              </SelectContent>
            </Select>
          }
        />
      </SettingsGroup>

      <SettingsGroup title="AI Assistant">
        <SettingsRow icon={Brain} label="Model Version" value="Agri-GPT 4.0" control={<div />} />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsRow icon={Database} label="Data Refresh Interval" value="Every 15 minutes" control={<div />} />
      </SettingsGroup>
    </div>
  );
}

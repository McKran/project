import { Link, useLocation } from "wouter";
import { LayoutDashboard, CloudSun, Sprout, TrendingUp, MessageSquare, MapPin, Settings } from "lucide-react";
import { useLocationStore } from "@/hooks/use-location";
import { Input } from "@/components/ui/input";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/weather", icon: CloudSun, label: "Weather" },
  { href: "/crops", icon: Sprout, label: "Crops" },
  { href: "/market", icon: TrendingUp, label: "Market" },
  { href: "/chat", icon: MessageSquare, label: "Ask AI" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [locationPath] = useLocation();
  const { location, setLocation } = useLocationStore();

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-72 flex-col border-r bg-card h-full shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 font-bold text-2xl text-primary">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <span>AgriAssist</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Smart farming command centre</p>
        </div>

        <div className="px-6 pb-6">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus-visible:ring-primary focus-visible:bg-background transition-colors h-11 rounded-xl"
              placeholder="Your Location..."
            />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = locationPath === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.01]'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile Header */}
        <header className="md:hidden flex-none flex items-center justify-between p-4 border-b bg-card z-10 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sprout className="h-5 w-5 text-primary" />
            </div>
            AgriAssist
          </div>
          <div className="relative w-36">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 pl-8 text-xs bg-muted/50 border-transparent rounded-lg"
              placeholder="Location..."
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto relative pb-20 md:pb-0">
          <div className="p-4 md:p-8 max-w-6xl mx-auto w-full min-h-full">
            {children}
          </div>
        </div>

        {/* Bottom Nav for Mobile */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur-md flex justify-around p-2 pb-safe z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive = locationPath === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`flex flex-col items-center gap-1.5 p-2 min-w-[64px] transition-colors rounded-lg ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}

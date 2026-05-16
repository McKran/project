import { Link, useLocation } from "wouter";
import { LayoutDashboard, CloudSun, Sprout, TrendingUp, MessageSquare, MapPin } from "lucide-react";
import { useLocationStore } from "@/hooks/use-location";
import { Input } from "@/components/ui/input";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/weather", icon: CloudSun, label: "Weather" },
  { href: "/crops", icon: Sprout, label: "Crops" },
  { href: "/market", icon: TrendingUp, label: "Market" },
  { href: "/chat", icon: MessageSquare, label: "Ask AI" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [locationPath] = useLocation();
  const { location, setLocation } = useLocationStore();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <Sprout className="h-6 w-6" />
            <span>AgriAssist</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Smart farming companion</p>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="pl-9 bg-background/50 border-muted"
              placeholder="Your Location..."
            />
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = locationPath === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pb-16 md:pb-0 min-h-0 overflow-auto">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-card/90 backdrop-blur-md">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <Sprout className="h-5 w-5" />
            AgriAssist
          </div>
          <div className="relative w-40">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-8 pl-8 text-xs bg-background/50 border-muted"
              placeholder="Location..."
            />
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* Bottom Nav for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card flex justify-around p-2 pb-safe z-50">
        {NAV_ITEMS.map((item) => {
          const isActive = locationPath === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 p-2 min-w-16 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

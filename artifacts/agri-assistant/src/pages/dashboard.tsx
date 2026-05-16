import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useLocationStore } from "@/hooks/use-location";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Cloud, Sprout, TrendingUp, AlertCircle, Lightbulb, MapPin, Wind, Droplets } from "lucide-react";

export default function Dashboard() {
  const { location } = useLocationStore();
  const { data: summary, isLoading, error } = useGetDashboardSummary(
    { location }, 
    { query: { queryKey: getGetDashboardSummaryQueryKey({ location }) } }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[300px] w-full rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-3xl h-[60vh]">
        <AlertCircle className="h-12 w-12 mb-4 text-destructive/50" />
        <h2 className="text-xl font-semibold text-foreground">Failed to load dashboard</h2>
        <p className="mt-2 max-w-sm">Please check your connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Weather Hero Card (Google Weather Style) */}
      <Link href="/weather" className="block relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg hover:shadow-xl transition-all group">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1595878715977-2e8f8df18ea8?q=80&w=2000&auto=format&fit=crop')] opacity-20 bg-cover bg-center mix-blend-overlay group-hover:scale-105 transition-transform duration-1000"></div>
        <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-50 font-medium tracking-wide">
              <MapPin className="h-4 w-4" />
              <span>{location}</span>
            </div>
            <div>
              <div className="text-8xl font-light tracking-tighter mb-2">{summary.weather.temperature}°</div>
              <div className="text-2xl font-medium capitalize">{summary.weather.condition}</div>
              <div className="text-blue-100 mt-1">Feels like {summary.weather.feelsLike}°</div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 flex items-center gap-8 border border-white/20">
            <div className="flex flex-col items-center gap-2">
              <Wind className="h-6 w-6 text-blue-100" />
              <div className="text-lg font-semibold">{summary.weather.windSpeed}</div>
              <div className="text-xs text-blue-200">km/h</div>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div className="flex flex-col items-center gap-2">
              <Droplets className="h-6 w-6 text-blue-100" />
              <div className="text-lg font-semibold">{summary.weather.humidity}%</div>
              <div className="text-xs text-blue-200">Humidity</div>
            </div>
          </div>
        </div>
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Status Cards */}
        <Link href="/crops" className="block">
          <div className="bg-card rounded-[2rem] p-6 shadow-sm border hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sprout className="h-24 w-24 text-primary" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 z-10">
              <Sprout className="h-6 w-6" />
            </div>
            <div className="mt-auto z-10">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Top Recommendation</h3>
              <div className="text-2xl font-bold truncate pr-8">{summary.topCropRecommendation}</div>
            </div>
          </div>
        </Link>

        <Link href="/market" className="block">
          <div className="bg-card rounded-[2rem] p-6 shadow-sm border hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="h-24 w-24 text-amber-500" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 z-10">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="mt-auto z-10">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Market Alert</h3>
              <div className="text-xl font-bold leading-tight line-clamp-2">{summary.marketAlert}</div>
            </div>
          </div>
        </Link>

        <Link href="/chat" className="block">
          <div className="bg-card rounded-[2rem] p-6 shadow-sm border hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <AlertCircle className="h-24 w-24 text-destructive" />
            </div>
            <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive mb-6 z-10">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="mt-auto z-10">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Action Items</h3>
              <div className="text-4xl font-bold text-destructive">{summary.alertCount}</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Tip Card */}
      <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-6 sm:p-8 flex items-start gap-6">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
          <Lightbulb className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-primary mb-2">Agronomist Tip</h3>
          <p className="text-muted-foreground leading-relaxed font-medium">{summary.farmingTip}</p>
        </div>
      </div>

    </div>
  );
}

import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { useLocationStore } from "@/hooks/use-location";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, Sprout, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { location } = useLocationStore();
  const { data: summary, isLoading, error } = useGetDashboardSummary(
    { location }, 
    { query: { queryKey: getGetDashboardSummaryQueryKey({ location }) } }
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Farm Overview</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 text-center text-destructive">
        <AlertTriangle className="h-10 w-10 mx-auto mb-4 opacity-50" />
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="text-sm opacity-80">Please check your connection and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Farm Overview</h1>
        <p className="text-muted-foreground mt-1">Current conditions for {location}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/weather" className="block">
          <Card className="hover-elevate cursor-pointer transition-all border-l-4 border-l-blue-500 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Weather</CardTitle>
              <Cloud className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.weather.temperature}°C</div>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {summary.weather.condition} • {summary.weather.rainfall}mm rain
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/crops" className="block">
          <Card className="hover-elevate cursor-pointer transition-all border-l-4 border-l-primary h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Top Crop</CardTitle>
              <Sprout className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">{summary.topCropRecommendation}</div>
              <p className="text-xs text-muted-foreground mt-1">Recommended for current season</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/market" className="block">
          <Card className="hover-elevate cursor-pointer transition-all border-l-4 border-l-amber-500 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Market Alert</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium leading-tight">{summary.marketAlert}</div>
              <p className="text-xs text-muted-foreground mt-2">Latest market trends</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/chat" className="block">
          <Card className="hover-elevate cursor-pointer transition-all border-l-4 border-l-destructive h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Action Items</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.alertCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Urgent farming alerts</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Lightbulb className="h-5 w-5" />
            Tip of the Day
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{summary.farmingTip}</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { useLocationStore } from "@/hooks/use-location";
import { 
  useGetWeather, getGetWeatherQueryKey, 
  useGetWeatherForecast, getGetWeatherForecastQueryKey,
  useGetFarmingAdvice, getGetFarmingAdviceQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Cloud, Droplets, Wind, Sun, AlertCircle } from "lucide-react";

export default function Weather() {
  const { location } = useLocationStore();

  const { data: current, isLoading: isCurrentLoading } = useGetWeather(
    { location }, 
    { query: { queryKey: getGetWeatherQueryKey({ location }) } }
  );

  const { data: forecast, isLoading: isForecastLoading } = useGetWeatherForecast(
    { location }, 
    { query: { queryKey: getGetWeatherForecastQueryKey({ location }) } }
  );

  const { data: advice, isLoading: isAdviceLoading } = useGetFarmingAdvice(
    { location }, 
    { query: { queryKey: getGetFarmingAdviceQueryKey({ location }) } }
  );

  if (isCurrentLoading || isForecastLoading || isAdviceLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Weather & Advice</h1>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!current || !forecast || !advice) {
    return (
      <div className="p-8 text-center text-destructive">
        <h2 className="text-lg font-semibold">Failed to load weather data</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weather & Advice</h1>
        <p className="text-muted-foreground mt-1">Current conditions and farming outlook for {location}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Current Weather */}
        <Card className="md:col-span-1 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-slate-900 border-none">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-5xl font-bold">{current.temperature}°C</div>
                <div className="text-lg font-medium mt-1 capitalize text-blue-900 dark:text-blue-200">{current.condition}</div>
                <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">Feels like {current.feelsLike}°C</div>
              </div>
              <Cloud className="h-12 w-12 text-blue-500 opacity-80" />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-4 border-t border-blue-200/50 dark:border-blue-800/50">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium">{current.humidity}%</div>
                  <div className="text-xs opacity-80">Humidity</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium">{current.windSpeed} km/h</div>
                  <div className="text-xs opacity-80">Wind</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium">{current.rainfall} mm</div>
                  <div className="text-xs opacity-80">Rainfall</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <div className="text-sm font-medium">{current.uvIndex}</div>
                  <div className="text-xs opacity-80">UV Index</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Advice */}
        <div className="md:col-span-2 space-y-4">
          <Card className="border-l-4 border-l-primary h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Agronomist Advice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed mb-4">{advice.advice}</p>
              
              {advice.urgentAlerts.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Urgent Actions</h4>
                  <ul className="space-y-1">
                    {advice.urgentAlerts.map((alert, i) => (
                      <li key={i} className="text-sm flex items-start gap-2 text-destructive/90">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {advice.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-primary mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {advice.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm flex items-start gap-2 text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">7-Day Forecast & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px] flex flex-col gap-4">
              {forecast.map((day, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="w-24 shrink-0">
                    <div className="font-medium">{day.dayName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</div>
                  </div>
                  <div className="w-12 text-center shrink-0">
                    <Cloud className="h-6 w-6 mx-auto text-muted-foreground" />
                  </div>
                  <div className="w-24 text-center shrink-0">
                    <div className="font-semibold">{day.high}° <span className="text-muted-foreground font-normal">{day.low}°</span></div>
                  </div>
                  <div className="w-24 text-center shrink-0 text-sm">
                    <span className="text-blue-500">{day.rainfall}mm</span>
                  </div>
                  <div className="flex-1 text-sm text-muted-foreground border-l pl-4">
                    {day.farmingNote}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

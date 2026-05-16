import { useLocationStore } from "@/hooks/use-location";
import { 
  useGetCropRecommendations, getGetCropRecommendationsQueryKey,
  useGetCropCalendar, getGetCropCalendarQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Info, Sprout, TrendingUp, AlertTriangle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Crops() {
  const { location } = useLocationStore();
  const currentMonth = new Date().getMonth() + 1;
  const currentSeason = currentMonth > 2 && currentMonth < 6 ? "Long Rains" : "Short Rains"; // Simple approximation for Kenya

  const { data: recommendations, isLoading: isRecsLoading } = useGetCropRecommendations(
    { location, season: currentSeason }, 
    { query: { queryKey: getGetCropRecommendationsQueryKey({ location, season: currentSeason }) } }
  );

  const { data: calendar, isLoading: isCalendarLoading } = useGetCropCalendar(
    { month: currentMonth }, 
    { query: { queryKey: getGetCropCalendarQueryKey({ month: currentMonth }) } }
  );

  if (isRecsLoading || isCalendarLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Crop Recommendations</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'bg-primary/20 text-primary-foreground';
      case 'medium': return 'bg-amber-500/20 text-amber-700 dark:text-amber-400';
      case 'high': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-destructive';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Crop Planning</h1>
        <p className="text-muted-foreground mt-1">Recommendations for {location} • {currentSeason} Season</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Recommendations List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sprout className="h-5 w-5" />
            Recommended Crops
          </h2>
          
          <Accordion type="single" collapsible className="w-full space-y-4" defaultValue="rec-0">
            {recommendations?.map((crop, i) => (
              <AccordionItem key={i} value={`rec-${i}`} className="border rounded-xl bg-card overflow-hidden">
                <AccordionTrigger className="px-6 hover:no-underline hover:bg-muted/50 data-[state=open]:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                        {crop.icon}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-lg">{crop.cropName}</div>
                        <div className="text-sm text-muted-foreground">Suitability: {crop.suitability}</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className={getRiskColor(crop.riskLevel)}>
                      {crop.riskLevel} Risk
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1 p-3 bg-background rounded-lg border">
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Expected Yield
                      </div>
                      <div className="font-medium">{crop.estimatedYield}</div>
                    </div>
                    <div className="space-y-1 p-3 bg-background rounded-lg border">
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" /> Planting Window
                      </div>
                      <div className="font-medium">{crop.plantingWindow}</div>
                    </div>
                    <div className="sm:col-span-2 space-y-2 p-3 bg-background rounded-lg border">
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" /> Agronomist Notes
                      </div>
                      <p className="text-sm leading-relaxed">{crop.notes}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Planting Calendar */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Upcoming Activities
          </h2>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Next 30 Days</CardTitle>
              <CardDescription>Scheduled farming tasks</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {calendar && calendar.length > 0 ? (
                <div className="divide-y">
                  {calendar.map((event, i) => (
                    <div key={i} className="p-4 flex gap-4 hover:bg-muted/50 transition-colors">
                      <div className="w-12 text-center shrink-0">
                        <div className="text-2xl font-bold text-primary">{event.daysFromNow}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Days</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{event.crop}</span>
                          <AlertTriangle className={`h-3.5 w-3.5 ${getPriorityColor(event.priority)}`} />
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {event.activity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No upcoming activities scheduled for this month.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

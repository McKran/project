import { useLocationStore } from "@/hooks/use-location";
import { 
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketTrends, getGetMarketTrendsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, AlertCircle, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function Market() {
  const { location } = useLocationStore();
  const [category, setCategory] = useState<string>("all");

  const { data: prices, isLoading: isPricesLoading } = useGetMarketPrices(
    category !== "all" ? { category } : undefined, 
    { query: { queryKey: getGetMarketPricesQueryKey(category !== "all" ? { category } : undefined) } }
  );

  const { data: trends, isLoading: isTrendsLoading } = useGetMarketTrends(
    { query: { queryKey: getGetMarketTrendsQueryKey() } }
  );

  if (isPricesLoading || isTrendsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Market Prices</h1>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const renderTrendIcon = (trend: string, percent: number) => {
    switch (trend.toLowerCase()) {
      case 'rising':
        return <span className="flex items-center text-destructive"><ArrowUpRight className="h-4 w-4 mr-1" /> {percent}%</span>;
      case 'falling':
        return <span className="flex items-center text-primary"><ArrowDownRight className="h-4 w-4 mr-1" /> {percent}%</span>;
      default:
        return <span className="flex items-center text-muted-foreground"><Minus className="h-4 w-4 mr-1" /> {percent}%</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Prices</h1>
          <p className="text-muted-foreground mt-1">Local and international price tracking</p>
        </div>
        <div className="w-full sm:w-48">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Filter category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="cereals">Cereals</SelectItem>
              <SelectItem value="vegetables">Vegetables</SelectItem>
              <SelectItem value="fruits">Fruits</SelectItem>
              <SelectItem value="cash-crops">Cash Crops</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {trends && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-card to-muted/50 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4 text-destructive" /> Top Gainer
              </div>
              <div className="text-lg font-bold">{trends.topGainer}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/50 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4 text-primary" style={{ transform: 'scaleY(-1)' }} /> Top Loser
              </div>
              <div className="text-lg font-bold">{trends.topLoser}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/50 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <BarChart3 className="h-4 w-4 text-blue-500" /> Most Stable
              </div>
              <div className="text-lg font-bold">{trends.mostStable}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/50 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Market Sentiment
              </div>
              <div className="text-lg font-bold capitalize">{trends.marketSentiment}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Price Index</CardTitle>
            <CardDescription>Prices per standard unit in local currency</CardDescription>
          </div>
          {trends && <div className="text-xs text-muted-foreground">Updated {trends.lastUpdated}</div>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Crop</th>
                  <th className="px-6 py-3 font-medium">Local Price</th>
                  <th className="px-6 py-3 font-medium hidden sm:table-cell">Int'l Price</th>
                  <th className="px-6 py-3 font-medium">Unit</th>
                  <th className="px-6 py-3 font-medium">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {prices?.map((item, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold">{item.crop}</div>
                      <div className="text-xs text-muted-foreground capitalize sm:hidden">{item.category}</div>
                    </td>
                    <td className="px-6 py-4 font-medium">${item.localPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">${item.internationalPrice.toFixed(2)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{item.unit}</td>
                    <td className="px-6 py-4">
                      {renderTrendIcon(item.trend, item.changePercent)}
                    </td>
                  </tr>
                ))}
                {(!prices || prices.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                      No market data available for this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

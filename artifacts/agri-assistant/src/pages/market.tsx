import { useLocationStore } from "@/hooks/use-location";
import { useSettings } from "@/hooks/use-settings";
import { convertFromTon, convertCurrency, getCurrencySymbol, WEIGHT_UNIT_SHORT } from "@/lib/country-data";
import {
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetMarketTrends, getGetMarketTrendsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, AlertCircle, BarChart3, Scale } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Market() {
  const { location } = useLocationStore();
  const { settings } = useSettings();
  const isMobile = useIsMobile();
  const [category, setCategory] = useState<string>("all");

  const { data: prices, isLoading: isPricesLoading } = useGetMarketPrices(
    category !== "all" ? { category } : undefined,
    { query: { queryKey: getGetMarketPricesQueryKey(category !== "all" ? { category } : undefined) } }
  );

  const { data: trends, isLoading: isTrendsLoading } = useGetMarketTrends(
    { query: { queryKey: getGetMarketTrendsQueryKey() } }
  );

  const currencySymbol = getCurrencySymbol(settings.currency);
  const unitShort = WEIGHT_UNIT_SHORT[settings.weightUnit];

  const formatPrice = (usdPerTon: number) => {
    const converted = convertCurrency(convertFromTon(usdPerTon, settings.weightUnit), settings.currency);
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: converted < 1 ? 4 : 0,
      maximumFractionDigits: converted < 1 ? 4 : 2,
    }).format(converted);
    return `${currencySymbol}${formatted}`;
  };

  if (isPricesLoading || isTrendsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Market Prices</h1>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const renderTrendBadge = (trend: string, percent: number) => {
    switch (trend.toLowerCase()) {
      case "rising":
        return (
          <span className="flex items-center gap-1 text-destructive font-semibold">
            <ArrowUpRight className="h-4 w-4" /> {percent}%
          </span>
        );
      case "falling":
        return (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <ArrowDownRight className="h-4 w-4" /> {percent}%
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Minus className="h-4 w-4" /> {percent}%
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Prices</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            Local and international price tracking
            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
              <Scale className="h-3 w-3" /> {currencySymbol} / {unitShort}
            </span>
          </p>
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

      {/* Trend Summary Cards */}
      {trends && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-card to-muted/40 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-destructive" /> Top Gainer
              </div>
              <div className="text-base font-bold">{trends.topGainer}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/40 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary rotate-180" /> Top Loser
              </div>
              <div className="text-base font-bold">{trends.topLoser}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/40 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-blue-500" /> Most Stable
              </div>
              <div className="text-base font-bold">{trends.mostStable}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-card to-muted/40 border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-2">
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Sentiment
              </div>
              <div className="text-base font-bold capitalize">{trends.marketSentiment}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Price Table — Desktop */}
      {!isMobile && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Price Index</CardTitle>
              <CardDescription>
                Prices in {settings.currency} per {unitShort} · converted from USD base rates
              </CardDescription>
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
                    <th className="px-6 py-3 font-medium">Int'l Price</th>
                    <th className="px-6 py-3 font-medium">Unit</th>
                    <th className="px-6 py-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prices?.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold">{item.crop}</div>
                        <div className="text-xs text-muted-foreground capitalize">{item.category}</div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">{formatPrice(item.localPrice)}</td>
                      <td className="px-6 py-4 text-muted-foreground">{formatPrice(item.internationalPrice)}</td>
                      <td className="px-6 py-4 text-muted-foreground text-xs font-medium">{unitShort}</td>
                      <td className="px-6 py-4">{renderTrendBadge(item.trend, item.changePercent)}</td>
                    </tr>
                  ))}
                  {(!prices || prices.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                        No market data available for this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Cards — Mobile */}
      {isMobile && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Price Index</h2>
            {trends && <span className="text-xs text-muted-foreground">Updated {trends.lastUpdated}</span>}
          </div>
          {prices?.map((item, i) => (
            <div
              key={i}
              className="bg-card border rounded-2xl p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base">{item.crop}</div>
                <div className="text-xs text-muted-foreground capitalize mt-0.5">{item.category}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-lg">{formatPrice(item.localPrice)}</div>
                <div className="text-xs text-muted-foreground">{unitShort}</div>
              </div>
              <div className="shrink-0 w-16 text-right">
                {renderTrendBadge(item.trend, item.changePercent)}
              </div>
            </div>
          ))}
          {(!prices || prices.length === 0) && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No market data available for this category.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

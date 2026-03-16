import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, RefreshCw, Loader2, CalendarDays } from "lucide-react";
import { getUserTime, loadUserSettings } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type NewsItem = {
  title: string;
  currency: string;
  impact: string;
  time: string;
  date: string;
  dateNormalized: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  day: "today" | "next" | "other";
};

type NewsResponse = {
  items: NewsItem[];
  todayStr: string;
  nextStr: string;
};

const CURRENCY_STYLE: Record<string, { badge: string; dot: string }> = {
  EUR: { badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400", dot: "bg-emerald-500" },
  USD: { badge: "bg-red-500/15 border-red-500/40 text-red-400", dot: "bg-red-500" },
};

function msTillMidnightBerlin(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const berlinMs = utc + 3600000;
  const berlinNow = new Date(berlinMs);
  const berlinMidnight = new Date(berlinNow);
  berlinMidnight.setHours(24, 0, 0, 0);
  return berlinMidnight.getTime() - berlinNow.getTime();
}

function formatFullDate(dateStr: string): { weekday: string; full: string } {
  if (!dateStr) return { weekday: "", full: "" };
  try {
    const d = new Date(dateStr + "T12:00:00Z");
    return {
      weekday: d.toLocaleDateString("ru-RU", { weekday: "long" }),
      full: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    };
  } catch {
    return { weekday: "", full: dateStr };
  }
}

function NewsRow({ item }: { item: NewsItem }) {
  const style = CURRENCY_STYLE[item.currency] || { badge: "bg-muted border-border text-foreground", dot: "bg-muted-foreground" };
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-card-border last:border-0"
      data-testid={`news-row-${item.currency}-${item.time}`}
    >
      <div className="flex-shrink-0 w-[60px] text-right">
        <span className="font-mono text-sm font-bold text-foreground">{item.time}</span>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
      <Badge
        variant="outline"
        className={`flex-shrink-0 font-mono text-xs font-bold px-2 py-0 h-5 border ${style.badge}`}
      >
        {item.currency}
      </Badge>
      <span className="font-display text-sm text-foreground flex-1 leading-snug">{item.title}</span>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0 animate-pulse">
          <div className="w-14 h-4 bg-muted rounded ml-auto flex-shrink-0" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted flex-shrink-0" />
          <div className="w-10 h-5 bg-muted rounded-full flex-shrink-0" />
          <div className="flex-1 h-4 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [berlinTime, setBerlinTime] = useState(getUserTime());
  const utcOffset = loadUserSettings().utcOffset;
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();


  const { data, isLoading, isFetching } = useQuery<NewsResponse>({
    queryKey: ["/api/news", utcOffset],
    queryFn: async () => {
      const res = await fetch(`/api/news?utcOffset=${utcOffset}`, { credentials: "include" });
      return res.json();
    },
    staleTime: msTillMidnightBerlin(),
    gcTime: msTillMidnightBerlin() + 60000,
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return { items: raw as NewsItem[], todayStr: "", nextStr: "" };
      return raw as NewsResponse;
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getUserTime()), 15000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const items = data?.items || [];
  const nextStr = data?.nextStr || "";
  const todayItems = items.filter(n => n.day === "today");
  const nextItems = items.filter(n => n.day === "next");
  const nextDate = formatFullDate(nextStr);

  const isSpinning = isLoading || isFetching || refreshing;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiRequest("POST", "/api/news/refresh");
      await queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      await queryClient.refetchQueries({ queryKey: ["/api/news"] });
      toast({ title: "Обновлено", description: "Данные загружены с Forex Factory" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось загрузить данные" });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Forex Factory
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/20 px-2.5 py-1.5 rounded-full border border-border">
              <Clock className="w-3 h-3" />
              <span>{utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`} — {timeStr}</span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isSpinning}
              className="h-8 gap-1.5 rounded-full text-xs font-display uppercase tracking-widest"
              data-testid="button-refresh-news"
            >
              {isSpinning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Обновить
            </Button>
          </div>
        </div>

        {/* Alert if events today */}
        {!isLoading && todayItems.length > 0 && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
            <div>
              <div className="font-display text-sm font-bold text-foreground uppercase tracking-tight">
                {todayItems.length} важных событий сегодня
              </div>
              <div className="text-xs text-muted-foreground">Высокая волатильность по EUR/USD</div>
            </div>
          </Card>
        )}

        {/* Tabs — always visible */}
        <Tabs defaultValue="today">
          <TabsList className="w-full rounded-xl h-10">
            <TabsTrigger value="today" className="flex-1 font-display text-xs gap-1.5" data-testid="tab-today">
              Сегодня
              {!isLoading && todayItems.length > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full">{todayItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="next" className="flex-1 font-display text-xs gap-1.5 min-w-0" data-testid="tab-next">
              {isLoading || !nextStr ? (
                <span>Ближайший день</span>
              ) : (
                <span className="capitalize truncate">{nextDate.weekday}</span>
              )}
              {!isLoading && nextItems.length > 0 && (
                <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full flex-shrink-0">{nextItems.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Today */}
          <TabsContent value="today" className="mt-3">
            <Card className="px-4 py-1 border-card-border rounded-2xl">
              {isLoading ? (
                <SkeletonRows />
              ) : todayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Newspaper className="w-7 h-7 opacity-15" />
                  <p className="text-sm text-muted-foreground font-display">Важных новостей по EUR/USD сегодня нет</p>
                </div>
              ) : (
                todayItems.map((n, i) => <NewsRow key={`today-${i}`} item={n} />)
              )}
            </Card>
          </TabsContent>

          {/* Next day */}
          <TabsContent value="next" className="mt-3 space-y-3">
            {/* Date header */}
            {!isLoading && nextStr && (
              <div className="flex items-center gap-3 px-1">
                <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
                <div>
                  <div className="font-display text-sm font-bold text-foreground capitalize">{nextDate.weekday}</div>
                  <div className="text-xs text-muted-foreground font-mono">{nextDate.full}</div>
                </div>
              </div>
            )}

            <Card className="px-4 py-1 border-card-border rounded-2xl">
              {isLoading ? (
                <SkeletonRows />
              ) : nextItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Newspaper className="w-7 h-7 opacity-15" />
                  <p className="text-sm text-muted-foreground font-display">Нет предстоящих важных новостей по EUR/USD</p>
                </div>
              ) : (
                nextItems.map((n, i) => <NewsRow key={`next-${i}`} item={n} />)
              )}
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
          Forex Factory · HIGH IMPACT · EUR &amp; USD · Обновляется ежедневно
        </p>
      </div>
    </div>
  );
}

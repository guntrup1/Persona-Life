import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { getBerlinTime } from "@/lib/store";
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

const CURRENCY_COLORS: Record<string, string> = {
  EUR: "text-emerald-400",
  USD: "text-blue-400",
};

const CURRENCY_BG: Record<string, string> = {
  EUR: "bg-emerald-500/20 border-emerald-500/30",
  USD: "bg-blue-500/20 border-blue-500/30",
};

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return dateStr;
  }
}

function NewsCard({ news, showPast }: { news: NewsItem; showPast: boolean }) {
  const berlinNow = getBerlinTime();
  const currentTimeMinutes = berlinNow.getHours() * 60 + berlinNow.getMinutes();
  const isPast = showPast && news.day === "today" && (() => {
    const m = news.time.match(/(\d+):(\d+)(am|pm)?/i);
    if (!m) return false;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const period = m[3]?.toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return h * 60 + min < currentTimeMinutes;
  })();

  return (
    <Card
      className={`p-3 border-card-border rounded-xl transition-all ${isPast ? "opacity-50" : ""}`}
      data-testid={`news-card-${news.currency}-${news.time}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[56px]">
          <span className="font-mono text-xs font-bold text-foreground">{news.time}</span>
          <div className={`w-2.5 h-2.5 rounded-full bg-red-500 ${!isPast ? "animate-pulse" : ""}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge
              variant="outline"
              className={`font-mono text-xs font-bold px-1.5 py-0 h-5 ${CURRENCY_BG[news.currency] || ""} ${CURRENCY_COLORS[news.currency] || "text-foreground"} border-current`}
            >
              {news.currency}
            </Badge>
            <Badge
              variant="outline"
              className="font-display text-xs font-bold px-1.5 py-0 h-5 bg-red-500/20 border-red-500/30 text-red-400"
            >
              HIGH
            </Badge>
            {isPast && news.actual && (
              <Badge variant="outline" className="text-xs py-0 h-5 border-green-500/30 text-green-400 font-mono">
                Факт: {news.actual}
              </Badge>
            )}
          </div>
          <p className="font-display text-sm text-foreground font-medium leading-snug">{news.title}</p>
          {(news.forecast || news.previous) && (
            <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground font-mono">
              {news.forecast && <span>Прогноз: <span className="text-foreground font-medium">{news.forecast}</span></span>}
              {news.previous && <span>Пред.: <span className="text-foreground font-medium">{news.previous}</span></span>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function NewsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-3 border-card-border rounded-xl animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-12 bg-muted rounded-lg" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="flex gap-2">
                <div className="w-12 h-4 bg-muted rounded-full" />
                <div className="w-10 h-4 bg-muted rounded-full" />
              </div>
              <div className="w-full h-4 bg-muted rounded" />
              <div className="w-2/3 h-3 bg-muted rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="p-10 text-center border-dashed border-border bg-muted/5 rounded-2xl">
      <Newspaper className="w-8 h-8 mx-auto mb-3 opacity-20" />
      <p className="font-display text-sm text-muted-foreground">{message}</p>
    </Card>
  );
}

export default function NewsPage() {
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery<NewsResponse>({
    queryKey: ["/api/news"],
    staleTime: 1000 * 60 * 30,
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return { items: raw, todayStr: "", nextStr: "" };
      return raw as NewsResponse;
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/news/refresh"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({ title: "Обновлено", description: "Данные с Forex Factory получены заново" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось обновить данные" });
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 10000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const items = data?.items || [];
  const todayStr = data?.todayStr || "";
  const nextStr = data?.nextStr || "";

  const todayItems = items.filter(n => n.day === "today");
  const nextItems = items.filter(n => n.day === "next");

  const nextDayLabel = nextStr ? formatDate(nextStr) : "Следующий день";

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display">Ошибка загрузки</h2>
          <p className="text-muted-foreground text-sm">Не удалось получить данные с сервера</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2 rounded-full">
          <RefreshCw className="w-4 h-4" />
          Попробовать снова
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Forex Calendar
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/30 px-2.5 py-1.5 rounded-full">
              <Clock className="w-3 h-3" />
              <span>UTC+1 — {timeStr}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 rounded-full text-xs"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-news"
            >
              <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Обновить
            </Button>
          </div>
        </div>

        {!isLoading && todayItems.length > 0 && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
            <div>
              <div className="font-display text-sm text-foreground font-bold uppercase tracking-tight">
                {todayItems.length} важных событий сегодня
              </div>
              <div className="text-xs text-muted-foreground">Высокая волатильность по EUR/USD</div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="today">
          <TabsList className="w-full rounded-xl">
            <TabsTrigger value="today" className="flex-1 font-display text-xs" data-testid="tab-today">
              Сегодня
              {!isLoading && todayItems.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 font-mono text-xs rounded-full h-4 px-1.5">{todayItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="next" className="flex-1 font-display text-xs" data-testid="tab-next">
              {nextStr ? (
                <span className="truncate max-w-[120px]">{nextDayLabel}</span>
              ) : (
                "Ближайший день"
              )}
              {!isLoading && nextItems.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 font-mono text-xs rounded-full h-4 px-1.5">{nextItems.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-2">
            {isLoading ? (
              <NewsSkeleton />
            ) : todayItems.length === 0 ? (
              <EmptyState message="Важных новостей по EUR/USD на сегодня нет" />
            ) : (
              todayItems.map((n, i) => <NewsCard key={`today-${i}`} news={n} showPast={true} />)
            )}
          </TabsContent>

          <TabsContent value="next" className="mt-4 space-y-2">
            {nextStr && (
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-3 px-1">
                {nextDayLabel}
              </div>
            )}
            {isLoading ? (
              <NewsSkeleton />
            ) : nextItems.length === 0 ? (
              <EmptyState message="Нет предстоящих важных новостей на этой неделе" />
            ) : (
              nextItems.map((n, i) => <NewsCard key={`next-${i}`} news={n} showPast={false} />)
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center text-[10px] text-muted-foreground uppercase tracking-widest py-1 font-mono">
          Источник: Forex Factory · HIGH IMPACT · EUR/USD · Кэш обновляется раз в сутки
        </div>
      </div>
    </div>
  );
}

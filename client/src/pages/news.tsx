import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, RefreshCw, Loader2 } from "lucide-react";
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

const CURRENCY_STYLE: Record<string, { badge: string; dot: string }> = {
  EUR: { badge: "bg-emerald-500/15 border-emerald-500/40 text-emerald-400", dot: "bg-emerald-500" },
  USD: { badge: "bg-blue-500/15 border-blue-500/40 text-blue-400", dot: "bg-blue-500" },
};

function formatNextLabel(dateStr: string): string {
  if (!dateStr) return "Ближайший день";
  try {
    const d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return dateStr;
  }
}

function NewsRow({ item }: { item: NewsItem }) {
  const style = CURRENCY_STYLE[item.currency] || { badge: "bg-muted border-border text-foreground", dot: "bg-muted-foreground" };
  return (
    <div
      className="flex items-center gap-3 py-3 border-b border-card-border last:border-0"
      data-testid={`news-row-${item.currency}-${item.time}`}
    >
      <div className="flex-shrink-0 w-16 text-right">
        <span className="font-mono text-sm font-bold text-foreground">{item.time}</span>
      </div>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot} animate-pulse`} />
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

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <Newspaper className="w-8 h-8 opacity-15" />
      <p className="text-sm text-muted-foreground font-display">{message}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-card-border last:border-0 animate-pulse">
          <div className="w-16 h-4 bg-muted rounded ml-auto" />
          <div className="w-1.5 h-1.5 rounded-full bg-muted flex-shrink-0" />
          <div className="w-10 h-5 bg-muted rounded-full flex-shrink-0" />
          <div className="flex-1 h-4 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const { data, isLoading: queryLoading } = useQuery<NewsResponse>({
    queryKey: ["/api/news"],
    enabled: false,
    staleTime: Infinity,
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return { items: raw as NewsItem[], todayStr: "", nextStr: "" };
      return raw as NewsResponse;
    },
  });

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 15000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const items = data?.items || [];
  const nextStr = data?.nextStr || "";

  const todayItems = items.filter(n => n.day === "today");
  const nextItems = items.filter(n => n.day === "next");
  const nextLabel = formatNextLabel(nextStr);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await apiRequest("POST", "/api/news/refresh");
      await queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      await queryClient.refetchQueries({ queryKey: ["/api/news"] });
      toast({ title: "Данные обновлены", description: "Новости загружены с Forex Factory" });
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось получить данные" });
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || queryLoading;
  const hasData = items.length > 0;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">

        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Forex Factory
          </h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/20 px-2.5 py-1.5 rounded-full border border-border">
              <Clock className="w-3 h-3" />
              <span>UTC+1 — {timeStr}</span>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 gap-1.5 rounded-full text-xs font-display uppercase tracking-widest"
              data-testid="button-refresh-news"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Обновить
            </Button>
          </div>
        </div>

        {!isLoading && hasData && todayItems.length > 0 && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-display text-sm font-bold text-foreground uppercase tracking-tight">
                {todayItems.length} важных событий сегодня
              </div>
              <div className="text-xs text-muted-foreground">Ожидается высокая волатильность EUR/USD</div>
            </div>
          </Card>
        )}

        {!hasData && !isLoading && (
          <Card className="p-6 border-dashed border-border bg-muted/5 rounded-2xl text-center space-y-3">
            <Newspaper className="w-10 h-10 mx-auto opacity-15" />
            <div className="space-y-1">
              <p className="font-display text-sm font-bold text-foreground uppercase tracking-wider">Нет данных</p>
              <p className="text-xs text-muted-foreground">Нажми «Обновить» чтобы загрузить новости с Forex Factory</p>
            </div>
            <Button
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outline"
              className="rounded-full text-xs font-display gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Загрузить данные
            </Button>
          </Card>
        )}

        {(hasData || isLoading) && (
          <Tabs defaultValue="today">
            <TabsList className="w-full rounded-xl h-10">
              <TabsTrigger value="today" className="flex-1 font-display text-xs gap-1.5" data-testid="tab-today">
                Сегодня
                {hasData && todayItems.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full">{todayItems.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="next" className="flex-1 font-display text-xs gap-1.5 min-w-0" data-testid="tab-next">
                <span className="truncate">{nextStr ? nextLabel : "Ближайший"}</span>
                {hasData && nextItems.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full flex-shrink-0">{nextItems.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-3">
              <Card className="px-4 py-1 border-card-border rounded-2xl">
                {isLoading ? (
                  <SkeletonRows />
                ) : todayItems.length === 0 ? (
                  <EmptyCard message="Важных новостей по EUR/USD на сегодня нет" />
                ) : (
                  todayItems.map((n, i) => <NewsRow key={`today-${i}`} item={n} />)
                )}
              </Card>
            </TabsContent>

            <TabsContent value="next" className="mt-3">
              <Card className="px-4 py-1 border-card-border rounded-2xl">
                {isLoading ? (
                  <SkeletonRows />
                ) : nextItems.length === 0 ? (
                  <EmptyCard message="Нет предстоящих важных новостей по EUR/USD" />
                ) : (
                  nextItems.map((n, i) => <NewsRow key={`next-${i}`} item={n} />)
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-mono pt-1">
          Источник: Forex Factory · HIGH IMPACT · EUR &amp; USD
        </p>
      </div>
    </div>
  );
}

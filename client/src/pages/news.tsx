import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { getBerlinTime } from "@/lib/store";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ImpactLevel = "High" | "Medium" | "Low";
type NewsItem = {
  title: string;
  currency: string;
  impact: ImpactLevel;
  time: string;
  date: string;
  dateNormalized: string;
  actual?: string;
  forecast?: string;
  previous?: string;
  day: "today" | "tomorrow" | "other";
};

const IMPACT_CONFIG: Record<ImpactLevel, { color: string; bg: string; label: string }> = {
  High: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", label: "HIGH" },
  Medium: { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "MEDIUM" },
  Low: { color: "text-green-400", bg: "bg-green-500/20 border-green-500/30", label: "LOW" },
};

const CURRENCY_COLORS: Record<string, string> = {
  EUR: "text-green-400",
  USD: "text-blue-400",
};

function NewsCard({ news }: { news: NewsItem }) {
  const impact = IMPACT_CONFIG[news.impact] || IMPACT_CONFIG.Low;
  const berlinNow = getBerlinTime();
  const currentTimeStr = berlinNow.toTimeString().slice(0, 5);
  const isPast = news.day === "today" && news.time < currentTimeStr;

  return (
    <Card
      className={`p-3 border-card-border hover-elevate transition-all ${isPast ? "opacity-50" : ""}`}
      data-testid={`news-item-${news.title}-${news.time}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[60px]">
          <Badge variant="outline" className="font-mono text-xs font-bold border-muted-foreground/30 px-1.5">
            {news.time}
          </Badge>
          <div className={`w-2 h-2 rounded-full ${
            news.impact === "High" ? "bg-red-500" :
            news.impact === "Medium" ? "bg-yellow-500" : "bg-green-500"
          } ${!isPast ? "animate-pulse" : ""}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`font-display text-xs font-bold border-current ${CURRENCY_COLORS[news.currency] || "text-foreground"}`}>
              {news.currency}
            </Badge>
            <Badge variant="outline" className={`text-xs py-0 h-4 ${impact.bg} ${impact.color} border-current font-bold`}>
              {impact.label}
            </Badge>
            {isPast && news.actual && (
              <Badge variant="outline" className="text-xs py-0 h-4 border-green-500/30 text-green-400">
                Факт: {news.actual}
              </Badge>
            )}
          </div>
          <p className="font-display text-sm text-foreground font-medium">{news.title}</p>
          {(news.forecast || news.previous) && (
            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground font-mono uppercase tracking-tight">
              {news.forecast && <span>Прогноз: <span className="text-foreground">{news.forecast}</span></span>}
              {news.previous && <span>Пред.: <span className="text-foreground">{news.previous}</span></span>}
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
        <Card key={i} className="p-3 border-card-border animate-pulse">
          <div className="flex gap-3">
            <div className="w-12 h-10 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="w-24 h-4 bg-muted rounded" />
              <div className="w-full h-4 bg-muted rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const { toast } = useToast();

  const { data: news = [], isLoading, isError, refetch } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/news/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      toast({
        title: "Обновлено",
        description: "Список новостей успешно обновлен",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить новости",
      });
    }
  });

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const todayNews = news.filter(n => n.day === "today");
  const tomorrowNews = news.filter(n => n.day === "tomorrow");

  const highImpactTodayCount = todayNews.filter(n => n.impact === "High").length;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-bold font-display">Ошибка загрузки</h2>
          <p className="text-muted-foreground">Не удалось получить данные с сервера</p>
        </div>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
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
            Экономический календарь
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            <span>UTC+1 BERLIN: {timeStr}</span>
          </div>
        </div>

        {highImpactTodayCount > 0 && !isLoading && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-display text-sm text-foreground font-bold uppercase tracking-tight">
                {highImpactTodayCount} ВАЖНЫХ СОБЫТИЙ СЕГОДНЯ
              </div>
              <div className="text-xs text-muted-foreground">Высокая волатильность ожидается</div>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-3 h-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Обновить данные
            </Button>
          </div>

          <Tabs defaultValue="today">
            <TabsList className="w-full">
              <TabsTrigger value="today" className="flex-1 font-display" data-testid="tab-news-today">
                Сегодня
              </TabsTrigger>
              <TabsTrigger value="tomorrow" className="flex-1 font-display" data-testid="tab-news-tomorrow">
                Завтра
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-4 space-y-2 animate-slide-in-up">
              {isLoading ? (
                <NewsSkeleton />
              ) : todayNews.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-border bg-muted/10">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="font-display text-sm text-muted-foreground">Важных новостей на сегодня нет</p>
                </Card>
              ) : (
                todayNews.map((n, i) => <NewsCard key={`${n.title}-${i}`} news={n} />)
              )}
            </TabsContent>

            <TabsContent value="tomorrow" className="mt-4 space-y-2 animate-slide-in-up">
              {isLoading ? (
                <NewsSkeleton />
              ) : tomorrowNews.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-border bg-muted/10">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="font-display text-sm text-muted-foreground">Важных новостей на завтра нет</p>
                </Card>
              ) : (
                tomorrowNews.map((n, i) => <NewsCard key={`${n.title}-${i}`} news={n} />)
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Card className="p-3 bg-muted/20 border-dashed border-border">
          <p className="text-[10px] text-muted-foreground text-center uppercase tracking-widest">
            Источник: Forex Factory • HIGH IMPACT ONLY • EUR/USD ONLY
          </p>
        </Card>
      </div>
    </div>
  );
}


import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Newspaper, AlertTriangle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { getBerlinTime } from "@/lib/store";

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
};

const IMPACT_CONFIG: Record<ImpactLevel, { color: string; bg: string; label: string }> = {
  High: { color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", label: "Высокое" },
  Medium: { color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", label: "Среднее" },
  Low: { color: "text-green-400", bg: "bg-green-500/20 border-green-500/30", label: "Низкое" },
};

const CURRENCY_COLORS: Record<string, string> = {
  EUR: "text-blue-400",
  USD: "text-green-400",
  GBP: "text-purple-400",
  JPY: "text-orange-400",
  CHF: "text-red-400",
};

function NewsCard({ news }: { news: NewsItem }) {
  const impact = IMPACT_CONFIG[news.impact] || IMPACT_CONFIG.Low;
  const berlinNow = getBerlinTime();
  const currentTimeStr = berlinNow.toTimeString().slice(0, 5);
  const isPast = news.dateNormalized === berlinNow.toISOString().split("T")[0] && news.time < currentTimeStr;

  return (
    <Card
      className={`p-3 border-card-border hover-elevate transition-all ${isPast ? "opacity-50" : ""}`}
      data-testid={`news-item-${news.title}-${news.time}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[50px]">
          <span className="font-mono text-sm font-bold text-foreground">{news.time}</span>
          <div className={`w-2 h-2 rounded-full ${
            news.impact === "High" ? "bg-red-500" :
            news.impact === "Medium" ? "bg-yellow-500" : "bg-green-500"
          } ${!isPast ? "animate-pulse" : ""}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`font-display text-xs font-bold ${CURRENCY_COLORS[news.currency] || "text-foreground"}`}>
              {news.currency}
            </span>
            <Badge variant="outline" className={`text-xs py-0 h-4 ${impact.bg} ${impact.color} border-current`}>
              {impact.label}
            </Badge>
            {isPast && news.actual && (
              <Badge variant="outline" className="text-xs py-0 h-4 border-green-500/30 text-green-400">
                Факт: {news.actual}
              </Badge>
            )}
          </div>
          <p className="font-display text-sm text-foreground">{news.title}</p>
          {(news.forecast || news.previous) && (
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground font-mono">
              {news.forecast && <span>Прогноз: <span className="text-foreground">{news.forecast}</span></span>}
              {news.previous && <span>Пред.: <span className="text-foreground">{news.previous}</span></span>}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function NewsPage() {
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "All">("All");
  const [currencyFilter, setCurrencyFilter] = useState<string>("All");

  const { data: news = [], isLoading, isError, refetch } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const berlinTodayStr = berlinTime.toISOString().split("T")[0];

  const filteredNews = news.filter(n => {
    const matchesImpact = impactFilter === "All" || n.impact === impactFilter;
    const matchesCurrency = currencyFilter === "All" || n.currency === currencyFilter;
    return matchesImpact && matchesCurrency;
  });

  const todayNews = filteredNews
    .filter(n => n.dateNormalized === berlinTodayStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const weekNewsByDate = filteredNews.reduce((acc, n) => {
    if (!acc[n.dateNormalized]) acc[n.dateNormalized] = [];
    acc[n.dateNormalized].push(n);
    return acc;
  }, {} as Record<string, NewsItem[]>);

  const sortedDates = Object.keys(weekNewsByDate).sort();

  const highImpactTodayCount = todayNews.filter(n => n.impact === "High").length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-display">Загрузка новостей...</p>
      </div>
    );
  }

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
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-primary" />
            Финансовые новости
          </h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Clock className="w-3 h-3" />
            <span>UTC+1 Берлин: {timeStr}</span>
          </div>
        </div>

        {highImpactTodayCount > 0 && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-display text-sm text-foreground">
                {highImpactTodayCount} событий высокого влияния сегодня
              </div>
              <div className="text-xs text-muted-foreground">Будь осторожен во время публикации данных</div>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                {(["All", "High", "Medium", "Low"] as const).map((impact) => (
                  <Button
                    key={impact}
                    variant={impactFilter === impact ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs font-display"
                    onClick={() => setImpactFilter(impact)}
                  >
                    {impact === "All" ? "Все" : impact}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
                {(["All", "EUR", "USD"] as const).map((curr) => (
                  <Button
                    key={curr}
                    variant={currencyFilter === curr ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-2 text-xs font-display"
                    onClick={() => setCurrencyFilter(curr)}
                  >
                    {curr === "All" ? "Все" : curr}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => refetch()}
            >
              <RefreshCw className="w-3 h-3" />
              Обновить
            </Button>
          </div>

          <Tabs defaultValue="today">
            <TabsList className="w-full">
              <TabsTrigger value="today" className="flex-1 font-display" data-testid="tab-news-today">
                Сегодня ({todayNews.length})
              </TabsTrigger>
              <TabsTrigger value="week" className="flex-1 font-display" data-testid="tab-news-week">
                На неделю ({filteredNews.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-4 space-y-2 animate-slide-in-up">
              {todayNews.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-border">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-display text-sm text-muted-foreground">Новостей на сегодня нет</p>
                </Card>
              ) : (
                todayNews.map((n, i) => <NewsCard key={`${n.title}-${i}`} news={n} />)
              )}
            </TabsContent>

            <TabsContent value="week" className="mt-4 space-y-4 animate-slide-in-up">
              {sortedDates.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-border">
                  <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="font-display text-sm text-muted-foreground">Новостей на неделю нет</p>
                </Card>
              ) : (
                sortedDates.map(date => (
                  <div key={date} className="space-y-2">
                    <div className="text-xs font-display uppercase tracking-widest text-muted-foreground pt-2 pb-1 sticky top-0 bg-background/95 backdrop-blur z-10">
                      {new Date(date).toLocaleDateString("ru-RU", { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {weekNewsByDate[date].map((n, i) => <NewsCard key={`${n.title}-${i}`} news={n} />)}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        <Card className="p-3 bg-muted/30 border-dashed border-border">
          <p className="text-xs text-muted-foreground">
            Данные загружаются автоматически из Forex Factory (на этой неделе). Все время указано в формате UTC+1 (Берлин).
          </p>
        </Card>
      </div>
    </div>
  );
}


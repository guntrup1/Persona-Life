import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { getBerlinTime } from "@/lib/store";

type ImpactLevel = "High" | "Medium" | "Low";
type NewsItem = {
  id: string;
  title: string;
  currency: string;
  impact: ImpactLevel;
  time: string;
  date: string;
  actual?: string;
  forecast?: string;
  previous?: string;
};

const SAMPLE_NEWS: NewsItem[] = [
  { id: "1", title: "ИПЦ (г/г)", currency: "EUR", impact: "High", time: "10:00", date: "today", forecast: "2.2%", previous: "2.4%" },
  { id: "2", title: "Заседание ФРС — ставка", currency: "USD", impact: "High", time: "20:00", date: "today" },
  { id: "3", title: "Торговый баланс Германии", currency: "EUR", impact: "Medium", time: "08:00", date: "today", actual: "€22.3B", forecast: "€21.5B", previous: "€20.8B" },
  { id: "4", title: "Первичные заявки по безработице", currency: "USD", impact: "Medium", time: "14:30", date: "today", forecast: "215K", previous: "210K" },
  { id: "5", title: "Индекс цен производителей (г/г)", currency: "GBP", impact: "Low", time: "09:30", date: "today" },
  { id: "6", title: "Протокол заседания ЕЦБ", currency: "EUR", impact: "Medium", time: "13:30", date: "tomorrow", forecast: "—", previous: "—" },
  { id: "7", title: "Индекс потребительского доверия", currency: "USD", impact: "Medium", time: "16:00", date: "tomorrow" },
  { id: "8", title: "Решение по процентной ставке ЕЦБ", currency: "EUR", impact: "High", time: "13:15", date: "week" },
  { id: "9", title: "Заявление по монетарной политике Банка Англии", currency: "GBP", impact: "High", time: "12:00", date: "week" },
  { id: "10", title: "Индекс делового климата IFO", currency: "EUR", impact: "Medium", time: "10:00", date: "week" },
  { id: "11", title: "Данные по занятости ADP", currency: "USD", impact: "Medium", time: "14:15", date: "week" },
  { id: "12", title: "Нонфарм payrolls", currency: "USD", impact: "High", time: "14:30", date: "week" },
  { id: "13", title: "Индекс потребительских цен Германии (г/г)", currency: "EUR", impact: "Medium", time: "14:00", date: "week" },
  { id: "14", title: "Розничные продажи (г/г)", currency: "GBP", impact: "Medium", time: "09:30", date: "week" },
  { id: "15", title: "Доверие потребителей ZEW", currency: "EUR", impact: "Low", time: "11:00", date: "week" },
];

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
  const impact = IMPACT_CONFIG[news.impact];
  const berlinNow = getBerlinTime();
  const currentTimeStr = berlinNow.toTimeString().slice(0, 5);
  const isPast = news.date === "today" && news.time < currentTimeStr;

  return (
    <Card
      className={`p-3 border-card-border hover-elevate transition-all ${isPast ? "opacity-50" : ""}`}
      data-testid={`news-${news.id}`}
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

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const todayNews = SAMPLE_NEWS.filter(n => n.date === "today")
    .sort((a, b) => a.time.localeCompare(b.time));

  const weekNews = SAMPLE_NEWS.filter(n => n.date !== "today" || true)
    .sort((a, b) => {
      const order: Record<string, number> = { today: 0, tomorrow: 1, week: 2 };
      const orderDiff = (order[a.date] || 0) - (order[b.date] || 0);
      if (orderDiff !== 0) return orderDiff;
      return a.time.localeCompare(b.time);
    });

  const highImpactToday = todayNews.filter(n => n.impact === "High").length;

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

        {highImpactToday > 0 && (
          <Card className="p-3 bg-red-500/10 border-red-500/30 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <div className="font-display text-sm text-foreground">
                {highImpactToday} событий высокого влияния сегодня
              </div>
              <div className="text-xs text-muted-foreground">Будь осторожен во время публикации данных</div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="today">
          <TabsList className="w-full">
            <TabsTrigger value="today" className="flex-1 font-display" data-testid="tab-news-today">
              Сегодня ({todayNews.length})
            </TabsTrigger>
            <TabsTrigger value="week" className="flex-1 font-display" data-testid="tab-news-week">
              На неделю ({SAMPLE_NEWS.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-2 animate-slide-in-up">
            <div className="flex gap-2 flex-wrap mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">Высокое ({todayNews.filter(n => n.impact === "High").length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground">Среднее ({todayNews.filter(n => n.impact === "Medium").length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Низкое ({todayNews.filter(n => n.impact === "Low").length})</span>
              </div>
            </div>

            {todayNews.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-border">
                <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-display text-sm text-muted-foreground">Новостей нет</p>
              </Card>
            ) : (
              todayNews.map(news => <NewsCard key={news.id} news={news} />)
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-4 space-y-2 animate-slide-in-up">
            {["today", "tomorrow", "week"].map(period => {
              const periodNews = weekNews.filter(n => n.date === period);
              if (periodNews.length === 0) return null;
              const periodLabel = period === "today" ? "Сегодня" : period === "tomorrow" ? "Завтра" : "На этой неделе";
              return (
                <div key={period} className="space-y-2">
                  <div className="text-xs font-display uppercase tracking-widest text-muted-foreground pt-2 pb-1">
                    {periodLabel}
                  </div>
                  {periodNews.map(news => <NewsCard key={news.id} news={news} />)}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <Card className="p-3 bg-muted/30 border-dashed border-border">
          <p className="text-xs text-muted-foreground">
            Данные новостей обновляются вручную. Для получения актуальных событий используй Forex Factory.
          </p>
        </Card>
      </div>
    </div>
  );
}

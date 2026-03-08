import { useState } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, LIFE_AREA_BG, getTodayDate } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Zap, Flame, Target, CheckCircle, Trophy, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

type Period = "day" | "week" | "month" | "all";

function getPeriodDates(period: Period): string[] {
  const today = new Date();
  const dates: string[] = [];

  if (period === "day") {
    return [getTodayDate()];
  }

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }

  if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }

  return [];
}

export default function StatsPage() {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>("week");

  const dates = getPeriodDates(period);

  const filteredTasks = period === "all"
    ? state.todayTasks
    : state.todayTasks.filter(t => dates.includes(t.date));

  const completedTasks = filteredTasks.filter(t => t.completed);

  const filteredSessions = period === "all"
    ? state.focusSessions
    : state.focusSessions.filter(s => dates.includes(s.date));

  const totalXP = state.xp.totalXP;
  const todayDate = getTodayDate();

  const dailyData = (period === "week" || period === "month")
    ? dates.map(date => {
        const tasks = state.todayTasks.filter(t => t.date === date && t.completed);
        const xp = tasks.reduce((sum, t) => sum + t.xp, 0);
        const focusXP = state.focusSessions.filter(s => s.date === date).reduce((sum, s) => sum + s.xp, 0);
        const d = new Date(date);
        const label = period === "week"
          ? d.toLocaleDateString("ru-RU", { weekday: "short" })
          : String(d.getDate());
        return { date, label, xp: xp + focusXP, tasks: tasks.length };
      })
    : [];

  const categoryData = LIFE_AREAS.map(area => ({
    name: area,
    xp: state.xp.categoryXP[area] || 0,
  })).filter(d => d.xp > 0).sort((a, b) => b.xp - a.xp);

  const level = Math.floor(totalXP / 100) + 1;
  const xpInLevel = totalXP % 100;

  const completionRate = filteredTasks.length > 0
    ? Math.round((completedTasks.length / filteredTasks.length) * 100)
    : 0;

  const focusMinutes = filteredSessions.reduce((sum, s) => sum + s.duration, 0);

  const PIE_COLORS = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316", "#10b981"];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Статистика
          </h1>
          <div className="flex gap-1">
            {(["day", "week", "month", "all"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md font-display text-xs font-semibold transition-all border ${
                  period === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-card-border text-muted-foreground hover-elevate"
                }`}
                data-testid={`period-${p}`}
              >
                {p === "day" ? "День" : p === "week" ? "Неделя" : p === "month" ? "Месяц" : "Всё время"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 border-card-border text-center">
            <Zap className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="font-display text-2xl font-bold text-primary">{totalXP}</div>
            <div className="text-xs text-muted-foreground">Total XP</div>
          </Card>
          <Card className="p-3 border-card-border text-center">
            <CheckCircle className="w-4 h-4 text-green-400 mx-auto mb-1" />
            <div className="font-display text-2xl font-bold text-green-400">{completedTasks.length}</div>
            <div className="text-xs text-muted-foreground">Задач выполнено</div>
          </Card>
          <Card className="p-3 border-card-border text-center">
            <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className="font-display text-2xl font-bold text-orange-400">{state.streak.currentStreak}</div>
            <div className="text-xs text-muted-foreground">Стрик (дней)</div>
          </Card>
          <Card className="p-3 border-card-border text-center">
            <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <div className="font-display text-2xl font-bold text-blue-400">{focusMinutes}</div>
            <div className="text-xs text-muted-foreground">Минут фокуса</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3 border-card-border sm:col-span-2">
            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-1">Уровень {level}</div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${xpInLevel}%` }}
                />
              </div>
              <span className="font-mono text-xs text-primary">{xpInLevel}/100 XP</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="font-mono font-bold text-blue-400">{state.xp.routineXP}</div>
                <div className="text-muted-foreground">Рутина XP</div>
              </div>
              <div>
                <div className="font-mono font-bold text-green-400">{state.xp.taskXP}</div>
                <div className="text-muted-foreground">Задачи XP</div>
              </div>
              <div>
                <div className="font-mono font-bold text-yellow-400">{state.xp.goalXP}</div>
                <div className="text-muted-foreground">Цели XP</div>
              </div>
            </div>
          </Card>

          <Card className="p-3 border-card-border text-center">
            <Trophy className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <div className="font-display text-2xl font-bold text-yellow-400">{state.streak.longestStreak}</div>
            <div className="text-xs text-muted-foreground">Рекорд стрика</div>
            <div className="mt-2 text-xs text-muted-foreground">
              {completionRate}% выполнено
            </div>
          </Card>
        </div>

        {(period === "week" || period === "month") && dailyData.some(d => d.xp > 0) && (
          <Card className="p-4 border-card-border">
            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">XP по дням</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dailyData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--card-border))", borderRadius: "6px" }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontFamily: "var(--font-display)" }}
                  itemStyle={{ color: "hsl(var(--primary))" }}
                />
                <Bar dataKey="xp" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {categoryData.length > 0 && (
          <Card className="p-4 border-card-border">
            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">XP по сферам жизни</div>
            <div className="space-y-2">
              {categoryData.map((item, i) => {
                const maxXP = categoryData[0].xp;
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className={`text-xs font-display w-24 flex-shrink-0 ${LIFE_AREA_COLORS[item.name as any]}`}>
                      {item.name}
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(item.xp / maxXP) * 100}%`,
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground w-12 text-right">{item.xp} XP</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {state.goals.filter(g => g.completed).length > 0 && (
          <Card className="p-4 border-card-border">
            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">Выполненные цели</div>
            <div className="space-y-2">
              {state.goals.filter(g => g.completed).map(goal => (
                <div key={goal.id} className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-display text-sm text-foreground flex-1">{goal.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {goal.type === "year" ? "Год" : goal.type === "month" ? "Месяц" : "Неделя"}
                  </Badge>
                  <span className="font-mono text-xs text-primary">+{goal.xp} XP</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

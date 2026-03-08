import { useState, useEffect, useRef } from "react";
import { useStore, getBerlinTime, getMarketSession, getCharacterState, getTodayDate, LIFE_AREA_COLORS, LIFE_AREA_BG, getGoalProgress } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Trash2, RefreshCw, Flame, Zap, Star, Target, Clock, Newspaper, FileText, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function CharacterEmoji({ state }: { state: string }) {
  const getEmoji = () => {
    switch (state) {
      case "sleeping": return "😴";
      case "morning": return "🌅";
      case "working": return "💪";
      case "resting": return "☕";
      case "evening": return "🌙";
      default: return "😎";
    }
  };

  const emoji = getEmoji();

  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
          }
          @keyframes pulse-glow {
            0%, 100% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.2)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 25px rgba(255,255,255,0.5)); transform: scale(1.05); }
          }
          @keyframes sway {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
          }
          @keyframes bounce-custom {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-15px) scale(1.1); }
          }
          @keyframes z-float {
            0% { transform: translate(0, 0) opacity(0); }
            20% { opacity: 0.8; }
            100% { transform: translate(20px, -60px) opacity(0); }
          }
          .animate-float { animation: float 3s ease-in-out infinite; }
          .animate-glow { animation: pulse-glow 2s ease-in-out infinite; }
          .animate-sway { animation: sway 4s ease-in-out infinite; }
          .animate-bounce-custom { animation: bounce-custom 1s ease-in-out infinite; }
          .z-letter { 
            position: absolute;
            font-family: 'Oxanium', sans-serif;
            font-weight: bold;
            color: #8B0000;
            opacity: 0;
            pointer-events: none;
          }
        `}
      </style>
      
      <div className={`text-8xl flex items-center justify-center
        ${state === 'sleeping' ? 'animate-glow' : ''}
        ${state === 'morning' ? 'animate-float' : ''}
        ${state === 'working' ? 'animate-bounce-custom' : ''}
        ${state === 'resting' ? 'animate-sway' : ''}
        ${state === 'evening' ? 'animate-glow' : ''}
      `}>
        {emoji}
        
        {state === 'sleeping' && (
          <>
            <span className="z-letter text-2xl" style={{ animation: 'z-float 3s infinite 0s', left: '60%', top: '20%' }}>Z</span>
            <span className="z-letter text-xl" style={{ animation: 'z-float 3s infinite 1s', left: '70%', top: '10%' }}>Z</span>
            <span className="z-letter text-lg" style={{ animation: 'z-float 3s infinite 2s', left: '80%', top: '0%' }}>Z</span>
          </>
        )}
      </div>
    </div>
  );
}

function XPNotification({ xp, visible, onHide }: { xp: number; visible: boolean; onHide: () => void }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 1200);
      return () => clearTimeout(t);
    }
  }, [visible, onHide]);

  if (!visible) return null;
  return (
    <div className="fixed top-16 right-6 z-50 animate-xp-gain pointer-events-none">
      <div className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-display font-bold text-sm p5-glow">
        +{xp} XP
      </div>
    </div>
  );
}

export default function HubPage() {
  const { state, actions, todayTasks, completedToday, totalToday, isRoutineLoaded, todayNote } = useStore();
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const [xpNotif, setXpNotif] = useState<{ xp: number; visible: boolean }>({ xp: 0, visible: false });
  const [noteContent, setNoteContent] = useState(todayNote?.content || "");
  const { toast } = useToast();
  const prevCompleted = useRef(completedToday);

  const { data: todayNews, isLoading: isNewsLoading } = useQuery<{ title: string; currency: string; impact: string; time: string }[]>({
    queryKey: ["/api/news/today"],
  });

  useEffect(() => {
    if (todayNote) {
      setNoteContent(todayNote.content);
    }
  }, [todayNote]);

  useEffect(() => {
    const interval = setInterval(() => setBerlinTime(getBerlinTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (completedToday > prevCompleted.current) {
      const lastCompleted = todayTasks.filter(t => t.completed).at(-1);
      if (lastCompleted) {
        setXpNotif({ xp: lastCompleted.xp, visible: true });
      }
    }
    prevCompleted.current = completedToday;
  }, [completedToday, todayTasks]);

  useEffect(() => {
    if (!isRoutineLoaded) {
      actions.loadRoutineForToday();
    }
  }, [isRoutineLoaded, actions]);

  const charState = getCharacterState();
  const session = getMarketSession();

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const dateStr = berlinTime.toLocaleDateString("ru-RU", {
    weekday: "long", day: "numeric", month: "long"
  });

  const progress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  const handleToggle = (id: string) => {
    actions.toggleTask(id);
  };

  const handleLoadRoutine = () => {
    actions.loadRoutineForToday();
    toast({ title: "Рутина загружена", description: "Задачи дня добавлены в список." });
  };

  const handleClearTasks = () => {
    actions.clearTodayTasks();
    toast({ title: "Список очищен", description: "Все задачи на сегодня удалены." });
  };

  const handleSaveNote = () => {
    actions.upsertDayNote(getTodayDate(), noteContent);
    toast({ title: "Заметка сохранена", description: "Ваша заметка на сегодня обновлена." });
  };

  const level = Math.floor(state.xp.totalXP / 100) + 1;
  const xpInLevel = state.xp.totalXP % 100;

  const allSessions = [
    { name: "Азия", start: "03:00", end: "08:00", color: "text-yellow-400" },
    { name: "Франкфурт", start: "08:00", end: "09:00", color: "text-blue-400" },
    { name: "Лондон", start: "09:00", end: "14:00", color: "text-green-400" },
    { name: "Нью-Йорк", start: "14:00", end: "17:00", color: "text-red-400" },
  ];

  const weekGoals = state.goals.filter(g => g.type === "week" && !g.completed);

  return (
    <div className="h-full overflow-auto">
      <XPNotification xp={xpNotif.xp} visible={xpNotif.visible} onHide={() => setXpNotif(p => ({ ...p, visible: false }))} />

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4 bg-card border-card-border rounded-2xl">
              <div className="space-y-1">
                <div className="font-mono text-4xl font-bold text-foreground tracking-tight">{timeStr}</div>
                <div className="text-muted-foreground text-sm capitalize">{dateStr}</div>
                <div className="pt-2 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${session.active ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
                  <span className={`font-display text-sm font-semibold ${session.color}`}>{session.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">UTC+1</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-card border-card-border rounded-2xl">
              <div className="text-xs text-muted-foreground font-display uppercase tracking-wider mb-3">Торговые сессии</div>
              <div className="space-y-2">
                {allSessions.map(s => {
                  const isActive = session.name === s.name;
                  return (
                    <div key={s.name} className={`flex items-center justify-between rounded-md px-2 py-1 transition-all ${isActive ? "bg-primary/10" : ""}`}>
                      <div className="flex items-center gap-2">
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                        {!isActive && <div className="w-1.5 h-1.5 rounded-full bg-muted" />}
                        <span className={`font-display text-xs ${isActive ? s.color + " font-bold" : "text-muted-foreground"}`}>{s.name}</span>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{s.start}–{s.end}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-4 bg-card border-card-border sm:col-span-2 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">Прогресс дня</div>
                    <div className="font-display text-2xl font-bold text-foreground">{completedToday}/{totalToday}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">XP сегодня</div>
                  <div className="font-mono text-xl font-bold text-primary">
                    +{todayTasks.filter(t => t.completed).reduce((s, t) => s + t.xp, 0)}
                  </div>
                </div>
              </div>
              <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700 relative xp-bar-shine"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {weekGoals.length > 0 && (
                <div className="mt-4 space-y-3 pt-3 border-t">
                  <div className="text-xs font-display text-muted-foreground uppercase tracking-wider">Цели недели</div>
                  {weekGoals.slice(0, 2).map(goal => {
                    const progress = getGoalProgress(goal, state);
                    return (
                      <div key={goal.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-display">
                          <span className="text-foreground truncate max-w-[200px]">{goal.title}</span>
                          <span className="text-muted-foreground">{progress.completed}/{progress.total}</span>
                        </div>
                        <Progress value={progress.percent} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 flex gap-3 text-xs text-muted-foreground font-mono">
                <span>Стрик: <span className="text-orange-400 font-bold">{state.streak.currentStreak} дн.</span></span>
                <span>Рекорд: <span className="text-yellow-400 font-bold">{state.streak.longestStreak} дн.</span></span>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="p-4 bg-card border-card-border w-full flex-1 rounded-3xl">
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs font-display text-muted-foreground uppercase tracking-widest">{charState.label}</div>
                <div className="w-36 h-44 character-container overflow-visible flex items-center justify-center">
                  <CharacterEmoji state={charState.state} />
                </div>
                <div className="font-display text-sm text-muted-foreground">Уровень {level}</div>
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">XP</span>
                    <span className="text-primary font-mono">{xpInLevel}/100</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xpInLevel}%` }} />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-card border-card-border w-full rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Newspaper className="w-4 h-4 text-primary" />
                <div className="font-display text-xs font-bold uppercase tracking-wider">Новости сегодня</div>
              </div>
              <div className="space-y-2">
                {isNewsLoading ? (
                  <div className="text-xs text-muted-foreground animate-pulse">Загрузка...</div>
                ) : todayNews && todayNews.length > 0 ? (
                  todayNews.map((news, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-red-500 pl-2 py-1">
                      <div className="font-mono text-muted-foreground whitespace-nowrap">{news.time}</div>
                      <div className="flex-1 font-display font-medium leading-tight">{news.title}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-muted-foreground italic">Важных новостей нет</div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4 bg-card border-card-border rounded-2xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="font-display text-base font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Задачи на сегодня
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!isRoutineLoaded && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLoadRoutine}
                    data-testid="button-load-routine"
                    className="gap-1 h-8 rounded-full"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Загрузить рутину
                  </Button>
                )}
                {todayTasks.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-clear-tasks" className="gap-1 text-destructive h-8 rounded-full">
                        <Trash2 className="w-3 h-3" />
                        Очистить
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Очистить список задач?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Все задачи на сегодня будут удалены. Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearTasks} className="bg-destructive text-destructive-foreground rounded-full">
                          Очистить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {todayTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="font-display text-sm">Список задач пуст</p>
                <p className="text-xs mt-1">Загрузи рутину или добавь задачи на вкладке Задачи</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover-elevate ${
                      task.completed
                        ? "bg-muted/50 border-border opacity-60"
                        : "bg-card border-card-border"
                    }`}
                    onClick={() => handleToggle(task.id)}
                    data-testid={`task-item-${task.id}`}
                  >
                    <button className="flex-shrink-0 transition-transform" data-testid={`task-toggle-${task.id}`}>
                      {task.completed ? (
                        <CheckCircle className="w-5 h-5 text-primary animate-check-bounce" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className={`font-display text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
                        {task.type === "routine" && (
                          <Badge variant="secondary" className="text-xs py-0 h-4 rounded-full">Рутина</Badge>
                        )}
                        {task.difficulty && (
                          <Badge variant="outline" className={`text-xs py-0 h-4 rounded-full ${
                            task.difficulty === "high" ? "border-red-500/50 text-red-400" :
                            task.difficulty === "medium" ? "border-yellow-500/50 text-yellow-400" :
                            "border-green-500/50 text-green-400"
                          }`}>
                            {task.difficulty === "low" ? "Лёгкая" : task.difficulty === "medium" ? "Средняя" : "Сложная"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-mono text-xs font-bold ${task.completed ? "text-muted-foreground" : "text-primary"}`}>
                        +{task.xp} XP
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-card border-card-border rounded-2xl flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-primary" />
              <div className="font-display text-base font-bold uppercase tracking-wider text-foreground">Заметка дня</div>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <Textarea
                placeholder="Как прошел твой день? Краткие выводы или мысли..."
                className="flex-1 min-h-[150px] resize-none border-card-border focus-visible:ring-primary bg-muted/30 rounded-xl"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <Button
                onClick={handleSaveNote}
                className="w-full font-display uppercase tracking-widest text-xs h-9 rounded-full"
              >
                Сохранить заметку
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

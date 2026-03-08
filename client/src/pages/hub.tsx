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

function CharacterSVG({ state }: { state: string }) {
  const bodyColor = "#1a1a1a";
  const skinColor = "#f5d0a9";
  const hairColor = "#1a1a1a";
  const jacketColor = state === "working" ? "#8B0000" : state === "morning" ? "#2d5a8e" : state === "sleeping" ? "#2a2a3a" : state === "evening" ? "#3a2a4a" : "#2a4a2a";

  if (state === "sleeping") {
    return (
      <svg viewBox="0 0 120 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g className="animate-pulse">
          <ellipse cx="60" cy="80" rx="28" ry="35" fill="#2a2a3a" opacity="0.9" />
          <circle cx="60" cy="52" r="22" fill={skinColor} />
          <ellipse cx="60" cy="42" rx="18" ry="14" fill={hairColor} />
          <line x1="48" y1="60" x2="55" y2="60" stroke="#666" strokeWidth="2" strokeLinecap="round" />
          <line x1="65" y1="60" x2="72" y2="60" stroke="#666" strokeWidth="2" strokeLinecap="round" />
          <path d="M53 67 Q60 64 67 67" stroke="#c0887a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
        <text x="90" y="35" fontSize="12" fill="#8B0000" fontFamily="Oxanium" opacity="0.8">Z</text>
        <text x="98" y="22" fontSize="9" fill="#8B0000" fontFamily="Oxanium" opacity="0.6">Z</text>
        <text x="104" y="12" fontSize="7" fill="#8B0000" fontFamily="Oxanium" opacity="0.4">Z</text>
      </svg>
    );
  }

  if (state === "morning") {
    return (
      <svg viewBox="0 0 120 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g className="animate-bounce" style={{ animationDuration: '3s' }}>
          <rect x="32" y="75" width="56" height="75" rx="6" fill={jacketColor} />
          <rect x="22" y="80" width="18" height="55" rx="6" fill={jacketColor} />
          <rect x="80" y="80" width="18" height="55" rx="6" fill={jacketColor} />
          <rect x="42" y="150" width="16" height="40" rx="5" fill="#2a2a3a" />
          <rect x="62" y="150" width="16" height="40" rx="5" fill="#2a2a3a" />
          <circle cx="60" cy="55" r="24" fill={skinColor} />
          <ellipse cx="60" cy="38" rx="20" ry="15" fill={hairColor} />
          <circle cx="51" cy="55" r="4" fill="white" />
          <circle cx="69" cy="55" r="4" fill="white" />
          <circle cx="52" cy="55" r="2" fill="#3a3a3a" />
          <circle cx="70" cy="55" r="2" fill="#3a3a3a" />
          <path d="M53 65 Q60 70 67 65" stroke="#c0887a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="25" cy="20" r="12" fill="#FFD700" opacity="0.8" />
          {[0,45,90,135,180,225,270,315].map((deg, i) => (
            <line key={i}
              x1={25 + Math.cos(deg * Math.PI/180) * 14}
              y1={20 + Math.sin(deg * Math.PI/180) * 14}
              x2={25 + Math.cos(deg * Math.PI/180) * 18}
              y2={20 + Math.sin(deg * Math.PI/180) * 18}
              stroke="#FFD700" strokeWidth="2" opacity="0.6"
            />
          ))}
        </g>
      </svg>
    );
  }

  if (state === "working") {
    return (
      <svg viewBox="0 0 120 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g>
          <rect x="32" y="75" width="56" height="75" rx="4" fill={jacketColor} />
          <rect x="22" y="75" width="16" height="60" rx="4" fill={jacketColor} />
          <rect x="82" y="75" width="16" height="40" rx="4" fill={jacketColor} />
          <rect x="42" y="150" width="15" height="42" rx="5" fill="#1a1a2a" />
          <rect x="63" y="150" width="15" height="42" rx="5" fill="#1a1a2a" />
          <rect x="92" y="85" width="24" height="18" rx="2" fill="#0a0a1a" />
          <rect x="94" y="87" width="20" height="14" rx="1" fill="#1a3a5a" />
          <line x1="98" y1="92" x2="110" y2="92" stroke="#00ff88" strokeWidth="0.8" opacity="0.7" className="animate-pulse" />
          <line x1="98" y1="95" x2="107" y2="95" stroke="#00ff88" strokeWidth="0.8" opacity="0.5" className="animate-pulse" />
          <line x1="98" y1="98" x2="112" y2="98" stroke="#00ff88" strokeWidth="0.8" opacity="0.7" className="animate-pulse" />
          <circle cx="60" cy="52" r="24" fill={skinColor} />
          <ellipse cx="60" cy="36" rx="21" ry="16" fill={hairColor} />
          <rect x="52" y="48" width="6" height="4" rx="1" fill="#c0887a" opacity="0.3" />
          <rect x="62" y="48" width="6" height="4" rx="1" fill="#c0887a" opacity="0.3" />
          <circle cx="52" cy="52" r="3.5" fill="white" />
          <circle cx="68" cy="52" r="3.5" fill="white" />
          <circle cx="53" cy="52" r="2" fill="#2a2a3a" />
          <circle cx="69" cy="52" r="2" fill="#2a2a3a" />
          <path d="M53 63 Q60 60 67 63" stroke="#c0887a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (state === "resting") {
    return (
      <svg viewBox="0 0 120 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g className="animate-pulse">
          <rect x="30" y="85" width="60" height="70" rx="8" fill={jacketColor} />
          <rect x="18" y="90" width="18" height="50" rx="8" fill={jacketColor} />
          <rect x="84" y="90" width="18" height="50" rx="8" fill={jacketColor} />
          <rect x="10" y="130" width="14" height="8" rx="4" fill={jacketColor} />
          <rect x="40" y="155" width="16" height="38" rx="6" fill="#2a2a3a" />
          <rect x="64" y="155" width="16" height="38" rx="6" fill="#2a2a3a" />
          <circle cx="60" cy="58" r="25" fill={skinColor} />
          <ellipse cx="60" cy="42" rx="21" ry="15" fill={hairColor} />
          <circle cx="50" cy="58" r="4" fill="white" />
          <circle cx="70" cy="58" r="4" fill="white" />
          <circle cx="51" cy="58" r="2.5" fill="#3a3a3a" />
          <circle cx="71" cy="58" r="2.5" fill="#3a3a3a" />
          <path d="M52 69 Q60 74 68 69" stroke="#c0887a" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="20" cy="40" r="5" fill="#8B4513" opacity="0.9" />
          <path d="M15 30 Q12 20 16 15 Q18 12 20 15 Q22 12 24 15 Q28 20 25 30" fill="#8B4513" opacity="0.8" />
          <path d="M17 30 Q17 35 20 38 Q23 35 23 30" fill={skinColor} opacity="0.7" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <g className="animate-pulse">
        <rect x="33" y="80" width="54" height="72" rx="5" fill={jacketColor} />
        <rect x="22" y="83" width="17" height="55" rx="5" fill={jacketColor} />
        <rect x="81" y="83" width="17" height="55" rx="5" fill={jacketColor} />
        <rect x="40" y="152" width="16" height="40" rx="5" fill="#2a2a3a" />
        <rect x="64" y="152" width="16" height="40" rx="5" fill="#2a2a3a" />
        <circle cx="60" cy="54" r="24" fill={skinColor} />
        <ellipse cx="60" cy="38" rx="20" ry="15" fill={hairColor} />
        <circle cx="50" cy="55" r="4" fill="white" />
        <circle cx="70" cy="55" r="4" fill="white" />
        <circle cx="51" cy="55" r="2.5" fill="#3a3a3a" />
        <circle cx="71" cy="55" r="2.5" fill="#3a3a3a" />
        <path d="M52 66 Q60 71 68 66" stroke="#c0887a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="85" cy="20" r="8" fill="#FFD700" opacity="0.3" />
        <circle cx="90" cy="30" r="5" fill="#c0c0c0" opacity="0.4" />
        <circle cx="95" cy="15" r="4" fill="#c0c0c0" opacity="0.3" />
      </g>
    </svg>
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
            <Card className="p-4 bg-card border-card-border">
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

            <Card className="p-4 bg-card border-card-border">
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

            <Card className="p-4 bg-card border-card-border sm:col-span-2">
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
            <Card className="p-4 bg-card border-card-border w-full flex-1">
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs font-display text-muted-foreground uppercase tracking-widest">{charState.label}</div>
                <div className="w-36 h-44 character-container overflow-visible">
                  <CharacterSVG state={charState.state} />
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

            <Card className="p-4 bg-card border-card-border w-full">
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
          <Card className="p-4 bg-card border-card-border">
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
                    className="gap-1 h-8"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Загрузить рутину
                  </Button>
                )}
                {todayTasks.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-clear-tasks" className="gap-1 text-destructive h-8">
                        <Trash2 className="w-3 h-3" />
                        Очистить
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Очистить список задач?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Все задачи на сегодня будут удалены. Это действие нельзя отменить.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearTasks} className="bg-destructive text-destructive-foreground">
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
                    className={`flex items-center gap-3 p-3 rounded-md border transition-all cursor-pointer hover-elevate ${
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
                          <Badge variant="secondary" className="text-xs py-0 h-4">Рутина</Badge>
                        )}
                        {task.difficulty && (
                          <Badge variant="outline" className={`text-xs py-0 h-4 ${
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

          <Card className="p-4 bg-card border-card-border flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-primary" />
              <div className="font-display text-base font-bold uppercase tracking-wider text-foreground">Заметка дня</div>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              <Textarea
                placeholder="Как прошел твой день? Краткие выводы или мысли..."
                className="flex-1 min-h-[150px] resize-none border-card-border focus-visible:ring-primary bg-muted/30"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <Button
                onClick={handleSaveNote}
                className="w-full font-display uppercase tracking-widest text-xs h-9"
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

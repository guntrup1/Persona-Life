import { useState, useEffect, useRef, memo } from "react";
import { useStore, getBerlinTime, getMarketSession, getCharacterState, getTodayDate, LIFE_AREA_COLORS, getGoalProgress, syncFromServer } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle, Circle, Trash2, RefreshCw, Flame, Zap, Target, Clock,
  Newspaper, FileText, TrendingUp, ChevronDown, Star, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Character emoji ─────────────────────────────────────────────────────────

const CharacterEmoji = memo(function CharacterEmoji({ state }: { state: string }) {
  const emoji =
    state === "sleeping" ? "😴" :
    state === "morning"  ? "🌅" :
    state === "working"  ? "💪" :
    state === "resting"  ? "☕" :
    state === "evening"  ? "🌙" : "😎";

  const animClass =
    state === "sleeping" ? "char-anim-glow" :
    state === "morning"  ? "char-anim-float" :
    state === "working"  ? "char-anim-bounce" :
    state === "resting"  ? "char-anim-sway" :
    state === "evening"  ? "char-anim-glow" : "";

  return (
    <div className="relative flex items-center justify-center w-full h-full select-none">
      <div className={`text-7xl flex items-center justify-center ${animClass}`}>
        {emoji}
        {state === "sleeping" && <>
          <span className="char-zletter char-z1">Z</span>
          <span className="char-zletter char-z2">Z</span>
          <span className="char-zletter char-z3">Z</span>
        </>}
      </div>
    </div>
  );
});

// ─── XP toast ────────────────────────────────────────────────────────────────

function XPNotification({ xp, visible, onHide }: { xp: number; visible: boolean; onHide: () => void }) {
  useEffect(() => {
    if (visible) { const t = setTimeout(onHide, 1200); return () => clearTimeout(t); }
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

// ─── Self-contained clock ─────────────────────────────────────────────────────

function ClockWidget() {
  const [berlinTime, setBerlinTime] = useState(getBerlinTime());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const id = setInterval(() => {
      setBerlinTime(getBerlinTime());
      setSession(getMarketSession());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = berlinTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = berlinTime.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="text-center">
        <div className="font-mono text-2xl font-bold text-foreground tracking-tight">{timeStr}</div>
        <div className="text-muted-foreground text-xs capitalize mt-0.5">{dateStr}</div>
      </div>
      <div className="w-full flex items-center justify-between rounded-xl px-3 py-2 bg-muted/20 border border-card-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${session.active ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
          <span className={`font-display text-xs font-semibold ${session.color}`}>{session.name}</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">UTC+1</span>
      </div>
    </>
  );
}

// ─── Collapsible block ────────────────────────────────────────────────────────

const CollapsibleBlock = memo(function CollapsibleBlock({
  title, icon, children, defaultOpen = true, badge,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="border-card-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors"
        data-testid={`collapse-toggle-${title}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-display text-sm font-bold uppercase tracking-wider text-foreground">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className="overflow-hidden"
        style={{ maxHeight: open ? "2000px" : "0px", transition: "max-height 0.3s ease" }}
        aria-hidden={!open}
        data-testid={`collapse-content-${title}`}
      >
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      </div>
    </Card>
  );
});

// ─── Main hub ─────────────────────────────────────────────────────────────────

export default function HubPage() {
  const { state, actions, todayTasks, completedToday, totalToday, todayNotes } = useStore();
  const [xpNotif, setXpNotif] = useState<{ xp: number; visible: boolean }>({ xp: 0, visible: false });
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const { toast } = useToast();
  const prevCompleted = useRef(completedToday);

  const { data: newsData } = useQuery<{ items: { title: string; currency: string; impact: string; time: string; day: string }[]; todayStr: string; nextStr: string }>({
    queryKey: ["/api/news"],
    enabled: false,
    staleTime: Infinity,
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return { items: raw as { title: string; currency: string; impact: string; time: string; day: string }[], todayStr: "", nextStr: "" };
      return raw as { items: { title: string; currency: string; impact: string; time: string; day: string }[]; todayStr: string; nextStr: string };
    },
  });
  const todayNews = newsData?.items?.filter(n => n.day === "today") || [];

  // Real-time polling every 30 seconds
  useEffect(() => {
    const poll = async () => {
      await syncFromServer();
      setLastSynced(new Date());
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (completedToday > prevCompleted.current) {
      const last = todayTasks.filter(t => t.completed).at(-1);
      if (last) setXpNotif({ xp: last.xp, visible: true });
    }
    prevCompleted.current = completedToday;
  }, [completedToday, todayTasks]);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await syncFromServer();
    setSyncing(false);
    setLastSynced(new Date());
    toast({ title: ok ? "Данные синхронизированы" : "Нет соединения" });
  };

  const charState = getCharacterState();

  const dayProgress = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;
  const dayXP = todayTasks.filter(t => t.completed).reduce((s, t) => s + t.xp, 0);

  const level = Math.floor(state.xp.totalXP / 100) + 1;
  const xpInLevel = state.xp.totalXP % 100;

  const weekGoals = state.goals.filter(g => g.type === "week" && !g.completed);
  const monthGoals = state.goals.filter(g => g.type === "month" && !g.completed);

  const weekProgress = weekGoals.length > 0
    ? weekGoals.reduce((sum, g) => sum + getGoalProgress(g, state).percent, 0) / weekGoals.length
    : 0;

  const handleToggle = (id: string) => actions.toggleTask(id);
  const handleClearTasks = () => {
    actions.clearTodayTasks();
    toast({ title: "Список очищен" });
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    actions.addDayNote(getTodayDate(), newNoteText);
    setNewNoteText("");
  };

  const handleSaveEdit = () => {
    if (editingNoteId && editingText.trim()) actions.updateDayNote(editingNoteId, editingText);
    setEditingNoteId(null);
    setEditingText("");
  };

  return (
    <div className="h-full overflow-auto">
      <XPNotification xp={xpNotif.xp} visible={xpNotif.visible} onHide={() => setXpNotif(p => ({ ...p, visible: false }))} />

      <div className="max-w-7xl mx-auto p-4 space-y-4">

        {/* ── Main 2-column grid ── */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="lg:w-72 flex flex-col gap-3 flex-shrink-0">

            {/* Character panel */}
            <Card className="p-4 bg-card border-card-border rounded-3xl flex flex-col items-center gap-3">
              <div className="w-32 h-36 overflow-visible flex items-center justify-center">
                <CharacterEmoji state={charState.state} />
              </div>

              <div className="text-xs font-display text-muted-foreground uppercase tracking-widest text-center">
                {charState.label}
              </div>

              <ClockWidget />

              {/* Level + XP */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display text-muted-foreground flex items-center gap-1">
                    <Star className="w-3 h-3 text-primary" /> Уровень {level}
                  </span>
                  <span className="font-mono text-primary font-bold">{xpInLevel}/100 XP</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${xpInLevel}%` }} />
                </div>
              </div>

              {/* Streak */}
              <div className="w-full flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-400 font-bold">{state.streak.currentStreak} дн.</span>
                </span>
                <span className="text-muted-foreground">Рекорд: <span className="text-yellow-400 font-bold">{state.streak.longestStreak} дн.</span></span>
              </div>

              {/* Sync button */}
              <button
                onClick={handleSync}
                disabled={syncing}
                data-testid="button-sync"
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-card-border bg-muted/20 hover:bg-muted/40 transition-colors text-xs text-muted-foreground font-display"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                {syncing ? "Синхронизация..." : lastSynced ? `Синхр. ${lastSynced.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : "Синхронизировать"}
              </button>
            </Card>

            {/* News alert */}
            {todayNews.length > 0 && (
              <Card className="p-3 bg-red-500/10 border-red-500/30 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
                  <span className="font-display text-xs font-bold text-foreground uppercase tracking-wider">
                    {todayNews.length} важных новостей
                  </span>
                </div>
                <div className="space-y-1">
                  {todayNews.map((n, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-red-500 pl-2 py-0.5">
                      <span className="font-mono text-muted-foreground whitespace-nowrap flex-shrink-0">{n.time}</span>
                      <span className="font-display text-foreground leading-snug">{n.title}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {todayNews.length === 0 && (
              <Card className="p-3 bg-card border-card-border rounded-2xl">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display text-xs text-muted-foreground">
                    {newsData ? "Важных новостей нет" : "Открой Новости → Обновить"}
                  </span>
                </div>
              </Card>
            )}

            {/* ── Задачи недели (under emoji) ── */}
            <CollapsibleBlock
              title="Задачи недели"
              icon={<Target className="w-4 h-4 text-primary" />}
              badge={weekGoals.length > 0 && <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full">{weekGoals.length}</Badge>}
            >
              {weekGoals.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Нет активных целей. Создай в разделе Цели.</p>
              ) : (
                <div className="space-y-2">
                  {weekGoals.map(goal => {
                    const prog = getGoalProgress(goal, state);
                    return (
                      <div key={goal.id} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-display text-sm text-foreground truncate max-w-[70%]">{goal.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">{prog.completed}/{prog.total} XP</span>
                        </div>
                        <Progress value={prog.percent} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleBlock>

            {/* ── Прогресс недели (under emoji) ── */}
            <CollapsibleBlock
              title="Прогресс недели"
              icon={<TrendingUp className="w-4 h-4 text-primary" />}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm text-muted-foreground">
                    {weekGoals.filter(g => getGoalProgress(g, state).percent >= 100).length}/{weekGoals.length} целей выполнено
                  </span>
                  <span className="font-mono text-sm font-bold text-primary">{Math.round(weekProgress)}%</span>
                </div>
                <Progress value={weekProgress} className="h-2.5" />

                {monthGoals.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-card-border">
                    <div className="text-xs font-display text-muted-foreground uppercase tracking-wider">Цели месяца</div>
                    {monthGoals.slice(0, 3).map(g => {
                      const p = getGoalProgress(g, state);
                      return (
                        <div key={g.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-foreground font-display truncate max-w-[70%]">{g.title}</span>
                            <span className="text-muted-foreground font-mono">{Math.round(p.percent)}%</span>
                          </div>
                          <Progress value={p.percent} className="h-1" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleBlock>
          </div>

          {/* ═══ RIGHT COLUMN: Daily progress + tasks ═══ */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">

            {/* Прогресс дня */}
            <Card className="p-4 bg-card border-card-border rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Прогресс дня</span>
                  <span className="font-mono text-xs text-primary font-bold">{completedToday}/{totalToday}</span>
                </div>
                <span className="font-mono text-sm font-bold text-primary">+{dayXP} XP</span>
              </div>
              <div className="relative w-full h-3 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${dayProgress}%` }}
                />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" />
                  Стрик: <span className="text-orange-400 font-bold ml-1">{state.streak.currentStreak} дн.</span>
                </span>
                <span>Рекорд: <span className="text-yellow-400 font-bold">{state.streak.longestStreak} дн.</span></span>
              </div>
            </Card>

            {/* Задачи на сегодня */}
            <CollapsibleBlock
              title="Задачи на сегодня"
              icon={<Clock className="w-4 h-4 text-primary" />}
              badge={totalToday > 0 && <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5 rounded-full">{completedToday}/{totalToday}</Badge>}
            >
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { actions.loadRoutineForToday(); toast({ title: "Рутина синхронизирована" }); }}
                    data-testid="button-load-routine"
                    className="gap-1 h-7 rounded-full text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Загрузить рутину
                  </Button>
                  {todayTasks.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1 text-destructive h-7 rounded-full text-xs">
                          <Trash2 className="w-3 h-3" />
                          Очистить
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Очистить задачи?</AlertDialogTitle>
                          <AlertDialogDescription>Все задачи на сегодня будут удалены.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearTasks} className="bg-destructive text-destructive-foreground rounded-full">Очистить</AlertDialogAction>
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
                  <p className="text-xs mt-1 opacity-70">Нажми «Загрузить рутину» или добавь задачи</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover-elevate ${
                        task.completed ? "bg-muted/50 border-border opacity-60" : "bg-card border-card-border"
                      }`}
                      onClick={() => handleToggle(task.id)}
                      data-testid={`task-item-${task.id}`}
                    >
                      <button className="flex-shrink-0" data-testid={`task-toggle-${task.id}`}>
                        {task.completed
                          ? <CheckCircle className="w-5 h-5 text-primary" />
                          : <Circle className="w-5 h-5 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className={`font-display text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
                          {task.type === "routine" && <Badge variant="secondary" className="text-xs py-0 h-4 rounded-full">Рутина</Badge>}
                        </div>
                      </div>
                      <span className={`font-mono text-xs font-bold flex-shrink-0 ${task.completed ? "text-muted-foreground" : "text-primary"}`}>
                        +{task.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleBlock>
          </div>
        </div>

        {/* ── Notes (full width) ── */}
        <Card className="p-4 bg-card border-card-border rounded-2xl flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <div className="font-display text-base font-bold uppercase tracking-wider text-foreground">Заметки дня</div>
            {todayNotes.length > 0 && (
              <Badge variant="secondary" className="ml-auto font-mono text-xs rounded-full">{todayNotes.length}</Badge>
            )}
          </div>

          {todayNotes.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {todayNotes.map(note => {
                const timeLabel = new Date(note.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
                const isEditing = editingNoteId === note.id;
                return (
                  <div key={note.id} className="rounded-xl border border-card-border bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">{timeLabel}</span>
                      {!isEditing && (
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingNoteId(note.id); setEditingText(note.content); }} className="p-1 rounded-md text-muted-foreground hover:text-primary transition-colors" data-testid={`button-edit-note-${note.id}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => actions.deleteDayNote(note.id)} className="p-1 rounded-md text-muted-foreground hover:text-red-400 transition-colors" data-testid={`button-delete-note-${note.id}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea value={editingText} onChange={e => setEditingText(e.target.value)} className="min-h-[70px] resize-none text-sm rounded-lg" autoFocus data-testid="input-edit-note" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveEdit} className="flex-1 h-7 text-xs rounded-full font-display">Сохранить</Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingNoteId(null); setEditingText(""); }} className="h-7 text-xs rounded-full">Отмена</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Новая заметка дня..."
              className="min-h-[70px] resize-none border-card-border focus-visible:ring-primary bg-muted/30 rounded-xl text-sm"
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
              data-testid="input-new-note"
            />
            <Button onClick={handleAddNote} disabled={!newNoteText.trim()} className="w-full font-display uppercase tracking-widest text-xs h-9 rounded-full" data-testid="button-add-note">
              + Добавить заметку
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

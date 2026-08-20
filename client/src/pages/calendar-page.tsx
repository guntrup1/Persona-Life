import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type TaskDifficulty, xpForDifficulty, type TodayTask } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Plus, Hourglass, CheckCircle, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle, FileText, CandlestickChart, Edit2, CalendarDays, Brain } from "lucide-react";
import { getTodayDate, formatUserClock } from "@/lib/store";
import { RemoteImage } from "@/components/remote-image";
import { Link } from "wouter";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_RU = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MoveTaskDialog({ task, open, onOpenChange, onMove }: {
  task: TodayTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (taskId: string, date: string) => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState<string>(getTodayDate());

  useEffect(() => {
    if (task) setDate(task.date || getTodayDate());
  }, [task]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Перенести задачу
          </DialogTitle>
        </DialogHeader>
        {task && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              «{task.name}» — выберите новую дату
            </p>
            <div className="space-y-1.5">
              <Label>Новая дата</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-move-date" />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (date) onMove(task.id, date);
                onOpenChange(false);
              }}
            >
              Перенести
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CalendarPage() {
  const { state, actions } = useStore();
  const { t, lang } = useI18n();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskCategory, setTaskCategory] = useState<LifeArea>("Mind");
  const [taskDifficulty, setTaskDifficulty] = useState<TaskDifficulty>("medium");
  const [taskGoalId, setTaskGoalId] = useState<string>("");
  const [noDeadline, setNoDeadline] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [addToGoogleCalendar, setAddToGoogleCalendar] = useState(false);

  const [editingTask, setEditingTask] = useState<TodayTask | null>(null);
  const [moveTask, setMoveTask] = useState<TodayTask | null>(null);
  const [moveDate, setMoveDate] = useState<string>(getTodayDate());

  const [brainstormSessions, setBrainstormSessions] = useState<any[]>([]);

  const [googleReminderMinutes, setGoogleReminderMinutes] = useState<number[]>([30]);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);

  const REMINDER_OPTIONS = [
    { minutes: 15, label: "⏱️ 15м" },
    { minutes: 30, label: "⏱️ 30м" },
    { minutes: 60, label: "⌛ 1ч" },
    { minutes: 120, label: "⌛ 2ч" },
    { minutes: 180, label: "⌛ 3ч" },
    { minutes: 720, label: "🌙 12ч" },
    { minutes: 1440, label: "📅 1 день" },
    { minutes: 2880, label: "📅 2 дня" },
  ];

  useEffect(() => {
    fetch("/api/user/settings", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.settings?.googleReminderMinutes !== undefined) {
          const val = data.settings.googleReminderMinutes;
          if (Array.isArray(val)) setGoogleReminderMinutes(val);
          else if (typeof val === "number") setGoogleReminderMinutes([val]);
        }
      })
      .catch(() => {});

    fetch("/api/auth/google/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data?.connected) {
          setGoogleConnected(true);
          // Automatic 2-way sync when viewing calendar page
          fetch("/api/calendar/full-sync", { method: "POST", credentials: "include" }).catch(() => {});
        }
      })
      .catch(() => {});

    fetch("/api/brainstorms", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data?.brainstorms) setBrainstormSessions(data.brainstorms);
      })
      .catch(() => {});
  }, []);

  const toggleReminderOption = (minutes: number) => {
    const current = new Set(googleReminderMinutes);
    if (current.has(minutes)) {
      if (current.size > 1) current.delete(minutes);
    } else {
      current.add(minutes);
    }
    const updated = Array.from(current).sort((a, b) => a - b);
    setGoogleReminderMinutes(updated);
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ googleReminderMinutes: updated }),
    }).catch(() => {});
  };

  const todayStr = getTodayDate();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const getTasksForDate = (date: string) => state.todayTasks.filter(t => t.date === date);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    const taskData = {
      name: taskName.trim(),
      description: taskDescription.trim(),
      category: taskCategory,
      difficulty: taskDifficulty,
      xp: xpForDifficulty(taskDifficulty),
      type: "today" as const,
      date: selectedDate,
      weekGoalId: taskGoalId || undefined,
      noDeadline,
      startTime: noDeadline ? undefined : startTime,
      endTime: noDeadline ? undefined : endTime,
      addToGoogleCalendar,
    };

    if (editingTask) {
      actions.updateTask(editingTask.id, taskData);
    } else {
      actions.addTodayTask(taskData);
    }

    resetForm();
    setAddTaskOpen(false);
  };

  const resetForm = () => {
    setTaskName("");
    setTaskDescription("");
    setTaskCategory("Mind");
    setTaskDifficulty("medium");
    setTaskGoalId("");
    setNoDeadline(true);
    setStartTime("09:00");
    setEndTime("10:00");
    setAddToGoogleCalendar(false);
    setEditingTask(null);
  };

  const handleEditTask = (task: TodayTask) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDescription(task.description || "");
    setTaskCategory(task.category);
    setTaskDifficulty(task.difficulty || "medium");
    setTaskGoalId(task.weekGoalId || "");
    setNoDeadline(task.noDeadline ?? true);
    setStartTime(task.startTime || "09:00");
    setEndTime(task.endTime || "10:00");
    setAddToGoogleCalendar(!!task.googleCalendarEventId || !!task.addToGoogleCalendar);
    setAddTaskOpen(true);
  };

  const selectedTasks = getTasksForDate(selectedDate);

  const dayNote = state.dayNotes.find(n => n.date === selectedDate);
  const tradingNotes = state.tradingNotes.filter(n => n.date === selectedDate);
  const dailyBiases = state.dailyBiases.filter(b => b.date === selectedDate);

  const renderMonthView = () => {
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(currentYear, currentMonth, day);
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const tasks = getTasksForDate(dateStr);
      const completedCount = tasks.filter(t => t.completed).length;
      const hasHighImpact = tasks.some(t => t.difficulty === "high");
      const hasNote = state.dayNotes.some(n => n.date === dateStr);
      const hasTradingNotes = state.tradingNotes.some(n => n.date === dateStr);
      const hasBiases = state.dailyBiases.some(b => b.date === dateStr);
      const hasBrainstorm = brainstormSessions.some((s: any) => new Date(s.createdAt).toISOString().slice(0, 10) === dateStr);

      cells.push(
        <button
          key={day}
          className={`aspect-square flex flex-col items-center justify-start p-1 rounded-md transition-all text-xs hover-elevate border ${
            isSelected
              ? "bg-primary/20 border-primary/50 text-primary"
              : isToday
              ? "bg-muted border-border text-foreground"
              : "border-transparent text-muted-foreground"
          }`}
          onClick={() => setSelectedDate(dateStr)}
          data-testid={`calendar-day-${dateStr}`}
        >
          <span className={`font-display font-bold text-xs mb-0.5 ${isToday ? "text-primary" : ""}`}>{day}</span>
          <div className="flex items-center gap-0.5 flex-wrap justify-center">
            {tasks.length > 0 && (
              <>
                <div className="w-1 h-1 rounded-full bg-primary/40" />
                {completedCount > 0 && <div className="w-1 h-1 rounded-full bg-primary" />}
                {tasks.length - completedCount > 0 && <div className="w-1 h-1 rounded-full bg-muted-foreground" />}
                {hasHighImpact && <div className="w-1 h-1 rounded-full bg-red-400" />}
              </>
            )}
            {(hasNote || hasTradingNotes || hasBiases) && <div className="w-1 h-1 rounded-full bg-blue-400" />}
            {hasBrainstorm && <div className="w-1 h-1 rounded-full bg-purple-500" />}
          </div>
        </button>
      );
    }

    return cells;
  };

  const getWeekDays = () => {
    const today = new Date(selectedDate);
    const dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Hourglass className="w-5 h-5 text-primary" />
            {t.nav.calendar}
          </h1>
          <div className="flex gap-1">
            {(["day", "week", "month"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md font-display text-xs font-semibold border transition-all ${
                  view === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-card-border text-muted-foreground hover-elevate"
                }`}
                data-testid={`view-${v}`}
              >
                {v === "day" ? t.calendar.day : v === "week" ? t.calendar.week : t.calendar.month}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            {view === "month" && (
              <Card className="p-4 border-card-border">
                <div className="flex items-center justify-between mb-4">
                  <Button size="icon" variant="ghost" onClick={prevMonth}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="font-display font-bold text-foreground">
                    {t.calendar.months[currentMonth]} {currentYear}
                  </div>
                  <Button size="icon" variant="ghost" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {t.calendar.weekdays.map(d => (
                    <div key={d} className="text-center text-xs font-display text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {renderMonthView()}
                </div>
              </Card>
            )}

            {view === "week" && (
              <Card className="p-4 border-card-border">
                <div className="flex items-center justify-between mb-4">
                  <Button size="icon" variant="ghost" onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() - 7);
                    setSelectedDate(d.toISOString().split("T")[0]);
                  }}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="font-display font-bold text-foreground">{t.calendar.weekTitle}</div>
                  <Button size="icon" variant="ghost" onClick={() => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + 7);
                    setSelectedDate(d.toISOString().split("T")[0]);
                  }}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {getWeekDays().map((dateStr, i) => {
                    const tasks = getTasksForDate(dateStr);
                    const d = new Date(dateStr);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === todayStr;
                    return (
                      <button
                        key={dateStr}
                        className={`p-2 rounded-md border text-center transition-all hover-elevate ${
                          isSelected ? "bg-primary/20 border-primary/50" :
                          isToday ? "bg-muted border-border" : "border-transparent"
                        }`}
                        onClick={() => setSelectedDate(dateStr)}
                      >
                        <div className="text-xs text-muted-foreground font-display">{t.calendar.weekdays[i]}</div>
                        <div className={`font-display font-bold text-sm ${isToday ? "text-primary" : "text-foreground"}`}>
                          {d.getDate()}
                        </div>
                        {tasks.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {tasks.slice(0, 2).map(t => (
                              <div key={t.id} className={`h-1 rounded-full ${t.completed ? "bg-primary" : "bg-muted-foreground"}`} />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {view === "day" && (
              <>
                <Card className="p-4 border-card-border">
                  <div className="flex items-center justify-between mb-4">
                    <Button size="icon" variant="ghost" onClick={() => {
                      const d = new Date(selectedDate);
                      d.setDate(d.getDate() - 1);
                      setSelectedDate(d.toISOString().split("T")[0]);
                    }}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="font-display font-bold text-foreground">
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                        weekday: "long", day: "numeric", month: "long"
                      })}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => {
                      const d = new Date(selectedDate);
                      d.setDate(d.getDate() + 1);
                      setSelectedDate(d.toISOString().split("T")[0]);
                    }}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {selectedTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm font-display">{t.calendar.noTasks}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTasks.map(task => {
                        const isPast = selectedDate < todayStr;
                        return (
                          <div key={task.id} className={`flex items-center gap-3 p-3 rounded-md border ${task.completed ? "opacity-60 bg-muted/50" : "bg-card"} border-card-border`}>
                            <button onClick={() => actions.toggleTask(task.id)} disabled={isPast}>
                              {task.completed ? <CheckCircle className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className={`font-display text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {task.name}
                                {task.startTime && task.endTime && (
                                  <span className="ml-2 text-[10px] text-muted-foreground">({task.startTime}-{task.endTime})</span>
                                )}
                              </div>
                              {task.description && <div className="text-[10px] text-muted-foreground truncate">{task.description}</div>}
                            </div>
                            <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
                            <span className="font-mono text-xs text-primary">+{task.xp}</span>
                            {!isPast && (
                              <div className="flex gap-1 ml-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setMoveDate(task.date || selectedDate); setMoveTask(task); }} title="Перенести">
                                  <CalendarDays className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditTask(task)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => actions.deleteTask(task.id)}>
                                  <MinusCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <DayExtras selectedDate={selectedDate} brainstormSessions={brainstormSessions} />
              </>
            )}
          </div>

          <div className="space-y-3">
            <Card className="p-4 border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-xs text-muted-foreground uppercase tracking-widest">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: "numeric", month: "short" })}
                  </div>
                  <div className="font-display font-bold text-foreground">
                    {t.calendar.tasksCount.replace("{done}", selectedTasks.filter(t => t.completed).length.toString()).replace("{total}", selectedTasks.length.toString())}
                  </div>
                </div>
                {selectedDate >= todayStr && (
                  <Dialog open={addTaskOpen} onOpenChange={(open) => {
                    setAddTaskOpen(open);
                    if (!open) resetForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" data-testid="button-calendar-add">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display">{editingTask ? t.calendar.editTask : t.calendar.newTask}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddTask} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>{t.calendar.taskName}</Label>
                          <Input
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            placeholder={t.calendar.taskNamePlaceholder}
                            autoFocus
                            data-testid="input-calendar-task"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t.calendar.taskDesc}</Label>
                          <Textarea
                            value={taskDescription}
                            onChange={e => setTaskDescription(e.target.value)}
                            placeholder={t.calendar.taskDescPlaceholder}
                            className="h-20"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label>{t.calendar.category}</Label>
                            <Select value={taskCategory} onValueChange={(v) => setTaskCategory(v as LifeArea)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>{t.calendar.difficulty}</Label>
                            <Select value={taskDifficulty} onValueChange={(v) => setTaskDifficulty(v as TaskDifficulty)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">{t.calendar.diffLow}</SelectItem>
                                <SelectItem value="medium">{t.calendar.diffMedium}</SelectItem>
                                <SelectItem value="high">{t.calendar.diffHigh}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label>{t.calendar.linkGoal}</Label>
                          <Select value={taskGoalId} onValueChange={setTaskGoalId}>
                            <SelectTrigger>
                              <SelectValue placeholder={t.calendar.selectGoal} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t.calendar.noGoal}</SelectItem>
                              {state.goals.filter(g => g.type === "week").map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {googleConnected && (
                          <div className="flex items-center justify-between py-1 border-t border-border/40 pt-2">
                            <div className="space-y-0.5">
                              <Label htmlFor="calendar-google-toggle" className="text-xs font-display flex items-center gap-1.5">
                                📅 Добавить в Google Календарь
                              </Label>
                              <div className="text-[10px] text-muted-foreground">Отправить событием в ваш Google Calendar</div>
                            </div>
                            <Switch
                              id="calendar-google-toggle"
                              checked={addToGoogleCalendar}
                              onCheckedChange={setAddToGoogleCalendar}
                            />
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>{t.calendar.specifyTime}</Label>
                            <Switch checked={!noDeadline} onCheckedChange={(checked: boolean) => setNoDeadline(!checked)} />
                          </div>

                          {!noDeadline && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label>{t.calendar.startTime}</Label>
                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>{t.calendar.endTime}</Label>
                                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                              </div>
                            </div>
                          )}
                        </div>

                        <Button type="submit" className="w-full">
                          {editingTask ? t.calendar.saveChanges : t.calendar.addBtn}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {selectedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground font-display text-center py-4">{t.calendar.noTasksShort}</p>
              ) : (
                <div className="space-y-2">
                  {selectedTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2">
                      <button onClick={() => actions.toggleTask(task.id)}>
                        {task.completed
                          ? <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                          : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        }
                      </button>
                      <span className={`font-display text-xs flex-1 truncate ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.name}
                      </span>
                      <span className="font-mono text-xs text-primary flex-shrink-0">+{task.xp}</span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setMoveDate(task.date || selectedDate); setMoveTask(task); }} title="Перенести">
                          <CalendarDays className="w-3 h-3 text-muted-foreground" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => actions.deleteTask(task.id)} title="Удалить">
                          <MinusCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <DayDetails selectedDate={selectedDate} brainstormSessions={brainstormSessions} />

            <Card className="p-3 border-card-border">
              <div className="font-display text-xs text-muted-foreground uppercase tracking-widest mb-2">{t.calendar.legend}</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">{t.calendar.legendCompleted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{t.calendar.legendNotCompleted}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-muted-foreground">{t.calendar.legendHighImpact}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs text-muted-foreground">{t.calendar.legendNotes}</span>
                </div>
              </div>
            </Card>

            {/* Google Calendar Reminder Settings Panel (Multi-Select) */}
            {googleConnected && (
              <Card className="p-3 border-card-border rounded-2xl space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  <span className="font-display text-xs font-bold uppercase tracking-wider">
                    {lang === "ru" ? "Google Напоминания" : "Google Reminders"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "ru"
                    ? "Выберите точки уведомлений в Google Календаре (можно выбрать несколько):"
                    : "Select notification points in Google Calendar (multiple allowed):"}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {REMINDER_OPTIONS.map(opt => {
                    const isSelected = googleReminderMinutes.includes(opt.minutes);
                    return (
                      <button
                        key={opt.minutes}
                        type="button"
                        onClick={() => toggleReminderOption(opt.minutes)}
                        className={`text-xs py-1 px-2.5 rounded-lg font-display transition-all border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        </div>

        <MoveTaskDialog
          task={moveTask}
          open={!!moveTask}
          onOpenChange={(open) => { if (!open) setMoveTask(null); }}
          onMove={(taskId, date) => actions.scheduleTaskToDay(taskId, date)}
        />
      </div>
    </div>
  );
}

function DayDetails({ selectedDate, brainstormSessions = [] }: { selectedDate: string, brainstormSessions?: any[] }) {
  const { t, lang } = useI18n();
  const { state } = useStore();
  const tradingNotes = state.tradingNotes.filter(n => n.date === selectedDate);
  const dailyBiases = state.dailyBiases.filter(b => b.date === selectedDate);
  const dayNotes = state.dayNotes.filter(n => n.date === selectedDate).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const brainstorms = brainstormSessions
    // A session = its plan + discussion thread; history lists only the root entry
    .filter(s => !s.parentSessionId)
    .filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === selectedDate)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="space-y-3">
      {brainstorms.length > 0 && (
        <Card className="p-4 border-card-border bg-purple-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-400" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider text-purple-400">Брейншторм сессии</h3>
          </div>
          <div className="space-y-2">
            {brainstorms.map((session: any) => {
              const replies = brainstormSessions.filter((s: any) => s.parentSessionId === session._id).length;
              return (
              <div key={session._id} className="border-b border-white/5 pb-2 last:border-0 last:pb-0 relative group">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatUserClock(session.createdAt, lang)}
                  </span>
                  {replies > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400/80 font-semibold">
                      💬 {replies}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground font-medium">{session.theme || "Без темы"}</p>
                <Link href={`/brainstorm?session=${session._id}`}>
                  <button className="text-[10px] text-indigo-400/70 hover:text-indigo-400 mt-1 uppercase tracking-wider font-semibold">
                    Перейти к анализу →
                  </button>
                </Link>
              </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 border-card-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">{t.calendar.dayNotes}</h3>
        </div>
        {dayNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-2">{t.calendar.noDayNotes}</p>
        ) : (
          <div className="space-y-2">
            {dayNotes.map(note => (
              <div key={note.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatUserClock(note.createdAt, lang)}
                  </span>
                  {note.updatedAt !== note.createdAt && (
                    <span className="text-[10px] text-muted-foreground/60">{lang === 'en' ? '(ed.)' : '(ред.)'}</span>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {dailyBiases.length > 0 && (
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <CandlestickChart className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">{t.calendar.dailyBias}</h3>
          </div>
          <div className="space-y-3">
            {dailyBiases.map(bias => (
              <div key={bias.id} className="space-y-2 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase">{bias.asset}</Badge>
                  <div className="flex items-center gap-1">
                    {bias.direction === "bullish" && <ArrowUpCircle className="w-3 h-3 text-green-400" />}
                    {bias.direction === "bearish" && <ArrowDownCircle className="w-3 h-3 text-red-400" />}
                    {bias.direction === "neutral" && <MinusCircle className="w-3 h-3 text-muted-foreground" />}
                    <span className={`text-[10px] font-bold uppercase ${
                      bias.direction === "bullish" ? "text-green-400" :
                      bias.direction === "bearish" ? "text-red-400" : "text-muted-foreground"
                    }`}>{bias.direction}</span>
                  </div>
                </div>
                {bias.pros && (
                  <div className="text-[10px] text-green-400/80 line-clamp-2">▲ {t.calendar.pros}: {bias.pros}</div>
                )}
                {bias.cons && (
                  <div className="text-[10px] text-red-400/80 line-clamp-2">▼ {t.calendar.cons}: {bias.cons}</div>
                )}
                {(bias.screenshots?.length ? bias.screenshots : (bias.screenshotUrl ? [{ tf: "1D", url: bias.screenshotUrl }] : [])).map((s, i) => (
                  <div key={i} className="mt-1 relative">
                    {s.tf && (
                      <span className="absolute top-1 left-1 z-10 text-[8px] font-bold px-1 py-0.5 rounded bg-black/70 text-white/90 border border-white/10">
                        {s.tf}
                      </span>
                    )}
                    <RemoteImage bordered src={s.url} alt={`Bias screenshot ${s.tf}`} variant="auto" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tradingNotes.length > 0 && (
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <CandlestickChart className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">{t.calendar.tradingNotes}</h3>
          </div>
          <div className="space-y-3">
            {tradingNotes.map(note => (
              <div key={note.id} className="space-y-1.5 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-display font-bold text-xs text-foreground truncate max-w-[150px]">
                    {note.title || t.calendar.untitled}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 h-4">{note.asset}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{note.timeframe}</span>
                  <span>•</span>
                  <span className="text-primary">#{note.tag}</span>
                  <span>•</span>
                  <span>{formatUserClock(note.createdAt, lang)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3 italic">
                  "{note.text}"
                </p>
                {(note.screenshots?.length ? note.screenshots : (note.screenshotUrl ? [{ tf: "1D", url: note.screenshotUrl }] : [])).map((s, i) => (
                  <div key={i} className="mt-1 relative">
                    {s.tf && (
                      <span className="absolute top-1 left-1 z-10 text-[8px] font-bold px-1 py-0.5 rounded bg-black/70 text-white/90 border border-white/10">
                        {s.tf}
                      </span>
                    )}
                    <RemoteImage bordered src={s.url} alt={`Trading note screenshot ${s.tf}`} variant="auto" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DayExtras({ selectedDate, brainstormSessions = [] }: { selectedDate: string, brainstormSessions?: any[] }) {
  return (
    <div className="mt-6 space-y-4">
      <Separator />
      <DayDetails selectedDate={selectedDate} brainstormSessions={brainstormSessions} />
    </div>
  );
}

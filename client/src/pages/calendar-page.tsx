import { useState } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type TaskDifficulty, xpForDifficulty, type DailyBias, type TradingNote, type DayNote } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, CheckCircle, Circle, ArrowUpCircle, ArrowDownCircle, MinusCircle, FileText, TrendingUp, Image as ImageIcon } from "lucide-react";
import { getTodayDate } from "@/lib/store";

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

export default function CalendarPage() {
  const { state, actions } = useStore();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskCategory, setTaskCategory] = useState<LifeArea>("Mind");
  const [taskDifficulty, setTaskDifficulty] = useState<TaskDifficulty>("medium");

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

    const isToday = selectedDate === todayStr;
    if (isToday) {
      actions.addTodayTask({
        name: taskName.trim(),
        category: taskCategory,
        difficulty: taskDifficulty,
        xp: xpForDifficulty(taskDifficulty),
        type: "today",
      });
    }

    setTaskName("");
    setAddTaskOpen(false);
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
                {completedCount > 0 && <div className="w-1 h-1 rounded-full bg-primary" />}
                {tasks.length - completedCount > 0 && <div className="w-1 h-1 rounded-full bg-muted-foreground" />}
                {hasHighImpact && <div className="w-1 h-1 rounded-full bg-red-400" />}
              </>
            )}
            {(hasNote || hasTradingNotes || hasBiases) && <div className="w-1 h-1 rounded-full bg-blue-400" />}
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
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Календарь
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
                {v === "day" ? "День" : v === "week" ? "Неделя" : "Месяц"}
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
                    {MONTHS_RU[currentMonth]} {currentYear}
                  </div>
                  <Button size="icon" variant="ghost" onClick={nextMonth}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-2">
                  {WEEKDAYS.map(d => (
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
                  <div className="font-display font-bold text-foreground">Неделя</div>
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
                        <div className="text-xs text-muted-foreground font-display">{WEEKDAYS[i]}</div>
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
                      {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru-RU", {
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
                      <p className="text-muted-foreground text-sm font-display">Нет задач на этот день</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTasks.map(task => (
                        <div key={task.id} className={`flex items-center gap-3 p-3 rounded-md border ${task.completed ? "opacity-60 bg-muted/50" : "bg-card"} border-card-border`}>
                          <button onClick={() => actions.toggleTask(task.id)}>
                            {task.completed ? <CheckCircle className="w-4 h-4 text-primary" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                          </button>
                          <span className={`font-display text-sm flex-1 ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.name}</span>
                          <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
                          <span className="font-mono text-xs text-primary">+{task.xp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <DayExtras selectedDate={selectedDate} />
              </>
            )}
          </div>

          <div className="space-y-3">
            <Card className="p-4 border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-display text-xs text-muted-foreground uppercase tracking-widest">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                  </div>
                  <div className="font-display font-bold text-foreground">
                    {selectedTasks.filter(t => t.completed).length}/{selectedTasks.length} задач
                  </div>
                </div>
                {selectedDate === todayStr && (
                  <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" data-testid="button-calendar-add">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="font-display">Новая задача</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddTask} className="space-y-4">
                        <div className="space-y-1.5">
                          <Label>Название</Label>
                          <Input
                            value={taskName}
                            onChange={e => setTaskName(e.target.value)}
                            placeholder="Что нужно сделать?"
                            autoFocus
                            data-testid="input-calendar-task"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Сфера</Label>
                          <Select value={taskCategory} onValueChange={(v) => setTaskCategory(v as LifeArea)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Сложность</Label>
                          <Select value={taskDifficulty} onValueChange={(v) => setTaskDifficulty(v as TaskDifficulty)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Лёгкая — 10 XP</SelectItem>
                              <SelectItem value="medium">Средняя — 25 XP</SelectItem>
                              <SelectItem value="high">Сложная — 50 XP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full">Добавить</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {selectedTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground font-display text-center py-4">Нет задач</p>
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
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <DayDetails selectedDate={selectedDate} />

            <Card className="p-3 border-card-border">
              <div className="font-display text-xs text-muted-foreground uppercase tracking-widest mb-2">Легенда</div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs text-muted-foreground">Выполнено</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Не выполнено</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-muted-foreground">Высокая сложность</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="text-xs text-muted-foreground">Заметки / Bias</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function DayDetails({ selectedDate }: { selectedDate: string }) {
  const { state, actions } = useStore();
  const todayStr = getTodayDate();
  const isToday = selectedDate === todayStr;
  const dayNote = state.dayNotes.find(n => n.date === selectedDate);
  const tradingNotes = state.tradingNotes.filter(n => n.date === selectedDate);
  const dailyBiases = state.dailyBiases.filter(b => b.date === selectedDate);

  const [noteContent, setNoteContent] = useState(dayNote?.content || "");

  // Update local state when dayNote changes (e.g. when selectedDate changes)
  useState(() => {
    setNoteContent(dayNote?.content || "");
  });

  const handleSaveNote = () => {
    actions.upsertDayNote(selectedDate, noteContent);
  };

  return (
    <div className="space-y-3">
      <Card className="p-4 border-card-border">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm uppercase tracking-wider">Заметка дня</h3>
        </div>
        {isToday ? (
          <div className="space-y-2">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Как прошел день?"
              className="min-h-[100px] text-sm resize-none"
              data-testid="textarea-day-note"
            />
            <Button size="sm" className="w-full" onClick={handleSaveNote}>Сохранить</Button>
          </div>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap italic">
            {dayNote?.content || "Заметка отсутствует"}
          </p>
        )}
      </Card>

      {dailyBiases.length > 0 && (
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Дневной BIAS</h3>
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
                  <div className="text-[10px] text-green-400/80 line-clamp-2">▲ {bias.pros}</div>
                )}
                {bias.cons && (
                  <div className="text-[10px] text-red-400/80 line-clamp-2">▼ {bias.cons}</div>
                )}
                {bias.screenshotUrl && (
                  <div className="mt-1">
                    <img src={bias.screenshotUrl} alt="Bias screenshot" className="rounded-md w-full h-auto object-cover max-h-24 border border-border" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tradingNotes.length > 0 && (
        <Card className="p-4 border-card-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-sm uppercase tracking-wider">Торговые заметки</h3>
          </div>
          <div className="space-y-3">
            {tradingNotes.map(note => (
              <div key={note.id} className="space-y-1.5 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="font-display font-bold text-xs text-foreground truncate max-w-[150px]">
                    {note.title || "Без названия"}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1 h-4">{note.asset}</Badge>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{note.timeframe}</span>
                  <span>•</span>
                  <span className="text-primary">#{note.tag}</span>
                  <span>•</span>
                  <span>{new Date(note.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-3 italic">
                  "{note.text}"
                </p>
                {note.screenshotUrl && (
                  <div className="flex items-center gap-1 text-[10px] text-primary">
                    <ImageIcon className="w-3 h-3" />
                    Скриншот прикреплен
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DayExtras({ selectedDate }: { selectedDate: string }) {
  return (
    <div className="mt-6 space-y-4">
      <Separator />
      <DayDetails selectedDate={selectedDate} />
    </div>
  );
}

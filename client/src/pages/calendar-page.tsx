import { useState } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type TaskDifficulty, xpForDifficulty } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, CheckCircle, Circle } from "lucide-react";
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
          {tasks.length > 0 && (
            <div className="flex items-center gap-0.5 flex-wrap justify-center">
              {completedCount > 0 && <div className="w-1 h-1 rounded-full bg-primary" />}
              {tasks.length - completedCount > 0 && <div className="w-1 h-1 rounded-full bg-muted-foreground" />}
              {hasHighImpact && <div className="w-1 h-1 rounded-full bg-red-400" />}
            </div>
          )}
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
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

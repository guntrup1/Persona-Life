import { useState, useEffect } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, xpForDifficulty, getTodayDate, type LifeArea, type TaskDifficulty, type TodayTask, type RoutineTemplate } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import { CheckCircle, Circle, Plus, Trash2, RefreshCw, CheckSquare, Repeat, Zap, Pencil, Clock, ChevronDown, ChevronRight, CalendarDays, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AddTaskDialog({ onAdd, taskToEdit, open: externalOpen, onOpenChange }: { 
  onAdd: (task: any) => void;
  taskToEdit?: TodayTask;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LifeArea>("Body");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("medium");
  const [xp, setXp] = useState<number>(25);
  const [weekGoalId, setWeekGoalId] = useState<string>("none");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [noDeadline, setNoDeadline] = useState(true);
  const [date, setDate] = useState(getTodayDate());

  const { state } = useStore();
  const weekGoals = state.goals.filter(g => g.type === "week" && !g.completed);

  useEffect(() => {
    if (taskToEdit && open) {
      setName(taskToEdit.name);
      setDescription(taskToEdit.description || "");
      setCategory(taskToEdit.category);
      setDifficulty(taskToEdit.difficulty || "medium");
      setXp(taskToEdit.xp);
      setWeekGoalId(taskToEdit.weekGoalId || "none");
      setStartTime(taskToEdit.startTime || "");
      setEndTime(taskToEdit.endTime || "");
      setNoDeadline(taskToEdit.noDeadline ?? !taskToEdit.startTime);
      setDate(taskToEdit.date || getTodayDate());
    } else if (!taskToEdit && open) {
      setName("");
      setDescription("");
      setCategory("Body");
      setDifficulty("medium");
      setXp(25);
      setWeekGoalId("none");
      setStartTime("");
      setEndTime("");
      setNoDeadline(true);
      setDate(getTodayDate());
    }
  }, [taskToEdit, open]);

  const handleDifficultyChange = (val: TaskDifficulty) => {
    setDifficulty(val);
    if (val !== "custom") {
      setXp(xpForDifficulty(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const taskData = {
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      difficulty,
      xp,
      weekGoalId: weekGoalId === "none" ? undefined : weekGoalId,
      startTime: noDeadline ? undefined : (startTime || undefined),
      endTime: noDeadline ? undefined : (endTime || undefined),
      noDeadline,
      date,
      type: taskToEdit?.type || "today"
    };

    onAdd(taskData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!taskToEdit && (
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1" data-testid="button-add-task">
            <Plus className="w-3 h-3" />
            Добавить задачу
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            {taskToEdit ? "Редактировать задачу" : "Новая задача на сегодня"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Название</Label>
            <Input
              id="task-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Что нужно сделать?"
              data-testid="input-task-name"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Описание (опционально)</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Детали задачи..."
              className="min-h-[80px]"
              data-testid="textarea-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Сфера жизни</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as LifeArea)}>
                <SelectTrigger data-testid="select-task-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Сложность / XP</Label>
              <div className="flex gap-2">
                <Select value={difficulty} onValueChange={(v) => handleDifficultyChange(v as TaskDifficulty)}>
                  <SelectTrigger className="flex-1" data-testid="select-task-difficulty">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Лёгкая (10)</SelectItem>
                    <SelectItem value="medium">Средняя (25)</SelectItem>
                    <SelectItem value="high">Сложная (50)</SelectItem>
                    <SelectItem value="custom">Свой XP</SelectItem>
                  </SelectContent>
                </Select>
                {difficulty === "custom" && (
                  <Input 
                    type="number" 
                    value={xp} 
                    onChange={e => setXp(Number(e.target.value))}
                    className="w-20"
                    data-testid="input-task-xp"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Дата выполнения</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              data-testid="input-task-date"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Привязать к цели недели</Label>
            <Select value={weekGoalId} onValueChange={setWeekGoalId}>
              <SelectTrigger data-testid="select-task-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без цели</SelectItem>
                {weekGoals.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="space-y-0.5">
              <Label htmlFor="no-deadline-toggle">Без срока</Label>
              <div className="text-[10px] text-muted-foreground">Не указывать время начала и конца</div>
            </div>
            <Switch
              id="no-deadline-toggle"
              checked={noDeadline}
              onCheckedChange={setNoDeadline}
              data-testid="switch-no-deadline"
            />
          </div>

          {!noDeadline && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label htmlFor="start-time">Начало</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  data-testid="input-task-start-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end-time">Конец</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  data-testid="input-task-end-time"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" data-testid="button-task-submit">
              {taskToEdit ? "Сохранить изменения" : `Добавить (+${xp} XP)`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRoutineDialog({ onAdd, routineToEdit, open: externalOpen, onOpenChange }: { 
  onAdd: (r: any) => void;
  routineToEdit?: RoutineTemplate;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LifeArea>("Body");
  const [xp, setXp] = useState(10);
  const [goalId, setGoalId] = useState<string>("none");

  const { state } = useStore();
  const goals = state.goals.filter(g => !g.completed);

  useEffect(() => {
    if (routineToEdit && open) {
      setName(routineToEdit.name);
      setDescription(routineToEdit.description || "");
      setCategory(routineToEdit.category);
      setXp(routineToEdit.xp);
      setGoalId(routineToEdit.goalId || "none");
    } else if (!routineToEdit && open) {
      setName("");
      setDescription("");
      setCategory("Body");
      setXp(10);
      setGoalId("none");
    }
  }, [routineToEdit, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ 
      name: name.trim(), 
      description: description.trim() || undefined,
      category, 
      xp, 
      goalId: goalId === "none" ? undefined : goalId,
      enabled: routineToEdit ? routineToEdit.enabled : true 
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!routineToEdit && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1" data-testid="button-add-routine">
            <Plus className="w-3 h-3" />
            Добавить рутину
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">
            {routineToEdit ? "Редактировать рутину" : "Новая ежедневная рутина"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Медитация"
              data-testid="input-routine-name"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Описание (опционально)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Детали рутины..."
              data-testid="textarea-routine-description"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Сфера жизни</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LifeArea)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>XP за выполнение</Label>
            <Select value={String(xp)} onValueChange={(v) => setXp(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 XP</SelectItem>
                <SelectItem value="10">10 XP</SelectItem>
                <SelectItem value="15">15 XP</SelectItem>
                <SelectItem value="20">20 XP</SelectItem>
                <SelectItem value="25">25 XP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Привязать к цели</Label>
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger data-testid="select-routine-goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без цели</SelectItem>
                {goals.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" data-testid="button-routine-submit">
            {routineToEdit ? "Сохранить" : "Добавить рутину"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  const { state, actions, todayTasks, isRoutineLoaded } = useStore();
  const { toast } = useToast();
  const [editingTask, setEditingTask] = useState<TodayTask | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<RoutineTemplate | null>(null);

  const handleToggle = (id: string) => actions.toggleTask(id);

  const handleLoadRoutine = () => {
    actions.loadRoutineForToday();
    toast({ title: "Рутина загружена", description: "Шаблоны добавлены в список сегодня." });
  };

  const routineTasks = todayTasks.filter(t => t.type === "routine");
  const regularTasks = todayTasks.filter(t => t.type !== "routine");
  const unlinkedTasks = regularTasks.filter(t => !t.weekGoalId);
  const linkedTasks = regularTasks.filter(t => !!t.weekGoalId);

  const goalGroups = linkedTasks.reduce<Record<string, TodayTask[]>>((acc, task) => {
    const gid = task.weekGoalId!;
    if (!acc[gid]) acc[gid] = [];
    acc[gid].push(task);
    return acc;
  }, {});

  const [collapsedGoals, setCollapsedGoals] = useState<Record<string, boolean>>({});
  const toggleGoalCollapse = (goalId: string) => setCollapsedGoals(prev => ({ ...prev, [goalId]: !prev[goalId] }));

  const handleReschedule = (taskId: string, newDate: string) => {
    actions.rescheduleTask(taskId, newDate);
    toast({ title: "Задача перенесена", description: `Новая дата: ${newDate}` });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            Задачи
          </h1>
        </div>

        <Tabs defaultValue="today" className="w-full">
          <TabsList className="w-full" data-testid="tabs-tasks">
            <TabsTrigger value="today" className="flex-1 font-display" data-testid="tab-today">
              Задачи на сегодня
            </TabsTrigger>
            <TabsTrigger value="routine" className="flex-1 font-display" data-testid="tab-routine">
              Шаблон рутины
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 space-y-3 animate-slide-in-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-muted-foreground font-mono">
                {todayTasks.filter(t => t.completed).length}/{todayTasks.length} выполнено
              </div>
              <div className="flex gap-2 flex-wrap">
                {!isRoutineLoaded && (
                  <Button size="sm" variant="outline" onClick={handleLoadRoutine} className="gap-1" data-testid="button-load-routine-tasks">
                    <RefreshCw className="w-3 h-3" />
                    Загрузить рутину
                  </Button>
                )}
                <AddTaskDialog onAdd={actions.addTodayTask} />
              </div>
            </div>

            {routineTasks.length > 0 && (
              <div>
                <div className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  Рутина
                </div>
                <div className="space-y-2">
                  {routineTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      onToggle={handleToggle} 
                      onDelete={actions.deleteTask}
                      onEdit={() => setEditingTask(task)}
                      onReschedule={handleReschedule}
                    />
                  ))}
                </div>
              </div>
            )}

            {unlinkedTasks.length > 0 && (
              <div>
                <div className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Задачи
                </div>
                <div className="space-y-2">
                  {unlinkedTasks.map(task => (
                    <TaskRow 
                      key={task.id} 
                      task={task} 
                      onToggle={handleToggle} 
                      onDelete={actions.deleteTask}
                      onEdit={() => setEditingTask(task)}
                      onReschedule={handleReschedule}
                    />
                  ))}
                </div>
              </div>
            )}

            {Object.keys(goalGroups).length > 0 && Object.entries(goalGroups).map(([goalId, tasks]) => {
              const goal = state.goals.find(g => g.id === goalId);
              const isCollapsed = collapsedGoals[goalId];
              const completedCount = tasks.filter(t => t.completed).length;
              return (
                <div key={goalId}>
                  <button
                    className="w-full text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => toggleGoalCollapse(goalId)}
                    data-testid={`goal-group-toggle-${goalId}`}
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <Target className="w-3 h-3 text-primary" />
                    {goal?.title || "Цель"}
                    <span className="font-mono text-[10px] ml-1 text-primary">{completedCount}/{tasks.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-2 pl-1 border-l-2 border-primary/20 ml-1">
                      {tasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={handleToggle}
                          onDelete={actions.deleteTask}
                          onEdit={() => setEditingTask(task)}
                          onReschedule={handleReschedule}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {todayTasks.length === 0 && (
              <Card className="p-8 text-center border-dashed border-border">
                <CheckSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-display text-sm text-muted-foreground">Нет задач на сегодня</p>
                <p className="text-xs text-muted-foreground mt-1">Загрузи рутину или создай новую задачу</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="routine" className="mt-4 space-y-3 animate-slide-in-up">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm text-muted-foreground">
                {state.routineTemplates.filter(r => r.enabled).length} активных шаблонов
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 rounded-full text-xs font-display"
                  data-testid="button-sync-routine"
                  onClick={() => {
                    actions.loadRoutineForToday();
                    toast({ title: "Рутина обновлена", description: "Недостающие задачи добавлены без дублей" });
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  Обновить рутину
                </Button>
                <AddRoutineDialog onAdd={actions.addRoutineTemplate} />
              </div>
            </div>

            {state.routineTemplates.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-border">
                <Repeat className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-display text-sm text-muted-foreground">Нет шаблонов рутины</p>
                <p className="text-xs text-muted-foreground mt-1">Создай повторяющиеся задачи</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {state.routineTemplates.map(routine => {
                  const linkedGoal = routine.goalId ? state.goals.find(g => g.id === routine.goalId) : null;
                  return (
                    <Card key={routine.id} className="p-3 border-card-border hover-elevate" data-testid={`routine-${routine.id}`}>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={routine.enabled}
                          onCheckedChange={(checked) => actions.updateRoutineTemplate(routine.id, { enabled: checked })}
                          data-testid={`routine-toggle-${routine.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-sm text-foreground">{routine.name}</div>
                          {routine.description && (
                            <div className="text-xs text-muted-foreground truncate">{routine.description}</div>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className={`text-xs ${LIFE_AREA_COLORS[routine.category]}`}>{routine.category}</span>
                            {linkedGoal && (
                              <Badge variant="outline" className="text-[10px] py-0 h-3.5 border-primary/30 text-primary/70">
                                {linkedGoal.title}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-xs text-primary font-bold">+{routine.xp} XP</span>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setEditingRoutine(routine)}
                            data-testid={`routine-edit-${routine.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`routine-delete-${routine.id}`}>
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить рутину?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Шаблон "{routine.name}" будет удалён из рутины.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => actions.deleteRoutineTemplate(routine.id)}>
                                  Удалить
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Card className="p-3 bg-muted/50 border-dashed border-border">
              <p className="text-xs text-muted-foreground font-display">
                Максимальный XP за рутину в день: <span className="text-primary font-bold">50 XP</span>
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {editingTask && (
        <AddTaskDialog 
          open={!!editingTask} 
          onOpenChange={(open) => !open && setEditingTask(null)}
          taskToEdit={editingTask}
          onAdd={(updates) => {
            actions.updateTask(editingTask.id, updates);
            setEditingTask(null);
          }}
        />
      )}

      {editingRoutine && (
        <AddRoutineDialog
          open={!!editingRoutine}
          onOpenChange={(open) => !open && setEditingRoutine(null)}
          routineToEdit={editingRoutine}
          onAdd={(updates) => {
            actions.updateRoutineTemplate(editingRoutine.id, updates);
            setEditingRoutine(null);
          }}
        />
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete, onEdit, onReschedule }: {
  task: TodayTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onReschedule?: (id: string, newDate: string) => void;
}) {
  const { state } = useStore();
  const weekGoal = task.weekGoalId ? state.goals.find(g => g.id === task.weekGoalId) : null;
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const getNextDay = () => {
    const d = new Date(task.date || getTodayDate());
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  return (
    <Card
      className={`p-3 border-card-border cursor-pointer transition-all hover-elevate group ${
        task.completed ? "opacity-60" : ""
      }`}
      onClick={() => onToggle(task.id)}
      data-testid={`task-row-${task.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {task.completed ? (
            <CheckCircle className="w-5 h-5 text-primary" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-display text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.name}
          </div>
          {task.description && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
            {task.type === "routine" && <Badge variant="secondary" className="text-xs py-0 h-4">Рутина</Badge>}
            {task.difficulty && (
              <Badge variant="outline" className={`text-xs py-0 h-4 ${
                task.difficulty === "high" ? "border-red-500/50 text-red-400" :
                task.difficulty === "medium" ? "border-yellow-500/50 text-yellow-400" :
                task.difficulty === "low" ? "border-green-500/50 text-green-400" :
                "border-primary/50 text-primary"
              }`}>
                {task.difficulty === "low" ? "Лёгкая" : task.difficulty === "medium" ? "Средняя" : task.difficulty === "high" ? "Сложная" : "Свой XP"}
              </Badge>
            )}
            {weekGoal && (
              <Badge variant="outline" className="text-xs py-0 h-4 border-primary/30 text-primary/70">
                {weekGoal.title}
              </Badge>
            )}
            {(task.startTime || task.endTime) && !task.noDeadline && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                {task.startTime || "??"} - {task.endTime || "??"}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`font-mono text-xs font-bold mr-2 ${task.completed ? "text-muted-foreground" : "text-primary"}`}>
            +{task.xp} XP
          </span>
          {onReschedule && !task.completed && (
            <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
              <PopoverTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 invisible group-hover:visible"
                  onClick={(e) => { e.stopPropagation(); }}
                  data-testid={`task-reschedule-${task.id}`}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-display text-muted-foreground uppercase tracking-wider px-1">Перенести задачу</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start text-xs gap-2"
                  onClick={() => { onReschedule(task.id, getNextDay()); setRescheduleOpen(false); }}
                  data-testid={`task-reschedule-tomorrow-${task.id}`}
                >
                  <CalendarDays className="w-3 h-3" />
                  Завтра
                </Button>
                <div className="flex gap-1">
                  <Input
                    type="date"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className="text-xs h-8 flex-1"
                    data-testid={`task-reschedule-date-${task.id}`}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 text-xs px-2"
                    disabled={!customDate}
                    onClick={() => {
                      if (customDate) {
                        onReschedule(task.id, customDate);
                        setRescheduleOpen(false);
                        setCustomDate("");
                      }
                    }}
                    data-testid={`task-reschedule-confirm-${task.id}`}
                  >
                    OK
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 invisible group-hover:visible"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            data-testid={`task-edit-${task.id}`}
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <button
            className="invisible group-hover:visible text-muted-foreground p-1"
            onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            data-testid={`task-delete-${task.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

import { useState } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, xpForDifficulty, getTodayDate, type LifeArea, type TaskDifficulty } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Plus, Trash2, RefreshCw, CheckSquare, Repeat, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function AddTaskDialog({ onAdd }: { onAdd: (task: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LifeArea>("Body");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), category, difficulty, xp: xpForDifficulty(difficulty), type: "today" });
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1" data-testid="button-add-task">
          <Plus className="w-3 h-3" />
          Добавить задачу
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Новая задача на сегодня</DialogTitle>
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
            <Label>Сложность</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as TaskDifficulty)}>
              <SelectTrigger data-testid="select-task-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Лёгкая — 10 XP</SelectItem>
                <SelectItem value="medium">Средняя — 25 XP</SelectItem>
                <SelectItem value="high">Сложная — 50 XP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" data-testid="button-task-submit">
              Добавить (+{xpForDifficulty(difficulty)} XP)
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddRoutineDialog({ onAdd }: { onAdd: (r: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LifeArea>("Body");
  const [xp, setXp] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ name: name.trim(), category, xp, enabled: true });
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1" data-testid="button-add-routine">
          <Plus className="w-3 h-3" />
          Добавить рутину
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Новая ежедневная рутина</DialogTitle>
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
          <Button type="submit" className="w-full" data-testid="button-routine-submit">
            Добавить рутину
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksPage() {
  const { state, actions, todayTasks, isRoutineLoaded } = useStore();
  const { toast } = useToast();
  const today = getTodayDate();

  const handleToggle = (id: string) => actions.toggleTask(id);

  const handleLoadRoutine = () => {
    actions.loadRoutineForToday();
    toast({ title: "Рутина загружена", description: "Шаблоны добавлены в список сегодня." });
  };

  const routineTasks = todayTasks.filter(t => t.type === "routine");
  const regularTasks = todayTasks.filter(t => t.type !== "routine");

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
                    <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={actions.deleteTask} />
                  ))}
                </div>
              </div>
            )}

            {regularTasks.length > 0 && (
              <div>
                <div className="text-xs font-display uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Сегодняшние задачи
                </div>
                <div className="space-y-2">
                  {regularTasks.map(task => (
                    <TaskRow key={task.id} task={task} onToggle={handleToggle} onDelete={actions.deleteTask} />
                  ))}
                </div>
              </div>
            )}

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
              <AddRoutineDialog onAdd={actions.addRoutineTemplate} />
            </div>

            {state.routineTemplates.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-border">
                <Repeat className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-display text-sm text-muted-foreground">Нет шаблонов рутины</p>
                <p className="text-xs text-muted-foreground mt-1">Создай повторяющиеся задачи</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {state.routineTemplates.map(routine => (
                  <Card key={routine.id} className="p-3 border-card-border hover-elevate" data-testid={`routine-${routine.id}`}>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={routine.enabled}
                        onCheckedChange={(checked) => actions.updateRoutineTemplate(routine.id, { enabled: checked })}
                        data-testid={`routine-toggle-${routine.id}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-sm text-foreground">{routine.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${LIFE_AREA_COLORS[routine.category]}`}>{routine.category}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-xs text-primary font-bold">+{routine.xp} XP</span>
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
                ))}
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
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: {
  task: any;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
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
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs ${LIFE_AREA_COLORS[task.category]}`}>{task.category}</span>
            {task.type === "routine" && <Badge variant="secondary" className="text-xs py-0 h-4">Рутина</Badge>}
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
          <button
            className="invisible group-hover:visible text-muted-foreground"
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

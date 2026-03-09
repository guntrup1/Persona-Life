import { useState, useEffect } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type GoalType, xpForGoal, getGoalProgress, type Goal, getTodayDate, type TodayTask } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Plus, Trash2, Target, ChevronRight, Trophy, Zap, Edit2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

function EditGoalDialog({ goal, onUpdate }: { goal: Goal; onUpdate: (id: string, g: any) => void }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [category, setCategory] = useState<LifeArea>(goal.category);
  const [description, setDescription] = useState(goal.description || "");
  const [parentId, setParentId] = useState(goal.parentId || "none");

  const typeLabels: Record<GoalType, string> = { year: "Годовая", month: "Месячная", week: "Недельная" };

  const possibleParents = state.goals.filter(g => {
    if (goal.type === "month") return g.type === "year";
    if (goal.type === "week") return g.type === "month";
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onUpdate(goal.id, {
      title: title.trim(),
      category,
      parentId: parentId === "none" ? undefined : parentId,
      description: description.trim(),
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-goal-${goal.id}`}>
          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Редактировать {typeLabels[goal.type]} цель</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Название цели</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Чего хочешь достичь?"
              data-testid="input-edit-goal-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Описание (опционально)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Подробности..."
              className="min-h-[80px]"
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

          {(goal.type === "month" || goal.type === "week") && (
            <div className="space-y-1.5">
              <Label>{goal.type === "month" ? "Годовая цель" : "Месячная цель"}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите родительскую цель" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет</SelectItem>
                  {possibleParents.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full mt-2" data-testid="button-edit-goal-submit">
            Сохранить изменения
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddGoalDialog({ parentId, parentType, onAdd, forcedType }: {
  parentId?: string;
  parentType?: GoalType;
  onAdd: (g: any) => void;
  forcedType?: GoalType;
}) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LifeArea>("Mind");
  const [description, setDescription] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(parentId || "");
  const [customXP, setCustomXP] = useState<number | "">("");

  const type: GoalType = forcedType || (!parentType ? "year" : parentType === "year" ? "month" : "week");
  const typeLabels: Record<GoalType, string> = { year: "Годовая", month: "Месячная", week: "Недельная" };
  const defaultXP = xpForGoal(type);

  const possibleParents = state.goals.filter(g => {
    if (type === "month") return g.type === "year";
    if (type === "week") return g.type === "month";
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date();
    onAdd({
      type,
      title: title.trim(),
      category,
      parentId: selectedParentId || undefined,
      description: description.trim(),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      week: Math.ceil(now.getDate() / 7),
      customXP: customXP !== "" ? Number(customXP) : undefined,
    });
    setTitle("");
    setDescription("");
    setSelectedParentId(parentId || "");
    setCustomXP("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1" data-testid={`button-add-goal-${type}`}>
          <Plus className="w-3 h-3" />
          {typeLabels[type]}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{typeLabels[type]} цель</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Название цели</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Чего хочешь достичь?"
              autoFocus
              data-testid="input-goal-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Описание (опционально)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Подробности..."
              className="min-h-[80px]"
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

          {(type === "month" || type === "week") && possibleParents.length > 0 && (
            <div className="space-y-1.5">
              <Label>{type === "month" ? "Годовая цель" : "Месячная цель"}</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите родительскую цель" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет</SelectItem>
                  {possibleParents.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>XP за выполнение</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={9999}
                placeholder={String(defaultXP)}
                value={customXP}
                onChange={e => setCustomXP(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-32 font-mono"
                data-testid="input-goal-xp"
              />
              <span className="text-sm text-muted-foreground">XP</span>
              <span className="text-xs text-muted-foreground ml-auto">По умолчанию: {defaultXP} XP</span>
            </div>
          </div>
          <Button type="submit" className="w-full" data-testid="button-goal-submit">
            Создать цель
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, goals, onToggle, onDelete, onAdd, onUpdate, setGoalTaskWeight, state }: {
  goal: Goal;
  goals: Goal[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (g: any) => void;
  onUpdate: (id: string, g: any) => void;
  setGoalTaskWeight: (goalId: string, taskId: string, weight: number) => void;
  state: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeColors: Record<GoalType, string> = {
    year: "text-yellow-400 border-yellow-500/30",
    month: "text-blue-400 border-blue-500/30",
    week: "text-green-400 border-green-500/30",
  };
  const typeLabels: Record<GoalType, string> = { year: "Год", month: "Месяц", week: "Неделя" };

  const childGoals = goals.filter(g => g.parentId === goal.id);
  const progress = getGoalProgress(goal, state);
  const parentGoal = goal.parentId ? goals.find(g => g.id === goal.parentId) : null;

  // Find linked tasks (including routine tasks for today)
  const linkedTasks = state.todayTasks.filter((t: TodayTask) => t.weekGoalId === goal.id || t.goalId === goal.id);
  const routineLinked = state.routineTemplates
    .filter((r: any) => r.goalId === goal.id)
    .map((r: any) => {
      const todayTask = state.todayTasks.find((t: TodayTask) => t.routineId === r.id && t.date === getTodayDate());
      return todayTask || null;
    })
    .filter(Boolean) as TodayTask[];

  const allTasks = [...linkedTasks, ...routineLinked.filter(rt => !linkedTasks.find((t: TodayTask) => t.id === rt.id))];

  return (
    <div className="space-y-2">
      <Card className={`p-3 border-card-border hover-elevate transition-all ${goal.completed ? "opacity-60" : ""}`} data-testid={`goal-${goal.id}`}>
        <div className="flex items-start gap-3">
          <button
            className="mt-0.5 flex-shrink-0"
            onClick={() => onToggle(goal.id)}
            data-testid={`goal-toggle-${goal.id}`}
          >
            {goal.completed ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-xs h-4 py-0 ${typeColors[goal.type]}`}>
                {typeLabels[goal.type]}
              </Badge>
              <span className={`text-xs ${LIFE_AREA_COLORS[goal.category]}`}>{goal.category}</span>
              {parentGoal && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ChevronRight className="w-2 h-2" />
                  {parentGoal.title}
                </span>
              )}
            </div>
            <div className={`font-display text-sm font-medium ${goal.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {goal.title}
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
            )}

            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Прогресс</span>
                <span>{progress.completed}/{progress.total} XP ({progress.percent}%)</span>
              </div>
              <Progress value={progress.percent} className="h-1" />
            </div>

            {goal.type === "week" && allTasks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Связанные задачи
                </div>
                <div className="space-y-1">
                  {allTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between text-[11px]">
                      <span className={`truncate mr-2 ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {task.name}
                      </span>
                      <span className={`font-mono shrink-0 ${task.completed ? "text-primary" : "text-muted-foreground"}`}>
                        {task.completed ? "✓ " : ""}{task.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className={`font-mono text-xs font-bold ${goal.completed ? "text-muted-foreground" : "text-primary"}`}>
              +{goal.xp} XP
            </span>
            <div className="flex flex-col gap-0.5">
              <EditGoalDialog goal={goal} onUpdate={onUpdate} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid={`goal-delete-${goal.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить цель?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Цель и все вложенные подцели будут удалены.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(goal.id)}>Удалить</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {childGoals.length > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-2 text-muted-foreground transition-transform self-center"
                  style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {expanded && childGoals.length > 0 && (
        <div className="ml-6 space-y-2">
          {childGoals.map(child => (
            <GoalCard
              key={child.id}
              goal={child}
              goals={goals}
              onToggle={onToggle}
              onDelete={onDelete}
              onAdd={onAdd}
              onUpdate={onUpdate}
              setGoalTaskWeight={setGoalTaskWeight}
              state={state}
            />
          ))}
          {goal.type !== "week" && (
            <AddGoalDialog
              parentId={goal.id}
              parentType={goal.type}
              onAdd={onAdd}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const { state, actions } = useStore();

  const yearGoals = state.goals.filter(g => g.type === "year");
  const monthGoals = state.goals.filter(g => g.type === "month");
  const weekGoals = state.goals.filter(g => g.type === "week");

  const completedCount = state.goals.filter(g => g.completed).length;
  const totalCount = state.goals.length;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Цели
          </h1>
          <div className="flex gap-2">
            <AddGoalDialog onAdd={actions.addGoal} forcedType="year" />
            <AddGoalDialog onAdd={actions.addGoal} forcedType="month" />
            <AddGoalDialog onAdd={actions.addGoal} forcedType="week" />
          </div>
        </div>

        {state.xp.goalXP > 0 && (
          <Card className="p-3 bg-primary/10 border-primary/20 flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div>
              <div className="font-display text-sm text-foreground">Заработано за цели</div>
              <div className="font-mono text-xs text-primary">{state.xp.goalXP} XP</div>
            </div>
            <div className="ml-auto font-display text-xs text-muted-foreground">
              {completedCount}/{totalCount} выполнено
            </div>
          </Card>
        )}

        <Tabs defaultValue="week" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto">
            <TabsTrigger value="year" className="font-display text-xs">Год</TabsTrigger>
            <TabsTrigger value="month" className="font-display text-xs">Месяц</TabsTrigger>
            <TabsTrigger value="week" className="font-display text-xs">Неделя</TabsTrigger>
          </TabsList>

          <TabsContent value="year" className="space-y-4 outline-none">
            {yearGoals.length === 0 ? (
              <EmptyGoals type="year" onAdd={actions.addGoal} />
            ) : (
              yearGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  goals={state.goals}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onAdd={actions.addGoal}
                  onUpdate={actions.updateGoal}
                  setGoalTaskWeight={actions.setGoalTaskWeight}
                  state={state}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="month" className="space-y-4 outline-none">
            {monthGoals.length === 0 ? (
              <EmptyGoals type="month" onAdd={actions.addGoal} />
            ) : (
              monthGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  goals={state.goals}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onAdd={actions.addGoal}
                  onUpdate={actions.updateGoal}
                  setGoalTaskWeight={actions.setGoalTaskWeight}
                  state={state}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="week" className="space-y-4 outline-none">
            {weekGoals.length === 0 ? (
              <EmptyGoals type="week" onAdd={actions.addGoal} />
            ) : (
              weekGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  goals={state.goals}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onAdd={actions.addGoal}
                  onUpdate={actions.updateGoal}
                  setGoalTaskWeight={actions.setGoalTaskWeight}
                  state={state}
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        <Card className="p-3 bg-muted/30 border-dashed border-border">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div><span className="text-yellow-400 font-bold">1000</span><div className="text-muted-foreground">Год XP</div></div>
            <div><span className="text-blue-400 font-bold">250</span><div className="text-muted-foreground">Месяц XP</div></div>
            <div><span className="text-green-400 font-bold">100</span><div className="text-muted-foreground">Неделя XP</div></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyGoals({ type, onAdd }: { type: GoalType, onAdd: (g: any) => void }) {
  const labels: Record<GoalType, string> = { year: "годовую", month: "месячную", week: "недельную" };
  return (
    <Card className="p-10 text-center border-dashed border-border">
      <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
      <p className="font-display text-sm text-muted-foreground">Нет целей</p>
      <p className="text-xs text-muted-foreground mt-1">Создай первую {labels[type]} цель</p>
      <div className="mt-4">
        <AddGoalDialog onAdd={onAdd} forcedType={type} />
      </div>
    </Card>
  );
}

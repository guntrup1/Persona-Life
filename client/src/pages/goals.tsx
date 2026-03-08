import { useState } from "react";
import { useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type GoalType, xpForGoal } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Plus, Trash2, Target, ChevronRight, Trophy, Calendar, Zap } from "lucide-react";

type Goal = {
  id: string;
  type: GoalType;
  title: string;
  category: LifeArea;
  parentId?: string;
  completed: boolean;
  xp: number;
  linkedTaskIds: string[];
  year?: number;
  month?: number;
  week?: number;
  description?: string;
};

function AddGoalDialog({ parentId, parentType, onAdd }: {
  parentId?: string;
  parentType?: GoalType;
  onAdd: (g: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LifeArea>("Mind");
  const [description, setDescription] = useState("");

  const type: GoalType = !parentType ? "year" : parentType === "year" ? "month" : "week";
  const typeLabels: Record<GoalType, string> = { year: "Годовая", month: "Месячная", week: "Недельная" };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date();
    onAdd({
      type,
      title: title.trim(),
      category,
      parentId,
      description: description.trim(),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      week: Math.ceil(now.getDate() / 7),
    });
    setTitle("");
    setDescription("");
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
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <span className="text-sm text-muted-foreground">XP за выполнение</span>
            <span className="font-mono font-bold text-primary">+{xpForGoal(type)} XP</span>
          </div>
          <Button type="submit" className="w-full" data-testid="button-goal-submit">
            Создать цель
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, children, goals, onToggle, onDelete, onAdd }: {
  goal: Goal;
  children?: Goal[];
  goals: Goal[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (g: any) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const typeColors: Record<GoalType, string> = {
    year: "text-yellow-400 border-yellow-500/30",
    month: "text-blue-400 border-blue-500/30",
    week: "text-green-400 border-green-500/30",
  };
  const typeLabels: Record<GoalType, string> = { year: "Год", month: "Месяц", week: "Неделя" };

  const childGoals = goals.filter(g => g.parentId === goal.id);

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
            </div>
            <div className={`font-display text-sm font-medium ${goal.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {goal.title}
            </div>
            {goal.description && (
              <p className="text-xs text-muted-foreground mt-1">{goal.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`font-mono text-xs font-bold ${goal.completed ? "text-muted-foreground" : "text-primary"}`}>
              +{goal.xp} XP
            </span>
            {childGoals.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-muted-foreground transition-transform"
                style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
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
          </div>
        </div>
      </Card>

      {expanded && (
        <div className="ml-6 space-y-2">
          {childGoals.map(child => (
            <GoalCard
              key={child.id}
              goal={child}
              goals={goals}
              onToggle={onToggle}
              onDelete={onDelete}
              onAdd={onAdd}
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

  const yearGoals = state.goals.filter(g => g.type === "year" && !g.parentId);
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
          <AddGoalDialog onAdd={actions.addGoal} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center border-card-border">
            <div className="text-2xl font-display font-bold text-yellow-400">{state.goals.filter(g => g.type === "year").length}</div>
            <div className="text-xs text-muted-foreground font-display">Годовые</div>
          </Card>
          <Card className="p-3 text-center border-card-border">
            <div className="text-2xl font-display font-bold text-blue-400">{state.goals.filter(g => g.type === "month").length}</div>
            <div className="text-xs text-muted-foreground font-display">Месячные</div>
          </Card>
          <Card className="p-3 text-center border-card-border">
            <div className="text-2xl font-display font-bold text-green-400">{state.goals.filter(g => g.type === "week").length}</div>
            <div className="text-xs text-muted-foreground font-display">Недельные</div>
          </Card>
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

        {yearGoals.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-border">
            <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-display text-sm text-muted-foreground">Нет целей</p>
            <p className="text-xs text-muted-foreground mt-1">Создай первую годовую цель</p>
            <div className="mt-4">
              <AddGoalDialog onAdd={actions.addGoal} />
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="text-xs font-display uppercase tracking-widest text-yellow-400 flex items-center gap-2">
              <Trophy className="w-3 h-3" />
              Годовые цели
            </div>
            {yearGoals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                goals={state.goals}
                onToggle={actions.toggleGoal}
                onDelete={actions.deleteGoal}
                onAdd={actions.addGoal}
              />
            ))}
          </div>
        )}

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

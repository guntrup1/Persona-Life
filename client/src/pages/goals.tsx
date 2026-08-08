import { useState } from "react";
import {
  useStore, LIFE_AREAS, LIFE_AREA_COLORS, type LifeArea, type GoalType,
  type PlanItem, getGoalProgress, type Goal, getTodayDate, canCompleteGoal,
} from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Plus, Trash2, Milestone, ChevronRight, ChevronDown, Edit2, Archive, RotateCcw, ListChecks, AlertTriangle, Calendar, Clock, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

// ─── Restore Goal Dialog ───────────────────────────────────────────────

function RestoreGoalDialog({ goal }: { goal: Goal }) {
  const { actions } = useStore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [timeLimitType, setTimeLimitType] = useState<"current_period" | "from_now" | "custom">("current_period");
  const [customStart, setCustomStart] = useState(getTodayDate());
  const [customEnd, setCustomEnd] = useState("");

  const handleRestore = (e: React.FormEvent) => {
    e.preventDefault();
    if (timeLimitType === "custom" && (!customStart || !customEnd)) {
      toast({ title: "Ошибка", description: "Укажите начальную и конечную даты цели", variant: "destructive" });
      return;
    }
    actions.restoreGoal(goal.id, timeLimitType, customStart, customEnd);
    toast({ title: "Цель восстановлена", description: `Цель «${goal.title}» снова активна!` });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
          <RotateCcw className="w-3 h-3" /> Восстановить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base">Восстановление цели «{goal.title}»</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleRestore} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-display">Новые границы времени</Label>
            <Select value={timeLimitType} onValueChange={(v: any) => setTimeLimitType(v)}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_period">Текущий период (до конца текущего {goal.type === "year" ? "года" : goal.type === "month" ? "месяца" : "недели"})</SelectItem>
                <SelectItem value="from_now">С текущего момента (+1 {goal.type === "year" ? "год" : goal.type === "month" ? "месяц" : "неделю"})</SelectItem>
                <SelectItem value="custom">Произвольные даты</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeLimitType === "custom" && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[11px]">Дата начала</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Дата окончания</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full text-xs font-display uppercase tracking-wider" data-testid="button-confirm-restore-goal">
            Восстановить в активные цели
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Goal Dialog ──────────────────────────────────────────────────

function EditGoalDialog({ goal, onUpdate }: { goal: Goal; onUpdate: (id: string, g: any) => void }) {
  const { state } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [category, setCategory] = useState<LifeArea>(goal.category);
  const [description, setDescription] = useState(goal.description || "");
  const [parentId, setParentId] = useState(goal.parentId || "none");
  const [timeLimitType, setTimeLimitType] = useState<"current_period" | "from_now" | "custom">(goal.timeLimitType || "current_period");
  const [customStart, setCustomStart] = useState(goal.startDate || getTodayDate());
  const [customEnd, setCustomEnd] = useState(goal.endDate || "");

  const typeLabels: Record<GoalType, string> = { year: t.goals.yearTab, month: t.goals.monthTab, week: t.goals.weekTab };

  const possibleParents = state.goals.filter(g => {
    if (g.status === "failed") return false;
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
      timeLimitType,
      startDate: customStart,
      endDate: customEnd,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-goal-${goal.id}`}>
          <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Редактирование цели</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>{t.goals.goalName}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.goals.goalNamePlaceholder} data-testid="input-edit-goal-title" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.goals.goalDesc}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.goals.goalDescPlaceholder} className="min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.goals.category}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LifeArea)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Временные границы цели</Label>
            <Select value={timeLimitType} onValueChange={(v: any) => setTimeLimitType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current_period">Текущий календарный период</SelectItem>
                <SelectItem value="from_now">С текущего момента (+1 {goal.type === "year" ? "год" : goal.type === "month" ? "месяц" : "неделю"})</SelectItem>
                <SelectItem value="custom">Произвольные даты</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeLimitType === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Начало</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Конец</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          )}

          {(goal.type === "month" || goal.type === "week") && (
            <div className="space-y-1.5">
              <Label>{goal.type === "month" ? t.goals.parentYear : t.goals.parentMonth}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder={t.goals.selectParent} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.goals.noParent}</SelectItem>
                  {possibleParents.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="submit" className="w-full mt-2" data-testid="button-edit-goal-submit">{t.goals.saveChanges}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Goal Dialog ───────────────────────────────────────────────────

function AddGoalDialog({ parentId, parentType, onAdd, forcedType }: { parentId?: string; parentType?: GoalType; onAdd: (g: any) => void; forcedType?: GoalType }) {
  const { state } = useStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LifeArea>("Mind");
  const [description, setDescription] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(parentId || "");
  const [timeLimitType, setTimeLimitType] = useState<"current_period" | "from_now" | "custom">("current_period");
  const [customStart, setCustomStart] = useState(getTodayDate());
  const [customEnd, setCustomEnd] = useState("");

  const type: GoalType = forcedType || (!parentType ? "year" : parentType === "year" ? "month" : "week");
  const typeLabels: Record<GoalType, string> = { year: t.goals.yearTab, month: t.goals.monthTab, week: t.goals.weekTab };

  const possibleParents = state.goals.filter(g => {
    if (g.status === "failed") return false;
    if (type === "month") return g.type === "year";
    if (type === "week") return g.type === "month";
    return false;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({
      type,
      title: title.trim(),
      category,
      parentId: selectedParentId === "none" ? undefined : (selectedParentId || undefined),
      description: description.trim(),
      timeLimitType,
      startDate: customStart,
      endDate: customEnd,
    });
    setTitle(""); setDescription(""); setSelectedParentId(parentId || ""); setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1 border-primary/40" data-testid={`button-add-goal-${type}`}>
          <Plus className="w-3.5 h-3.5 text-primary" />{typeLabels[type]}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Новая цель ({typeLabels[type]})</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.goals.goalName}</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.goals.goalNamePlaceholder} autoFocus data-testid="input-goal-title" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.goals.goalDesc}</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.goals.goalDescPlaceholder} className="min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.goals.category}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as LifeArea)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LIFE_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Границы времени цели</Label>
            <Select value={timeLimitType} onValueChange={(v: any) => setTimeLimitType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current_period">Текущий период (до конца {type === "year" ? "года" : type === "month" ? "месяца" : "недели"})</SelectItem>
                <SelectItem value="from_now">С текущего момента (+1 {type === "year" ? "год" : type === "month" ? "месяц" : "неделю"})</SelectItem>
                <SelectItem value="custom">Произвольные даты</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {timeLimitType === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Начало</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Конец</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          )}

          {(type === "month" || type === "week") && possibleParents.length > 0 && (
            <div className="space-y-1.5">
              <Label>{type === "month" ? t.goals.parentYear : t.goals.parentMonth}</Label>
              <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                <SelectTrigger><SelectValue placeholder={t.goals.selectParent} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.goals.noParent}</SelectItem>
                  {possibleParents.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full" data-testid="button-goal-submit">{t.goals.createGoal}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Plan Section ──────────────────────────────────────────────────────

function PlanSection({ goal, onUpdate }: { goal: Goal; onUpdate: (id: string, g: any) => void }) {
  const { t } = useI18n();
  const [newItem, setNewItem] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const plan: PlanItem[] = goal.plan || [];
  const allDone = plan.length > 0 && plan.every(p => p.done);
  const doneCount = plan.filter(p => p.done).length;

  const addItem = () => {
    if (!newItem.trim()) return;
    const updated: PlanItem[] = [...plan, { id: crypto.randomUUID(), text: newItem.trim(), done: false }];
    onUpdate(goal.id, { plan: updated });
    setNewItem("");
  };

  const toggleItem = (itemId: string) => {
    const updated = plan.map(p => p.id === itemId ? { ...p, done: !p.done } : p);
    onUpdate(goal.id, { plan: updated });
  };

  const deleteItem = (itemId: string) => {
    const updated = plan.filter(p => p.id !== itemId);
    onUpdate(goal.id, { plan: updated });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <button
        className="w-full flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors mb-2"
        onClick={() => setPlanOpen(o => !o)}
      >
        <span className="flex items-center gap-1.5">
          <ListChecks className="w-3.5 h-3.5" />
          Чек-лист / Подпункты
          {plan.length > 0 && (
            <span className={`font-mono ml-1 ${allDone ? "text-primary" : "text-muted-foreground"}`}>
              {doneCount}/{plan.length}
            </span>
          )}
        </span>
        {planOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {planOpen && (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {plan.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic px-1">{t.goals.noPlan}</p>
          )}
          {plan.map(item => (
            <div key={item.id} className="flex items-center justify-between text-xs py-0.5 group">
              <button
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-2 text-left transition-colors flex-1 ${
                  item.done ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              >
                {item.done ? (
                  <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
                <span>{item.text}</span>
              </button>
              <button
                onClick={() => deleteItem(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 p-0.5 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          <div className="flex gap-1.5 pt-1">
            <Input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              placeholder="Добавить шаг плана..."
              className="text-xs h-7"
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem())}
            />
            <Button size="sm" variant="ghost" onClick={addItem} className="h-7 px-2 text-xs">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Goal Card Component ───────────────────────────────────────────────

function GoalCard({ goal, childGoals, onToggle, onDelete, onUpdate, onAddChild }: {
  goal: Goal;
  childGoals: Goal[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, g: any) => void;
  onAddChild: (parentId: string, parentType: GoalType) => void;
}) {
  const { state } = useStore();
  const { toast } = useToast();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const progress = getGoalProgress(goal, state);
  const childType: GoalType = goal.type === "year" ? "month" : "week";

  const handleToggleClick = () => {
    const check = canCompleteGoal(goal, state);
    if (!check.allowed && !goal.completed) {
      toast({
        title: "Невозможно завершить цель",
        description: check.reason,
        variant: "destructive",
      });
      return;
    }
    onToggle(goal.id);
  };

  return (
    <Card className={`p-4 border-card-border transition-all ${goal.completed ? "opacity-60 bg-card/40" : ""}`} data-testid={`goal-card-${goal.id}`}>
      <div className="space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <button
              onClick={handleToggleClick}
              className="mt-0.5 flex-shrink-0 transition-transform active:scale-95"
              data-testid={`button-toggle-goal-${goal.id}`}
            >
              {goal.completed ? (
                <CheckCircle className="w-5 h-5 text-primary" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-display text-base font-semibold ${goal.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {goal.title}
                </h3>
                <Badge variant="outline" className={`text-[10px] ${LIFE_AREA_COLORS[goal.category]}`}>
                  {goal.category}
                </Badge>
                {goal.startDate && goal.endDate && (
                  <Badge variant="secondary" className="text-[10px] font-mono gap-1 text-muted-foreground">
                    <Calendar className="w-3 h-3 text-primary" />
                    {goal.startDate} — {goal.endDate}
                  </Badge>
                )}
              </div>

              {goal.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <EditGoalDialog goal={goal} onUpdate={onUpdate} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-delete-goal-${goal.id}`}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t.goals.deleteGoalQ}</AlertDialogTitle>
                  <AlertDialogDescription>{t.goals.deleteGoalDesc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.goals.cancel}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(goal.id)}>{t.goals.delete}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>Прогресс</span>
            <span className="text-primary font-bold">{progress.percent}% ({progress.completed}/{progress.total})</span>
          </div>
          <Progress value={progress.percent} className="h-1.5" />
        </div>

        {/* Plan Section */}
        <PlanSection goal={goal} onUpdate={onUpdate} />

        {/* Child sub-goals list */}
        {(goal.type === "year" || goal.type === "month") && (
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                <Milestone className="w-3.5 h-3.5 text-primary" />
                <span>{goal.type === "year" ? "Месячные цели" : "Недельные цели"} ({childGoals.length})</span>
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] gap-1 text-primary"
                onClick={() => onAddChild(goal.id, goal.type)}
                data-testid={`button-add-child-goal-${goal.id}`}
              >
                <Plus className="w-3 h-3" />
                Добавить под-цель
              </Button>
            </div>

            {expanded && (
              <div className="space-y-1.5 pl-3 border-l-2 border-primary/20">
                {childGoals.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">Под-целей пока нет</p>
                ) : (
                  childGoals.map(child => {
                    const isFailed = child.status === "failed";
                    return (
                      <div key={child.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20 border border-border/40">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            onClick={() => {
                              const chk = canCompleteGoal(child, state);
                              if (!chk.allowed && !child.completed) {
                                toast({ title: "Невозможно завершить под-цель", description: chk.reason, variant: "destructive" });
                                return;
                              }
                              onToggle(child.id);
                            }}
                          >
                            {child.completed ? (
                              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </button>
                          <span className={`truncate font-medium ${child.completed ? "line-through text-muted-foreground" : isFailed ? "text-red-400" : "text-foreground"}`}>
                            {child.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isFailed ? (
                            <div className="flex items-center gap-1">
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Просрочено
                              </Badge>
                              <RestoreGoalDialog goal={child} />
                            </div>
                          ) : (
                            <Badge variant="outline" className={`text-[9px] ${LIFE_AREA_COLORS[child.category]}`}>
                              {child.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Main Goals Page Component ─────────────────────────────────────────

export default function GoalsPage() {
  const { state, actions } = useStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<GoalType | "archive">("week");
  const [archiveFilter, setArchiveFilter] = useState<GoalType | "all">("all");
  const [addingChildFor, setAddingChildFor] = useState<{ parentId: string; parentType: GoalType } | null>(null);

  const activeGoals = state.goals.filter(g => g.status !== "failed");
  const failedGoals = state.goals.filter(g => g.status === "failed");

  const yearGoals = activeGoals.filter(g => g.type === "year");
  const monthGoals = activeGoals.filter(g => g.type === "month");
  const weekGoals = activeGoals.filter(g => g.type === "week");

  const filteredFailedGoals = failedGoals.filter(g => {
    if (archiveFilter === "all") return true;
    return g.type === archiveFilter;
  });

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Milestone className="w-5 h-5 text-primary" />
            {t.nav.goals.toUpperCase()}
          </h1>
          <div className="flex items-center gap-2">
            <AddGoalDialog onAdd={actions.addGoal} forcedType="year" />
            <AddGoalDialog onAdd={actions.addGoal} forcedType="month" />
            <AddGoalDialog onAdd={actions.addGoal} forcedType="week" />
          </div>
        </div>

        {/* Tabs navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="year" className="font-display text-xs uppercase" data-testid="tab-year-goals">
              {t.goals.yearTab} ({yearGoals.length})
            </TabsTrigger>
            <TabsTrigger value="month" className="font-display text-xs uppercase" data-testid="tab-month-goals">
              {t.goals.monthTab} ({monthGoals.length})
            </TabsTrigger>
            <TabsTrigger value="week" className="font-display text-xs uppercase" data-testid="tab-week-goals">
              {t.goals.weekTab} ({weekGoals.length})
            </TabsTrigger>
            <TabsTrigger value="archive" className="font-display text-xs uppercase gap-1" data-testid="tab-archive-goals">
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              Невыполненные ({failedGoals.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Year Goals */}
          <TabsContent value="year" className="space-y-3 mt-4">
            {yearGoals.length === 0 ? (
              <Card className="p-8 text-center border-card-border space-y-3">
                <Milestone className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="font-display text-sm text-muted-foreground">Нет активных годовых целей</p>
                <AddGoalDialog onAdd={actions.addGoal} forcedType="year" />
              </Card>
            ) : (
              yearGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  childGoals={monthGoals.filter(m => m.parentId === goal.id)}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onUpdate={actions.updateGoal}
                  onAddChild={(parentId, parentType) => setAddingChildFor({ parentId, parentType })}
                />
              ))
            )}
          </TabsContent>

          {/* Active Month Goals */}
          <TabsContent value="month" className="space-y-3 mt-4">
            {monthGoals.length === 0 ? (
              <Card className="p-8 text-center border-card-border space-y-3">
                <Milestone className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="font-display text-sm text-muted-foreground">Нет активных месячных целей</p>
                <AddGoalDialog onAdd={actions.addGoal} forcedType="month" />
              </Card>
            ) : (
              monthGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  childGoals={weekGoals.filter(w => w.parentId === goal.id)}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onUpdate={actions.updateGoal}
                  onAddChild={(parentId, parentType) => setAddingChildFor({ parentId, parentType })}
                />
              ))
            )}
          </TabsContent>

          {/* Active Week Goals */}
          <TabsContent value="week" className="space-y-3 mt-4">
            {weekGoals.length === 0 ? (
              <Card className="p-8 text-center border-card-border space-y-3">
                <Milestone className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="font-display text-sm text-muted-foreground">Нет активных недельных целей</p>
                <AddGoalDialog onAdd={actions.addGoal} forcedType="week" />
              </Card>
            ) : (
              weekGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  childGoals={[]}
                  onToggle={actions.toggleGoal}
                  onDelete={actions.deleteGoal}
                  onUpdate={actions.updateGoal}
                  onAddChild={() => {}}
                />
              ))
            )}
          </TabsContent>

          {/* Failed Goals Archive Section */}
          <TabsContent value="archive" className="space-y-4 mt-4">
            {/* Type Filter Sub-Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-card p-2 rounded-lg border border-card-border">
              <div className="text-xs font-display font-semibold uppercase text-muted-foreground">Фильтр по типу:</div>
              <div className="flex gap-1">
                {(["all", "year", "month", "week"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setArchiveFilter(type)}
                    className={`px-3 py-1 rounded text-xs font-display transition-all ${
                      archiveFilter === type
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {type === "all" ? "Все" : type === "year" ? "Год" : type === "month" ? "Месяц" : "Неделя"}
                  </button>
                ))}
              </div>
            </div>

            {filteredFailedGoals.length === 0 ? (
              <Card className="p-8 text-center border-card-border space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-50" />
                <p className="font-display text-sm text-muted-foreground">Нет невыполненных целей по выбранному фильтру</p>
              </Card>
            ) : (
              filteredFailedGoals.map(goal => (
                <Card key={goal.id} className="p-4 border-amber-500/30 bg-amber-950/10 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1">
                          <AlertTriangle className="w-3 h-3" /> Просрочено
                        </Badge>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {goal.type === "year" ? "Год" : goal.type === "month" ? "Месяц" : "Неделя"}
                        </Badge>
                        <h3 className="font-display text-base font-bold text-foreground">{goal.title}</h3>
                      </div>

                      {goal.description && (
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono pt-1">
                        <span>Срок действовал: <strong className="text-foreground">{goal.startDate || "Н/Д"} — {goal.endDate || "Н/Д"}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RestoreGoalDialog goal={goal} />
                      <button
                        onClick={() => actions.deleteGoal(goal.id)}
                        className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                        title="Удалить навсегда"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Modal when adding a child goal directly from parent */}
        {addingChildFor && (
          <AddGoalDialog
            parentId={addingChildFor.parentId}
            parentType={addingChildFor.parentType}
            forcedType={addingChildFor.parentType === "year" ? "month" : "week"}
            onAdd={(g) => {
              actions.addGoal(g);
              setAddingChildFor(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

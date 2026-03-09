import { useState, useEffect, useCallback } from "react";

export type LifeArea =
  | "Body"
  | "Mind"
  | "Hard Skills"
  | "Soft Skills"
  | "Creativity"
  | "Mission"
  | "Finance";

export const LIFE_AREAS: LifeArea[] = [
  "Body", "Mind", "Hard Skills", "Soft Skills", "Creativity", "Mission", "Finance"
];

export const LIFE_AREA_COLORS: Record<LifeArea, string> = {
  "Body": "text-red-400",
  "Mind": "text-blue-400",
  "Hard Skills": "text-yellow-400",
  "Soft Skills": "text-green-400",
  "Creativity": "text-purple-400",
  "Mission": "text-orange-400",
  "Finance": "text-emerald-400",
};

export const LIFE_AREA_BG: Record<LifeArea, string> = {
  "Body": "bg-red-500/20",
  "Mind": "bg-blue-500/20",
  "Hard Skills": "bg-yellow-500/20",
  "Soft Skills": "bg-green-500/20",
  "Creativity": "bg-purple-500/20",
  "Mission": "bg-orange-500/20",
  "Finance": "bg-emerald-500/20",
};

export type TaskDifficulty = "low" | "medium" | "high" | "custom";
export type TaskType = "routine" | "today" | "goal";
export type GoalType = "year" | "month" | "week";
export type TimerMode = "pomodoro" | "deep-work" | "custom";
export type TradeAsset = "GER40" | "EUR" | "XAU" | "GBP";
export type NoteTag = "мысль" | "идея" | "ошибка";
export type BiasDirection = "bullish" | "bearish" | "neutral";

export interface RoutineTemplate {
  id: string;
  name: string;
  description?: string;
  category: LifeArea;
  xp: number;
  enabled: boolean;
  goalId?: string;
}

export interface TodayTask {
  id: string;
  name: string;
  description?: string;
  category: LifeArea;
  difficulty?: TaskDifficulty;
  xp: number;
  completed: boolean;
  date: string;
  type: TaskType;
  routineId?: string;
  goalId?: string;
  weekGoalId?: string;
  startTime?: string;
  endTime?: string;
  noDeadline?: boolean;
  completedAt?: string;
}

export interface Goal {
  id: string;
  type: GoalType;
  title: string;
  category: LifeArea;
  parentId?: string;
  completed: boolean;
  xp: number;
  linkedTaskIds: string[];
  taskWeights?: Record<string, number>;
  year?: number;
  month?: number;
  week?: number;
  description?: string;
}

export interface FocusSession {
  id: string;
  duration: number;
  mode: TimerMode;
  xp: number;
  date: string;
  completedAt: string;
}

export interface TradingNote {
  id: string;
  title?: string;
  time: string;
  asset: TradeAsset;
  timeframe: string;
  tag: NoteTag;
  text: string;
  screenshotUrl?: string;
  date: string;
  createdAt: string;
}

export interface DailyBias {
  id: string;
  date: string;
  asset: TradeAsset;
  direction: BiasDirection;
  pros: string;
  cons: string;
  screenshotUrl?: string;
  createdAt: string;
}

export interface DayNote {
  id: string;
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface StreakData {
  currentStreak: number;
  lastCompletedDate: string | null;
  longestStreak: number;
}

export interface XPData {
  routineXP: number;
  taskXP: number;
  goalXP: number;
  focusXP: number;
  categoryXP: Record<LifeArea, number>;
  totalXP: number;
}

export interface AppState {
  routineTemplates: RoutineTemplate[];
  todayTasks: TodayTask[];
  goals: Goal[];
  focusSessions: FocusSession[];
  tradingNotes: TradingNote[];
  dailyBiases: DailyBias[];
  dayNotes: DayNote[];
  streak: StreakData;
  xp: XPData;
  routineLoadedDates: string[];
}

const STORAGE_KEY = "lifeos_v2";

const DEFAULT_XP: XPData = {
  routineXP: 0,
  taskXP: 0,
  goalXP: 0,
  focusXP: 0,
  categoryXP: {
    "Body": 0, "Mind": 0, "Hard Skills": 0,
    "Soft Skills": 0, "Creativity": 0, "Mission": 0, "Finance": 0,
  },
  totalXP: 0,
};

const DEFAULT_ROUTINE_TEMPLATES: RoutineTemplate[] = [
  { id: "r1", name: "Тренировка", category: "Body", xp: 10, enabled: true },
  { id: "r2", name: "Чтение", category: "Mind", xp: 10, enabled: true },
  { id: "r3", name: "Медитация", category: "Mind", xp: 5, enabled: true },
  { id: "r4", name: "Дневник", category: "Creativity", xp: 5, enabled: true },
];

const DEFAULT_STATE: AppState = {
  routineTemplates: DEFAULT_ROUTINE_TEMPLATES,
  todayTasks: [],
  goals: [
    {
      id: "g1", type: "year", title: "Стать профессиональным трейдером",
      category: "Finance", completed: false, xp: 1000, linkedTaskIds: [], year: 2026,
    },
    {
      id: "g2", type: "month", title: "Изучить Price Action",
      category: "Hard Skills", parentId: "g1", completed: false, xp: 250,
      linkedTaskIds: [], year: 2026, month: 3,
    },
    {
      id: "g3", type: "week", title: "Разобрать 10 торговых сетапов",
      category: "Hard Skills", parentId: "g2", completed: false, xp: 100,
      linkedTaskIds: [], year: 2026, week: 10,
    },
  ],
  focusSessions: [],
  tradingNotes: [],
  dailyBiases: [],
  dayNotes: [],
  streak: { currentStreak: 0, lastCompletedDate: null, longestStreak: 0 },
  xp: DEFAULT_XP,
  routineLoadedDates: [],
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const oldRaw = localStorage.getItem("lifeos_v1");
      if (oldRaw) {
        const old = JSON.parse(oldRaw);
        return {
          ...DEFAULT_STATE,
          ...old,
          dailyBiases: old.dailyBiases || [],
          dayNotes: old.dayNotes || [],
          xp: { ...DEFAULT_XP, ...old.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(old.xp?.categoryXP || {}) } },
          streak: { ...DEFAULT_STATE.streak, ...old.streak },
        };
      }
      return DEFAULT_STATE;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      dailyBiases: parsed.dailyBiases || [],
      dayNotes: parsed.dayNotes || [],
      routineTemplates: parsed.routineTemplates?.length > 0 ? parsed.routineTemplates : DEFAULT_STATE.routineTemplates,
      xp: { ...DEFAULT_XP, ...parsed.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(parsed.xp?.categoryXP || {}) } },
      streak: { ...DEFAULT_STATE.streak, ...parsed.streak },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function getBerlinTime(): Date {
  const now = new Date();
  const berlinOffset = 1 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + berlinOffset * 60000);
}

export function getBerlinHour(): number {
  return getBerlinTime().getHours();
}

export function getBerlinDateString(): string {
  return getBerlinTime().toISOString().split("T")[0];
}

export function getTomorrowBerlinDate(): string {
  const berlin = getBerlinTime();
  berlin.setDate(berlin.getDate() + 1);
  return berlin.toISOString().split("T")[0];
}

export function getMarketSession(): { name: string; active: boolean; color: string } {
  const hour = getBerlinHour();
  const min = getBerlinTime().getMinutes();
  const totalMin = hour * 60 + min;
  if (totalMin >= 3 * 60 && totalMin < 8 * 60) return { name: "Азия", active: true, color: "text-yellow-400" };
  if (totalMin >= 8 * 60 && totalMin < 9 * 60) return { name: "Франкфурт", active: true, color: "text-blue-400" };
  if (totalMin >= 9 * 60 && totalMin < 14 * 60) return { name: "Лондон", active: true, color: "text-green-400" };
  if (totalMin >= 14 * 60 && totalMin < 17 * 60) return { name: "Нью-Йорк", active: true, color: "text-red-400" };
  return { name: "Закрыто", active: false, color: "text-muted-foreground" };
}

export function getCharacterState(): { state: string; label: string; emoji: string } {
  const hour = getBerlinHour();
  if (hour >= 0 && hour < 6) return { state: "sleeping", label: "Сон", emoji: "😴" };
  if (hour >= 6 && hour < 9) return { state: "morning", label: "Утро", emoji: "🌅" };
  if (hour >= 9 && hour < 14) return { state: "working", label: "Работа", emoji: "💪" };
  if (hour >= 14 && hour < 21) return { state: "resting", label: "Отдых", emoji: "☕" };
  return { state: "evening", label: "Вечер", emoji: "🌙" };
}

export function xpForDifficulty(difficulty: TaskDifficulty): number {
  const map: Record<TaskDifficulty, number> = { low: 10, medium: 25, high: 50, custom: 0 };
  return map[difficulty];
}

export function xpForGoal(type: GoalType): number {
  const map: Record<GoalType, number> = { week: 100, month: 250, year: 1000 };
  return map[type];
}

export function xpForFocus(duration: number): number {
  if (duration <= 25) return 5;
  if (duration <= 60) return 15;
  return 25;
}

export function getGoalProgress(goal: Goal, state: AppState): { completed: number; total: number; percent: number } {
  if (goal.type === "week") {
    const weights = goal.taskWeights || {};

    const allLinkedTasks = state.todayTasks.filter(t => t.weekGoalId === goal.id || t.goalId === goal.id);

    const routineLinked = state.routineTemplates
      .filter(r => r.goalId === goal.id)
      .map(r => {
        const todayTask = state.todayTasks.find(t => t.routineId === r.id && t.date === getTodayDate());
        return todayTask || null;
      })
      .filter(Boolean) as TodayTask[];

    const allTasks = [...allLinkedTasks, ...routineLinked.filter(rt => !allLinkedTasks.find(t => t.id === rt.id))];

    if (allTasks.length === 0) return { completed: 0, total: 0, percent: 0 };

    let totalWeight = 0;
    let completedWeight = 0;
    for (const t of allTasks) {
      const w = weights[t.id] ?? 1;
      totalWeight += w;
      if (t.completed) completedWeight += w;
    }

    return {
      completed: completedWeight,
      total: totalWeight,
      percent: totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0,
    };
  }

  if (goal.type === "month") {
    const childGoals = state.goals.filter(g => g.parentId === goal.id);
    if (childGoals.length === 0) return { completed: 0, total: 0, percent: 0 };
    const totalPercent = childGoals.reduce((sum, g) => sum + getGoalProgress(g, state).percent, 0);
    const avg = Math.round(totalPercent / childGoals.length);
    return { completed: avg, total: 100, percent: avg };
  }

  if (goal.type === "year") {
    const childGoals = state.goals.filter(g => g.parentId === goal.id);
    if (childGoals.length === 0) return { completed: 0, total: 0, percent: 0 };
    const totalPercent = childGoals.reduce((sum, g) => sum + getGoalProgress(g, state).percent, 0);
    const avg = Math.round(totalPercent / childGoals.length);
    return { completed: avg, total: 100, percent: avg };
  }

  return { completed: 0, total: 0, percent: 0 };
}

export function recalcXP(state: AppState): XPData {
  const categoryXP: Record<LifeArea, number> = {
    "Body": 0, "Mind": 0, "Hard Skills": 0,
    "Soft Skills": 0, "Creativity": 0, "Mission": 0, "Finance": 0,
  };
  let routineXP = 0;
  let taskXP = 0;
  let goalXP = 0;

  for (const task of state.todayTasks) {
    if (!task.completed) continue;
    if (task.type === "routine") {
      routineXP += task.xp;
      categoryXP[task.category] = (categoryXP[task.category] || 0) + task.xp;
    } else {
      taskXP += task.xp;
      categoryXP[task.category] = (categoryXP[task.category] || 0) + task.xp;
    }
  }

  for (const goal of state.goals) {
    if (goal.completed) {
      goalXP += goal.xp;
      categoryXP[goal.category] = (categoryXP[goal.category] || 0) + goal.xp;
    }
  }

  const focusXP = state.focusSessions.reduce((sum, s) => sum + s.xp, 0);

  return {
    routineXP, taskXP, goalXP, focusXP,
    categoryXP,
    totalXP: routineXP + taskXP + goalXP + focusXP,
  };
}

function checkAndUpdateStreak(state: AppState): StreakData {
  const today = getTodayDate();
  const todayTasks = state.todayTasks.filter(t => t.date === today);
  if (todayTasks.length === 0) return state.streak;
  const allDone = todayTasks.every(t => t.completed);
  if (!allDone) return state.streak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  let newStreak = state.streak.currentStreak;
  if (state.streak.lastCompletedDate === yesterdayStr) {
    newStreak = state.streak.currentStreak + 1;
  } else if (state.streak.lastCompletedDate !== today) {
    newStreak = 1;
  }
  return {
    currentStreak: newStreak,
    lastCompletedDate: today,
    longestStreak: Math.max(state.streak.longestStreak, newStreak),
  };
}

function autoLoadRoutine(state: AppState): AppState {
  const today = getTodayDate();
  const hasRoutineToday = state.todayTasks.some(t => t.date === today && t.type === "routine");
  if (hasRoutineToday) return state;

  const enabledRoutines = state.routineTemplates.filter(r => r.enabled);
  if (enabledRoutines.length === 0) return state;

  const newTasks: TodayTask[] = enabledRoutines.map(r => ({
    id: crypto.randomUUID(),
    name: r.name,
    description: r.description,
    category: r.category,
    xp: r.xp,
    completed: false,
    date: today,
    type: "routine" as TaskType,
    routineId: r.id,
    weekGoalId: r.goalId,
    noDeadline: true,
  }));

  return {
    ...state,
    todayTasks: [...state.todayTasks, ...newTasks],
    routineLoadedDates: [...state.routineLoadedDates.filter(d => d !== today), today],
  };
}

let globalState = loadState();
globalState = autoLoadRoutine(globalState);
globalState = { ...globalState, xp: recalcXP(globalState) };
saveState(globalState);

const listeners = new Set<() => void>();

function notify() { listeners.forEach(l => l()); }

let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleServerSync(state: AppState) {
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    fetch("/api/user/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ data: state }),
    }).catch(() => {});
  }, 2500);
}

export function loadFromServerData(data: AppState) {
  if (!data || typeof data !== "object") return;
  globalState = autoLoadRoutine({ ...DEFAULT_STATE, ...data });
  globalState = { ...globalState, xp: recalcXP(globalState) };
  saveState(globalState);
  notify();
}

function mutate(fn: (s: AppState) => AppState) {
  globalState = fn(globalState);
  globalState = { ...globalState, xp: recalcXP(globalState) };
  saveState(globalState);
  scheduleServerSync(globalState);
  notify();
}

export function useStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const cb = () => forceUpdate(n => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  const state = globalState;

  const actions = {
    addRoutineTemplate: useCallback((template: Omit<RoutineTemplate, "id">) => {
      mutate(s => ({ ...s, routineTemplates: [...s.routineTemplates, { ...template, id: crypto.randomUUID() }] }));
    }, []),

    updateRoutineTemplate: useCallback((id: string, updates: Partial<RoutineTemplate>) => {
      mutate(s => ({ ...s, routineTemplates: s.routineTemplates.map(r => r.id === id ? { ...r, ...updates } : r) }));
    }, []),

    deleteRoutineTemplate: useCallback((id: string) => {
      mutate(s => ({ ...s, routineTemplates: s.routineTemplates.filter(r => r.id !== id) }));
    }, []),

    loadRoutineForToday: useCallback(() => {
      mutate(s => {
        const today = getTodayDate();
        const existing = s.todayTasks.filter(t => t.date === today && t.type === "routine");
        const existingRoutineIds = existing.map(t => t.routineId);
        const enabledRoutines = s.routineTemplates.filter(r => r.enabled && !existingRoutineIds.includes(r.id));
        if (enabledRoutines.length === 0) return s;
        const newTasks: TodayTask[] = enabledRoutines.map(r => ({
          id: crypto.randomUUID(), name: r.name, description: r.description,
          category: r.category, xp: r.xp, completed: false,
          date: today, type: "routine" as TaskType, routineId: r.id,
          weekGoalId: r.goalId, noDeadline: true,
        }));
        return {
          ...s,
          todayTasks: [...s.todayTasks, ...newTasks],
          routineLoadedDates: [...s.routineLoadedDates.filter(d => d !== today), today],
        };
      });
    }, []),

    addTodayTask: useCallback((task: Omit<TodayTask, "id" | "completed">) => {
      mutate(s => ({ ...s, todayTasks: [...s.todayTasks, { ...task, id: crypto.randomUUID(), completed: false }] }));
    }, []),

    updateTask: useCallback((id: string, updates: Partial<TodayTask>) => {
      mutate(s => ({ ...s, todayTasks: s.todayTasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
    }, []),

    toggleTask: useCallback((id: string) => {
      mutate(s => {
        const updated = s.todayTasks.map(t =>
          t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined } : t
        );
        const newState = { ...s, todayTasks: updated };
        const streak = checkAndUpdateStreak(newState);
        return { ...newState, streak };
      });
    }, []),

    deleteTask: useCallback((id: string) => {
      mutate(s => ({ ...s, todayTasks: s.todayTasks.filter(t => t.id !== id) }));
    }, []),

    clearTodayTasks: useCallback(() => {
      const today = getTodayDate();
      mutate(s => ({
        ...s,
        todayTasks: s.todayTasks.filter(t => t.date !== today),
        routineLoadedDates: s.routineLoadedDates.filter(d => d !== today),
      }));
    }, []),

    addGoal: useCallback((goal: Omit<Goal, "id" | "completed" | "linkedTaskIds" | "xp"> & { customXP?: number }) => {
      const { customXP, ...goalData } = goal;
      mutate(s => ({
        ...s,
        goals: [...s.goals, {
          ...goalData, id: crypto.randomUUID(), completed: false, linkedTaskIds: [],
          xp: customXP && customXP > 0 ? customXP : xpForGoal(goal.type), taskWeights: {},
        }],
      }));
    }, []),

    updateGoal: useCallback((id: string, updates: Partial<Goal>) => {
      mutate(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, ...updates } : g) }));
    }, []),

    setGoalTaskWeight: useCallback((goalId: string, taskId: string, weight: number) => {
      mutate(s => ({
        ...s,
        goals: s.goals.map(g => g.id === goalId
          ? { ...g, taskWeights: { ...(g.taskWeights || {}), [taskId]: weight } }
          : g
        ),
      }));
    }, []),

    toggleGoal: useCallback((id: string) => {
      mutate(s => ({ ...s, goals: s.goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g) }));
    }, []),

    deleteGoal: useCallback((id: string) => {
      mutate(s => ({ ...s, goals: s.goals.filter(g => g.id !== id && g.parentId !== id) }));
    }, []),

    addFocusSession: useCallback((session: Omit<FocusSession, "id">) => {
      mutate(s => ({ ...s, focusSessions: [...s.focusSessions, { ...session, id: crypto.randomUUID() }] }));
    }, []),

    addTradingNote: useCallback((note: Omit<TradingNote, "id" | "createdAt">) => {
      mutate(s => ({
        ...s,
        tradingNotes: [...s.tradingNotes, { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
      }));
    }, []),

    updateTradingNote: useCallback((id: string, updates: Partial<TradingNote>) => {
      mutate(s => ({ ...s, tradingNotes: s.tradingNotes.map(n => n.id === id ? { ...n, ...updates } : n) }));
    }, []),

    deleteTradingNote: useCallback((id: string) => {
      mutate(s => ({ ...s, tradingNotes: s.tradingNotes.filter(n => n.id !== id) }));
    }, []),

    addDailyBias: useCallback((bias: Omit<DailyBias, "id" | "createdAt">) => {
      mutate(s => ({
        ...s,
        dailyBiases: [...s.dailyBiases, { ...bias, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
      }));
    }, []),

    updateDailyBias: useCallback((id: string, updates: Partial<DailyBias>) => {
      mutate(s => ({ ...s, dailyBiases: s.dailyBiases.map(b => b.id === id ? { ...b, ...updates } : b) }));
    }, []),

    deleteDailyBias: useCallback((id: string) => {
      mutate(s => ({ ...s, dailyBiases: s.dailyBiases.filter(b => b.id !== id) }));
    }, []),

    addDayNote: useCallback((date: string, content: string) => {
      if (!content.trim()) return;
      mutate(s => ({
        ...s,
        dayNotes: [...s.dayNotes, {
          id: crypto.randomUUID(), date, content: content.trim(),
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
      }));
    }, []),

    updateDayNote: useCallback((id: string, content: string) => {
      mutate(s => ({
        ...s,
        dayNotes: s.dayNotes.map(n => n.id === id ? { ...n, content: content.trim(), updatedAt: new Date().toISOString() } : n),
      }));
    }, []),

    upsertDayNote: useCallback((date: string, content: string) => {
      mutate(s => {
        const existing = s.dayNotes.find(n => n.date === date);
        if (existing) {
          return {
            ...s,
            dayNotes: s.dayNotes.map(n => n.date === date ? { ...n, content, updatedAt: new Date().toISOString() } : n),
          };
        }
        return {
          ...s,
          dayNotes: [...s.dayNotes, {
            id: crypto.randomUUID(), date, content,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }],
        };
      });
    }, []),

    deleteDayNote: useCallback((id: string) => {
      mutate(s => ({ ...s, dayNotes: s.dayNotes.filter(n => n.id !== id) }));
    }, []),
  };

  const todayDate = getTodayDate();
  const todayTasks = state.todayTasks.filter(t => t.date === todayDate);
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const isRoutineLoaded = state.routineLoadedDates.includes(todayDate);
  const todayNotes = state.dayNotes.filter(n => n.date === todayDate).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const todayNote = todayNotes[0] || null;
  const todayBiases = state.dailyBiases.filter(b => b.date === todayDate);

  return { state, actions, todayTasks, completedToday, totalToday, isRoutineLoaded, todayNotes, todayNote, todayBiases };
}

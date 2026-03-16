import { useSyncExternalStore, useCallback } from "react";

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
  isTradingIdea?: boolean;
  tradingIdeaDone?: boolean;
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

export type NoteType = "note" | "idea";
export type IdeaCategory = "gift" | "hobby" | "study" | "other";

export const IDEA_CATEGORIES: { value: IdeaCategory; label: string }[] = [
  { value: "gift", label: "Подарок" },
  { value: "hobby", label: "Хобби" },
  { value: "study", label: "Интересно изучить" },
  { value: "other", label: "Другое" },
];

export interface DayNote {
  id: string;
  date: string;
  title?: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  noteType?: NoteType;
  ideaCategory?: IdeaCategory;
  link?: string;
  ideaDone?: boolean;
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
  _deletedIds?: string[];
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

const DEFAULT_ROUTINE_TEMPLATES: RoutineTemplate[] = [];

const DEFAULT_STATE: AppState = {
  routineTemplates: DEFAULT_ROUTINE_TEMPLATES,
  todayTasks: [],
  goals: [],
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
      routineTemplates: Array.isArray(parsed.routineTemplates) ? parsed.routineTemplates : DEFAULT_STATE.routineTemplates,
      xp: { ...DEFAULT_XP, ...parsed.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(parsed.xp?.categoryXP || {}) } },
      streak: { ...DEFAULT_STATE.streak, ...parsed.streak },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

const BACKUP_KEY = "lifeos_v2_backup";
const BACKUP_INTERVAL = 5 * 60 * 1000;
let lastBackupTime = 0;

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const now = Date.now();
    if (now - lastBackupTime > BACKUP_INTERVAL) {
      lastBackupTime = now;
      localStorage.setItem(BACKUP_KEY, JSON.stringify({ state, timestamp: now }));
    }
  } catch {}
}

function getBackupState(): AppState | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state || null;
  } catch { return null; }
}

export function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getBerlinTime(): Date {
  const settings = loadUserSettings();
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + settings.utcOffset * 3600000);
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
  if (totalMin >= 3 * 60 && totalMin < 8 * 60) return { name: "Азия", active: true, color: "text-gray-400" };
  if (totalMin >= 8 * 60 && totalMin < 9 * 60) return { name: "Франкфурт", active: true, color: "text-purple-400" };
  if (totalMin >= 9 * 60 && totalMin < 14 * 60) return { name: "Лондон", active: true, color: "text-green-400" };
  if (totalMin >= 14 * 60 && totalMin < 17 * 60) return { name: "Нью-Йорк", active: true, color: "text-orange-400" };
  return { name: "Закрыто", active: false, color: "text-muted-foreground" };
}

export interface UserSettings {
  utcOffset: number;
  workStart: number;
  workEnd: number;
  restStart: number;
  restEnd: number;
  sleepStart: number;
  sleepEnd: number;
}

const STATE_EMOJIS: Record<string, string[]> = {
  sleeping: ["😴", "🛌", "💤", "🌛"],
  morning:  ["🌅", "🌄", "🌞", "🍳"],
  working:  ["💪", "🔥", "⚡", "🎯", "🧠", "🚀"],
  resting:  ["☕", "🍵", "🎮", "📖", "🎧", "🛋️"],
  evening:  ["🌙", "🌆", "🌃", "✨"],
};

function getDailyEmojiIndex(state: string): number {
  const day = new Date().getDate();
  const arr = STATE_EMOJIS[state] || ["😎"];
  return day % arr.length;
}

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem("userSettings");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    utcOffset: 1,
    workStart: 9,
    workEnd: 18,
    restStart: 18,
    restEnd: 23,
    sleepStart: 23,
    sleepEnd: 7,
  };
}

export function getUserTime(): Date {
  const settings = loadUserSettings();
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + settings.utcOffset * 3600000);
}

export function getCharacterState(): { state: string; label: string; emoji: string } {
  const settings = loadUserSettings();
  const hour = getUserTime().getHours();

  const inRange = (h: number, start: number, end: number): boolean => {
    if (start <= end) return h >= start && h < end;
    return h >= start || h < end;
  };

  let state = "evening";
  let label = "Вечер";

  if (inRange(hour, settings.sleepStart, settings.sleepEnd)) {
    state = "sleeping"; label = "Сон";
  } else if (inRange(hour, settings.sleepEnd, settings.workStart)) {
    state = "morning"; label = "Утро";
  } else if (inRange(hour, settings.workStart, settings.workEnd)) {
    state = "working"; label = "Работа";
  } else if (inRange(hour, settings.restStart, settings.restEnd)) {
    state = "resting"; label = "Отдых";
  }

  const emojis = STATE_EMOJIS[state] || ["😎"];
  const emoji = emojis[getDailyEmojiIndex(state)];

  return { state, label, emoji };
}

export function getXPForLevel(level: number): number {
  if (level <= 1) return 100;
  let threshold = 100;
  for (let i = 2; i <= level; i++) {
    threshold = Math.round(threshold + 40 + threshold * 0.12);
  }
  return threshold;
}

export function getLevelFromXP(totalXP: number): { level: number; xpInLevel: number; xpForNext: number } {
  let level = 1;
  let accumulated = 0;
  while (true) {
    const needed = getXPForLevel(level);
    if (accumulated + needed > totalXP) {
      return { level, xpInLevel: totalXP - accumulated, xpForNext: needed };
    }
    accumulated += needed;
    level++;
  }
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

function getLinkedTasksForWeekGoal(goal: Goal, state: AppState): TodayTask[] {
  const direct = state.todayTasks.filter(t => t.weekGoalId === goal.id || t.goalId === goal.id);
  const routineTasks = state.routineTemplates
    .filter(r => r.goalId === goal.id)
    .map(r => state.todayTasks.find(t => t.routineId === r.id && t.date === getTodayDate()) || null)
    .filter(Boolean) as TodayTask[];
  return [...direct, ...routineTasks.filter(rt => !direct.find(t => t.id === rt.id))];
}

function getCompletedXPForGoal(goal: Goal, state: AppState): number {
  if (goal.type === "week") {
    const tasks = getLinkedTasksForWeekGoal(goal, state);
    return tasks.filter(t => t.completed).reduce((sum, t) => sum + t.xp, 0);
  }
  const childGoals = state.goals.filter(g => g.parentId === goal.id);
  return childGoals.reduce((sum, child) => sum + getCompletedXPForGoal(child, state), 0);
}

export function getGoalProgress(goal: Goal, state: AppState): { completed: number; total: number; percent: number } {
  const totalGoalXP = goal.xp > 0 ? goal.xp : 1;

  if (goal.type === "week") {
    const tasks = getLinkedTasksForWeekGoal(goal, state);
    if (tasks.length === 0) return { completed: 0, total: totalGoalXP, percent: 0 };
    const completedXP = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.xp, 0);
    return {
      completed: completedXP,
      total: totalGoalXP,
      percent: Math.min(100, Math.round((completedXP / totalGoalXP) * 100)),
    };
  }

  if (goal.type === "month" || goal.type === "year") {
    const childGoals = state.goals.filter(g => g.parentId === goal.id);
    if (childGoals.length === 0) return { completed: 0, total: totalGoalXP, percent: 0 };
    const completedXP = getCompletedXPForGoal(goal, state);
    return {
      completed: completedXP,
      total: totalGoalXP,
      percent: Math.min(100, Math.round((completedXP / totalGoalXP) * 100)),
    };
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
  const yy = yesterday.getFullYear();
  const ym = String(yesterday.getMonth() + 1).padStart(2, "0");
  const yd = String(yesterday.getDate()).padStart(2, "0");
  const yesterdayStr = `${yy}-${ym}-${yd}`;
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
const syncListeners = new Set<(ok: boolean) => void>();

export function onSyncResult(cb: (ok: boolean) => void) {
  syncListeners.add(cb);
  return () => syncListeners.delete(cb);
}

function scheduleServerSync(state: AppState) {
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(async () => {
    serverSyncTimer = null;
    try {
      const res = await fetch("/api/user/data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ data: state }),
      });
      const ok = res.ok;
      syncListeners.forEach(cb => cb(ok));
    } catch {
      syncListeners.forEach(cb => cb(false));
    }
  }, 2500);
}

export function compressImage(dataUrl: string, maxWidth = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function mergeArraysById<T extends { id: string }>(local: T[], server: T[], deletedIds?: Set<string>): T[] {
  const map = new Map<string, T>();
  for (const item of server) map.set(item.id, item);
  for (const item of local) {
    const existing = map.get(item.id);
    if (existing && 'completed' in item && 'completed' in existing) {
      map.set(item.id, { ...item, completed: (item as any).completed || (existing as any).completed } as T);
    } else {
      map.set(item.id, item);
    }
  }
  if (deletedIds) {
    for (const id of deletedIds) map.delete(id);
  }
  return Array.from(map.values());
}

function mergeArraysByKey<T extends { id: string }>(local: T[], server: T[], keyFn: (item: T) => string, deletedIds?: Set<string>): T[] {
  const byId = new Map<string, T>();
  const byKey = new Map<string, T>();
  for (const item of server) {
    byId.set(item.id, item);
    byKey.set(keyFn(item), item);
  }
  for (const item of local) {
    const key = keyFn(item);
    if (byKey.has(key) && !byId.has(item.id)) {
      byId.delete(byKey.get(key)!.id);
    }
    const existing = byId.get(item.id);
    if (existing && 'completed' in item && 'completed' in existing) {
      // Победитель тот у кого completed: true, или у кого есть completedAt
      const serverCompleted = (existing as any).completed;
      const localCompleted = (item as any).completed;
      const serverTime = (existing as any).completedAt || "";
      const localTime = (item as any).completedAt || "";
      const winner = (serverCompleted && !localCompleted)
        ? existing
        : (localCompleted && !serverCompleted)
          ? item
          : localTime >= serverTime ? item : existing;
      byId.set(winner.id, winner);
    } else {
      byId.set(item.id, item);
    }
    byKey.set(key, item);
  }
  if (deletedIds) {
    for (const id of deletedIds) byId.delete(id);
  }
  return Array.from(byId.values());
}

function mergeStates(local: AppState, server: AppState): AppState {
  const combinedDeletedArr = [...new Set([...(local._deletedIds || []), ...(server._deletedIds || [])])].slice(-200);
  const deletedIds = new Set(combinedDeletedArr);
  const merged = {
    ...DEFAULT_STATE,
    ...server,
    routineTemplates: mergeArraysById(local.routineTemplates || [], server.routineTemplates || [], deletedIds),
    todayTasks: mergeArraysByKey(
      local.todayTasks || [], server.todayTasks || [],
      (t: TodayTask) => t.routineId ? `${t.routineId}_${t.date}` : t.id,
      deletedIds
    ),
    goals: mergeArraysById(local.goals || [], server.goals || [], deletedIds),
    focusSessions: mergeArraysById(local.focusSessions || [], server.focusSessions || [], deletedIds),
    tradingNotes: mergeArraysById(local.tradingNotes || [], server.tradingNotes || [], deletedIds),
    dailyBiases: mergeArraysByKey(
      local.dailyBiases || [], server.dailyBiases || [],
      (b: DailyBias) => `${b.date}_${b.asset}`,
      deletedIds
    ),
    dayNotes: mergeArraysById(local.dayNotes || [], server.dayNotes || [], deletedIds),
    routineLoadedDates: [...new Set([...(local.routineLoadedDates || []), ...(server.routineLoadedDates || [])])],
    streak: (local.streak?.currentStreak ?? 0) >= (server.streak?.currentStreak ?? 0)
      ? { ...DEFAULT_STATE.streak, ...local.streak }
      : { ...DEFAULT_STATE.streak, ...server.streak },
    xp: (local.xp?.totalXP ?? 0) >= (server.xp?.totalXP ?? 0)
      ? { ...DEFAULT_XP, ...local.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(local.xp?.categoryXP || {}) } }
      : { ...DEFAULT_XP, ...server.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(server.xp?.categoryXP || {}) } },
    _deletedIds: combinedDeletedArr,
  };
  return merged;
}

function countItems(s: AppState): number {
  return (s.todayTasks?.length || 0) + (s.dayNotes?.length || 0) +
    (s.tradingNotes?.length || 0) + (s.goals?.length || 0) +
    (s.focusSessions?.length || 0) + (s.dailyBiases?.length || 0);
}

export function loadFromServerData(data: AppState) {
  if (!data || typeof data !== "object") return;
  globalState = autoLoadRoutine({
    ...DEFAULT_STATE,
    ...data,
    xp: { ...DEFAULT_XP, ...data.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(data.xp?.categoryXP || {}) } },
    streak: { ...DEFAULT_STATE.streak, ...data.streak },
  });
  globalState = { ...globalState, xp: recalcXP(globalState) };
  saveState(globalState);
  notify();
}

export async function syncFromServer(): Promise<boolean> {
  try {
    const res = await fetch("/api/user/data", {
      credentials: "include",
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json?.data) {
      const serverData = json.data as AppState;
      // Сервер — единственный источник правды
      globalState = autoLoadRoutine({
        ...DEFAULT_STATE,
        ...serverData,
        xp: { ...DEFAULT_XP, ...serverData.xp, categoryXP: { ...DEFAULT_XP.categoryXP, ...(serverData.xp?.categoryXP || {}) } },
        streak: { ...DEFAULT_STATE.streak, ...serverData.streak },
      });
      globalState = { ...globalState, xp: recalcXP(globalState) };
      saveState(globalState);
      notify();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function mutate(fn: (s: AppState) => AppState) {
  globalState = fn(globalState);
  globalState = { ...globalState, xp: recalcXP(globalState) };
  saveState(globalState);
  scheduleServerSync(globalState);
  notify();
}

function subscribeToStore(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return globalState;
}

let dayChangeTrackedDate = getTodayDate();
let dayChangeInterval: ReturnType<typeof setInterval> | null = null;

function startDayChangeChecker() {
  if (dayChangeInterval) return;
  dayChangeInterval = setInterval(() => {
    const now = getTodayDate();
    if (now !== dayChangeTrackedDate) {
      dayChangeTrackedDate = now;
      globalState = autoLoadRoutine(globalState);
      globalState = { ...globalState, xp: recalcXP(globalState) };
      saveState(globalState);
      scheduleServerSync(globalState);
      notify();
    }
  }, 30000);
}

startDayChangeChecker();

if (typeof window !== "undefined") {
  syncFromServer();

  window.addEventListener("beforeunload", () => {
    if (serverSyncTimer) {
      clearTimeout(serverSyncTimer);
      serverSyncTimer = null;
      const blob = new Blob([JSON.stringify({ data: globalState })], { type: "application/json" });
      navigator.sendBeacon("/api/user/data-beacon", blob);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncFromServer();
    } else if (document.visibilityState === "hidden") {
      if (serverSyncTimer) {
        clearTimeout(serverSyncTimer);
        serverSyncTimer = null;
        const blob = new Blob([JSON.stringify({ data: globalState })], { type: "application/json" });
        navigator.sendBeacon("/api/user/data-beacon", blob);
      }
    }
  });
}

export function useStore() {
  const state = useSyncExternalStore(subscribeToStore, getSnapshot, getSnapshot);

  const actions = {
    addRoutineTemplate: useCallback((template: Omit<RoutineTemplate, "id">) => {
      mutate(s => ({ ...s, routineTemplates: [...s.routineTemplates, { ...template, id: crypto.randomUUID() }] }));
    }, []),

    updateRoutineTemplate: useCallback((id: string, updates: Partial<RoutineTemplate>) => {
      mutate(s => ({ ...s, routineTemplates: s.routineTemplates.map(r => r.id === id ? { ...r, ...updates } : r) }));
    }, []),

    deleteRoutineTemplate: useCallback((id: string) => {
      mutate(s => ({ ...s, routineTemplates: s.routineTemplates.filter(r => r.id !== id), _deletedIds: [...(s._deletedIds || []), id].slice(-200) }));
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
      mutate(s => ({ ...s, todayTasks: s.todayTasks.filter(t => t.id !== id), _deletedIds: [...(s._deletedIds || []), id].slice(-200) }));
    }, []),

    clearTodayTasks: useCallback(() => {
      const today = getTodayDate();
      mutate(s => ({
        ...s,
        todayTasks: s.todayTasks.filter(t => t.date !== today),
        routineLoadedDates: s.routineLoadedDates.filter(d => d !== today),
        _deletedIds: [...(s._deletedIds || []), ...s.todayTasks.filter(t => t.date === today).map(t => t.id)].slice(-200),
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
      const childIds = globalState.goals.filter(g => g.parentId === id).map(g => g.id);
      mutate(s => ({ ...s, goals: s.goals.filter(g => g.id !== id && g.parentId !== id), _deletedIds: [...(s._deletedIds || []), id, ...childIds].slice(-200) }));
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
      mutate(s => ({ ...s, tradingNotes: s.tradingNotes.filter(n => n.id !== id), _deletedIds: [...(s._deletedIds || []), id].slice(-200) }));
    }, []),

    addDailyBias: useCallback((bias: Omit<DailyBias, "id" | "createdAt">) => {
      mutate(s => {
        const existing = s.dailyBiases.find(b => b.date === bias.date && b.asset === bias.asset);
        if (existing) {
          return {
            ...s,
            dailyBiases: s.dailyBiases.map(b =>
              b.id === existing.id ? { ...b, ...bias, createdAt: b.createdAt } : b
            ),
          };
        }
        return {
          ...s,
          dailyBiases: [...s.dailyBiases, { ...bias, id: crypto.randomUUID(), createdAt: new Date().toISOString() }],
        };
      });
    }, []),

    updateDailyBias: useCallback((id: string, updates: Partial<DailyBias>) => {
      mutate(s => ({ ...s, dailyBiases: s.dailyBiases.map(b => b.id === id ? { ...b, ...updates } : b) }));
    }, []),

    deleteDailyBias: useCallback((id: string) => {
      mutate(s => ({ ...s, dailyBiases: s.dailyBiases.filter(b => b.id !== id), _deletedIds: [...(s._deletedIds || []), id].slice(-200) }));
    }, []),

    rescheduleTask: useCallback((id: string, newDate: string) => {
      mutate(s => ({ ...s, todayTasks: s.todayTasks.map(t => t.id === id ? { ...t, date: newDate, completed: false, completedAt: undefined } : t) }));
    }, []),

    addDayNote: useCallback((date: string, content: string, noteType: NoteType = "note", title?: string) => {
      if (!content.trim()) return;
      mutate(s => ({
        ...s,
        dayNotes: [...s.dayNotes, {
          id: crypto.randomUUID(), date, content: content.trim(), title: title?.trim() || undefined,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          noteType,
        }],
      }));
    }, []),

    updateDayNote: useCallback((id: string, updates: Partial<Pick<DayNote, "content" | "title" | "ideaCategory" | "link" | "ideaDone" | "noteType">>) => {
      mutate(s => ({
        ...s,
        dayNotes: s.dayNotes.map(n => n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n),
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
      mutate(s => ({ ...s, dayNotes: s.dayNotes.filter(n => n.id !== id), _deletedIds: [...(s._deletedIds || []), id].slice(-200) }));
    }, []),
  };

  const todayDate = getTodayDate();
  const todayTasks = state.todayTasks
    .filter(t => t.date === todayDate)
    .sort((a, b) => {
      if (a.type === "routine" && b.type !== "routine") return -1;
      if (a.type !== "routine" && b.type === "routine") return 1;
      return 0;
    });
  const completedToday = todayTasks.filter(t => t.completed).length;
  const totalToday = todayTasks.length;
  const isRoutineLoaded = state.routineLoadedDates.includes(todayDate);
  const todayNotes = state.dayNotes.filter(n => n.date === todayDate).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const todayNote = todayNotes[0] || null;
  const todayBiases = state.dailyBiases.filter(b => b.date === todayDate);

  return { state, actions, todayTasks, completedToday, totalToday, isRoutineLoaded, todayNotes, todayNote, todayBiases };
}

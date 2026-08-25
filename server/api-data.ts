import type { Express } from "express";
import { requireAuth } from "./auth";
import { z } from "zod";
import { bumpRevision, recordDeletion } from "./revision";
import { findDuplicateTask, findDuplicateGoal, findDuplicateDayNote } from "./dedupe";
import {
  Task, Goal, DayNote, TradingNote, DailyBias,
  FocusSession, RoutineTemplate, Simulation, UserData, UserDataBackup, BiasChecklist
} from "./mongodb";

// Zod schemas for validation
const taskSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  difficulty: z.string().optional(),
  xp: z.number().default(0),
  completed: z.boolean().default(false),
  date: z.string(),
  type: z.string(),
  routineId: z.string().optional(),
  goalId: z.string().optional(),
  weekGoalId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  noDeadline: z.boolean().optional(),
  completedAt: z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  addToGoogleCalendar: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

const goalSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().min(1),
  category: z.string(),
  parentId: z.string().optional(),
  completed: z.boolean().default(false),
  xp: z.number().default(0),
  linkedTaskIds: z.array(z.string()).default([]),
  taskWeights: z.any().optional(),
  year: z.number().optional(),
  month: z.number().optional(),
  week: z.number().optional(),
  description: z.string().optional(),
  plan: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).default([]),
  timeLimitType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  failedAt: z.string().optional(),
  restoredFromId: z.string().optional(),
});

const dayNoteSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string().optional(),
  content: z.string(),
  noteType: z.string().optional(),
  ideaCategory: z.string().optional(),
  link: z.string().refine((v) => /^https?:\/\//i.test(v), { message: "Ссылка должна начинаться с http(s)://" }).optional(),
  ideaDone: z.boolean().optional(),
});

const routineTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string(),
  xp: z.number().default(0),
  enabled: z.boolean().default(true),
  goalId: z.string().optional(),
  days: z.array(z.number()).default([]),
  sortOrder: z.number().optional(),
});

// ── PATCH schemas — validate partial updates so garbage can't overwrite fields ──
// Note: strict mode off so client's extra fields (updatedAt, wasRescheduled, ...)
// are stripped instead of rejected.
const taskPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  xp: z.number().optional(),
  completed: z.boolean().optional(),
  date: z.string().optional(),
  type: z.string().optional(),
  routineId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  weekGoalId: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  noDeadline: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
  wasRescheduled: z.boolean().optional(),
  googleCalendarEventId: z.string().nullable().optional(),
  addToGoogleCalendar: z.boolean().optional(),
  sortOrder: z.number().optional(),
}).strip();

const goalPatchSchema = z.object({
  type: z.string().optional(),
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  parentId: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  xp: z.number().optional(),
  linkedTaskIds: z.array(z.string()).optional(),
  taskWeights: z.any().optional(),
  year: z.number().nullable().optional(),
  month: z.number().nullable().optional(),
  week: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  plan: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean() })).optional(),
  timeLimitType: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.string().optional(),
  failedAt: z.string().nullable().optional(),
  restoredFromId: z.string().nullable().optional(),
}).strip();

const routinePatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  xp: z.number().optional(),
  enabled: z.boolean().optional(),
  goalId: z.string().nullable().optional(),
  days: z.array(z.number()).optional(),
  sortOrder: z.number().optional(),
}).strip();

const dayNotePatchSchema = z.object({
  date: z.string().optional(),
  title: z.string().nullable().optional(),
  content: z.string().optional(),
  noteType: z.string().optional(),
  ideaCategory: z.string().nullable().optional(),
  link: z.string().refine((v) => /^https?:\/\//i.test(v), { message: "Ссылка должна начинаться с http(s)://" }).nullable().optional(),
  ideaDone: z.boolean().optional(),
  updatedAt: z.string().optional(),
  }).strip();

const biasSchema = z.object({
  id: z.string(),
  date: z.string(),
  asset: z.enum(["GER40", "EUR", "XAU", "GBP", "US30", "US100", "US500", "none"]),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  pros: z.string().nullable().optional(),
  cons: z.string().nullable().optional(),
  screenshotUrl: z.string().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).optional(),
});

const biasPatchSchema = z.object({
  date: z.string().optional(),
  asset: z.enum(["GER40", "EUR", "XAU", "GBP", "US30", "US100", "US500", "none"]).optional(),
  direction: z.enum(["bullish", "bearish", "neutral"]).optional(),
  pros: z.string().nullable().optional(),
  cons: z.string().nullable().optional(),
  screenshotUrl: z.string().nullable().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).nullable().optional(),
}).strip();

const tradingNoteSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  time: z.string().optional(),
  asset: z.string().min(1),
  timeframe: z.string().optional(),
  tag: z.string().min(1),
  text: z.string().min(1),
  screenshotUrl: z.string().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).optional(),
  date: z.string().min(1),
  isTradingIdea: z.boolean().optional(),
  tradingIdeaDone: z.boolean().optional(),
}).strip();

const tradingNotePatchSchema = z.object({
  title: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  asset: z.string().optional(),
  timeframe: z.string().nullable().optional(),
  tag: z.string().optional(),
  text: z.string().optional(),
  screenshotUrl: z.string().nullable().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).nullable().optional(),
  date: z.string().optional(),
  isTradingIdea: z.boolean().optional(),
  tradingIdeaDone: z.boolean().optional(),
}).strip();

const biasChecklistSchema = z.object({
  biasId: z.string().min(1),
  items: z.array(z.object({ id: z.string(), text: z.string().min(1) })).default([]),
  marks: z.record(z.string(), z.record(z.string(), z.enum(["plus", "minus"]))).optional(),
}).strip();

export function registerDataRoutes(app: Express) {
  
  // NOTE: the old /api/rescue-data endpoint (DB-wide restore from every user's
  // backups) was removed — it exposed cross-user data to any authenticated user.

  app.get("/api/sync/init", requireAuth, async (req: any, res) => {
    const userId = req.session.userId;
    try {
      // 1. Check if migration is needed (runs ONCE per user — flag in UserData)
      const oldUserData = await UserData.findOne({ userId });
      if (oldUserData && !oldUserData.migrated && oldUserData.data && Object.keys(oldUserData.data).length > 0) {
        console.log(`[MIGRATION] Starting migration for user ${userId}`);
        const d = oldUserData.data as any;
        const failures: string[] = [];

        // Helpers: coerce legacy blob values to the strict schema types/fields.
        const num = (v: any, def = 0) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
        const str = (v: any, def = "") => (v == null ? def : String(v));
        const today = new Date().toISOString().slice(0, 10);

        // Migrate one array of legacy items into a strict collection. A single
        // bad record must NEVER abort the whole migration (that previously
        // threw and returned HTTP 500, hiding ALL data). Skip + log instead.
        const migrateArray = async (
          items: any[] | undefined,
          Model: any,
          idField: string,
          san: (x: any) => any
        ) => {
          if (!Array.isArray(items)) return;
          for (const x of items) {
            try {
              const doc = san(x) || {};
              const id = x?.id ?? doc?.[idField];
              if (id == null) { failures.push(`${Model.modelName}:no-id`); continue; }
              await Model.findOneAndUpdate(
                { userId, [idField]: id },
                { ...doc, [idField]: id, userId },
                { upsert: true }
              );
            } catch (e: any) {
              failures.push(`${Model.modelName}:${x?.id}:${e?.message}`);
              console.warn(`[MIGRATION] skip ${Model.modelName} ${x?.id}:`, e?.message);
            }
          }
        };

        await migrateArray(d.todayTasks || d.tasks, Task, "taskId", (t: any) => ({
          name: str(t.name || t.title, "Без названия"),
          description: str(t.description || t.text),
          category: str(t.category, "other"),
          difficulty: str(t.difficulty),
          xp: num(t.xp),
          completed: !!t.completed || !!t.done,
          sortOrder: num(t.sortOrder),
          date: str(t.date, today),
          type: str(t.type, "task"),
          routineId: str(t.routineId),
          goalId: str(t.goalId),
          weekGoalId: str(t.weekGoalId),
          startTime: str(t.startTime),
          endTime: str(t.endTime),
          noDeadline: !!t.noDeadline,
          completedAt: str(t.completedAt),
        }));
        await migrateArray(d.goals, Goal, "goalId", (g: any) => ({
          type: str(g.type, "personal"),
          title: str(g.title, "Без названия"),
          category: str(g.category, "other"),
          parentId: str(g.parentId),
          completed: !!g.completed,
          xp: num(g.xp),
          linkedTaskIds: Array.isArray(g.linkedTaskIds) ? g.linkedTaskIds.map(String) : [],
          taskWeights: (g.taskWeights && typeof g.taskWeights === "object") ? g.taskWeights : {},
          year: g.year == null ? undefined : num(g.year),
          month: g.month == null ? undefined : num(g.month),
          week: g.week == null ? undefined : num(g.week),
          description: str(g.description),
          plan: Array.isArray(g.plan) ? g.plan : [],
          timeLimitType: str(g.timeLimitType),
          startDate: str(g.startDate),
          endDate: str(g.endDate),
          status: str(g.status, "active"),
        }));
        await migrateArray(d.dayNotes, DayNote, "noteId", (n: any) => ({
          date: str(n.date, today),
          title: str(n.title, "Заметка"),
          content: str(n.content || n.note || n.text, ""),
          noteType: str(n.noteType, "note"),
          ideaCategory: str(n.ideaCategory),
          link: str(n.link),
          ideaDone: !!n.ideaDone,
        }));
        await migrateArray(d.tradingNotes, TradingNote, "noteId", (n: any) => ({
          title: str(n.title, "Идея"),
          time: str(n.time),
          asset: str(n.asset, "none"),
          timeframe: str(n.timeframe),
          tag: str(n.tag, "general"),
          text: str(n.text, ""),
          date: str(n.date, today),
          isTradingIdea: !!n.isTradingIdea,
          tradingIdeaDone: !!n.tradingIdeaDone,
          screenshotUrl: str(n.screenshotUrl),
        }));
        await migrateArray(d.focusSessions, FocusSession, "sessionId", (f: any) => ({
          duration: num(f.duration),
          mode: str(f.mode, "focus"),
          xp: num(f.xp),
          date: str(f.date, today),
          completedAt: str(f.completedAt, new Date().toISOString()),
          note: str(f.note),
        }));
        await migrateArray(d.dailyBiases, DailyBias, "biasId", (b: any) => ({
          date: str(b.date, today),
          asset: str(b.asset, "none"),
          direction: str(b.direction, "neutral"),
          pros: str(b.pros),
          cons: str(b.cons),
          screenshotUrl: str(b.screenshotUrl),
        }));
        await migrateArray(d.routineTemplates, RoutineTemplate, "templateId", (r: any) => ({
          name: str(r.name, "Рутина"),
          description: str(r.description),
          category: str(r.category, "other"),
          xp: num(r.xp),
          sortOrder: num(r.sortOrder),
          enabled: r.enabled !== false,
          goalId: str(r.goalId),
          days: Array.isArray(r.days) ? r.days.map((x: any) => num(x)) : [],
        }));
        await migrateArray(d.simulations, Simulation, "simId", (s: any) => ({
          name: str(s.name, "Симуляция"),
          mode: str(s.mode, "long"),
          startingBalance: num(s.startingBalance),
          riskType: str(s.riskType, "fixed"),
          commission: num(s.commission),
          maxTradesPerDay: s.maxTradesPerDay == null ? undefined : num(s.maxTradesPerDay),
          maxWinsPerDay: s.maxWinsPerDay == null ? undefined : num(s.maxWinsPerDay),
          notes: str(s.notes),
          assets: s.assets ?? {},
          results: s.results ?? {},
        }));

        // Only wipe the legacy blob once EVERY item migrated successfully,
        // so a single bad record can never silently destroy data. On any
        // failure we keep the blob as a safety net and simply mark migrated
        // so we stop retrying the same broken pass.
        const botHistory = d.botVoiceHistory || [];
        const savedXP = d.xp || {};
        const savedStreak = d.streak || {};
        if (failures.length === 0) {
          await UserData.findOneAndUpdate({ userId }, {
            $set: {
              data: { botVoiceHistory: botHistory, xp: savedXP, streak: savedStreak },
              migrated: true,
            }
          });
          console.log(`[MIGRATION] Completed for user ${userId}`);
        } else {
          await UserData.findOneAndUpdate({ userId }, { $set: { migrated: true } });
          console.warn(`[MIGRATION] Partial for ${userId}: ${failures.length} failures (blob kept as fallback)`, failures.slice(0, 5));
        }
      } else if (oldUserData && !oldUserData.migrated) {
        // Blob exists but has nothing to migrate — mark migrated so the
        // branch above never re-runs on every poll.
        await UserData.findOneAndUpdate({ userId }, { $set: { migrated: true } });
      }

      // 2. Fetch active data
      const tasks = await Task.find({ userId }).sort({ sortOrder: 1 }).lean();
      const goals = await Goal.find({ userId }).lean();
      const routines = await RoutineTemplate.find({ userId }).sort({ sortOrder: 1 }).lean();
      const focusSessions = await FocusSession.find({ userId }).lean(); // Maybe filter last 30 days
      const biases = await DailyBias.find({ userId }).lean();
      
      // Fetch all notes for initial load (to prevent missing old notes)
      const dayNotes = await DayNote.find({ userId }).lean();
      const tradingNotes = await TradingNote.find({ userId }).lean();
      const simulations = await Simulation.find({ userId }).lean();
      const biasChecklists = await BiasChecklist.find({ userId }).lean();

      const ud = await UserData.findOne({ userId }).lean() as any;
      const udData = (ud?.data as any) || {};

      const mapBack = (items: any[], idField: string) => items.map(i => {
        const { _id, userId: _uid, createdAt, updatedAt, __v, [idField]: mappedId, ...rest } = i;
        return { id: mappedId, createdAt: createdAt?.toISOString?.() || createdAt, updatedAt: updatedAt?.toISOString?.() || updatedAt, ...rest };
      });

      const safeArray = (arr: any) => Array.isArray(arr) ? arr : [];
      const mergeArrays = (arr1: any[], arr2: any[]) => {
        const map = new Map();
        for (const item of arr1) if (item?.id) map.set(item.id, item);
        for (const item of arr2) if (item?.id) map.set(item.id, item);
        return Array.from(map.values());
      };

      return res.json({
        ok: true,
        data: {
          todayTasks: mapBack(tasks, 'taskId'),
          goals: mapBack(goals, 'goalId'),
          routineTemplates: mapBack(routines, 'templateId'),
          focusSessions: mergeArrays(mapBack(focusSessions, 'sessionId'), safeArray(udData.focusSessions)),
          dailyBiases: mapBack(biases, 'biasId'),
          dayNotes: mapBack(dayNotes, 'noteId'),
          tradingNotes: mergeArrays(mapBack(tradingNotes, 'noteId'), safeArray(udData.tradingNotes)),
          simulations: mergeArrays(mapBack(simulations, 'simId'), safeArray(udData.simulations)),
          biasChecklists: (biasChecklists as any[]).map((c: any) => ({ id: c.biasId, biasId: c.biasId, items: c.items || [], marks: c.marks || {} })),
          botVoiceHistory: safeArray(udData.botVoiceHistory),
          streak: udData.streak,
          xp: udData.xp,
          _deletedIds: safeArray(ud?.deletedIds),
        }
      });
    } catch (err) {
      console.error("[sync/init error]", err);
      return res.status(500).json({ ok: false, message: "Internal Server Error" });
    }
  });

  // --- TASKS ---

  app.post("/api/tasks", requireAuth, async (req: any, res) => {
    try {
      const data = taskSchema.parse(req.body);
      const userId = req.session.userId;
      
      // Duplicate protection: only for genuinely new tasks (not upsert of an existing one)
      const alreadyExists = await Task.findOne({ userId, taskId: data.id }).select("_id").lean();
      if (!alreadyExists) {
        const dup = await findDuplicateTask(Task, userId, data.name, data.date || undefined);
        if (dup) {
          return res.json({ ok: true, duplicate: true, matchedId: dup.taskId });
        }
      }
      
      // Extract completion fields to avoid overwriting them if a PATCH (toggle) arrived before this POST
      const { completed, completedAt, ...restData } = data as any;
      
      await Task.findOneAndUpdate(
        { userId, taskId: data.id }, 
        { 
          $set: { ...restData, taskId: data.id, userId },
          $setOnInsert: { completed: completed ?? false, completedAt }
        }, 
        { upsert: true, returnDocument: "after" }
      );
      await bumpRevision(userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const parsed = taskPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      const updates = parsed.data;
      await Task.findOneAndUpdate(
        { userId, taskId: req.params.id }, 
        { $set: updates }, 
        { upsert: true }
      );
      await bumpRevision(userId);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      await Task.findOneAndDelete({ userId: req.session.userId, taskId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // --- GOALS ---

  app.post("/api/goals", requireAuth, async (req: any, res) => {
    try {
      const data = goalSchema.parse(req.body);
      const userId = req.session.userId;
      
      const goalExists = await Goal.findOne({ userId, goalId: data.id }).select("_id").lean();
      if (!goalExists) {
        const dup = await findDuplicateGoal(Goal, userId, data.title);
        if (dup) {
          return res.json({ ok: true, duplicate: true, matchedId: dup.goalId });
        }
      }
      
      await Goal.findOneAndUpdate(
        { userId, goalId: data.id }, 
        { ...data, goalId: data.id, userId }, 
        { upsert: true }
      );
      await bumpRevision(userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/goals/:id", requireAuth, async (req: any, res) => {
    try {
      const parsed = goalPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      await Goal.findOneAndUpdate({ userId: req.session.userId, goalId: req.params.id }, parsed.data);
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/goals/:id", requireAuth, async (req: any, res) => {
    try {
      await Goal.findOneAndDelete({ userId: req.session.userId, goalId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // --- ROUTINES ---

  app.post("/api/routines", requireAuth, async (req: any, res) => {
    try {
      const data = routineTemplateSchema.parse(req.body);
      await RoutineTemplate.findOneAndUpdate(
        { userId: req.session.userId, templateId: data.id }, 
        { ...data, templateId: data.id, userId: req.session.userId }, 
        { upsert: true }
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/routines/:id", requireAuth, async (req: any, res) => {
    try {
      const parsed = routinePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      await RoutineTemplate.findOneAndUpdate({ userId: req.session.userId, templateId: req.params.id }, parsed.data);
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/routines/:id", requireAuth, async (req: any, res) => {
    try {
      await RoutineTemplate.findOneAndDelete({ userId: req.session.userId, templateId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // --- NOTES (Lazy Loaded) ---

  app.get("/api/notes", requireAuth, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page || "1");
      const limit = 50;
      const skip = (page - 1) * limit;
      
      const notes = await DayNote.find({ userId: req.session.userId })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
        
      const mapped = notes.map((n: any) => {
        const { _id, userId, createdAt, updatedAt, __v, noteId, ...rest } = n;
        return { id: noteId, createdAt: createdAt?.toISOString(), updatedAt: updatedAt?.toISOString(), ...rest };
      });
      
      res.json({ ok: true, data: mapped });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  app.post("/api/notes", requireAuth, async (req: any, res) => {
    try {
      const data = dayNoteSchema.parse(req.body);
      
      const noteExists = await DayNote.findOne({ userId: req.session.userId, noteId: data.id }).select("_id").lean();
      if (!noteExists) {
        const dup = await findDuplicateDayNote(DayNote, req.session.userId, data.content || "", data.title);
        if (dup) {
          return res.json({ ok: true, duplicate: true, matchedId: dup.noteId });
        }
      }
      
      await DayNote.findOneAndUpdate(
        { userId: req.session.userId, noteId: data.id }, 
        { ...data, noteId: data.id, userId: req.session.userId }, 
        { upsert: true }
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req: any, res) => {
    try {
      const parsed = dayNotePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      await DayNote.findOneAndUpdate({ userId: req.session.userId, noteId: req.params.id }, parsed.data);
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req: any, res) => {
    try {
      await DayNote.findOneAndDelete({ userId: req.session.userId, noteId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/trading-notes/:id", requireAuth, async (req: any, res) => {
    try {
      await TradingNote.findOneAndDelete({ userId: req.session.userId, noteId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.post("/api/trading-notes", requireAuth, async (req: any, res) => {
    try {
      const data = tradingNoteSchema.parse(req.body);
      await TradingNote.findOneAndUpdate(
        { userId: req.session.userId, noteId: data.id },
        { ...data, noteId: data.id, userId: req.session.userId },
        { upsert: true }
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] trading-notes error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/trading-notes/:id", requireAuth, async (req: any, res) => {
    try {
      const parsed = tradingNotePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      await TradingNote.findOneAndUpdate(
        { userId: req.session.userId, noteId: req.params.id },
        parsed.data
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // --- DAILY BIAS ---
  app.post("/api/bias", requireAuth, async (req: any, res) => {
    try {
      const data = biasSchema.parse(req.body);
      await DailyBias.findOneAndUpdate(
        { userId: req.session.userId, biasId: data.id },
        { ...data, biasId: data.id, userId: req.session.userId },
        { upsert: true }
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] bias error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.patch("/api/bias/:id", requireAuth, async (req: any, res) => {
    try {
      const parsed = biasPatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: parsed.error.errors[0].message });
      }
      await DailyBias.findOneAndUpdate({ userId: req.session.userId, biasId: req.params.id }, parsed.data);
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/bias/:id", requireAuth, async (req: any, res) => {
    try {
      await DailyBias.findOneAndDelete({ userId: req.session.userId, biasId: req.params.id });
      await recordDeletion(req.session.userId, req.params.id);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // --- BIAS CHECKLISTS (per-bias, customizable, per-day completion) ---
  app.get("/api/bias-checklists", requireAuth, async (req: any, res) => {
    try {
      const list = await BiasChecklist.find({ userId: req.session.userId }).lean();
      res.json({ ok: true, data: list });
    } catch (err) {
      console.error("[api-data] bias-checklists get error:", err);
      res.status(500).json({ ok: false });
    }
  });

  app.post("/api/bias-checklists", requireAuth, async (req: any, res) => {
    try {
      const data = biasChecklistSchema.parse(req.body);
      await BiasChecklist.findOneAndUpdate(
        { userId: req.session.userId, biasId: data.biasId },
        { biasId: data.biasId, userId: req.session.userId, items: data.items, marks: data.marks || {} },
        { upsert: true }
      );
      await bumpRevision(req.session.userId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[api-data] bias-checklists error:", err);
      const msg = err instanceof z.ZodError ? (err.issues[0]?.message || "Ошибка валидации") : "Ошибка запроса";
      res.status(400).json({ ok: false, message: msg });
    }
  });

  app.delete("/api/bias-checklists/:biasId", requireAuth, async (req: any, res) => {
    try {
      await BiasChecklist.findOneAndDelete({ userId: req.session.userId, biasId: req.params.biasId });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });
  
  // --- XP & STREAK (Save without full sync) ---
  const statsSchema = z.object({
    xp: z.number().int().min(0).max(1_000_000_000).optional(),
    streak: z.number().int().min(0).max(100_000).optional(),
  }).strict().strip();

  app.post("/api/user/stats", requireAuth, async (req: any, res) => {
    const parsed = statsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false });
    }
    try {
      const { xp, streak } = parsed.data;
      const update: any = {};
      if (xp !== undefined) update.xp = xp;
      if (streak !== undefined) update.streak = streak;

      await UserData.findOneAndUpdate({ userId: req.session.userId }, { ...update, $inc: { revision: 1 } }, { upsert: true });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });
}

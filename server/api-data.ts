import type { Express } from "express";
import { requireAuth } from "./auth";
import { z } from "zod";
import { bumpRevision, recordDeletion } from "./revision";
import { findDuplicateTask, findDuplicateGoal, findDuplicateDayNote } from "./dedupe";
import {
  Task, Goal, DayNote, TradingNote, DailyBias,
  FocusSession, RoutineTemplate, Simulation, UserData, UserDataBackup
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
  asset: z.enum(["GER40", "EUR", "XAU", "GBP"]),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  pros: z.string().optional(),
  cons: z.string().optional(),
  screenshotUrl: z.string().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).optional(),
});

const biasPatchSchema = z.object({
  date: z.string().optional(),
  asset: z.enum(["GER40", "EUR", "XAU", "GBP"]).optional(),
  direction: z.enum(["bullish", "bearish", "neutral"]).optional(),
  pros: z.string().nullable().optional(),
  cons: z.string().nullable().optional(),
  screenshotUrl: z.string().nullable().optional(),
  screenshots: z.array(z.object({ tf: z.string(), url: z.string() })).nullable().optional(),
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
        
        // Migrate Tasks
        if (Array.isArray(d.todayTasks)) {
          for (const t of d.todayTasks) {
            await Task.findOneAndUpdate({ userId, taskId: t.id }, { ...t, taskId: t.id, userId }, { upsert: true });
          }
        }
        // Migrate Goals
        if (Array.isArray(d.goals)) {
          for (const g of d.goals) {
            await Goal.findOneAndUpdate({ userId, goalId: g.id }, { ...g, goalId: g.id, userId }, { upsert: true });
          }
        }
        // Migrate DayNotes
        if (Array.isArray(d.dayNotes)) {
          for (const n of d.dayNotes) {
            await DayNote.findOneAndUpdate({ userId, noteId: n.id }, { ...n, noteId: n.id, userId }, { upsert: true });
          }
        }
        // Migrate TradingNotes
        if (Array.isArray(d.tradingNotes)) {
          for (const n of d.tradingNotes) {
            await TradingNote.findOneAndUpdate({ userId, noteId: n.id }, { ...n, noteId: n.id, userId }, { upsert: true });
          }
        }
        // Migrate FocusSessions
        if (Array.isArray(d.focusSessions)) {
          for (const f of d.focusSessions) {
            await FocusSession.findOneAndUpdate({ userId, sessionId: f.id }, { ...f, sessionId: f.id, userId }, { upsert: true });
          }
        }
        // Migrate DailyBiases
        if (Array.isArray(d.dailyBiases)) {
          for (const b of d.dailyBiases) {
            await DailyBias.findOneAndUpdate({ userId, biasId: b.id }, { ...b, biasId: b.id, userId }, { upsert: true });
          }
        }
        // Migrate Routines
        if (Array.isArray(d.routineTemplates)) {
          for (const r of d.routineTemplates) {
            await RoutineTemplate.findOneAndUpdate({ userId, templateId: r.id }, { ...r, templateId: r.id, userId }, { upsert: true });
          }
        }
        // Migrate Simulations
        if (Array.isArray(d.simulations)) {
          for (const s of d.simulations) {
            await Simulation.findOneAndUpdate({ userId, simId: s.id }, { ...s, simId: s.id, userId }, { upsert: true });
          }
        }
        
        // Preserve botVoiceHistory and xp/streak — only clear the migrated data, keep bot metadata
        const botHistory = d.botVoiceHistory || [];
        const savedXP = d.xp || {};
        const savedStreak = d.streak || {};
        await UserData.findOneAndUpdate({ userId }, { 
          $set: { 
            data: { botVoiceHistory: botHistory, xp: savedXP, streak: savedStreak },
            migrated: true,
          }
        });
        console.log(`[MIGRATION] Completed for user ${userId}`);
      } else if (oldUserData && !oldUserData.migrated) {
        // Blob exists but has nothing to migrate — mark migrated so the
        // branch above never re-runs on every poll.
        await UserData.findOneAndUpdate({ userId }, { $set: { migrated: true } });
      }

      // 2. Fetch active data
      const tasks = await Task.find({ userId }).lean();
      const goals = await Goal.find({ userId }).lean();
      const routines = await RoutineTemplate.find({ userId }).lean();
      const focusSessions = await FocusSession.find({ userId }).lean(); // Maybe filter last 30 days
      const biases = await DailyBias.find({ userId }).lean();
      
      // Fetch all notes for initial load (to prevent missing old notes)
      const dayNotes = await DayNote.find({ userId }).lean();
      const tradingNotes = await TradingNote.find({ userId }).lean();

      const ud = await UserData.findOne({ userId }).lean() as any;
      const udData = (ud?.data as any) || {};

      // Transform _id and mapped ids back to frontend format
      const mapBack = (items: any[], idField: string) => items.map(i => {
        const { _id, userId: _uid, createdAt, updatedAt, __v, [idField]: mappedId, ...rest } = i;
        return { id: mappedId, createdAt: createdAt?.toISOString?.(), updatedAt: updatedAt?.toISOString?.(), ...rest };
      });

      return res.json({
        ok: true,
        data: {
          todayTasks: mapBack(tasks, 'taskId'),
          goals: mapBack(goals, 'goalId'),
          routineTemplates: mapBack(routines, 'templateId'),
          focusSessions: mapBack(focusSessions, 'sessionId'),
          dailyBiases: mapBack(biases, 'biasId'),
          dayNotes: mapBack(dayNotes, 'noteId'),
          tradingNotes: mapBack(tradingNotes, 'noteId'),
          streak: udData.streak,
          xp: udData.xp,
          _deletedIds: (ud?.deletedIds as string[] | undefined) || [],
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

import type { Express } from "express";
import { requireAuth } from "./auth";
import { z } from "zod";
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
  link: z.string().optional(),
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

export function registerDataRoutes(app: Express) {
  
  // --- EMERGENCY RESTORE ---
  app.get("/api/rescue-data", async (req, res) => {
    try {
      const backups = await UserDataBackup.find({}).sort({ createdAt: -1 }).lean();
      
      let restoredCount = 0;
      for (const b of backups) {
        const uid = b.userId;
        const bd = b.data || {};
        const dayNotes = bd.dayNotes || [];
        const tradingNotes = bd.tradingNotes || [];
        
        for (const n of dayNotes) {
          const exists = await DayNote.findOne({ noteId: n.id });
          if (!exists) {
            await DayNote.create({ ...n, noteId: n.id, userId: uid });
            restoredCount++;
          }
        }
        for (const n of tradingNotes) {
          const exists = await TradingNote.findOne({ noteId: n.id });
          if (!exists) {
            await TradingNote.create({ ...n, noteId: n.id, userId: uid });
            restoredCount++;
          }
        }
      }
      return res.json({ ok: true, restored: restoredCount, msg: "Emergency restore complete" });
    } catch (e: any) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  
  app.get("/api/sync/init", requireAuth, async (req: any, res) => {
    const userId = req.session.userId;
    try {
      // 1. Check if migration is needed
      const oldUserData = await UserData.findOne({ userId });
      if (oldUserData && oldUserData.data && Object.keys(oldUserData.data).length > 0) {
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
            data: { botVoiceHistory: botHistory, xp: savedXP, streak: savedStreak }
          }
        });
        console.log(`[MIGRATION] Completed for user ${userId}`);
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
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  });

  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const updates = req.body;
      await Task.findOneAndUpdate(
        { userId, taskId: req.params.id }, 
        { $set: updates }, 
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      await Task.findOneAndDelete({ userId: req.session.userId, taskId: req.params.id });
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
      await Goal.findOneAndUpdate(
        { userId, goalId: data.id }, 
        { ...data, goalId: data.id, userId }, 
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  });

  app.patch("/api/goals/:id", requireAuth, async (req: any, res) => {
    try {
      await Goal.findOneAndUpdate({ userId: req.session.userId, goalId: req.params.id }, req.body);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/goals/:id", requireAuth, async (req: any, res) => {
    try {
      await Goal.findOneAndDelete({ userId: req.session.userId, goalId: req.params.id });
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
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  });

  app.patch("/api/routines/:id", requireAuth, async (req: any, res) => {
    try {
      await RoutineTemplate.findOneAndUpdate({ userId: req.session.userId, templateId: req.params.id }, req.body);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/routines/:id", requireAuth, async (req: any, res) => {
    try {
      await RoutineTemplate.findOneAndDelete({ userId: req.session.userId, templateId: req.params.id });
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
      await DayNote.findOneAndUpdate(
        { userId: req.session.userId, noteId: data.id }, 
        { ...data, noteId: data.id, userId: req.session.userId }, 
        { upsert: true }
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, message: err.message });
    }
  });

  app.patch("/api/notes/:id", requireAuth, async (req: any, res) => {
    try {
      await DayNote.findOneAndUpdate({ userId: req.session.userId, noteId: req.params.id }, req.body);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  app.delete("/api/notes/:id", requireAuth, async (req: any, res) => {
    try {
      await DayNote.findOneAndDelete({ userId: req.session.userId, noteId: req.params.id });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });
  
  // --- XP & STREAK (Save without full sync) ---
  app.post("/api/user/stats", requireAuth, async (req: any, res) => {
    try {
      const { xp, streak } = req.body;
      const update: any = {};
      if (xp) update.xp = xp;
      if (streak) update.streak = streak;
      
      await UserData.findOneAndUpdate({ userId: req.session.userId }, update, { upsert: true });
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });
}

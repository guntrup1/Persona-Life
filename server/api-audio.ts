import { Express } from "express";
import { User, ProcessedAudio, DayNote } from "./mongodb";

export function registerAudioRoutes(app: Express) {

  // ── Worker Security Middleware ──
  function requireWorkerSecret(req: any, res: any, next: any) {
    const secret = req.headers["x-worker-secret"] || req.body?.secretToken;
    if (secret !== process.env.WORKER_SECRET_TOKEN) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    next();
  }

  // ── GET /api/internal/user-config — Worker looks up user's BYOK keys ──
  app.get("/api/internal/user-config", requireWorkerSecret, async (req: any, res: any) => {
    try {
      const { telegramId } = req.query;
      if (!telegramId) return res.status(400).json({ error: "Missing telegramId" });

      const user = await User.findOne({ telegramId: String(telegramId) })
        .select("groqApiKey geminiApiKey botSetupStep")
        .lean();

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        groqApiKey: (user as any).groqApiKey || null,
        geminiApiKey: (user as any).geminiApiKey || null,
        botSetupStep: (user as any).botSetupStep || null,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/internal/user-config — Worker updates user's onboarding state/keys ──
  app.post("/api/internal/user-config", requireWorkerSecret, async (req: any, res: any) => {
    try {
      const { telegramId, botSetupStep, groqApiKey, geminiApiKey } = req.body;
      if (!telegramId) return res.status(400).json({ error: "Missing telegramId" });

      const updateData: any = {};
      if (botSetupStep !== undefined) updateData.botSetupStep = botSetupStep;
      if (groqApiKey !== undefined) updateData.groqApiKey = groqApiKey;
      if (geminiApiKey !== undefined) updateData.geminiApiKey = geminiApiKey;

      const user = await User.findOneAndUpdate(
        { telegramId: String(telegramId) },
        { $set: updateData },
        { new: true }
      );

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/internal/link-telegram — Worker links telegramId to account via magic token ──
  app.post("/api/internal/link-telegram", requireWorkerSecret, async (req: any, res: any) => {
    try {
      const { token, telegramId } = req.body;
      if (!token || !telegramId) return res.status(400).json({ error: "Missing token or telegramId" });

      // Find user with valid unexpired link token
      const user = await User.findOne({
        telegramLinkToken: token,
        telegramLinkExpires: { $gt: new Date() },
      });

      if (!user) return res.status(404).json({ error: "Token invalid or expired" });

      // Check if this telegramId is already used by another account
      const existing = await User.findOne({ telegramId: String(telegramId) });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(409).json({ error: "Telegram already linked to another account" });
      }

      // Link the account + set initial setup step
      await User.findByIdAndUpdate(user._id, {
        telegramId: String(telegramId),
        telegramLinkToken: null,
        telegramLinkExpires: null,
        botSetupStep: (user as any).groqApiKey && (user as any).geminiApiKey ? "done" : "awaiting_groq",
      });

      return res.json({ ok: true, email: user.email, hasKeys: !!(user as any).groqApiKey && !!(user as any).geminiApiKey });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/internal/audio-result — Worker pushes completed analysis ──
  app.post("/api/internal/audio-result", requireWorkerSecret, async (req: any, res: any) => {
    try {
      const {
        telegramId, messageId, transcript, summary,
        actionItems, tags, mindMap, keyInsights,
        topics, sentiment, noteType, questionsRaised,
      } = req.body;

      // Find user by telegram ID
      const user = await User.findOne({ telegramId }).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      // Save ProcessedAudio record
      const processed = await ProcessedAudio.create({
        userId: user._id,
        telegramMessageId: messageId,
        raw_transcript: transcript,
        executive_summary: summary,
        action_items: actionItems || [],
        semantic_tags: tags || [],
        mind_map_nodes: mindMap || [],
        status: "completed",
      });

      // Auto-create a DayNote so it appears in the app immediately
      const today = new Date().toISOString().slice(0, 10);
      await DayNote.create({
        userId: user._id,
        noteId: `audio_${processed._id}`,
        date: today,
        title: summary ? summary.slice(0, 80) : "Голосовая заметка",
        content: [
          summary || "",
          "",
          keyInsights?.length ? `💡 Ключевые мысли:\n${keyInsights.map((i: string) => `• ${i}`).join("\n")}` : "",
          actionItems?.length ? `✅ Задачи:\n${actionItems.map((a: any) => `• ${a.task}`).join("\n")}` : "",
          tags?.length ? `🏷 Теги: ${tags.join(", ")}` : "",
          "",
          `📝 Полная расшифровка:\n${transcript}`,
        ].filter(Boolean).join("\n"),
        noteType: noteType === "idea" ? "idea" : "note",
        ideaCategory: tags?.[0] || "",
      });

      return res.json({ ok: true, id: processed._id });
    } catch (e: any) {
      console.error("[api-audio] Error saving processed audio:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // ── GET /api/processed-audios — Frontend fetches voice notes ──
  app.get("/api/processed-audios", async (req: any, res: any) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      const audios = await ProcessedAudio.find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json({ audios });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });
}


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

      const user = await User.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      })
        .select("groqApiKey geminiApiKey botSetupStep botRecordMode")
        .lean();

      if (!user) return res.status(404).json({ error: "User not found" });

      return res.json({
        groqApiKey: (user as any).groqApiKey || null,
        geminiApiKey: (user as any).geminiApiKey || null,
        botSetupStep: (user as any).botSetupStep || null,
        botRecordMode: (user as any).botRecordMode || "notes",
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/internal/user-config — Worker updates user's onboarding state/keys ──
  app.post("/api/internal/user-config", requireWorkerSecret, async (req: any, res: any) => {
    try {
      const { telegramId, botSetupStep, groqApiKey, geminiApiKey, botRecordMode } = req.body;
      if (!telegramId) return res.status(400).json({ error: "Missing telegramId" });

      const updateData: any = {};
      if (botSetupStep !== undefined) updateData.botSetupStep = botSetupStep;
      if (groqApiKey !== undefined) updateData.groqApiKey = groqApiKey;
      if (geminiApiKey !== undefined) updateData.geminiApiKey = geminiApiKey;
      if (botRecordMode !== undefined) updateData.botRecordMode = botRecordMode;

      const user = await User.findOneAndUpdate(
        { $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }] },
        { $set: updateData },
        { returnDocument: "after" }
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
      const existing = await User.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      });
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
        topics, sentiment, noteType, questionsRaised, mode,
      } = req.body;

      // Find user by telegram ID (support String or Number)
      const user = await User.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      }).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      // Save ProcessedAudio record (always — appears in Brainstorm panel)
      const processed = await ProcessedAudio.create({
        userId: user._id,
        telegramMessageId: messageId,
        raw_transcript: transcript,
        executive_summary: summary,
        action_items: actionItems || [],
        semantic_tags: tags || [],
        mind_map_nodes: mindMap || [],
        key_insights: keyInsights || [],
        topics: topics || [],
        sentiment: sentiment || "neutral",
        questions_raised: questionsRaised || [],
        note_type: noteType || "note",
        status: "completed",
        mode: mode || "notes",
      });

      // Auto-create a DayNote ONLY for non-brainstorm modes so it appears in the app's Notes/Tasks sections
      if (mode !== "brainstorm") {
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
            `📝 Расшифровка:\n${transcript}`,
          ].filter(Boolean).join("\n"),
          noteType: noteType === "idea" ? "idea" : "note",
          ideaCategory: tags?.[0] || "",
        });
      }

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

  // ── POST /api/internal/analyze-transcript ──
  // Worker sends transcript text here; server does Gemini + saves + replies to Telegram
  // (Audio downloading and Groq Whisper is handled entirely by Cloudflare to save Render bandwidth)
  app.post("/api/internal/analyze-transcript", requireWorkerSecret, async (req: any, res: any) => {
    // Immediately acknowledge so Worker can return 200 to Telegram
    res.json({ ok: true, status: "processing" });

    const {
      telegramId, chatId, messageId, transcript, botToken, mode = "notes"
    } = req.body;

    if (!telegramId || !chatId || !transcript || !botToken) {
      console.error("[analyze-transcript] Missing required fields");
      return;
    }

    // Helper to send Telegram message without blocking
    async function tgSend(text: string) {
      try {
        const body: any = { chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true };
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok && text.includes("Markdown")) {
          // retry without parse_mode on Markdown parse error
          delete body.parse_mode;
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }
      } catch (e: any) {
        console.error("[tgSend error]", e.message);
      }
    }

    try {
      // 1. Find user
      const user = await User.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      }).lean();
      if (!user) {
        await tgSend("❌ Аккаунт не найден. Привяжи заново через /start");
        return;
      }

      const geminiApiKey = (user as any).geminiApiKey || process.env.GEMINI_API_KEY;

      // 4. Analyze with Gemini
      const modeInstructions: Record<string, string> = {
        tasks: "\nMODE: TASKS. Extract ALL action items with priority.",
        goals: "\nMODE: GOALS. Extract long-term objectives as milestones.",
        brainstorm: "\nMODE: BRAINSTORM. Be highly detailed and comprehensive. Provide a thorough executive summary, extract deep key insights, generate expanded new ideas/connections (put them in mind_map_nodes or key_insights), and formulate a detailed action plan if applicable.",
        notes: "\nMODE: NOTES. Extract key thoughts, facts, observations.",
      };

      const systemPrompt = `You are an elite cognitive extraction AI. Analyze the voice transcript and return ONLY a valid JSON object.
${modeInstructions[mode] || modeInstructions.notes}

RULES:
1. Output ONLY raw JSON starting with { and ending with }
2. No markdown, no explanation, no code blocks
3. All string values must be in the transcript's language

JSON SCHEMA:
{
  "executive_summary": "2-3 sentence dense summary",
  "key_insights": ["insight 1", "insight 2"],
  "action_items": [{"task": "...", "assignee": null, "priority": "high"}],
  "semantic_tags": ["tag1", "tag2"],
  "topics": ["topic1"],
  "sentiment": "neutral",
  "mind_map_nodes": [{"entity": "...", "relation": "leads to", "target": "..."}],
  "questions_raised": [],
  "note_type": "note"
}

TRANSCRIPT:
${transcript}`;

      const geminiModels = [
        { model: "gemini-3.6-flash", api: "v1beta" },
        { model: "gemini-2.5-flash", api: "v1beta" },
        { model: "gemini-2.0-flash", api: "v1beta" },
        { model: "gemini-1.5-flash-latest", api: "v1" },
      ];

      let rawGemini = "";
      for (const { model, api } of geminiModels) {
        try {
          const gRes = await fetch(
            `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
              }),
            }
          );
          if (!gRes.ok) continue;
          const gData = await gRes.json() as any;
          const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) { rawGemini = text; break; }
        } catch { continue; }
      }

      // Parse Gemini output
      let parsed: any = {};
      if (rawGemini) {
        // Extract JSON from the response
        let jsonStr = rawGemini.trim();
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1].trim();
        const objStart = jsonStr.indexOf("{");
        const objEnd = jsonStr.lastIndexOf("}");
        if (objStart !== -1 && objEnd !== -1) {
          jsonStr = jsonStr.slice(objStart, objEnd + 1);
        }
        try { parsed = JSON.parse(jsonStr); } catch {
          // best effort: try to recover
          try { parsed = JSON.parse(jsonStr.replace(/,\s*([}\]])/g, "$1")); } catch { /* ignore */ }
        }
      }

      const result = {
        executive_summary: String(parsed.executive_summary || transcript.slice(0, 300)),
        key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights.map(String) : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        semantic_tags: Array.isArray(parsed.semantic_tags) ? parsed.semantic_tags.map(String) : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
        sentiment: String(parsed.sentiment || "neutral"),
        mind_map_nodes: Array.isArray(parsed.mind_map_nodes) ? parsed.mind_map_nodes : [],
        questions_raised: Array.isArray(parsed.questions_raised) ? parsed.questions_raised.map(String) : [],
        note_type: String(parsed.note_type || "note"),
      };

      // 5. Save to DB
      const processed = await ProcessedAudio.create({
        userId: (user as any)._id,
        telegramMessageId: String(messageId),
        raw_transcript: transcript,
        executive_summary: result.executive_summary,
        action_items: result.action_items,
        semantic_tags: result.semantic_tags,
        mind_map_nodes: result.mind_map_nodes,
        key_insights: result.key_insights,
        topics: result.topics,
        sentiment: result.sentiment,
        questions_raised: result.questions_raised,
        note_type: result.note_type,
        status: "completed",
        mode,
      });

      // Auto-create DayNote only for non-brainstorm modes
      if (mode !== "brainstorm") {
        const today = new Date().toISOString().slice(0, 10);
        await DayNote.create({
          userId: (user as any)._id,
          noteId: `audio_${processed._id}`,
          date: today,
          title: result.executive_summary.slice(0, 80),
          content: [
            result.executive_summary,
            "",
            result.key_insights.length ? `💡 Ключевые мысли:\n${result.key_insights.map((i: string) => `• ${i}`).join("\n")}` : "",
            result.action_items.length ? `✅ Задачи:\n${result.action_items.map((a: any) => `• ${a.task}`).join("\n")}` : "",
            result.semantic_tags.length ? `🏷 Теги: ${result.semantic_tags.join(", ")}` : "",
            "",
            `📝 Расшифровка:\n${transcript}`,
          ].filter(Boolean).join("\n"),
          noteType: result.note_type === "idea" ? "idea" : "note",
          ideaCategory: result.semantic_tags[0] || "",
        }).catch(() => {}); // Non-critical
      }

      // 6. Send result to Telegram
      const modeEmoji: Record<string, string> = { brainstorm: "🧠", tasks: "📝", goals: "🎯", notes: "💡" };
      const modeTitle: Record<string, string> = { brainstorm: "Брейн-шторм", tasks: "Задачи из записи", goals: "Цели из записи", notes: "Анализ заметки" };
      const emoji = modeEmoji[mode] || "💡";
      const title = modeTitle[mode] || "Анализ записи";

      const lines: string[] = [`${emoji} *${title}*`, `━━━━━━━━━━━━━━━━━━━━━━`];
      if (result.executive_summary) lines.push(`\n📋 *Суть:*\n${result.executive_summary}`);
      if (result.key_insights.length) lines.push(`\n💡 *Инсайты:*\n${result.key_insights.map((i: string) => `• ${i}`).join("\n")}`);
      if (result.action_items.length) {
        const items = result.action_items.map((a: any) => {
          const p = a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "🟢";
          return `${p} ${a.task}`;
        });
        lines.push(`\n✅ *Задачи:*\n${items.join("\n")}`);
      }
      if (result.semantic_tags.length) lines.push(`\n🏷 _${result.semantic_tags.join(" · ")}_`);

      await tgSend(lines.join("\n"));

    } catch (err: any) {
      console.error("[process-audio] Unhandled error:", err);
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: `❌ Ошибка обработки: ${err?.message?.slice(0, 200) || "Неизвестная ошибка"}` }),
        });
      } catch { /* ignore */ }
    }
  });
}



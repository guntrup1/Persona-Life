import { Express } from "express";
import { User, ProcessedAudio, DayNote, Task, Goal } from "./mongodb";

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
      const query: any = { userId: req.session.userId };
      if (req.query.mode) {
        query.mode = req.query.mode;
      }
      const audios = await ProcessedAudio.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json({ audios });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── POST /api/internal/process-audio ──
  // Worker sends fileId here; server downloads audio, transcribes with Groq, analyzes with Gemini, saves, and replies to Telegram
  app.post("/api/internal/process-audio", requireWorkerSecret, async (req: any, res: any) => {
    // Immediately acknowledge so Worker can return 200 to Telegram and avoid timeout
    res.json({ ok: true, status: "processing" });

    const {
      telegramId, chatId, messageId, fileId, botToken, mode = "notes", progressMsgId = null
    } = req.body;

    if (!telegramId || !chatId || !fileId || !botToken) {
      console.error("[process-audio] Missing required fields");
      return;
    }

    // Main menu keyboard — always restore after processing
    const mainMenuKeyboard = {
      keyboard: [
        [{ text: "➕ Добавить" }],
        [{ text: "👤 Мой аккаунт" }, { text: "❓ Помощь" }],
      ],
      resize_keyboard: true,
    };

    // Helper to send Telegram message without blocking
    async function tgSend(text: string, withKeyboard = false) {
      try {
        const body: any = { chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true };
        if (withKeyboard) body.reply_markup = mainMenuKeyboard;
        const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
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

      const groqApiKey = (user as any).groqApiKey;
      const geminiApiKey = (user as any).geminiApiKey || process.env.GEMINI_API_KEY;

      if (!groqApiKey) {
        await tgSend("❌ Groq API ключ не найден. Настрой ключи через /reset");
        return;
      }

      // 2. Get file path from Telegram
      const getFileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      const getFileData = await getFileRes.json() as any;
      if (!getFileData.ok) throw new Error("Failed to get file from Telegram");
      const filePath = getFileData.result.file_path;

      // 3. Download audio file from Telegram
      const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
      const arrayBuffer = await fileRes.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "audio/ogg" });

      // 4. Transcribe with Groq
      const formData = new FormData();
      formData.append("file", blob, "audio.ogg");
      formData.append("model", "whisper-large-v3");

      const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqApiKey}` },
        body: formData as any,
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text();
        throw new Error(`Groq API Error: ${errorText}`);
      }

      const groqData = await groqRes.json() as any;
      const transcript = groqData.text;

      if (!transcript || transcript.length < 3) {
        await tgSend("⚠️ Не удалось распознать речь. Попробуй ещё раз.");
        return;
      }

      // Update progress message if we have one
      if (progressMsgId) {
        await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: Number(progressMsgId),
            text: `🧠 *Анализирую...*\n\`Gemini обрабатывает текст\``,
            parse_mode: "Markdown",
          }),
        }).catch(() => {});
      }

      // 5. Analyze with Gemini
      const modeInstructions: Record<string, string> = {
        tasks: "\nMODE: TASKS. Extract ALL action items with priority.",
        goals: "\nMODE: GOALS. Extract long-term objectives as milestones.",
        brainstorm: "\nMODE: BRAINSTORM. Be highly detailed and comprehensive. Provide a thorough executive summary, extract deep key insights, generate expanded new ideas/connections (put them in mind_map_nodes or key_insights), and formulate a detailed action plan if applicable.",
        notes: "\nMODE: NOTES. Extract key thoughts, facts, observations.",
      };

      const todayDateStr = new Date().toISOString().slice(0, 10);
      // Trim very long transcripts to avoid token limits (8000 chars ≈ 6000 tokens)
      const trimmedTranscript = transcript.length > 8000 ? transcript.slice(0, 8000) + "..." : transcript;
      const systemPrompt = `You are an elite cognitive extraction AI. Analyze the voice transcript and return ONLY a valid JSON object.
${modeInstructions[mode] || modeInstructions.notes}

RULES:
1. Output ONLY raw JSON starting with { and ending with }
2. No markdown, no explanation, no code blocks
3. All string values must be in the transcript's language
4. Today's date is ${todayDateStr}. If the user mentions "завтра" (tomorrow), calculate the correct YYYY-MM-DD date. If no date is specified for a task, use ${todayDateStr}.
5. Extract time (e.g., "14:00") if the user mentions it. Use HH:MM format. If no time is specified, leave "time" as null.

JSON SCHEMA:
{
  "executive_summary": "2-3 sentence dense summary",
  "key_insights": ["insight 1", "insight 2"],
  "action_items": [{"task": "...", "date": "YYYY-MM-DD", "time": "HH:MM", "priority": "high"}],
  "semantic_tags": ["tag1", "tag2"],
  "topics": ["topic1"],
  "sentiment": "neutral",
  "mind_map_nodes": [{"entity": "...", "relation": "leads to", "target": "..."}],
  "questions_raised": [],
  "note_type": "note"
}

TRANSCRIPT:
${trimmedTranscript}`;

      const geminiModels = [
        { model: "gemini-3.6-flash", api: "v1beta" },
        { model: "gemini-1.5-flash", api: "v1" },
      ];

      // Try user's key first, then server fallback key on quota errors
      const geminiKeys = [geminiApiKey, process.env.GEMINI_API_KEY].filter(Boolean) as string[];
      // Deduplicate (if user key == server key)
      const uniqueKeys = [...new Set(geminiKeys)];

      let rawGemini = "";
      outer:
      for (const apiKey of uniqueKeys) {
        for (const { model, api } of geminiModels) {
          try {
            const gRes = await fetch(
              `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                }),
              }
            );
            if (!gRes.ok) {
              const errText = await gRes.text();
              const isQuota = gRes.status === 429;
              console.error(`[Gemini] ${model} (key=...${apiKey.slice(-6)}) failed ${gRes.status}${isQuota ? " QUOTA" : ""}: ${errText.slice(0, 200)}`);
              if (isQuota) break; // quota exhausted for this key, try next key
              continue; // model not found, try next model
            }
            const gData = await gRes.json() as any;
            const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              rawGemini = text;
              console.log(`[Gemini] Success with ${model}, length=${text.length}`);
              break outer;
            }
          } catch (e: any) {
            console.error(`[Gemini] ${model} exception: ${e.message}`);
            continue;
          }
        }
      }

      if (!rawGemini) {
        console.error("[Gemini] ALL keys and models failed. Transcript length:", transcript.length);
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

      // 6. Create corresponding entities based on mode
      const today = new Date().toISOString().slice(0, 10);
      const category = result.semantic_tags[0] || "General";

      if (mode === "tasks") {
        // Create a Task for each action item
        for (const item of result.action_items) {
          const taskDate = item.date && item.date.match(/^\d{4}-\d{2}-\d{2}$/) ? item.date : today;
          
          const taskData: any = {
            userId: (user as any)._id,
            taskId: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            name: item.task || "Новая задача",
            description: result.executive_summary,
            category: category,
            date: taskDate,
            type: "daily",
            noDeadline: true,
          };
          
          if (item.time && item.time.match(/^\d{2}:\d{2}$/)) {
             taskData.startTime = item.time;
             taskData.noDeadline = false;
          }

          await Task.create(taskData).catch((e) => console.error("Task creation failed", e));
        }
      } else if (mode === "goals") {
        // Create a Goal for each action item
        for (const item of result.action_items) {
          await Goal.create({
            userId: (user as any)._id,
            goalId: `goal_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: "life",
            title: item.task || "Новая цель",
            description: result.executive_summary,
            category: category,
          }).catch((e) => console.error("Goal creation failed", e));
        }
      } else if (mode === "notes") {
        // Create a Note
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
          ideaCategory: category,
        }).catch(() => {});
      }

      // 7. Send result to Telegram
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
      lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`_Отправь ещё голосовое или выбери режим ➕_`);

      // Delete progress message before sending final result
      if (progressMsgId) {
        await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: Number(progressMsgId) }),
        }).catch(() => {});
      }

      // Send final result — split into chunks if > 4000 chars to avoid Telegram limit
      const fullText = lines.join("\n");
      const CHUNK_SIZE = 3900;
      if (fullText.length <= CHUNK_SIZE) {
        await tgSend(fullText, true);
      } else {
        // Split by paragraphs (\n\n)
        const parts: string[] = [];
        let current = "";
        for (const segment of fullText.split("\n")) {
          if ((current + "\n" + segment).length > CHUNK_SIZE) {
            if (current) parts.push(current);
            current = segment;
          } else {
            current = current ? current + "\n" + segment : segment;
          }
        }
        if (current) parts.push(current);

        for (let i = 0; i < parts.length; i++) {
          await tgSend(parts[i], i === parts.length - 1); // keyboard only on last chunk
        }
      }

    } catch (err: any) {
      console.error("[analyze-transcript] Unhandled error:", err);
      // Always restore keyboard even on error
      await tgSend(`❌ Ошибка обработки: _${err?.message?.slice(0, 200) || "Неизвестная ошибка"}_`, true);
    }
  });
}



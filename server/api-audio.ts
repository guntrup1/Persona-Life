import { Express } from "express";
import mongoose from "mongoose";

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

      const UserModel = mongoose.model("User");
      const user = await UserModel.findOne({
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

      const UserModel = mongoose.model("User");
      const user = await UserModel.findOneAndUpdate(
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
      const UserModel = mongoose.model("User");
      const user = await UserModel.findOne({
        telegramLinkToken: token,
        telegramLinkExpires: { $gt: new Date() },
      });

      if (!user) return res.status(404).json({ error: "Token invalid or expired" });

      // Check if this telegramId is already used by another account
      const existing = await UserModel.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(409).json({ error: "Telegram already linked to another account" });
      }

      // Link the account + set initial setup step
      await UserModel.findByIdAndUpdate(user._id, {
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
      const UserModel = mongoose.model("User");
      const user = await UserModel.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      }).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      // Save ProcessedAudio record (always — appears in Brainstorm panel)
      const ProcessedAudioModel = mongoose.model("ProcessedAudio");
      const processed = await ProcessedAudioModel.create({
        userId: (user as any)._id,
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
        const DayNoteModel = mongoose.model("DayNote");
        await DayNoteModel.create({
          userId: (user as any)._id,
          noteId: `audio_${(processed as any)._id}`,
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
      const ProcessedAudioModel = mongoose.model("ProcessedAudio");
      const audios = await ProcessedAudioModel.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json({ audios });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/processed-audios/all — Clear all voice notes for user ──
  app.delete("/api/processed-audios/all", async (req: any, res: any) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      const ProcessedAudioModel = mongoose.model("ProcessedAudio");
      await ProcessedAudioModel.deleteMany({ userId: req.session.userId });
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── DELETE /api/processed-audios/:id — Delete a single voice note ──
  app.delete("/api/processed-audios/:id", async (req: any, res: any) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
      const ProcessedAudioModel = mongoose.model("ProcessedAudio");
      const deleted = await ProcessedAudioModel.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
      if (!deleted) return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true });
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
      const UserModel = mongoose.model("User");
      const user = await UserModel.findOne({
        $or: [{ telegramId: String(telegramId) }, { telegramId: Number(telegramId) }]
      }).lean();
      if (!user) {
        await tgSend("❌ Аккаунт не найден. Привяжи заново через /start");
        return;
      }

      const groqApiKey = (user as any).groqApiKey;
      const geminiApiKey = (user as any).geminiApiKey;

      if (!groqApiKey) {
        await tgSend("❌ Groq API ключ не найден. Настрой ключи через /reset");
        return;
      }

      if (!geminiApiKey) {
        await tgSend("❌ Gemini API ключ не найден. Настрой ключи через /reset");
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
      const todayDateStr = new Date().toISOString().slice(0, 10);
      const modeInstructions: Record<string, string> = {
        tasks: `
MODE: TASKS
- Extract EVERY action item, even small ones
- Assign realistic priority: high / medium / low
- Parse dates: "завтра" = tomorrow, "в пятницу" = nearest Friday, "через неделю" = +7 days
- Parse exact times if mentioned: "с 14:00 до 15:30" → start_time "14:00", end_time "15:30"; "в 15:00" → start_time "15:00", end_time "16:00"; "после обеда" = 14:00
- If only a start time is mentioned without an end time, set end_time = start_time + 1 hour
- If no time is mentioned, set both start_time and end_time to null
- If no date mentioned for a task, use today: ${todayDateStr}
- life_area MUST be exactly one of: Health, Wealth, Mind, Spirit, Relationships, Career, Environment
- The executive_summary must briefly describe what kind of tasks were extracted`,

        goals: `
MODE: GOALS
- Extract long-term objectives
- For each goal, generate a detailed step-by-step plan (array of strings) in the "plan_steps" field.
- Identify underlying motivation / "why" behind each goal
- time_limit MUST be exactly one of: week, month, year, life, custom_date
- life_area MUST be exactly one of: Health, Wealth, Mind, Spirit, Relationships, Career, Environment
- key_insights should reveal what obstacles or dependencies were mentioned
- executive_summary: what the person ultimately wants to achieve and why`,

        brainstorm: `
MODE: BRAINSTORM — MAXIMUM DEPTH REQUIRED
- executive_summary: write 3-5 sentences. Capture the CORE THESIS of the recording. What is the central idea? What problem is being solved? What conclusion was reached?
- key_insights: extract 4-8 non-obvious insights. Each insight must be a standalone valuable observation that a reader could act on or think about. Not just summaries — real analytical value.
- action_items: extract concrete next steps if any were mentioned. Each step should be specific and actionable.
- mind_map_nodes: map the key concepts and how they relate to each other (at least 5 nodes)
- questions_raised: list unanswered questions or open problems the speaker raised
- semantic_tags: 5-8 relevant tags`,

        notes: `
MODE: NOTES / IDEAS / TRADING
- Determine if this is a general note, an idea, or a trading note/idea.
- TRADING CONTENT (markets, GER40, XAU, EUR, GBP, OB, FVG, fractal, imbalance, entries, setup, analysis): set "is_trading_note": true and extract:
  - "asset": one of GER40, EUR, XAU, GBP (or null if not clear)
  - "timeframe": timeframe if mentioned (e.g. "15m", "H1", "H4", "D1") or null
  - "tag": one of "мысль" (observation/thought), "идея" (trade setup/idea), "ошибка" (mistake review)
  - "is_trading_idea": true ONLY for a concrete trade setup/idea (tag "идея"), otherwise false
- NON-TRADING IDEA (gift, hobby, study, project idea): set "note_type": "idea" and "idea_category" to one of: gift, hobby, study, other.
- Otherwise, set "note_type": "note".
- executive_summary: 2-3 sentence summary of the main thought or observation
- key_insights: 2-4 key takeaways
- semantic_tags: relevant topic tags`,
      };

      // Trim very long transcripts to avoid token limits (12000 chars ≈ 9000 tokens)
      const trimmedTranscript = transcript.length > 12000 ? transcript.slice(0, 12000) + "..." : transcript;
      const systemPrompt = `You are an expert cognitive analyst AI. Your job is to extract maximum analytical value from voice recordings. Analyze the transcript below and return ONLY a valid JSON object — no markdown, no explanation, no code blocks.

${modeInstructions[mode] || modeInstructions.notes}

CRITICAL RULES:
1. Output ONLY raw JSON starting with { and ending with }
2. NO markdown, NO explanation, NO code blocks, NO backticks
3. All string values MUST be in the same language as the transcript (Russian if Russian)
4. Today's date is ${todayDateStr}
5. Be THOROUGH and DETAILED — this is for a productivity system, shallow analysis is useless
6. executive_summary is MANDATORY and must be substantive (not empty, not generic)
7. key_insights must contain real insights, not just rephrased sentences from the transcript

JSON SCHEMA (return ALL fields, use empty arrays [] if not applicable):
{
  "executive_summary": "3-5 sentences capturing the core thesis, main idea, and key conclusion of the recording",
  "key_insights": ["non-obvious insight 1", "non-obvious insight 2", "...up to 8 insights"],
  "action_items": [{"task": "specific actionable step", "date": "YYYY-MM-DD", "start_time": "HH:MM or null", "end_time": "HH:MM or null", "priority": "high|medium|low"}],
  "goals_extracted": [{"title": "goal title", "time_limit": "week|month|year|life", "life_area": "Health|Wealth|Mind|Spirit|Relationships|Career|Environment", "plan_steps": ["step 1", "step 2"]}],
  "semantic_tags": ["tag1", "tag2", "tag3"],
  "topics": ["main topic", "secondary topic"],
  "sentiment": "positive|neutral|negative|mixed",
  "mind_map_nodes": [{"entity": "concept A", "relation": "leads to", "target": "concept B"}],
  "questions_raised": ["open question 1", "open question 2"],
  "note_type": "note|task|goal|idea|reflection",
  "idea_category": "gift|hobby|study|other|null",
  "is_trading_note": false,
  "asset": "GER40|EUR|XAU|GBP|null",
  "timeframe": "15m|H1|H4|D1|null",
  "tag": "мысль|идея|ошибка|null",
  "is_trading_idea": false,
  "life_area": "Health|Wealth|Mind|Spirit|Relationships|Career|Environment|General"
}

TRANSCRIPT:
${trimmedTranscript}`;


      const geminiModels = [
        { model: "gemini-3.5-flash-lite", api: "v1beta" }, // 15 RPM, 500 RPD
        { model: "gemini-2.5-flash-lite", api: "v1beta" }, // 10 RPM, 20 RPD
        { model: "gemini-3.7-flash", api: "v1beta" },      // 5 RPM, 20 RPD
        { model: "gemini-3.6-flash", api: "v1beta" },      // 5 RPM, 20 RPD
        { model: "gemini-2.5-flash", api: "v1beta" }       // 5 RPM, 20 RPD
      ];

      // Helper: call Gemini with one retry on 429
      const callGemini = async (): Promise<string> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          for (const { model, api } of geminiModels) {
            try {
              const gRes = await fetch(
                `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${geminiApiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                  }),
                }
              );
              if (gRes.status === 429) {
                console.warn(`[Gemini] ${model} hit 429 (attempt ${attempt + 1})`);
                if (attempt === 0) {
                  // Notify user that we're waiting, then retry
                  if (progressMsgId) {
                    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        chat_id: chatId,
                        message_id: Number(progressMsgId),
                        text: `⏳ *Gemini перегружен...*\n\`Лимит 15 запросов/мин. Ожидаю 65 сек и повторяю...\``,
                        parse_mode: "Markdown",
                      }),
                    }).catch(() => {});
                  }
                  // Wait 65 seconds before retry (60s window + buffer)
                  await new Promise(r => setTimeout(r, 65000));
                  break; // break model loop, go to next attempt
                } else {
                  // Second attempt also 429 - give up
                  await tgSend(
                    "⚠️ *Gemini API перегружен*\n" +
                    "Превышен лимит \`15 запросов/мин\`.\n" +
                    "Твой транскрипт сохранён. Повтори через несколько минут.",
                    true
                  );
                  return "";
                }
              }
              if (gRes.status === 401) {
                await tgSend("❌ Gemini API ключ недействителен (Ошибка 401). Обнови через /reset", true);
                return "";
              }
              if (gRes.status === 403) {
                console.warn(`[Gemini] ${model} failed 403: Permission Denied. Trying next model...`);
                continue;
              }
              if (!gRes.ok) {
                const errText = await gRes.text();
                console.error(`[Gemini] ${model} failed ${gRes.status}: ${errText.slice(0, 200)}`);
                continue;
              }
              const gData = await gRes.json() as any;
              const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                console.log(`[Gemini] ✓ ${model} OK, length=${text.length}`);
                return text;
              }
            } catch (e: any) {
              console.error(`[Gemini] ${model} exception: ${e.message}`);
              continue;
            }
          }
        }
        return "";
      }

      const rawGemini = await callGemini();

      if (!rawGemini) {
        console.error("[Gemini] ALL models failed. Transcript length:", transcript.length);
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
        goals_extracted: Array.isArray(parsed.goals_extracted) ? parsed.goals_extracted : [],
        semantic_tags: Array.isArray(parsed.semantic_tags) ? parsed.semantic_tags.map(String) : [],
        topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
        sentiment: String(parsed.sentiment || "neutral"),
        mind_map_nodes: Array.isArray(parsed.mind_map_nodes) ? parsed.mind_map_nodes : [],
        questions_raised: Array.isArray(parsed.questions_raised) ? parsed.questions_raised.map(String) : [],
        note_type: String(parsed.note_type || "note"),
        idea_category: parsed.idea_category ? String(parsed.idea_category) : null,
        is_trading_note: Boolean(parsed.is_trading_note),
        asset: parsed.asset ? String(parsed.asset) : null,
        timeframe: parsed.timeframe ? String(parsed.timeframe) : null,
        tag: parsed.tag ? String(parsed.tag) : null,
        is_trading_idea: Boolean(parsed.is_trading_idea),
        life_area: parsed.life_area ? String(parsed.life_area) : null,
      };

      // 5. Save to DB
      const ProcessedAudioModel = mongoose.model("ProcessedAudio");
      const processed = await ProcessedAudioModel.create({
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
      const parsedLifeArea = result.life_area || result.semantic_tags?.[0] || "General";
      const validLifeAreas = ["Health", "Wealth", "Mind", "Spirit", "Relationships", "Career", "Environment"];
      const category = validLifeAreas.includes(parsedLifeArea) ? parsedLifeArea : "Mind";

      if (mode === "tasks") {
        // Create a Task for each action item
        const TaskModel = mongoose.model("Task");
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
          
          const rawStart = (item.start_time || item.time || "").trim();
          const startTime = rawStart.match(/^\d{2}:\d{2}$/) ? rawStart : null;

          if (startTime) {
            taskData.startTime = startTime;
            taskData.noDeadline = false;
            const rawEnd = (item.end_time || "").trim();
            if (rawEnd.match(/^\d{2}:\d{2}$/)) {
              taskData.endTime = rawEnd;
            } else {
              // Default end = start + 1 hour when no end time was mentioned
              const [h, m] = startTime.split(":").map(Number);
              const endH = (h + 1) % 24;
              taskData.endTime = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
            }
          }

          if ((user as any).googleCalendarConnected) {
            taskData.addToGoogleCalendar = true;
          }

          const createdTask = await TaskModel.create(taskData).catch((e) => {
            console.error("Task creation failed", e);
            return null;
          });

          if (createdTask && (user as any).googleCalendarConnected) {
            try {
              const { syncTaskToGoogleCalendar } = await import("./google-calendar");
              const eventId = await syncTaskToGoogleCalendar((user as any)._id.toString(), createdTask);
              if (eventId) {
                await TaskModel.updateOne(
                  { _id: createdTask._id },
                  { $set: { googleCalendarEventId: eventId } }
                );
              }
            } catch (err) {
              console.error("Failed to sync audio task to calendar", err);
            }
          }
        }
      } else if (mode === "goals" && Array.isArray(result.goals_extracted)) {
        // Create a Goal for each extracted goal
        const GoalModel = mongoose.model("Goal");
        for (const item of result.goals_extracted) {
          const planArray = Array.isArray(item.plan_steps) 
            ? item.plan_steps.map((step: string) => ({ id: `step_${Date.now()}_${Math.random().toString(36).substring(7)}`, text: step, done: false }))
            : [];
            
          const goalCat = validLifeAreas.includes(item.life_area) ? item.life_area : category;
          const timeLimit = item.time_limit || "month"; // week, month, year, life, custom_date
          const validGoalTypes = ["week", "month", "year"];
          const goalType = validGoalTypes.includes(timeLimit) ? timeLimit : "year"; // life/custom_date → year

          await GoalModel.create({
            userId: (user as any)._id,
            goalId: `goal_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: goalType,
            title: item.title || "Новая цель",
            description: result.executive_summary,
            category: goalCat,
            timeLimitType: timeLimit,
            status: "active",
            plan: planArray,
            completed: false,
            xp: 0
          }).catch((e) => console.error("Goal creation failed", e));
        }
      } else if (mode === "notes") {
        if (result.is_trading_note) {
          // Create a Trading Note
          const TradingNoteModel = mongoose.model("TradingNote");
          const validAssets = ["GER40", "EUR", "XAU", "GBP"];
          const validTags = ["мысль", "идея", "ошибка"];
          const asset = result.asset && validAssets.includes(result.asset) ? result.asset : "GER40";
          const tag = result.tag && validTags.includes(result.tag) ? result.tag : "мысль";
          await TradingNoteModel.create({
            userId: (user as any)._id,
            noteId: `trading_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            date: today,
            title: result.executive_summary.slice(0, 80),
            text: result.executive_summary + "\n\n" + (result.key_insights || []).map((i: string) => `• ${i}`).join("\n"),
            asset: asset,
            timeframe: result.timeframe || undefined,
            tag: tag,
            time: new Date().toTimeString().slice(0, 5),
            isTradingIdea: result.is_trading_idea || tag === "идея",
          }).catch((e) => console.error("TradingNote creation failed", e));
        } else {
          // Create a DayNote
          const DayNoteModel = mongoose.model("DayNote");
          await DayNoteModel.create({
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
            ].filter(Boolean).join("\n"),
            noteType: result.note_type === "idea" ? "idea" : "note",
            ideaCategory: result.idea_category || category,
          }).catch((e) => console.error("DayNote creation failed", e));
        }
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



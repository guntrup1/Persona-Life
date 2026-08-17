import { Express } from "express";
import { BrainstormSession, ProcessedAudio, User } from "./mongodb";
import { requireAuth } from "./auth";

export function registerBrainstormRoutes(app: Express) {

  // ── GET all user's brainstorms (for day-by-day dashboard) ──
  app.get("/api/brainstorms", requireAuth, async (req: any, res: any) => {
    try {
      const brainstorms = await BrainstormSession.find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .populate("sourceNoteIds", "raw_transcript executive_summary semantic_tags createdAt status")
        .lean();
      
      return res.json({ brainstorms });
    } catch (err: any) {
      console.error("[brainstorm] get error:", err);
      return res.status(500).json({ error: "Ошибка сервера при получении брейнштормов" });
    }
  });

  // ── POST generate brainstorm ──
  app.post("/api/brainstorms/generate", requireAuth, async (req: any, res: any) => {
    try {
      const { noteIds, prompt } = req.body;
      if (!noteIds || !noteIds.length) {
        return res.status(400).json({ error: "Не выбраны заметки для штурма" });
      }

      // 1. Fetch user to get their Gemini API key
      const user = await User.findById(req.session.userId).select("geminiApiKey");
      const geminiApiKey = (user as any)?.geminiApiKey || process.env.GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        return res.status(400).json({ error: "Gemini API ключ не настроен. Привяжите его в настройках Telegram-бота." });
      }

      // 2. Fetch the notes (only for this user)
      const notes = await ProcessedAudio.find({ 
        _id: { $in: noteIds }, 
        userId: req.session.userId 
      }).lean();

      if (!notes || !notes.length) {
        return res.status(404).json({ error: "Заметки не найдены" });
      }

      // 3. Token optimization: Cascading Context Strategy
      //    If total raw transcripts > 4000 chars, use summaries only (save tokens)
      let totalLength = 0;
      notes.forEach((n: any) => totalLength += ((n as any).raw_transcript || "").length);
      const useCascadingContext = totalLength > 4000;
      
      const contextTexts = notes.map((n: any, i: number) => {
        if (useCascadingContext) {
          return `--- Запись ${i + 1} ---\nСводка: ${(n as any).executive_summary || "нет сводки"}\nТеги: ${((n as any).semantic_tags || []).join(", ")}`;
        } else {
          return `--- Запись ${i + 1} ---\nТранскрипт:\n${(n as any).raw_transcript || ""}`;
        }
      });

      const contextData = contextTexts.join("\n\n");

      // 4. Build prompt
      const defaultPrompt = "Выяви ключевые инсайты и сформулируй конкретный план действий из этих заметок.";
      const userPrompt = prompt && prompt.trim().length > 3 ? prompt.trim() : defaultPrompt;

      const fullPrompt = `Ты — AI-ассистент для брейн-шторминга высшего уровня. Анализируй записи пользователя и создай детальный JSON-вывод.

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userPrompt}

КОНТЕКСТ (Голосовые заметки / записи):
${contextData}

АБСОЛЮТНЫЕ ПРАВИЛА — НАРУШЕНИЕ СЛОМАЕТ СИСТЕМУ:
1. Твой ОТВЕТ — это ОДИН чистый JSON-объект. Без прозы, без объяснений, без Markdown.
2. Начинай с { и заканчивай }. Больше ничего.
3. Язык вывода — русский (совпадает с языком записей).
4. Заполни ВСЕ поля схемы. Не опускай ни одного.

JSON-СХЕМА (строго соблюдать):
{
  "theme": "Краткое название сессии (3-6 слов)",
  "executive_summary": "Глубокий анализ в 2-3 предложениях: о чём записи, что важно, что открыто",
  "key_insights": ["concrete insight 1", "concrete insight 2", "concrete insight 3", "concrete insight 4"],
  "patterns_found": ["повторяющаяся тема или шаблон 1", "шаблон 2"],
  "contradictions": ["противоречие или напряжение если есть"],
  "action_plan": [
    { "step": 1, "task": "конкретное действие", "priority": "high" },
    { "step": 2, "task": "конкретное действие", "priority": "medium" }
  ],
  "new_ideas": ["новая идея 1", "новая идея 2"],
  "questions_to_explore": ["вопрос для глубинного изучения"]
}

НАЧИНАЙ JSON СЕЙЧАС:`;

      // Available models for this API key in 2026
      const modelsToTry = [
        { model: "gemini-3.6-flash",        apiVersion: "v1beta" },
        { model: "gemini-3.7-flash",        apiVersion: "v1beta" },
        { model: "gemini-flash-latest",     apiVersion: "v1beta" },
        { model: "gemini-2.5-flash",        apiVersion: "v1beta" }
      ];

      let raw = "";
      let lastErrText = "";
      let rateLimitError: string | null = null;

      modelLoop:
      for (const { model, apiVersion } of modelsToTry) {
        const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${geminiApiKey}`;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                  temperature: 0.5,
                  maxOutputTokens: 2500,
                  responseMimeType: "application/json",
                },
              }),
            });

            if (!geminiRes.ok) {
              lastErrText = await geminiRes.text();
              const status = geminiRes.status;
              
              if (status === 404 || status === 400) {
                console.warn(`[brainstorm] Model ${model} (${apiVersion}) not found (${status}), skipping`);
                break; // next model
              }
              
              if (status === 429) {
                rateLimitError = `Превышен лимит запросов (Quota Exceeded) на модели ${model}. Пожалуйста, подождите минуту.`;
                break; // Try next model
              }

              if (status === 503) {
                const delay = attempt * 1500;
                console.warn(`[brainstorm] ${model} returned ${status}, retrying in ${delay}ms (attempt ${attempt}/3)`);
                await new Promise((r) => setTimeout(r, delay));
                continue;
              }
              
              console.error(`[brainstorm] ${model} returned ${status}:`, lastErrText.slice(0, 200));
              break;
            }

            const geminiData = await geminiRes.json() as any;
            raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (raw) break modelLoop;
            
            console.warn(`[brainstorm] ${model} returned empty response`);
            break;
            
          } catch (e: any) {
            lastErrText = e.message;
            console.error(`[brainstorm] Network error on ${model}:`, e.message);
            break;
          }
        }
      }
      
      if (!raw) {
        if (rateLimitError) {
          return res.status(429).json({ error: rateLimitError });
        }
        
        // Determine if it's a quota issue or model issue based on lastErrText
        const isQuota = lastErrText.includes("429") || lastErrText.includes("RESOURCE_EXHAUSTED") || lastErrText.includes("quota");
        const friendlyMsg = isQuota
          ? "Квота Gemini API исчерпана (лимит запросов в минуту). Подождите минуту и попробуйте снова."
          : "Не удалось получить ответ от Gemini. Попробуйте позже.";
        return res.status(502).json({ error: friendlyMsg });
      }

      // 6. Parse JSON with multi-strategy extraction
      let parsed: any;
      try {
        const trimmed = raw.trim();
        // Try strategies in order of reliability
        let candidate: string | null = null;
        
        // S1: Already clean JSON
        if (trimmed.startsWith("{")) {
          candidate = trimmed;
        }
        // S2: Find first { and last } 
        if (!candidate) {
          const first = trimmed.indexOf("{");
          const last = trimmed.lastIndexOf("}");
          if (first !== -1 && last > first) candidate = trimmed.slice(first, last + 1);
        }
        // S3: Strip markdown fences then retry
        if (!candidate) {
          const stripped = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
          const sf = stripped.indexOf("{");
          const sl = stripped.lastIndexOf("}");
          if (sf !== -1 && sl > sf) candidate = stripped.slice(sf, sl + 1);
        }
        
        if (!candidate) throw new Error("No JSON object found");
        parsed = JSON.parse(candidate);
      } catch (parseErr) {
        console.error("[brainstorm] JSON parse error. Raw length:", raw.length, "First 500:", raw.slice(0, 500));
        return res.status(502).json({ error: "Модель вернула некорректный JSON. Попробуйте ещё раз или измените запрос." });
      }

      // 7. Save to DB
      const session = await BrainstormSession.create({
        userId: req.session.userId,
        theme: parsed.theme || "Без названия",
        prompt: userPrompt,
        sourceNoteIds: noteIds,
        executiveSummary: parsed.executive_summary || "",
        keyInsights: parsed.key_insights || [],
        patternsFound: parsed.patterns_found || [],
        contradictions: parsed.contradictions || [],
        actionPlan: (parsed.action_plan || []).map((a: any, i: number) => ({
          step: a.step ?? i + 1,
          task: a.task || "",
          priority: a.priority || "medium",
        })),
        newIdeas: parsed.new_ideas || [],
        questionsToExplore: parsed.questions_to_explore || [],
      });

      return res.json({ session });

    } catch (err: any) {
      console.error("[brainstorm] generate error:", err);
      return res.status(500).json({ error: err.message || "Внутренняя ошибка сервера" });
    }
  });

  // ── DELETE a brainstorm session ──
  app.delete("/api/brainstorms/:id", requireAuth, async (req: any, res: any) => {
    try {
      const session = await BrainstormSession.findOneAndDelete({
        _id: req.params.id,
        userId: req.session.userId
      });

      if (!session) return res.status(404).json({ error: "Сессия не найдена" });
      return res.json({ ok: true });
    } catch (err: any) {
      console.error("[brainstorm] delete error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
}

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

      const fullPrompt = `Ты — AI-ассистент для брейн-шторминга. Проанализируй записи и создай структурированный вывод на основе запроса пользователя.

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: ${userPrompt}

КОНТЕКСТ (Голосовые заметки):
${contextData}

СТРОГИЕ ПРАВИЛА:
- Верни ТОЛЬКО чистый JSON без разметки Markdown, без блоков кода, без комментариев.
- Начни с { и заканчивай }
- Язык вывода должен совпадать с языком заметок (скорее всего русский).

JSON-СХЕМА:
{
  "theme": "Краткое название брейн-шторма (макс. 6 слов)",
  "key_insights": ["инсайт 1", "инсайт 2", "инсайт 3"],
  "action_plan": [
    { "step": 1, "task": "конкретное действие" },
    { "step": 2, "task": "конкретное действие" }
  ],
  "new_ideas": ["новая идея 1", "новая идея 2"]
}`;

      // 5. Call Gemini REST API directly with multi-model fallback
      const modelsToTry = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest"
      ];

      let raw = "";
      let lastErrText = "";

      for (const model of modelsToTry) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        try {
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.6,
                maxOutputTokens: 800,
              },
            }),
          });

          if (!geminiRes.ok) {
            lastErrText = await geminiRes.text();
            if (geminiRes.status === 404) continue;
            console.error(`[brainstorm] Gemini error on ${model}:`, lastErrText);
            continue;
          }

          const geminiData = await geminiRes.json() as any;
          raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (raw) break;
        } catch (e: any) {
          lastErrText = e.message;
        }
      }
      
      if (!raw) {
        return res.status(502).json({ error: "Ошибка Gemini API: " + (lastErrText || "Не удалось получить ответ ни от одной модели") });
      }

      // 6. Parse JSON
      let parsed: any;
      try {
        const cleaned = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error("[brainstorm] JSON parse error. Raw:", raw);
        return res.status(502).json({ error: "Модель вернула некорректный JSON" });
      }

      // 7. Save to DB
      const session = await BrainstormSession.create({
        userId: req.session.userId,
        theme: parsed.theme || "Без названия",
        prompt: userPrompt,
        sourceNoteIds: noteIds,
        keyInsights: parsed.key_insights || [],
        actionPlan: parsed.action_plan || [],
        newIdeas: parsed.new_ideas || [],
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

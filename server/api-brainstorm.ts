import { Express } from "express";
import mongoose from "mongoose";
import { requireAuth } from "./auth";
import { decryptSecret } from "./crypto";

export function registerBrainstormRoutes(app: Express) {

  // ── GET all user's brainstorms (for day-by-day dashboard) ──
  app.get("/api/brainstorms", requireAuth, async (req: any, res: any) => {
    try {
      const brainstorms = await mongoose.model("BrainstormSession").find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .populate("sourceNoteIds", "title raw_transcript executive_summary semantic_tags createdAt status")
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

      // 1. Fetch user to get their Gemini API key (user's own key only — no server fallback)
      const user = await mongoose.model("User").findById(req.session.userId).select("geminiApiKey");
      const geminiApiKey = decryptSecret((user as any)?.geminiApiKey);
      
      if (!geminiApiKey) {
        return res.status(400).json({ error: "Ваш Gemini API ключ не найден. Привяжите его в настройках Telegram-бота (/reset)." });
      }

      // 2. Fetch the notes (only for this user)
      const notes = await mongoose.model("ProcessedAudio").find({ 
        _id: { $in: noteIds }, 
        userId: req.session.userId 
      }).lean();

      if (!notes || !notes.length) {
        return res.status(404).json({ error: "Заметки не найдены" });
      }

      // 3. Context: pass FULL transcripts by default — summaries only as a last resort
      //    for truly enormous inputs. Truncating to summaries was the reason long
      //    recordings produced almost no ideas (the model only saw a 3-sentence summary).
      let totalLength = 0;
      notes.forEach((n: any) => totalLength += ((n as any).raw_transcript || "").length);
      const FULL_TRANSCRIPT_LIMIT = 100000; // ~70k tokens — still inside Gemini's context window
      const useCascadingContext = totalLength > FULL_TRANSCRIPT_LIMIT;

      const contextTexts = notes.map((n: any, i: number) => {
        const raw = (n as any).raw_transcript || "";
        if (useCascadingContext) {
          return `--- Запись ${i + 1} ---\nСводка: ${(n as any).executive_summary || "нет сводки"}\nТеги: ${((n as any).semantic_tags || []).join(", ")}`;
        }
        const body = raw.length > 60000 ? raw.slice(0, 60000) + "\n…" : raw;
        return `--- Запись ${i + 1} ---\nТранскрипт:\n${body}`;
      });

      const contextData = contextTexts.join("\n\n");

      // 4. Build prompt
      const defaultPrompt = "Выяви ключевые инсайты и сформулируй конкретный план действий из этих записей.";
      const userPrompt = prompt && prompt.trim().length > 3 ? prompt.trim() : defaultPrompt;

      const fullPrompt = `Ты — мой гениальный стратег, системный аналитик и коуч уровня топ-менеджмента. Твоя цель — объединять мои разрозненные мысли в мощные, структурированные концепции.

Твоя задача — не просто пересказать текст, а вытащить скрытые смыслы, выявить неочевидные связи между моими разными записями и предложить прорывные идеи. Вывод должен быть ГЛУБОКИМ, ДЕТАЛЬНЫМ и РАЗВЁРНУТЫМ. Не будь сухим! Никакой воды, корпоративного булшита или банальностей. Только концентрат смыслов.

ПРАВИЛА ПОНИМАНИЯ КОНТЕКСТА:
1. Синтез, а не перечисление: Если на вход подано несколько записей, не описывай их по отдельности. Найди общую нить, мета-тему и противоречия между ними.
2. Детализация итогов: Каждое предложенное действие или итог должно быть предельно конкретным (не "улучшить маркетинг", а "запустить тесты с акцентом на [X], потому что в записи [Y] я упомянул этот страх").
3. Психология и стратегия: Обращай внимание на мои страхи, сомнения, инсайты и амбиции. Подсвечивай мои слепые зоны, о которых я не сказал прямо, но которые читаются между строк.

МОЙ ЗАПРОС: ${userPrompt}

⚠️ ВАЖНО ПРО МОЙ ЗАПРОС:
- Мой запрос — это УТОЧНЕНИЕ или дополнение к анализу, а не замена полного анализа.
- Ты ОБЯЗАН всегда выполнить полный структурированный анализ записей (суть, инсайты, план действий, новые идеи, противоречия, вопросы) и вернуть ВСЕ поля JSON-схемы.
- Дополнительно учти то, что я прошу в запросе (например, сделать акцент на трейдинге, составить план на неделю, найти противоречия и т.д.).
- Если запрос короткий или общий ("Выдели главное") — просто выполни стандартный глубокий анализ.

📌 ПРАВИЛА СТИЛЯ:
- executive_summary — это прямая ВЫЖИМКА сути записей (как будто я сам резюмирую свои мысли), а не комментарий о процессе анализа.
- ЗАПРЕЩЕНО начинать с фраз-затравок: "Анализ записей...", "Синтез записей...", "Из записей следует...", "Рассмотрев записи...", "Данный анализ...", "На основе анализа...", "Записи показывают..." и т.п.
- Пиши сразу по делу: о чём речь, какая главная мысль, к чему я пришёл. Как будто это моя собственная заметка.
- ВСЕ тексты (executive_summary, инсайты, задачи, идеи, вопросы) пиши от первого лица ("я", "мне", "мой") или как прямое обращение ко мне ("ты"). НИКОГДА не используй третье лицо: "автор", "пользователь", "он", "она".

🔢 КОЛИЧЕСТВО ПУНКТОВ:
- key_insights: НЕ МЕНЕЕ 6 глубоких инсайтов.
- action_plan: от 3 до 8 конкретных задач/шагов с приоритетами. Точное количество зависит от объёма и насыщенности материала: чем больше важных мыслей, тем больше пунктов. Только САМЫЕ важные шаги — никакой воды и пунктов ради количества.
- new_ideas: НЕ МЕНЕЕ 4 нестандартных идей.
- patterns_found: НЕ МЕНЕЕ 2 паттернов.
- contradictions: 1-2 противоречия (если есть; иначе пустой массив).
- questions_to_explore: 2-3 вопроса для глубинного изучения.

КОНТЕКСТ (Голосовые заметки / записи):
${contextData}

ФОРМАТ ВЫВОДА:
Ты обязан ответить СТРОГО в формате валидного JSON (без обертки \`\`\`json). Твой ответ будет парситься системой.

Структура JSON должна быть следующей (строго соблюдай ключи):
{
  "theme": "Емкое и цепляющее название для сессии (до 6 слов)",
  "executive_summary": "Прямая выжимка сути (5-7 предложений) БЕЗ фраз-затравок вида 'Анализ записей...'. Сразу суть.",
  "key_insights": [
    "Инсайт 1",
    "Инсайт 2",
    "Инсайт 3",
    "Инсайт 4",
    "Инсайт 5",
    "Инсайт 6"
  ],
  "patterns_found": [
    "Паттерн 1: [Название] - [Глубокое объяснение неочевидной связи]",
    "Паттерн 2: [Название] - [Глубокое объяснение неочевидной связи]"
  ],
  "action_plan": [
    { "task": "Сформулированный итог или вывод из моих мыслей. Детально прописанный, конкретный следующий шаг.", "priority": "high" },
    { "task": "Второй конкретный шаг", "priority": "medium" }
  ],
  "new_ideas": [
    "Нестандартная идея 1, выходящая за рамки очевидного",
    "Нестандартная идея 2, предлагающая посмотреть на проблему под другим углом"
  ],
  "contradictions": ["Найденные противоречия или напряжения, если есть"],
  "questions_to_explore": ["Вопросы для глубинного изучения"]
}

НАЧИНАЙ JSON СЕЙЧАС:`;

      // Models in priority order (highest daily limits first) — only models confirmed in AI Studio
      const modelsToTry = [
        { model: "gemini-3.5-flash-lite", apiVersion: "v1beta" }, // 15 RPM, 500 RPD
        { model: "gemini-2.5-flash-lite", apiVersion: "v1beta" }, // 10 RPM, 20 RPD
        { model: "gemini-3.7-flash",      apiVersion: "v1beta" }, // 5 RPM, 20 RPD
        { model: "gemini-3.6-flash",      apiVersion: "v1beta" }, // 5 RPM, 20 RPD
        { model: "gemini-2.5-flash",      apiVersion: "v1beta" }, // 5 RPM, 20 RPD
      ];

      let raw = "";
      let lastErrText = "";
      let rateLimitError: string | null = null;

      modelLoop:
      for (const { model, apiVersion } of modelsToTry) {
        const geminiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${geminiApiKey}`;
        
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                  temperature: 0.5,
                  maxOutputTokens: 8192,
                  responseMimeType: "application/json",
                },
              }),
            });

            if (!geminiRes.ok) {
              lastErrText = await geminiRes.text();
              const status = geminiRes.status;
              
              if (status === 404 || status === 400 || status === 403) {
                console.warn(`[brainstorm] Model ${model} (${apiVersion}) not available (${status}), trying next`);
                break; // next model
              }
              
              if (status === 429) {
                if (attempt === 1) {
                  console.warn(`[brainstorm] ${model} hit 429, waiting 65s before retry...`);
                  await new Promise((r) => setTimeout(r, 65000));
                  continue; // retry same model
                }
                // Second attempt also 429 — try next model
                rateLimitError = `Превышен лимит запросов на модели ${model}. Перехожу на следующую...`;
                console.warn(`[brainstorm] ${model} hit 429 on retry, trying next model`);
                break; // next model
              }

              if (status === 503) {
                const delay = attempt * 1500;
                console.warn(`[brainstorm] ${model} returned ${status}, retrying in ${delay}ms (attempt ${attempt}/2)`);
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

      // 7. Save to DB — use snake_case fields to match frontend BrainstormSession interface
      const session = await mongoose.model("BrainstormSession").create({
        userId: req.session.userId,
        theme: parsed.theme || "Без названия",
        prompt: userPrompt,
        sourceNoteIds: noteIds,
        // snake_case: matches frontend interface (executive_summary, key_insights, etc.)
        executive_summary: parsed.executive_summary || "",
        key_insights: parsed.key_insights || [],
        patterns_found: parsed.patterns_found || [],
        contradictions: parsed.contradictions || [],
        action_items: (parsed.action_plan || []).map((a: any, i: number) => ({
          task: a.task || "",
          priority: a.priority || "medium",
        })),
        newIdeas: parsed.new_ideas || [],
        questions_raised: parsed.questions_to_explore || [],
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
      const session = await mongoose.model("BrainstormSession").findOneAndDelete({
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

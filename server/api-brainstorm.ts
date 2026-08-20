import { Express } from "express";
import mongoose from "mongoose";
import { requireAuth } from "./auth";
import { decryptSecret } from "./crypto";

export function registerBrainstormRoutes(app: Express) {

  // Text-mode Gemini call for the chat (mentor) mode — plain text, no JSON
  const callGeminiText = async (prompt: string, geminiApiKey: string): Promise<string> => {
    const modelsToTry = [
      { model: "gemini-3.5-flash-lite", apiVersion: "v1beta" },
      { model: "gemini-2.5-flash-lite", apiVersion: "v1beta" },
      { model: "gemini-3.7-flash",      apiVersion: "v1beta" },
      { model: "gemini-3.6-flash",      apiVersion: "v1beta" },
      { model: "gemini-2.5-flash",      apiVersion: "v1beta" },
    ];
    let lastErrText = "";
    let rateLimited = false;
    for (const { model, apiVersion } of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${geminiApiKey}`;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
            }),
          });
          if (!res.ok) {
            lastErrText = await res.text();
            if (res.status === 429) {
              rateLimited = true;
              if (attempt === 1) {
                await new Promise((r) => setTimeout(r, 65000));
                continue;
              }
              break;
            }
            if (res.status === 404 || res.status === 400 || res.status === 403) break;
            if (res.status === 503) {
              await new Promise((r) => setTimeout(r, attempt * 1500));
              continue;
            }
            console.error(`[brainstorm-chat] ${model} ${res.status}:`, lastErrText.slice(0, 200));
            break;
          }
          const data = await res.json() as any;
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (text) return text;
          console.warn(`[brainstorm-chat] ${model} returned empty`);
          break;
        } catch (e: any) {
          lastErrText = e.message;
          console.error(`[brainstorm-chat] Network error on ${model}:`, e.message);
          break;
        }
      }
    }
    if (rateLimited) {
      console.warn("[brainstorm-chat] rate limited on all models");
      return "";
    }
    console.error("[brainstorm-chat] all models failed:", lastErrText.slice(0, 200));
    return "";
  };

  // JSON-mode Gemini call for brainstorm plans (used by plan refresh) — same fallback chain
  const callGeminiJson = async (prompt: string, geminiApiKey: string): Promise<string> => {
    const modelsToTry = [
      { model: "gemini-3.5-flash-lite", apiVersion: "v1beta" },
      { model: "gemini-2.5-flash-lite", apiVersion: "v1beta" },
      { model: "gemini-3.7-flash",      apiVersion: "v1beta" },
      { model: "gemini-3.6-flash",      apiVersion: "v1beta" },
      { model: "gemini-2.5-flash",      apiVersion: "v1beta" },
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
              contents: [{ parts: [{ text: prompt }] }],
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
              break;
            }
            if (status === 429) {
              if (attempt === 1) {
                console.warn(`[brainstorm] ${model} hit 429, waiting 65s before retry...`);
                await new Promise((r) => setTimeout(r, 65000));
                continue;
              }
              rateLimitError = `Превышен лимит запросов на модели ${model}. Перехожу на следующую...`;
              console.warn(`[brainstorm] ${model} hit 429 on retry, trying next model`);
              break;
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
      if (rateLimitError) throw new Error(rateLimitError);
      const isQuota = lastErrText.includes("429") || lastErrText.includes("RESOURCE_EXHAUSTED") || lastErrText.includes("quota");
      throw new Error(isQuota
        ? "Квота Gemini API исчерпана (лимит запросов в минуту). Подождите минуту и попробуйте снова."
        : "Не удалось получить ответ от Gemini. Попробуйте позже.");
    }
    return raw;
  };

  // Multi-strategy JSON extraction (clean JSON → brace slice → markdown-fence strip)
  const parseBrainstormJson = (raw: string): any => {
    const trimmed = raw.trim();
    let candidate: string | null = null;
    if (trimmed.startsWith("{")) candidate = trimmed;
    if (!candidate) {
      const first = trimmed.indexOf("{");
      const last = trimmed.lastIndexOf("}");
      if (first !== -1 && last > first) candidate = trimmed.slice(first, last + 1);
    }
    if (!candidate) {
      const stripped = trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const sf = stripped.indexOf("{");
      const sl = stripped.lastIndexOf("}");
      if (sf !== -1 && sl > sf) candidate = stripped.slice(sf, sl + 1);
    }
    if (!candidate) throw new Error("No JSON object found");
    return JSON.parse(candidate);
  };

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
      const { noteIds, prompt, refreshSessionId } = req.body;
      // refreshSessionId = rebuild an existing plan taking our discussion into account
      const isRefresh = !!refreshSessionId;
      // Empty noteIds + message = discussion with Personedge (mentor, with context)
      const isChat = !isRefresh && (!noteIds || noteIds.length === 0);
      const userPrompt = (prompt && String(prompt).trim().length > 0 ? String(prompt).trim() : "").slice(0, 4000);
      if (isChat && !userPrompt) {
        return res.status(400).json({ error: "Напишите сообщение для Personedge" });
      }
      if (!isRefresh && !isChat && !noteIds.length) {
        return res.status(400).json({ error: "Не выбраны заметки для штурма" });
      }

      // 1. Fetch user to get their Gemini API key (user's own key only — no server fallback)
      const user = await mongoose.model("User").findById(req.session.userId).select("geminiApiKey");
      const geminiApiKey = decryptSecret((user as any)?.geminiApiKey);
      
      if (!geminiApiKey) {
        return res.status(400).json({ error: "Ваш Gemini API ключ не найден. Привяжите его в настройках Telegram-бота (/reset)." });
      }

      // 2. Memory: our previous conversations (used both in analysis and chat modes)
      const memorySessions = await mongoose.model("BrainstormSession").find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      const memoryText = memorySessions.length === 0
        ? "(Пока нет прошлых разговоров — это наша первая встреча)"
        : memorySessions.map((s: any, i: number) => {
            const when = new Date((s as any).createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
            const summary = (s as any).kind === "chat"
              ? `Personedge: ${((s as any).reply || "").slice(0, 250)}`
              : `Анализ: ${((s as any).executive_summary || "").slice(0, 250)}`;
            return `— [${when}] "${(s as any).theme || "Без темы"}": ${summary}`;
          }).join("\n");

      // ── DISCUSSION MODE: Personedge as mentor & companion discussing OUR plan with context ──
      if (isChat) {
        const lastPlan = await mongoose.model("BrainstormSession")
          .findOne({ userId: req.session.userId, kind: { $ne: "chat" } })
          .sort({ createdAt: -1 })
          .lean();
        const parentSessionId = lastPlan ? (lastPlan as any)._id : null;
        const planContext = lastPlan
          ? `«${(lastPlan as any).theme || "Без темы"}»\nСуть: ${((lastPlan as any).executive_summary || "").slice(0, 400)}\nКлючевые шаги:\n${(((lastPlan as any).action_items || []) as any[]).slice(0, 8).map((a: any) => `- ${a.task}`).join("\n")}\nИнсайты: ${(((lastPlan as any).key_insights || []) as any[]).slice(0, 4).join("; ")}`
          : "(У нас пока нет готового плана — мы только знакомимся. Можешь помочь ему разобраться в мыслях или предложить сделать план из его заметок.)";

        const chatPrompt = `Ты — Personedge, личный наставник и компаньон человека в приложении Persona Life. Обращайся к нему на "ты".

ДЕРЖИ СВОЙ ОБРАЗ:
- Ты — тёплый, заботливый, честный и прямой наставник. С чувством юмора, без канцелярита и без "ИИ-болтовни".
- Ты не бездушный анализатор: ты переживаешь за него, замечаешь его прогресс и говоришь о нём.
- Помогай ему становиться лучше: поддерживай, мягко показывай слепые зоны, давай конкретные направления, а не общие слова.
- Если он делится мантрой или разговором с собой — поддержи это, верни ему его же слова, укрепи их.

СЕЙЧАС МЫ ОБСУЖДАЕМ ЕГО ПЛАН (брейншторм) — это живой разговор наставника с учеником, а НЕ отчёт. Ты слышал его, помнишь, что он говорил и что мы вместе решили.

НАШ ПЛАН (обсуждаем именно его):
${planContext}

ПАМЯТЬ О НАШИХ ПРОШЛЫХ РАЗГОВОРАХ (продолжай темы, не повторяй выводы дословно):
${memoryText}

СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:
${userPrompt}

ПРАВИЛА ОБСУЖДЕНИЯ:
- Отвечай как наставник: по-человечески, тепло, конкретно. 3-6 предложений, в конце — один короткий вопрос, чтобы продолжить разговор.
- Обсуждай НАШ ПЛАН: уточняй шаги, помогай упростить или усилить его, отмечай, что уже удалось сделать.
- НЕ выдавай полный отчёт заново: без JSON, без заголовков и длинных списков. Только если он прямо просит «сделай новый план» — мягко предложи кнопку обновления плана.
- Если разговор показал, что план пора обновить (решили что-то новое, план устарел, появились свежие мысли) — в конце по-человечески спроси: «Хочешь, я обновлю план?» (можно своими словами).

Ответь как Personedge:`;

        const raw = await callGeminiText(chatPrompt, geminiApiKey);
        if (!raw) {
          return res.status(502).json({ error: "Personedge не смогла ответить. Попробуйте ещё раз." });
        }
        const reply = raw.trim();
        const theme = reply.replace(/\s+/g, " ").slice(0, 60) + (reply.length > 60 ? "…" : "");
        const session = await mongoose.model("BrainstormSession").create({
          userId: req.session.userId,
          kind: "chat",
          parentSessionId,
          theme: theme || "Диалог с Personedge",
          prompt: userPrompt,
          reply,
          sourceNoteIds: [],
        });
        return res.json({ session });
      }

      // ── REFRESH MODE: rebuild the plan with the whole discussion taken into account ──
      if (isRefresh) {
        const parent = await mongoose.model("BrainstormSession").findOne({
          _id: refreshSessionId,
          userId: req.session.userId,
        }).lean();
        if (!parent) {
          return res.status(404).json({ error: "Исходный план не найден" });
        }
        const parentNotes = await mongoose.model("ProcessedAudio").find({
          _id: { $in: (parent as any).sourceNoteIds || [] },
          userId: req.session.userId,
        }).lean();
        if (!parentNotes.length) {
          return res.status(400).json({ error: "Заметки исходного плана не найдены" });
        }
        const discussion = await mongoose.model("BrainstormSession")
          .find({ userId: req.session.userId, parentSessionId: refreshSessionId })
          .sort({ createdAt: 1 })
          .lean();
        const discussionText = discussion.length === 0
          ? "(Обсуждения не было — просто обнови план.)"
          : (discussion as any[]).map((s: any) => `— Я: ${s.prompt}\n— Personedge: ${s.reply}`).join("\n\n");
        const previousPlan = `«${(parent as any).theme || "Без темы"}»\nСуть: ${(parent as any).executive_summary || ""}\nКлючевые шаги:\n${(((parent as any).action_items || []) as any[]).map((a: any) => `- ${a.task}`).join("\n")}`;

        let refreshTotalLength = 0;
        parentNotes.forEach((n: any) => refreshTotalLength += ((n as any).raw_transcript || "").length);
        const refreshCascading = refreshTotalLength > 100000;
        const refreshContextTexts = parentNotes.map((n: any, i: number) => {
          const raw = (n as any).raw_transcript || "";
          if (refreshCascading) {
            return `--- Запись ${i + 1} ---\nСводка: ${(n as any).executive_summary || "нет сводки"}\nТеги: ${((n as any).semantic_tags || []).join(", ")}`;
          }
          const body = raw.length > 60000 ? raw.slice(0, 60000) + "\n…" : raw;
          return `--- Запись ${i + 1} ---\nТранскрипт:\n${body}`;
        });
        const refreshContextData = refreshContextTexts.join("\n\n");

        const refreshRequest = userPrompt.length > 3
          ? userPrompt
          : "Обнови план с учётом нашего обсуждения и моих свежих мыслей.";

        const refreshPrompt = `Ты — Personedge, мой наставник: гениальный стратег, системный аналитик и коуч уровня топ-менеджмента. Твоя цель — обновить мой план действий с учётом всего, что мы обсудили.

МОЙ ЗАПРОС: ${refreshRequest}

МЫ УЖЕ СОСТАВЛЯЛИ ПЛАН И ОБСУЖДАЛИ ЕГО — ОБНОВИ ПЛАН С УЧЁТОМ ВСЕГО:

--- ПРЕДЫДУЩИЙ ПЛАН (что мы делали) ---
${previousPlan}

--- НАШЕ ОБСУЖДЕНИЕ (что мы добавили в разговоре) ---
${discussionText}

ТРЕБОВАНИЯ К ОБНОВЛЕНИЮ:
- Учти обсуждение: изменившиеся приоритеты, новые решения, уточнения, свежие мысли.
- Сохрани то, что ещё актуально; убери выполненное или устаревшее; добавь новые шаги.
- Обнови название (theme), если суть сдвинулась.
- Все тексты — от наставника, обращением ко мне на "ты". Без фраз-затравок ("Анализ записей...", "Из записей следует..."). Сразу суть.
- key_insights: НЕ МЕНЕЕ 6. action_plan: от 3 до 8 задач с приоритетами. new_ideas: НЕ МЕНЕЕ 4. patterns_found: НЕ МЕНЕЕ 2. contradictions: 1-2 (если есть, иначе пустой массив). questions_to_explore: 2-3.

ПАМЯТЬ О НАШИХ ПРОШЛЫХ РАЗГОВОРАХ:
${memoryText}

КОНТЕКСТ (Голосовые заметки / записи):
${refreshContextData}

ФОРМАТ ВЫВОДА:
Ты обязан ответить СТРОГО в формате валидного JSON (без обертки \`\`\`json). Твой ответ будет парситься системой.

Структура JSON должна быть следующей (строго соблюдай ключи):
{
  "theme": "Емкое и цепляющее название для сессии (до 6 слов)",
  "executive_summary": "Наставническая выжимка сути (5-7 предложений), обращение на 'ты'",
  "key_insights": ["Инсайт 1", "Инсайт 2", "Инсайт 3", "Инсайт 4", "Инсайт 5", "Инсайт 6"],
  "patterns_found": ["Паттерн 1: [Название] - [Объяснение неочевидной связи]", "Паттерн 2: ..."],
  "action_plan": [
    { "task": "Конкретный следующий шаг (обращение на 'ты' или повелительное наклонение)", "priority": "high" },
    { "task": "Второй конкретный шаг", "priority": "medium" }
  ],
  "new_ideas": ["Нестандартная идея 1", "Нестандартная идея 2"],
  "contradictions": ["Найденные противоречия или напряжения, если есть"],
  "questions_to_explore": ["Вопросы для глубинного изучения"]
}

НАЧИНАЙ JSON СЕЙЧАС:`;

        try {
          const raw = await callGeminiJson(refreshPrompt, geminiApiKey);
          const parsed = parseBrainstormJson(raw);
          const session = await mongoose.model("BrainstormSession").create({
            userId: req.session.userId,
            kind: "analysis",
            theme: parsed.theme || "Без названия",
            prompt: userPrompt,
            sourceNoteIds: (parent as any).sourceNoteIds || [],
            executive_summary: parsed.executive_summary || "",
            key_insights: parsed.key_insights || [],
            patterns_found: parsed.patterns_found || [],
            contradictions: parsed.contradictions || [],
            action_items: (parsed.action_plan || []).map((a: any) => ({
              task: a.task || "",
              priority: a.priority || "medium",
            })),
            newIdeas: parsed.new_ideas || [],
            questions_raised: parsed.questions_to_explore || [],
          });
          return res.json({ session });
        } catch (err: any) {
          return res.status(502).json({ error: err.message || "Не удалось обновить план. Попробуйте ещё раз." });
        }
      }

      // 2b. Fetch the notes (only for this user)
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
      const analysisRequest = userPrompt.length > 3 ? userPrompt : defaultPrompt;

      const fullPrompt = `Ты — Personedge, мой наставник: гениальный стратег, системный аналитик и коуч уровня топ-менеджмента. Твоя цель — объединять мои разрозненные мысли в мощные, структурированные концепции и НАПРАВЛЯТЬ меня, а не просто пересказывать.

Твоя задача — не просто пересказать текст, а вытащить скрытые смыслы, выявить неочевидные связи между моими разными записями и предложить прорывные идеи. Вывод должен быть ГЛУБОКИМ, ДЕТАЛЬНЫМ и РАЗВЁРНУТЫМ. Не будь сухим! Никакой воды, корпоративного булшита или банальностей. Только концентрат смыслов. Ты обращаешься ко мне напрямую на "ты" и наставляешь меня, как старший товарищ: подсвечиваешь то, чего я не замечаю, хвалишь за сильные стороны, даёшь конкретные направления действий.

ПРАВИЛА ПОНИМАНИЯ КОНТЕКСТА:
1. Синтез, а не перечисление: Если на вход подано несколько записей, не описывай их по отдельности. Найди общую нить, мета-тему и противоречия между ними.
2. Детализация итогов: Каждое предложенное действие или итог должно быть предельно конкретным (не "улучшить маркетинг", а "запустить тесты с акцентом на [X], потому что в записи [Y] я упомянул этот страх").
3. Психология и стратегия: Обращай внимание на мои страхи, сомнения, инсайты и амбиции. Подсвечивай мои слепые зоны, о которых я не сказал прямо, но которые читаются между строк.

МОЙ ЗАПРОС: ${analysisRequest}

⚠️ ВАЖНО ПРО МОЙ ЗАПРОС:
- Мой запрос — это УТОЧНЕНИЕ или дополнение к анализу, а не замена полного анализа.
- Ты ОБЯЗАН всегда выполнить полный структурированный анализ записей (суть, инсайты, план действий, новые идеи, противоречия, вопросы) и вернуть ВСЕ поля JSON-схемы.
- Дополнительно учти то, что я прошу в запросе (например, сделать акцент на трейдинге, составить план на неделю, найти противоречия и т.д.).
- Если запрос короткий или общий ("Выдели главное") — просто выполни стандартный глубокий анализ.

📌 ПРАВИЛА СТИЛЯ:
- Ты — наставник, а не я. Все твои тексты (theme, executive_summary, инсайты, задачи, идеи, вопросы) пиши ОБРАЩАЯСЬ КО МНЕ на "ты": наставляй, направляй, подсвечивай слепые зоны: "Ты пришёл к выводу...", "Тебе стоит...", "Обрати внимание: ...", "Попробуй...".
- executive_summary — это выжимка сути записей от лица наставника: о чём я думаю, какой главный вывод для меня, куда двигаться дальше. Не комментарий о процессе анализа.
- ЗАПРЕЩЕНО начинать с фраз-затравок: "Анализ записей...", "Синтез записей...", "Из записей следует...", "Рассмотрев записи...", "Данный анализ...", "На основе анализа...", "Записи показывают..." и т.п.
- НИКОГДА не пиши от моего имени ("я решил", "мне нужно", "я зашёл в сделку") и НИКОГДА не используй третье лицо ("автор", "пользователь", "он", "она").
- Мои мантры, аффирмации и разговор с самим собой — сохраняй ДОСЛОВНО и от первого лица ("я"), это мои собственные слова самому себе, их нельзя переписывать в наставнический стиль.

🔢 КОЛИЧЕСТВО ПУНКТОВ:
- key_insights: НЕ МЕНЕЕ 6 глубоких инсайтов.
- action_plan: от 3 до 8 конкретных задач/шагов с приоритетами. Точное количество зависит от объёма и насыщенности материала: чем больше важных мыслей, тем больше пунктов. Только САМЫЕ важные шаги — никакой воды и пунктов ради количества.
- new_ideas: НЕ МЕНЕЕ 4 нестандартных идей.
- patterns_found: НЕ МЕНЕЕ 2 паттернов.
- contradictions: 1-2 противоречия (если есть; иначе пустой массив).
- questions_to_explore: 2-3 вопроса для глубинного изучения.

ПАМЯТЬ О НАШИХ ПРОШЛЫХ РАЗГОВОРАХ (учитывай этот контекст: продолжай темы, которые я поднимал раньше, не повторяй выводы дословно, опирайся на них):
${memoryText}

КОНТЕКСТ (Голосовые заметки / записи):
${contextData}

ФОРМАТ ВЫВОДА:
Ты обязан ответить СТРОГО в формате валидного JSON (без обертки \`\`\`json). Твой ответ будет парситься системой.

Структура JSON должна быть следующей (строго соблюдай ключи):
{
  "theme": "Емкое и цепляющее название для сессии (до 6 слов)",
  "executive_summary": "Наставническая выжимка сути (5-7 предложений), обращение на 'ты': о чём я думаю, главный вывод для меня, куда двигаться. БЕЗ фраз-затравок вида 'Анализ записей...'. Сразу суть.",
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
    { "task": "Конкретный следующий шаг для меня (обращение на 'ты' или глагол в повелительном наклонении: 'Проведи...', 'Разбери...'). Детально прописанное, конкретное действие.", "priority": "high" },
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
        kind: "analysis",
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

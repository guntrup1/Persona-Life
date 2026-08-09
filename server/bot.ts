import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, UserData } from "./mongodb";
import crypto from "crypto";

// ── Types ──
type RecordType = "task" | "note" | "goal";

interface BotTaskResult {
  name: string;
  description?: string;
  category: string;
  difficulty: "low" | "medium" | "high";
  date: string;
  startTime?: string;
  endTime?: string;
  noDeadline?: boolean;
}

interface BotNoteResult {
  title: string;
  content: string;
  noteType: "note" | "idea";
  ideaCategory?: "gift" | "hobby" | "study" | "other";
}

interface BotGoalResult {
  title: string;
  category: string;
  goalType: "week" | "month" | "year";
  description?: string;
  plan?: Array<{ text: string; done: boolean }>;
  timeLimitType?: "current_period" | "from_now" | "custom";
}

interface AIResponse {
  type: RecordType;
  tasks?: BotTaskResult[];
  notes?: BotNoteResult[];
  goals?: BotGoalResult[];
}

// ── State: track which type the user selected ──
const userState = new Map<number, { type: RecordType; messageId?: number }>();

// ── XP helpers ──
function xpForDifficulty(d: string): number {
  const map: Record<string, number> = { low: 10, medium: 25, high: 50 };
  return map[d] || 25;
}

function xpForGoal(t: string): number {
  const map: Record<string, number> = { week: 100, month: 250, year: 1000 };
  return map[t] || 100;
}

// ── Date helpers ──
function getTodayDate(utcOffset = 2): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + utcOffset * 3600000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTomorrowDate(utcOffset = 2): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + utcOffset * 3600000 + 86400000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayOfWeek(utcOffset = 2): string {
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + utcOffset * 3600000);
  return days[local.getDay()];
}

// ── Sanitize data from AI (same logic as auth.ts) ──
function sanitizeMongoInput(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(sanitizeMongoInput);

  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith("$") || key.includes(".")) continue;
    clean[key] = sanitizeMongoInput(val);
  }
  return clean;
}

// ── Build Gemini prompt ──
function buildPrompt(recordType: RecordType, utcOffset = 2): string {
  const today = getTodayDate(utcOffset);
  const tomorrow = getTomorrowDate(utcOffset);
  const dayOfWeek = getDayOfWeek(utcOffset);

  const VALID_CATEGORIES = "Body, Mind, Hard Skills, Soft Skills, Creativity, Mission, Finance";

  const baseContext = `
Ты — ассистент приложения Trade Persona. Анализируешь голосовые сообщения пользователей.
Текущая дата: ${today}, день недели: ${dayOfWeek}.
Часовой пояс пользователя: UTC+${utcOffset}.
Завтрашняя дата: ${tomorrow}.

ВАЖНЫЕ ПРАВИЛА АНАЛИЗА КОНТЕКСТА:
- НЕ копируй дословно. Анализируй СМЫСЛ и создавай чёткие, понятные записи.
- "завтра" = ${tomorrow}
- "послезавтра" = дата через 2 дня от ${today}
- "в понедельник" = ближайший понедельник от ${today}
- "10го числа" (без уточнения месяца) = 10 число текущего месяца, если ещё не прошло; иначе — следующего.
- Если в сообщении НЕСКОЛЬКО задач/заметок/целей — создай МАССИВ из нескольких элементов.
- Названия должны быть лаконичными (2-5 слов), описания — информативными.
- Допустимые категории: ${VALID_CATEGORIES}. Выбери наиболее подходящую по контексту.

ФОРМАТ ОТВЕТА: Строго JSON, без markdown, без \`\`\`, только чистый JSON.
`;

  if (recordType === "task") {
    return `${baseContext}
Пользователь хочет создать ЗАДАЧУ (или несколько задач).

Для каждой задачи определи:
- name: лаконичное название (2-5 слов)
- description: детальное описание что нужно сделать (если есть контекст)
- category: одна из [${VALID_CATEGORIES}]
- difficulty: "low" (простое, <30 мин), "medium" (требует усилий, 30мин-2ч), "high" (сложная, >2ч)
- date: дата в формате YYYY-MM-DD. Если не указана — "${today}"
- startTime: время начала в формате "HH:MM" (24ч). Если указано "в 9 утра" → "09:00". Если не указано — пропусти
- endTime: время окончания. Если не указано, но есть startTime — добавь +1 час. Если нет startTime — пропусти
- noDeadline: true если нет конкретного времени (только startTime и endTime), false если есть

ФОРМАТ:
{
  "type": "task",
  "tasks": [
    {
      "name": "...",
      "description": "...",
      "category": "...",
      "difficulty": "...",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "noDeadline": false
    }
  ]
}`;
  }

  if (recordType === "note") {
    return `${baseContext}
Пользователь хочет создать ЗАМЕТКУ или ИДЕЮ.

Определи:
- title: краткий, ёмкий заголовок (3-8 слов). Для идей начни с "Идея: ..."
- content: развёрнутое содержание заметки. Не копируй дословно — переформулируй чётко и структурированно
- noteType: "idea" если это идея/концепция/предложение, "note" если это обычная заметка/мысль/наблюдение
- ideaCategory: только для идей — "gift" (подарок), "hobby" (хобби/увлечение), "study" (интересно изучить), "other" (другое)

ФОРМАТ:
{
  "type": "note",
  "notes": [
    {
      "title": "...",
      "content": "...",
      "noteType": "note" | "idea",
      "ideaCategory": "gift" | "hobby" | "study" | "other"
    }
  ]
}`;
  }

  // goal
  return `${baseContext}
Пользователь хочет создать ЦЕЛЬ.

Определи:
- title: чёткая формулировка цели (3-10 слов)
- category: одна из [${VALID_CATEGORIES}]
- goalType: "week" (на неделю), "month" (на месяц), "year" (на год). Определи по контексту — если говорит "за этот месяц" → month, "на этой неделе" → week, если масштабная → year
- description: детальное описание цели и ожидаемого результата
- plan: разбей цель на 3-6 конкретных подзадач [{text: "...", done: false}]
- timeLimitType: "current_period" (до конца текущей недели/месяца/года), "from_now" (с сегодня + период)

ФОРМАТ:
{
  "type": "goal",
  "goals": [
    {
      "title": "...",
      "category": "...",
      "goalType": "week" | "month" | "year",
      "description": "...",
      "plan": [{"text": "...", "done": false}],
      "timeLimitType": "current_period" | "from_now"
    }
  ]
}`;
}

// ── Process voice with Gemini ──
async function processVoiceWithAI(
  audioBuffer: Buffer,
  recordType: RecordType,
  utcOffset?: number
): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = buildPrompt(recordType, utcOffset);

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString("base64"),
      mimeType: "audio/ogg",
    },
  };

  const result = await model.generateContent([prompt, audioPart]);
  const response = result.response;
  const text = response.text();

  // Clean up response — remove markdown code blocks if present
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const parsed = JSON.parse(cleaned) as AIResponse;
  return parsed;
}

// ── Save data to MongoDB ──
async function saveTasksToUser(userId: string, tasks: BotTaskResult[]): Promise<string[]> {
  const userData = await UserData.findOne({ userId });
  if (!userData) throw new Error("UserData not found");

  const existingData = (userData.data as any) || {};
  const existingTasks = Array.isArray(existingData.todayTasks) ? existingData.todayTasks : [];
  const createdNames: string[] = [];

  for (const task of tasks) {
    const newTask = sanitizeMongoInput({
      id: crypto.randomUUID(),
      name: task.name,
      description: task.description || "",
      category: task.category || "Mind",
      difficulty: task.difficulty || "medium",
      xp: xpForDifficulty(task.difficulty || "medium"),
      completed: false,
      date: task.date || getTodayDate(),
      type: "today",
      startTime: task.startTime || undefined,
      endTime: task.endTime || undefined,
      noDeadline: task.noDeadline ?? (!task.startTime),
    });
    existingTasks.push(newTask);
    createdNames.push(task.name);
  }

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, todayTasks: existingTasks }, updatedAt: new Date() }
  );

  return createdNames;
}

async function saveNotesToUser(userId: string, notes: BotNoteResult[]): Promise<string[]> {
  const userData = await UserData.findOne({ userId });
  if (!userData) throw new Error("UserData not found");

  const existingData = (userData.data as any) || {};
  const existingNotes = Array.isArray(existingData.dayNotes) ? existingData.dayNotes : [];
  const createdTitles: string[] = [];
  const now = new Date().toISOString();

  for (const note of notes) {
    const newNote = sanitizeMongoInput({
      id: crypto.randomUUID(),
      date: getTodayDate(),
      title: note.title || "",
      content: note.content || "",
      createdAt: now,
      updatedAt: now,
      noteType: note.noteType || "note",
      ideaCategory: note.ideaCategory || undefined,
    });
    existingNotes.push(newNote);
    createdTitles.push(note.title);
  }

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, dayNotes: existingNotes }, updatedAt: new Date() }
  );

  return createdTitles;
}

async function saveGoalsToUser(userId: string, goals: BotGoalResult[]): Promise<string[]> {
  const userData = await UserData.findOne({ userId });
  if (!userData) throw new Error("UserData not found");

  const existingData = (userData.data as any) || {};
  const existingGoals = Array.isArray(existingData.goals) ? existingData.goals : [];
  const createdTitles: string[] = [];

  for (const goal of goals) {
    const newGoal = sanitizeMongoInput({
      id: crypto.randomUUID(),
      type: goal.goalType || "month",
      title: goal.title,
      category: goal.category || "Mind",
      completed: false,
      xp: xpForGoal(goal.goalType || "month"),
      linkedTaskIds: [],
      description: goal.description || "",
      plan: (goal.plan || []).map(p => ({ ...p, id: crypto.randomUUID() })),
      timeLimitType: goal.timeLimitType || "current_period",
      status: "active",
    });
    existingGoals.push(newGoal);
    createdTitles.push(goal.title);
  }

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, goals: existingGoals }, updatedAt: new Date() }
  );

  return createdTitles;
}

// ── Format confirmation message ──
function formatConfirmation(aiResult: AIResponse): string {
  if (aiResult.type === "task" && aiResult.tasks?.length) {
    const lines = aiResult.tasks.map((t, i) => {
      let line = `  📌 *${t.name}*`;
      if (t.description) line += `\n     ${t.description}`;
      line += `\n     📅 ${t.date}`;
      if (t.startTime) line += ` | ⏰ ${t.startTime}`;
      if (t.endTime) line += `–${t.endTime}`;
      line += `\n     📂 ${t.category} | ${t.difficulty === "high" ? "🔴" : t.difficulty === "medium" ? "🟡" : "🟢"} ${t.difficulty}`;
      return line;
    });
    const header = aiResult.tasks.length === 1 ? "✅ *Задача создана!*" : `✅ *Создано задач: ${aiResult.tasks.length}*`;
    return `${header}\n\n${lines.join("\n\n")}`;
  }

  if (aiResult.type === "note" && aiResult.notes?.length) {
    const lines = aiResult.notes.map(n => {
      let line = `  📝 *${n.title}*`;
      if (n.content) line += `\n     ${n.content.slice(0, 120)}${n.content.length > 120 ? "..." : ""}`;
      line += `\n     ${n.noteType === "idea" ? "💡 Идея" : "📓 Заметка"}`;
      return line;
    });
    return `✅ *Заметка создана!*\n\n${lines.join("\n\n")}`;
  }

  if (aiResult.type === "goal" && aiResult.goals?.length) {
    const lines = aiResult.goals.map(g => {
      let line = `  🎯 *${g.title}*`;
      if (g.description) line += `\n     ${g.description.slice(0, 120)}${g.description.length > 120 ? "..." : ""}`;
      line += `\n     📂 ${g.category} | ⏳ ${g.goalType === "week" ? "Неделя" : g.goalType === "month" ? "Месяц" : "Год"}`;
      if (g.plan?.length) {
        line += `\n     План (${g.plan.length} пунктов):`;
        g.plan.slice(0, 4).forEach(p => {
          line += `\n       ◻️ ${p.text}`;
        });
        if (g.plan.length > 4) line += `\n       ...ещё ${g.plan.length - 4}`;
      }
      return line;
    });
    return `✅ *Цель создана!*\n\n${lines.join("\n\n")}`;
  }

  return "✅ Запись сохранена!";
}

// ── Initialize and export bot ──
export function createBot(): Telegraf | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[bot] TELEGRAM_BOT_TOKEN not set, skipping bot initialization");
    return null;
  }

  if (!process.env.GEMINI_API_KEY) {
    console.log("[bot] GEMINI_API_KEY not set, skipping bot initialization");
    return null;
  }

  const bot = new Telegraf(token);

  // ── /start — account linking ──
  bot.start(async (ctx) => {
    const linkToken = ctx.startPayload;

    if (linkToken) {
      // User came via link with a token — link account
      try {
        const user = await User.findOne({
          telegramLinkToken: linkToken,
          telegramLinkExpires: { $gt: new Date() },
        });

        if (!user) {
          return ctx.reply("❌ Ссылка недействительна или истекла. Сгенерируй новую в настройках Trade Persona.");
        }

        // Check if this Telegram ID is already linked to another account
        const existingLink = await User.findOne({ telegramId: String(ctx.from.id) });
        if (existingLink && existingLink._id.toString() !== user._id.toString()) {
          return ctx.reply("⚠️ Этот Telegram аккаунт уже привязан к другому аккаунту Trade Persona.");
        }

        await User.findByIdAndUpdate(user._id, {
          telegramId: String(ctx.from.id),
          telegramLinkToken: null,
          telegramLinkExpires: null,
        });

        return ctx.reply(
          `✅ *Аккаунт успешно привязан!*\n\nТвой Telegram теперь связан с аккаунтом Trade Persona (${user.email}).\n\nИспользуй /add чтобы добавить запись голосом.`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        console.error("[bot] Link error:", err);
        return ctx.reply("❌ Ошибка при привязке аккаунта. Попробуй позже.");
      }
    }

    // No token — show welcome message
    return ctx.reply(
      `👋 *Привет! Я бот Trade Persona.*\n\n` +
      `Я помогу тебе быстро добавлять задачи, заметки и цели голосом.\n\n` +
      `📌 *Как начать:*\n` +
      `1. Зайди в настройки Trade Persona на сайте\n` +
      `2. Нажми "Подключить Telegram"\n` +
      `3. Перейди по ссылке — и мы связаны!\n\n` +
      `После привязки используй /add чтобы добавить запись.`,
      { parse_mode: "Markdown" }
    );
  });

  // ── /add — show type selection ──
  bot.command("add", async (ctx) => {
    // Check if account is linked
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply(
        "🔗 Сначала привяжи свой аккаунт Trade Persona.\n\n" +
        "Зайди в настройки на сайте → «Подключить Telegram»."
      );
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("✅ Задача", "type_task")],
      [Markup.button.callback("📝 Заметка / Идея", "type_note")],
      [Markup.button.callback("🎯 Цель", "type_goal")],
    ]);

    return ctx.reply(
      "📋 *Что ты хочешь добавить?*\n\nВыбери тип записи, а затем отправь голосовое сообщение.",
      { parse_mode: "Markdown", ...keyboard }
    );
  });

  // ── Callback buttons — set type ──
  bot.action("type_task", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "task" });
    await ctx.editMessageText(
      "✅ *Задача*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Опиши что нужно сделать, когда и в какое время.\n" +
      "Примеры:\n" +
      '• _"Завтра в 9 утра совещание по проекту"_\n' +
      '• _"Сходить в спортзал и купить продукты"_\n' +
      '• _"В пятницу подготовить отчёт до 17:00"_',
      { parse_mode: "Markdown" }
    );
  });

  bot.action("type_note", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "note" });
    await ctx.editMessageText(
      "📝 *Заметка / Идея*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Расскажи о своей мысли, наблюдении или идее.\n" +
      "Примеры:\n" +
      '• _"У меня идея — сделать приложение для..."_\n' +
      '• _"Заметил что лучше всего работаю утром"_\n' +
      '• _"Подарить маме книгу на день рождения"_',
      { parse_mode: "Markdown" }
    );
  });

  bot.action("type_goal", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "goal" });
    await ctx.editMessageText(
      "🎯 *Цель*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Опиши свою цель, за какой период и чего хочешь достичь.\n" +
      "Примеры:\n" +
      '• _"За этот месяц выучить основы Python"_\n' +
      '• _"На этой неделе пробежать 20 километров"_\n' +
      '• _"За год запустить свой бизнес"_',
      { parse_mode: "Markdown" }
    );
  });

  // ── Voice message handler ──
  bot.on(message("voice"), async (ctx) => {
    const state = userState.get(ctx.from.id);
    if (!state) {
      return ctx.reply(
        "⚠️ Сначала выбери тип записи.\n\nНажми /add и выбери: Задача, Заметка или Цель."
      );
    }

    // Check account link
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply("🔗 Аккаунт не привязан. Зайди в настройки Trade Persona.");
    }

    const processingMsg = await ctx.reply("⏳ Обрабатываю голосовое сообщение...");

    try {
      // Download the voice file
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const response = await fetch(fileLink.toString());
      if (!response.ok) throw new Error("Failed to download voice file");
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Get user UTC offset for date context
      const settings = await (await import("./mongodb")).UserSettings?.findOne({ userId: user._id });
      const utcOffset = settings?.utcOffset ?? 2;

      // Send to Gemini AI
      const aiResult = await processVoiceWithAI(audioBuffer, state.type, utcOffset);

      // Save to database
      let savedNames: string[] = [];

      if (aiResult.type === "task" && aiResult.tasks?.length) {
        savedNames = await saveTasksToUser(user._id.toString(), aiResult.tasks);
      } else if (aiResult.type === "note" && aiResult.notes?.length) {
        savedNames = await saveNotesToUser(user._id.toString(), aiResult.notes);
      } else if (aiResult.type === "goal" && aiResult.goals?.length) {
        savedNames = await saveGoalsToUser(user._id.toString(), aiResult.goals);
      } else {
        throw new Error("ИИ не смог распознать запись. Попробуй ещё раз.");
      }

      // Clear user state
      userState.delete(ctx.from.id);

      // Delete "processing" message
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}

      // Send confirmation
      const confirmation = formatConfirmation(aiResult);
      await ctx.reply(
        confirmation + "\n\n_Данные синхронизированы с Trade Persona. Обнови страницу для просмотра._",
        { parse_mode: "Markdown" }
      );

    } catch (err: any) {
      console.error("[bot] Voice processing error:", err);
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}
      await ctx.reply(
        `❌ Ошибка обработки: ${err.message || "Неизвестная ошибка"}\n\nПопробуй отправить голосовое сообщение ещё раз.`
      );
    }
  });

  // ── /status — check link status ──
  bot.command("status", async (ctx) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (user) {
      return ctx.reply(`✅ Аккаунт привязан: *${user.email}*`, { parse_mode: "Markdown" });
    }
    return ctx.reply("❌ Аккаунт не привязан. Используй настройки Trade Persona для привязки.");
  });

  // ── /help ──
  bot.command("help", (ctx) => {
    return ctx.reply(
      "*📖 Команды бота:*\n\n" +
      "/add — Добавить запись (задача, заметка, цель)\n" +
      "/status — Проверить привязку аккаунта\n" +
      "/help — Показать это сообщение\n\n" +
      "*Как работает:*\n" +
      "1. Нажми /add\n" +
      "2. Выбери тип записи кнопкой\n" +
      "3. Отправь голосовое сообщение\n" +
      "4. ИИ проанализирует и создаст запись\n" +
      "5. Данные сохраняются в Trade Persona",
      { parse_mode: "Markdown" }
    );
  });

  // ── Handle text messages (not commands) ──
  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    return ctx.reply(
      "🎙 Я работаю с голосовыми сообщениями.\n\n" +
      "Нажми /add, выбери тип записи и отправь голосовое сообщение."
    );
  });

  return bot;
}

// ── Launch bot ──
export async function startBot() {
  const bot = createBot();
  if (!bot) return;

  try {
    await bot.launch();
    console.log("[bot] Telegram bot started successfully: @Personedge_bot");

    // Graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    console.error("[bot] Failed to start Telegram bot:", err);
  }
}

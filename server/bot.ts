import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, UserData } from "./mongodb";
import crypto from "crypto";

// ── Types ──
type RecordType = "task" | "note" | "goal";

export interface BotVoiceRecord {
  id: string;
  date: string;
  time: string;
  type: RecordType;
  titles: string[];
  messageId: number;
  chatId: number;
  createdAt: string;
}

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

// ── Main Menu Keyboard (Persistent Reply Keyboard) ──
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ["➕ Добавить запись", "📜 История ГС"],
    ["ℹ️ Статус аккаунта", "❓ Помощь"],
  ]).resize();
}

// ── Save Voice History metadata to MongoDB (No audio stored on server) ──
async function saveVoiceHistoryToUser(
  userId: string,
  record: {
    type: RecordType;
    titles: string[];
    messageId: number;
    chatId: number;
    utcOffset?: number;
  }
) {
  const userData = await UserData.findOne({ userId });
  if (!userData) return;

  const existingData = (userData.data as any) || {};
  const history: BotVoiceRecord[] = Array.isArray(existingData.botVoiceHistory)
    ? existingData.botVoiceHistory
    : [];

  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + (record.utcOffset ?? 2) * 3600000);
  const time = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;

  const newRecord: BotVoiceRecord = sanitizeMongoInput({
    id: crypto.randomUUID(),
    date: getTodayDate(record.utcOffset ?? 2),
    time,
    type: record.type,
    titles: record.titles,
    messageId: record.messageId,
    chatId: record.chatId,
    createdAt: now.toISOString(),
  });

  history.unshift(newRecord);
  if (history.length > 100) history.pop();

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, botVoiceHistory: history }, updatedAt: new Date() }
  );
}

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

function calculateGoalDates(
  type: "week" | "month" | "year",
  timeLimitType: "current_period" | "from_now" | "custom",
  utcOffset = 2
): { startDate: string; endDate: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const today = new Date(utc + utcOffset * 3600000);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const startDate = formatDate(today);

  if (timeLimitType === "from_now") {
    const end = new Date(today);
    if (type === "week") end.setDate(end.getDate() + 7);
    else if (type === "month") end.setMonth(end.getMonth() + 1);
    else if (type === "year") end.setFullYear(end.getFullYear() + 1);
    return { startDate, endDate: formatDate(end) };
  }

  // current_period
  const end = new Date(today);
  if (type === "week") {
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
    end.setDate(end.getDate() + (7 - dayOfWeek));
  } else if (type === "month") {
    end.setMonth(end.getMonth() + 1, 0);
  } else if (type === "year") {
    end.setMonth(11, 31);
  }
  return { startDate, endDate: formatDate(end) };
}

function getCalendarPeriod(type: "week" | "month" | "year", utcOffset = 2) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const today = new Date(utc + utcOffset * 3600000);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  if (type === "week") return { year, month, week };
  if (type === "month") return { year, month };
  return { year };
}

async function saveGoalsToUser(userId: string, goals: BotGoalResult[], utcOffset = 2): Promise<string[]> {
  const userData = await UserData.findOne({ userId });
  if (!userData) throw new Error("UserData not found");

  const existingData = (userData.data as any) || {};
  const existingGoals = Array.isArray(existingData.goals) ? existingData.goals : [];
  const existingTasks = Array.isArray(existingData.todayTasks) ? existingData.todayTasks : [];
  const createdTitles: string[] = [];

  for (const goal of goals) {
    const goalType = goal.goalType || "month";
    const timeLimitType = goal.timeLimitType || "current_period";
    const dates = calculateGoalDates(goalType, timeLimitType, utcOffset);
    const periods = getCalendarPeriod(goalType, utcOffset);
    const goalId = crypto.randomUUID();

    const planItems = (goal.plan || []).map(p => ({
      id: crypto.randomUUID(),
      text: p.text,
      done: !!p.done,
    }));

    const newGoal = sanitizeMongoInput({
      id: goalId,
      type: goalType,
      title: goal.title,
      category: goal.category || "Mind",
      completed: false,
      xp: xpForGoal(goalType),
      linkedTaskIds: [],
      description: goal.description || "",
      plan: planItems,
      timeLimitType,
      startDate: dates.startDate,
      endDate: dates.endDate,
      ...periods,
      status: "active",
    });

    existingGoals.push(newGoal);
    createdTitles.push(goal.title);

    // Create sub-tasks for todayTasks so they appear in "Пул под-задач недели"
    for (const item of planItems) {
      const subTask = sanitizeMongoInput({
        id: crypto.randomUUID(),
        name: item.text,
        description: `Под-задача цели «${goal.title}»`,
        category: goal.category || "Mind",
        difficulty: "medium",
        xp: 25,
        completed: item.done,
        date: "unassigned",
        type: "today",
        weekGoalId: goalType === "week" ? goalId : undefined,
        goalId: goalId,
        noDeadline: true,
      });
      existingTasks.push(subTask);
    }
  }

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, goals: existingGoals, todayTasks: existingTasks }, updatedAt: new Date() }
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

  // Set command menu in Telegram
  bot.telegram.setMyCommands([
    { command: "add", description: "➕ Добавить запись" },
    { command: "history", description: "📜 История голосовых сообщений" },
    { command: "status", description: "ℹ️ Статус аккаунта" },
    { command: "help", description: "❓ Помощь" },
  ]).catch(err => console.error("[bot] Error setting commands:", err));

  // ── Helper: Show Add Menu ──
  const showAddMenu = async (ctx: any) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply(
        "🔗 *Сначала привяжи свой аккаунт Trade Persona.*\n\n" +
        "Зайди в настройки на сайте → «Подключить Telegram».",
        { parse_mode: "Markdown", ...getMainMenuKeyboard() }
      );
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("✅ Задача", "type_task")],
      [Markup.button.callback("📝 Заметка / Идея", "type_note")],
      [Markup.button.callback("🎯 Цель", "type_goal")],
    ]);

    return ctx.reply(
      "📋 *Что ты хочешь добавить?*\n\nВыбери тип записи кнопкой ниже, а затем отправь голосовое сообщение.",
      { parse_mode: "Markdown", ...keyboard }
    );
  };

  // ── Helper: Show History ──
  const showHistory = async (ctx: any) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply("🔗 Аккаунт не привязан. Зайди в настройки Trade Persona.", getMainMenuKeyboard());
    }

    const userData = await UserData.findOne({ userId: user._id });
    const history: BotVoiceRecord[] = Array.isArray((userData?.data as any)?.botVoiceHistory)
      ? (userData?.data as any).botVoiceHistory
      : [];

    if (history.length === 0) {
      return ctx.reply(
        "📜 *История голосовых записей пуста.*\n\n" +
        "Нажми *➕ Добавить запись* и отправь первое голосовое сообщение!",
        { parse_mode: "Markdown", ...getMainMenuKeyboard() }
      );
    }

    // Group history entries by Date
    const grouped: Record<string, BotVoiceRecord[]> = {};
    for (const item of history.slice(0, 15)) {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    }

    await ctx.reply(
      "📜 *История созданных записей голосом:*\n\n" +
      "_Нажми на кнопку «🎧 Переслушать», чтобы подсветить ГС в чате._",
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
    );

    const typeLabels: Record<RecordType, string> = {
      task: "📌 Задача",
      note: "📝 Заметка",
      goal: "🎯 Цель",
    };

    for (const [date, records] of Object.entries(grouped)) {
      let text = `📅 *${date}*\n`;

      for (const rec of records) {
        const titleStr = rec.titles.join(", ");
        text += `• 🕒 *${rec.time}* | ${typeLabels[rec.type] || "📌"}: *${titleStr}*\n`;
      }

      // Build inline buttons for each voice in this date
      const inlineButtons = records.map(rec => [
        Markup.button.callback(`🎧 Переслушать ГС (${rec.time})`, `play_voice_${rec.messageId}`)
      ]);

      await ctx.reply(text, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(inlineButtons),
      });
    }
  };

  // ── Helper: Show Status ──
  const showStatus = async (ctx: any) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (user) {
      return ctx.reply(`✅ *Аккаунт привязан:* \`${user.email}\``, {
        parse_mode: "Markdown",
        ...getMainMenuKeyboard(),
      });
    }
    return ctx.reply(
      "❌ *Аккаунт не привязан.*\n\nЗайди в настройки Trade Persona на сайте и нажми «Подключить Telegram».",
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
    );
  };

  // ── Helper: Show Help ──
  const showHelp = async (ctx: any) => {
    return ctx.reply(
      "*📖 Инструкция по работе с ботом:*\n\n" +
      "1. Нажми кнопку *➕ Добавить запись*\n" +
      "2. Выбери тип (*Задача*, *Заметка* или *Цель*)\n" +
      "3. Запиши и отправь голосовое сообщение\n" +
      "4. ИИ распознает контекст, время и даты, и добавит запись в твой аккаунт Trade Persona!\n\n" +
      "📜 *История ГС*: просмотр созданных записей с возможностью переслушать оригинал прямо в чате.",
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
    );
  };

  // ── Action: Play voice by message ID ──
  bot.action(/^play_voice_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const msgId = parseInt(ctx.match[1], 10);
    try {
      await ctx.reply("🎧 *Вот твоё голосовое сообщение:*", {
        reply_to_message_id: msgId,
        parse_mode: "Markdown",
      } as any);
    } catch {
      await ctx.reply("⚠️ Не удалось найти исходное голосовое сообщение в этом чате.");
    }
  });

  // ── /start — account linking & welcome ──
  bot.start(async (ctx) => {
    const linkToken = ctx.startPayload;

    if (linkToken) {
      try {
        const user = await User.findOne({
          telegramLinkToken: linkToken,
          telegramLinkExpires: { $gt: new Date() },
        });

        if (!user) {
          return ctx.reply(
            "❌ Ссылка недействительна или истекла. Сгенерируй новую в настройках Trade Persona.",
            getMainMenuKeyboard()
          );
        }

        const existingLink = await User.findOne({ telegramId: String(ctx.from.id) });
        if (existingLink && existingLink._id.toString() !== user._id.toString()) {
          return ctx.reply(
            "⚠️ Этот Telegram аккаунт уже привязан к другому аккаунту Trade Persona.",
            getMainMenuKeyboard()
          );
        }

        await User.findByIdAndUpdate(user._id, {
          telegramId: String(ctx.from.id),
          telegramLinkToken: null,
          telegramLinkExpires: null,
        });

        return ctx.reply(
          `✅ *Аккаунт успешно привязан!*\n\nТвой Telegram связан с аккаунтом \`${user.email}\`.\n\nИспользуй меню снизу для добавления записей!`,
          { parse_mode: "Markdown", ...getMainMenuKeyboard() }
        );
      } catch (err) {
        console.error("[bot] Link error:", err);
        return ctx.reply("❌ Ошибка при привязке аккаунта. Попробуй позже.", getMainMenuKeyboard());
      }
    }

    return ctx.reply(
      `👋 *Привет! Я бот Trade Persona.*\n\n` +
      `Я помогу тебе быстро добавлять задачи, заметки и цели голосом.\n\n` +
      `Используй кнопки внизу экрана!`,
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
    );
  });

  // ── Commands and Reply Keyboard buttons ──
  bot.command("add", showAddMenu);
  bot.command("history", showHistory);
  bot.command("status", showStatus);
  bot.command("help", showHelp);

  // ── Inline callback buttons — set record type ──
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
        "⚠️ Сначала выбери тип записи.\n\nНажми *➕ Добавить запись* в меню снизу.",
        { parse_mode: "Markdown", ...getMainMenuKeyboard() }
      );
    }

    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply("🔗 Аккаунт не привязан. Зайди в настройки Trade Persona.", getMainMenuKeyboard());
    }

    const processingMsg = await ctx.reply("⏳ Обрабатываю голосовое сообщение...");

    try {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const response = await fetch(fileLink.toString());
      if (!response.ok) throw new Error("Failed to download voice file");
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      const settings = await (await import("./mongodb")).UserSettings?.findOne({ userId: user._id });
      const utcOffset = settings?.utcOffset ?? 2;

      const aiResult = await processVoiceWithAI(audioBuffer, state.type, utcOffset);

      let savedNames: string[] = [];

      if (aiResult.type === "task" && aiResult.tasks?.length) {
        savedNames = await saveTasksToUser(user._id.toString(), aiResult.tasks);
      } else if (aiResult.type === "note" && aiResult.notes?.length) {
        savedNames = await saveNotesToUser(user._id.toString(), aiResult.notes);
      } else if (aiResult.type === "goal" && aiResult.goals?.length) {
        savedNames = await saveGoalsToUser(user._id.toString(), aiResult.goals, utcOffset);
      } else {
        throw new Error("ИИ не смог распознать запись. Попробуй ещё раз.");
      }

      // Save Voice Entry metadata into history for user
      await saveVoiceHistoryToUser(user._id.toString(), {
        type: state.type,
        titles: savedNames,
        messageId: ctx.message.message_id,
        chatId: ctx.chat.id,
        utcOffset,
      });

      userState.delete(ctx.from.id);

      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}

      const confirmation = formatConfirmation(aiResult);
      const playbackKb = Markup.inlineKeyboard([
        [Markup.button.callback("🎧 Переслушать ГС", `play_voice_${ctx.message.message_id}`)]
      ]);

      await ctx.reply(
        confirmation + "\n\n_Данные синхронизированы с Trade Persona._",
        { parse_mode: "Markdown", ...playbackKb }
      );

    } catch (err: any) {
      console.error("[bot] Voice processing error:", err);
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}
      await ctx.reply(
        `❌ Ошибка обработки: ${err.message || "Неизвестная ошибка"}\n\nПопробуй отправить голосовое сообщение ещё раз.`,
        getMainMenuKeyboard()
      );
    }
  });

  // ── Reply Keyboard Text Handler ──
  bot.on(message("text"), async (ctx) => {
    const txt = ctx.message.text.trim();
    if (txt === "➕ Добавить запись") return showAddMenu(ctx);
    if (txt === "📜 История ГС") return showHistory(ctx);
    if (txt === "ℹ️ Статус аккаунта") return showStatus(ctx);
    if (txt === "❓ Помощь") return showHelp(ctx);
    if (txt.startsWith("/")) return;

    return ctx.reply(
      "🎙 Выбери действие из меню снизу или нажми *➕ Добавить запись*.",
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
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

    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    console.error("[bot] Failed to start Telegram bot:", err);
  }
}

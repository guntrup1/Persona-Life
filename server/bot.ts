import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, UserData } from "./mongodb";
import crypto from "crypto";

// ── Types ──
type RecordType = "task" | "note" | "goal" | "trading_note";

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
  weekGoalTitle?: string;
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
  timeLimitType?: "current_period" | "next_period" | "from_now" | "custom";
  parentGoalTitle?: string;
}

interface BotTradingNoteResult {
  title: string;
  text: string;
  asset: "GER40" | "EUR" | "XAU" | "GBP";
  timeframe: string;
  tag: "мысль" | "идея" | "ошибка";
  isTradingIdea: boolean;
}

interface AIResponse {
  type: RecordType;
  tasks?: BotTaskResult[];
  notes?: BotNoteResult[];
  goals?: BotGoalResult[];
  trading_notes?: BotTradingNoteResult[];
}

// ── State: track which type the user selected ──
const userState = new Map<number, { type: RecordType; messageId?: number; promptMessageId?: number }>();

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
function buildPrompt(
  recordType: RecordType,
  utcOffset = 2,
  activeGoals: Array<{ id: string; title: string; type: string; category: string }> = []
): string {
  const today = getTodayDate(utcOffset);
  const tomorrow = getTomorrowDate(utcOffset);
  const dayOfWeek = getDayOfWeek(utcOffset);

  const VALID_CATEGORIES = "Body, Mind, Hard Skills, Soft Skills, Creativity, Mission, Finance";

  const goalsContext = activeGoals && activeGoals.length > 0
    ? `\n━━━ СУЩЕСТВУЮЩИЕ АКТИВНЫЕ ЦЕЛИ ПОЛЬЗОВАТЕЛЯ ━━━\n` +
      activeGoals.map(g => `• [${g.type.toUpperCase()}] "${g.title}" (Категория: ${g.category})`).join("\n") + "\n"
    : "";

  const baseContext = `
Ты — высококвалифицированный ИИ-ассистент приложения Trade Persona.
Задача: точно анализировать голосовые сообщения и превращать их в структурированные данные.
Текущая дата: ${today} (${dayOfWeek}). Часовой пояс: UTC+${utcOffset}. Завтра: ${tomorrow}.
${goalsContext}
━━━ СТРОГИЕ ПРАВИЛА ИЕРАРХИИ И СВЯЗЫВАНИЯ ━━━
⚠️ ПО УМОЛЧАНИЮ ЗАДАЧИ НЕ ПРИВЯЗЫВАЮТСЯ! Обычные дневные задачи (быт, звонки, покупки, разовые мелкие дела) ДОЛЖНЫ ОСТАВАТЬСЯ САМОСТОЯТЕЛЬНЫМИ (без привязки к целям!).

Привязка производится ТОЛЬКО при ЧЁТКОМ И ОДНОЗНАЧНОМ контекстуальном соответствии:
1. ДНЕВНЫЕ ЗАДАЧИ → НЕДЕЛЬНАЯ ЦЕЛЬ:
   — Указывай "weekGoalTitle" ТОЛЬКО если пользователь прямо озвучил связь ("для цели X сделать Y") или контекст однозначно указывает, что это подпункт именно этой недельной цели.
   — Бытовые дела ("купить продукты", "помыть машину", "позвонить маме", "забрать посылку") — НЕ ПРИВЯЗЫВАЙ к целям! Оставляй "weekGoalTitle" пустым.
   — Дневные задачи привязываются ТОЛЬКО к недельной цели (не к месячной/годовой)!

2. НЕДЕЛЬНЫЕ ЦЕЛИ → МЕСЯЧНАЯ ЦЕЛЬ:
   — Указывай "parentGoalTitle" ТОЛЬКО если недельная цель является очевидным этапом этой месячной цели.
   — Недельные цели привязываются ТОЛЬКО к месячным целям!

3. МЕСЯЧНЫЕ ЦЕЛИ → ГОДОВАЯ ЦЕЛЬ:
   — Указывай "parentGoalTitle" ТОЛЬКО если месячная цель является этапом годовой цели.
   — Месячные цели привязываются ТОЛЬКО к годовым целям!

4. ГОДОВЫЕ ЦЕЛИ: не имеют родительских целей.

━━━ ПРАВИЛА РАСПОЗНАВАНИЯ ДАТ ━━━
• "завтра" → ${tomorrow}
• "послезавтра" → дата +2 дня от ${today}
• "в понедельник/вторник/..." → ближайший такой день ПОСЛЕ ${today}
• "на следующей неделе" → понедельник–воскресенье СЛЕДУЮЩЕЙ недели (не +7 дней!)
• "в следующем месяце" → 1-е–последнее число следующего месяца
• "10-го числа" (без месяца) → 10-е текущего месяца если не прошло, иначе следующего
• "на этой неделе" / "в этом месяце" → до конца текущего периода
• "с этого момента на X дней/недель" → от ${today} + X

ФОРМАТ ОТВЕТА: СТРОГО JSON, без markdown, без \`\`\`, только чистый JSON.
`;

  if (recordType === "task") {
    return `${baseContext}
━━━ ТЫ СОЗДАЁШЬ ЗАДАЧИ ━━━
Пользователь зафиксировал одно или несколько дел/действий в голосовом сообщении.

⚠️ ВАЖНО — АНАЛИЗ МНОГОЗАДАЧНОСТИ И ВРЕМЕННЫХ УКАЗАНИЙ:
1. Если пользователь нажал "Задачи на день", но в голосе одновременно проговорил дела на сегодня И дела на будущее (завтра, на следующей неделе, в следующем месяце):
   — Для дел на сегодня: создай задачи с date: "${today}".
   — Для дел на будущее:
       а) Если указана конкретная дата/период ("на следующей неделе X") → создай эту задачу на дату той будущей недели (понедельник той недели YYYY-MM-DD).
       б) Если пользователь сформулировал это как напоминание для себя ("напомни на следующей неделе запланировать X") → создай задачу на сегодня ("Запланировать на следующую неделю: X") ИЛИ создай саму задачу на будущую неделю.
   — КРИТИЧЕСКИ ВАЖНО: Ни одна деталь и ни одно поручение из голоса не должны быть потеряны!
2. Каждая озвученная мысль или поручение должны превратиться в отдельную чёткую задачу.

Для КАЖДОЙ задачи определи:
- name: лаконичное название (2-5 слов), начни с глагола действия
- description: подробности из контекста (если озвучены)
- category: одна из [${VALID_CATEGORIES}]
- difficulty:
    "low" = простое рутинное дело (<30 мин, не требует усилий)
    "medium" = требует усилий или внимания (30мин–2ч)
    "high" = сложная или многоэтапная задача (>2ч или требует подготовки)
- date: YYYY-MM-DD (точная дата из контекста, если "на следующей неделе" → понедельник следующей недели; по умолчанию "${today}")
- startTime: HH:MM если указано конкретное время
- endTime: HH:MM (если есть startTime и нет endTime → +1 час)
- noDeadline: true если нет конкретного времени начала
- weekGoalTitle: название существующей или новой недельной цели (УКАЗЫВАЙ ТОЛЬКО при явной прямой связи! Для обычных бытовых дел НЕ УКАЗЫВАЙ!)

ФОРМАТ:
{
  "type": "task",
  "tasks": [
    {
      "name": "...",
      "description": "...",
      "category": "...",
      "difficulty": "low" | "medium" | "high",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "noDeadline": true,
      "weekGoalTitle": "..."
    }
  ]
}`;
  }

  if (recordType === "note") {
    return `${baseContext}
━━━ ТЫ СОЗДАЁШЬ ЗАМЕТКИ И ИДЕИ ━━━

⚠️ ВАЖНО — АНАЛИЗ СМЕШАННЫХ И ТОРГОВЫХ ЗАМЕТОК:
В одном голосовом сообщении пользователь может озвучить КАК обычную заметку/идею, ТАК И торговую заметку/идею (или несколько тех и других)!
Твоя задача — разделить их и вернуть ВСЕ обнаруженные записи в соответствующих массивах ("notes" и "trading_notes").

• ТОРГОВАЯ ЗАМЕТКА ("trading_notes"):
  Если упоминаются трейдинг-термины: Order Block (OB), FVG, iFVG, CISD, shift, BOS, CHoCH, sweep, imbalance, buy/sell, long/short, стоп-лосс, тейк-профит, тайм-фреймы (M1, M5, M15, H1, H4, D1), активы (GER40, EUR, XAU, GBP), торговля на бирже.

• ОБЫЧНАЯ ЗАМЕТКА / ИДЕЯ ("notes"):
  Любые мысли, идеи (подарки, хобби, учеба), заметки, наблюдения не связанные с анализом финансовых рынков.

ФОРМАТ (верни все заполненные массивы, которые есть в голосе):
{
  "type": "note",
  "notes": [
    {
      "title": "краткий заголовок (3-8 слов)",
      "content": "содержание заметки",
      "noteType": "note" | "idea",
      "ideaCategory": "gift" | "hobby" | "study" | "other"
    }
  ],
  "trading_notes": [
    {
      "title": "заголовок сетапа/мысли",
      "text": "содержание торгового анализа/идеи",
      "asset": "GER40" | "EUR" | "XAU" | "GBP",
      "timeframe": "M15" | "H1" | "H4" | "D1" | "M5" | "M30" | "W1",
      "tag": "мысль" | "идея" | "ошибка",
      "isTradingIdea": true (если это сетап/торговая идея) | false (если наблюдение/ошибка)
    }
  ]
}`;
  }

  // goal
  return `${baseContext}
━━━ ТЫ СОЗДАЁШЬ ЦЕЛИ ━━━

📏 АНАЛИЗ МАСШТАБА — КЛЮЧЕВОЙ ШАГ:
Прежде чем создавать цели, оцени МАСШТАБ и ПРИРОДУ каждого элемента из голоса:

▶ ОДНА УКРУПНЁННАЯ ЦЕЛЬ (группируй несколько пунктов в одну цель):
  — Когда несколько дел объединяет одна ТЕМА (напр: "заняться документами", "сходить в банк", "позвонить врачу" → одна цель "Решить бытовые вопросы" с подпунктами)
  — Когда дела похожи по масштабу и относятся к одной жизненной сфере
  — Признак: дела звучат как пункты одного списка, а не самостоятельные направления

▶ ОТДЕЛЬНАЯ ЦЕЛЬ (создавай отдельную):
  — Когда дело САМО ПО СЕБЕ масштабное, многоуровневое, требует длительной работы (напр: "изучить Python", "запустить бизнес", "выстроить режим питания")
  — Когда дело в совершенно разных сферах жизни и не связаны между собой
  — Признак: достижение требует нескольких дней работы, планирования, подготовки

▶ ПОДПУНКТЫ ЦЕЛИ (plan) — добавляй ТОЛЬКО если:
  1. Пользователь ЯВНО назвал конкретные шаги в голосе
  2. ИЛИ: цель сформирована через группировку нескольких дел — тогда эти дела становятся подпунктами
  — НИКОГДА не придумывай подпункты от себя, если они не упомянуты в голосе!
  — Если шаги не названы явно и цель не составная — верни plan: []

ПРИМЕРЫ ПРАВИЛЬНОГО ОПРЕДЕЛЕНИЯ:
✅ "Разобраться с Deutschlandticket, переоформить карту Sparkasse, сходить к врачу" →
   ОДНА цель "Решить организационные вопросы" [Finance/Mind] с подпунктами: [Deutschlandticket, карта Sparkasse, врач]
✅ "Разобраться с питанием" (без деталей) →
   ОДНА цель "Разобраться с питанием" [Body], plan: [] (нет явных шагов)
✅ "Сходить с девушкой в кино" (без уточнения фильма) →
   ОДНА цель "Сходить в кино" [Soft Skills], plan: [{text: "Выбрать фильм и сеанс", done: false}]
   (Этот подпункт очевиден из контекста — без выбора фильма цель невозможна)
✅ "Сходить к врачу, купить билет на концерт, сделать тренировку" →
   Это 3 ОТДЕЛЬНЫЕ задачи, а НЕ цели — они разовые дела, не требуют недельной работы.
   → Сообщи: эти пункты больше похожи на ЗАДАЧИ, а не цели. Всё равно создай их как цели если пользователь выбрал тип "goal".

━━━ ВРЕМЕННЫЕ ГРАНИЦЫ ━━━
- "current_period" (по умолчанию) — "на этой неделе", "в этом месяце", без уточнения
- "next_period" — "на следующей неделе", "в следующем месяце", "в следующем году"
- "from_now" — "с этого момента на X дней", "на неделю от сегодня"

Определи для КАЖДОЙ ЦЕЛИ:
- title: чёткая формулировка (3-10 слов)
- category: одна из [${VALID_CATEGORIES}]
- goalType: "week" | "month" | "year" (по масштабу и времени)
- description: детальное описание цели и ожидаемого результата
- plan: [{text, done}] (ТОЛЬКО явно названные шаги ИЛИ пункты составной цели, иначе [])
- timeLimitType: "current_period" | "next_period" | "from_now"
- parentGoalTitle: название существующей родительской цели (для week → название month цели; для month → название year цели)

ФОРМАТ:
{
  "type": "goal",
  "goals": [
    {
      "title": "...",
      "category": "...",
      "goalType": "week" | "month" | "year",
      "description": "...",
      "plan": [],
      "timeLimitType": "current_period" | "next_period" | "from_now",
      "parentGoalTitle": "..."
    }
  ]
}`;
}

// ── Process voice with Gemini ──
async function processVoiceWithAI(
  audioBuffer: Buffer,
  recordType: RecordType,
  utcOffset = 2,
  activeGoals: Array<{ id: string; title: string; type: string; category: string }> = []
): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = buildPrompt(recordType, utcOffset, activeGoals);

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
  const existingGoals = Array.isArray(existingData.goals) ? existingData.goals : [];
  const createdNames: string[] = [];

  for (const task of tasks) {
    // Find matching active week goal if weekGoalTitle is specified
    let matchedWeekGoalId: string | undefined = undefined;
    if (task.weekGoalTitle) {
      const searchTitle = task.weekGoalTitle.trim().toLowerCase();
      const matchedGoal = existingGoals.find((g: any) =>
        g.type === "week" &&
        g.status !== "completed" &&
        (g.title.toLowerCase().includes(searchTitle) || searchTitle.includes(g.title.toLowerCase()))
      );
      if (matchedGoal) matchedWeekGoalId = matchedGoal.id;
    }

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
      weekGoalId: matchedWeekGoalId,
      goalId: matchedWeekGoalId,
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
  timeLimitType: "current_period" | "next_period" | "from_now" | "custom",
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

  if (timeLimitType === "next_period") {
    if (type === "week") {
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
      const nextMon = new Date(today);
      nextMon.setDate(today.getDate() + (8 - dayOfWeek)); // Next Monday
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6); // Next Sunday
      return { startDate: formatDate(nextMon), endDate: formatDate(nextSun) };
    }
    if (type === "month") {
      const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthLast = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { startDate: formatDate(nextMonthFirst), endDate: formatDate(nextMonthLast) };
    }
    if (type === "year") {
      const nextYearFirst = new Date(today.getFullYear() + 1, 0, 1);
      const nextYearLast = new Date(today.getFullYear() + 1, 11, 31);
      return { startDate: formatDate(nextYearFirst), endDate: formatDate(nextYearLast) };
    }
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
    const timeLimitType = (goal.timeLimitType as any) || "current_period";
    const dates = calculateGoalDates(goalType, timeLimitType, utcOffset);
    const periods = getCalendarPeriod(goalType, utcOffset);
    const goalId = crypto.randomUUID();

    // Strict Hierarchy Parent Linking:
    // Week goal -> Month goal parent
    // Month goal -> Year goal parent
    let parentId: string | undefined = undefined;
    if (goal.parentGoalTitle) {
      const parentSearch = goal.parentGoalTitle.trim().toLowerCase();
      const expectedParentType = goalType === "week" ? "month" : goalType === "month" ? "year" : undefined;
      if (expectedParentType) {
        const parentMatch = existingGoals.find((g: any) =>
          g.type === expectedParentType &&
          g.status !== "completed" &&
          (g.title.toLowerCase().includes(parentSearch) || parentSearch.includes(g.title.toLowerCase()))
        );
        if (parentMatch) parentId = parentMatch.id;
      }
    }

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
      parentId,
      description: goal.description || "",
      plan: [], // Avoid duplicates — sub-tasks go into todayTasks
      timeLimitType: timeLimitType === "next_period" ? "custom" : timeLimitType,
      startDate: dates.startDate,
      endDate: dates.endDate,
      ...periods,
      status: "active",
    });

    existingGoals.push(newGoal);
    createdTitles.push(goal.title);

    // If user explicitly stated sub-tasks in voice, add them to todayTasks
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

// ── Save Trading Note to MongoDB ──
async function saveTradingNoteToUser(userId: string, notes: BotTradingNoteResult[], utcOffset = 2): Promise<string[]> {
  const userData = await UserData.findOne({ userId });
  if (!userData) throw new Error("UserData not found");

  const existingData = (userData.data as any) || {};
  const existingNotes = Array.isArray(existingData.tradingNotes) ? existingData.tradingNotes : [];
  const createdTitles: string[] = [];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + utcOffset * 3600000);
  const todayStr = getTodayDate(utcOffset);
  const timeStr = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;

  for (const note of notes) {
    // Normalize asset — default to GER40 if unrecognized
    const validAssets = ["GER40", "EUR", "XAU", "GBP"];
    const asset = validAssets.includes(note.asset) ? note.asset : "GER40";
    // Normalize tag
    const validTags = ["мысль", "идея", "ошибка"];
    const tag = validTags.includes(note.tag) ? note.tag : "мысль";

    const newNote = sanitizeMongoInput({
      id: crypto.randomUUID(),
      title: note.title || "Торговая заметка",
      time: timeStr,
      asset,
      timeframe: note.timeframe || "H1",
      tag,
      text: note.text || "",
      date: todayStr,
      createdAt: now.toISOString(),
      isTradingIdea: !!note.isTradingIdea,
      tradingIdeaDone: false,
    });
    existingNotes.push(newNote);
    createdTitles.push(note.title || "Торговая заметка");
  }

  await UserData.findOneAndUpdate(
    { userId },
    { data: { ...existingData, tradingNotes: existingNotes }, updatedAt: new Date() }
  );

  return createdTitles;
}

// ── Format confirmation message ──
function formatConfirmation(aiResult: AIResponse): string {
  const parts: string[] = [];

  if (aiResult.tasks?.length) {
    const lines = aiResult.tasks.map((t) => {
      let line = `📌 *${t.name}*`;
      if (t.description) line += `\n   ${t.description}`;
      line += `\n   📅 ${t.date}`;
      if (t.startTime) line += ` | ⏰ ${t.startTime}`;
      if (t.endTime) line += `–${t.endTime}`;
      line += `\n   📂 ${t.category} | ${t.difficulty === "high" ? "🔴" : t.difficulty === "medium" ? "🟡" : "🟢"} ${t.difficulty}`;
      return line;
    });
    parts.push(`*Задачи (${aiResult.tasks.length}):*\n${lines.join("\n\n")}`);
  }

  if (aiResult.notes?.length) {
    const lines = aiResult.notes.map(n => {
      let line = `📝 *${n.title}*`;
      if (n.content) line += `\n   ${n.content.slice(0, 120)}${n.content.length > 120 ? "..." : ""}`;
      line += `\n   ${n.noteType === "idea" ? "💡 Идея" : "📓 Заметка"}`;
      return line;
    });
    parts.push(`*Заметки (${aiResult.notes.length}):*\n${lines.join("\n\n")}`);
  }

  if (aiResult.trading_notes?.length) {
    const lines = aiResult.trading_notes.map(n => {
      let line = `📈 *${n.title}*`;
      line += `\n   ${n.text.slice(0, 120)}${n.text.length > 120 ? "..." : ""}`;
      line += `\n   🎯 ${n.asset} | ⏱ ${n.timeframe} | ${n.tag === "ошибка" ? "❌" : n.tag === "идея" ? "💡" : "💭"} ${n.tag}`;
      if (n.isTradingIdea) line += " | ⭐ Торговая идея";
      return line;
    });
    parts.push(`*Торговые заметки (${aiResult.trading_notes.length}):*\n${lines.join("\n\n")}`);
  }

  if (aiResult.goals?.length) {
    const lines = aiResult.goals.map(g => {
      let line = `🎯 *${g.title}*`;
      if (g.description) line += `\n   ${g.description.slice(0, 120)}${g.description.length > 120 ? "..." : ""}`;
      line += `\n   📂 ${g.category} | ⏳ ${g.goalType === "week" ? "Неделя" : g.goalType === "month" ? "Месяц" : "Год"}`;
      if (g.plan?.length) {
        line += `\n   План (${g.plan.length} пунктов):`;
        g.plan.slice(0, 4).forEach(p => {
          line += `\n     ◻️ ${p.text}`;
        });
        if (g.plan.length > 4) line += `\n     ...ещё ${g.plan.length - 4}`;
      }
      return line;
    });
    parts.push(`*Цели (${aiResult.goals.length}):*\n${lines.join("\n\n")}`);
  }

  if (parts.length === 0) return "✅ Запись сохранена!";
  return `✅ *Запись сохранена!*\n\n${parts.join("\n\n───────────────────\n\n")}`;
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

    const prevState = userState.get(ctx.from.id);
    if (prevState?.promptMessageId) {
      ctx.telegram.deleteMessage(ctx.chat.id, prevState.promptMessageId).catch(() => {});
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📌 Задачи на день", "type_task")],
      [Markup.button.callback("🎯 Цели на неделю/месяц", "type_goal")],
      [Markup.button.callback("📝 Заметка / Идея", "type_note")],
    ]);

    const msg = await ctx.reply(
      "📋 *Что ты хочешь добавить?*\n\nВыбери тип записи кнопкой ниже, а затем отправь голосовое сообщение.",
      { parse_mode: "Markdown", ...keyboard }
    );

    userState.set(ctx.from.id, { type: "task", promptMessageId: msg.message_id });
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
      trading_note: "📈 Торговая заметка",
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
    userState.set(ctx.from!.id, { type: "task", promptMessageId: ctx.callbackQuery.message?.message_id });
    await ctx.editMessageText(
      "📌 *Задачи на день*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Опиши дела на сегодня или на ближайшие дни.\n" +
      "Примеры:\n" +
      '• _"Сделать отчет по проекту сегодня, а на следующей неделе подготовить презентацию"_\n' +
      '• _"Завтра в 9 утра совещание по проекту"_\n' +
      '• _"Сходить в спортзал и купить продукты"_',
      { parse_mode: "Markdown" }
    );
  });

  bot.action("type_note", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "note", promptMessageId: ctx.callbackQuery.message?.message_id });
    await ctx.editMessageText(
      "📝 *Заметка / Идея*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Расскажи о своей мысли, наблюдении, торговом сетапе или идее.\n" +
      "Примеры:\n" +
      '• _"M15 Order Flow от H4 POI по GER40, входить при снятии ликвидности"_\n' +
      '• _"У меня идея — сделать приложение для..."_\n' +
      '• _"Подарить маме книгу на день рождения"_',
      { parse_mode: "Markdown" }
    );
  });

  bot.action("type_goal", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "goal", promptMessageId: ctx.callbackQuery.message?.message_id });
    await ctx.editMessageText(
      "🎯 *Цели на неделю/месяц*\n\n🎙 Отправь голосовое сообщение.\n\n" +
      "Опиши свою цель, за какой период и чего хочешь достичь.\n" +
      "Примеры:\n" +
      '• _"За этот месяц выучить основы Python"_\n' +
      '• _"На следующей неделе пробежать 20 километров"_\n' +
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

      // Fetch active goals to pass to AI for smart linking
      const userData = await UserData.findOne({ userId: user._id });
      const rawGoals = Array.isArray((userData?.data as any)?.goals) ? (userData?.data as any).goals : [];
      const activeGoals = rawGoals
        .filter((g: any) => g.status !== "completed")
        .map((g: any) => ({ id: g.id, title: g.title, type: g.type, category: g.category }));

      const aiResult = await processVoiceWithAI(audioBuffer, state.type, utcOffset, activeGoals);

      let savedNames: string[] = [];

      if (aiResult.tasks?.length) {
        const tNames = await saveTasksToUser(user._id.toString(), aiResult.tasks);
        savedNames.push(...tNames);
      }
      if (aiResult.notes?.length) {
        const nNames = await saveNotesToUser(user._id.toString(), aiResult.notes);
        savedNames.push(...nNames);
      }
      if (aiResult.trading_notes?.length) {
        const trNames = await saveTradingNoteToUser(user._id.toString(), aiResult.trading_notes, utcOffset);
        savedNames.push(...trNames);
      }
      if (aiResult.goals?.length) {
        const gNames = await saveGoalsToUser(user._id.toString(), aiResult.goals, utcOffset);
        savedNames.push(...gNames);
      }

      if (savedNames.length === 0) {
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

      // Auto-clean Telegram Chat: delete intermediate processing & prompt selection messages
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id);
      } catch {}
      if (state.promptMessageId) {
        try {
          await ctx.telegram.deleteMessage(ctx.chat.id, state.promptMessageId);
        } catch {}
      }

      userState.delete(ctx.from.id);

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

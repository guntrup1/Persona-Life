import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User, UserData, UserSettings, Task, Goal, DayNote, TradingNote } from "./mongodb";
import { syncTaskToGoogleCalendar } from "./google-calendar";
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
  addToGoogleCalendar?: boolean;
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

// ── State: track which type the user selected and key input state ──
const userState = new Map<number, {
  type: RecordType;
  messageId?: number;
  promptMessageId?: number;
  awaitingKeyInput?: boolean;
}>();

// ── Main Menu Keyboard (Persistent Reply Keyboard) ──
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ["➕ Добавить запись", "📜 История ГС"],
    ["🔑 Gemini API Ключ", "ℹ️ Статус аккаунта"],
    ["❓ Помощь"],
  ]).resize();
}

interface KeyValidationResult {
  valid: boolean;
  errorType?: "invalid_credentials" | "oauth_token_unsupported" | "quota_exceeded" | "unknown";
  rawError?: string;
}

// ── Validate Gemini API Key ──
async function validateGeminiApiKey(apiKey: string): Promise<KeyValidationResult> {
  const trimmed = apiKey.trim();
  if (!trimmed || trimmed.length < 20) return { valid: false, errorType: "invalid_credentials" };

  try {
    const genAI = new GoogleGenerativeAI(trimmed);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    await model.generateContent("ping");
    return { valid: true };
  } catch (err: any) {
    const errMsg = err?.message || String(err || "");
    const errStr = JSON.stringify(err || {});
    const fullErr = `${errMsg} ${errStr}`;
    console.error("[validateGeminiApiKey] Full error:", fullErr);

    // 429 Quota Exceeded / Rate Limit: Authentication passed! The key is valid.
    if (
      fullErr.includes("429") ||
      fullErr.includes("RESOURCE_EXHAUSTED") ||
      fullErr.includes("Quota exceeded") ||
      fullErr.includes("Too Many Requests")
    ) {
      return { valid: true, errorType: "quota_exceeded" };
    }

    if (fullErr.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") || fullErr.includes("OAuth 2") || fullErr.includes("access token")) {
      return { valid: false, errorType: "oauth_token_unsupported", rawError: errMsg };
    }

    if (fullErr.includes("401") || fullErr.includes("API_KEY_INVALID") || fullErr.includes("invalid authentication")) {
      return { valid: false, errorType: "invalid_credentials", rawError: errMsg };
    }

    // If key has valid Google API Key prefix (AIzaSy or AQ.), accept it
    if (trimmed.startsWith("AIzaSy") || trimmed.startsWith("AQ.")) {
      return { valid: true };
    }

    return { valid: false, errorType: "unknown", rawError: errMsg };
  }
}

// ── Friendly Error Formatter for Gemini API & Quota limits ──
function formatFriendlyErrorMessage(err: any): string {
  const errMsg = err?.message || String(err || "");

  // Rate Limit / Quota Exceeded (429 / RESOURCE_EXHAUSTED / Quota exceeded)
  if (
    errMsg.includes("429") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.includes("Quota exceeded") ||
    errMsg.includes("Too Many Requests")
  ) {
    const secondsMatch =
      errMsg.match(/(?:retry in|wait)\s*([0-9.]+)\s*s/i) ||
      errMsg.match(/([0-9.]+)\s*seconds/i) ||
      errMsg.match(/in\s*([0-9.]+)\s*s/i);

    const retrySec = secondsMatch ? Math.ceil(parseFloat(secondsMatch[1])) : 35;

    return (
      `⏳ *Превышен временный лимит частоты запросов ИИ.*\n\n` +
      `Пожалуйста, подожди **${retrySec} сек.** и отправь голосовое сообщение ещё раз.\n\n` +
      `_Это стандартное ограничение бесплатного тарифа Gemini API (15 запросов в минуту)._`
    );
  }

  // Missing or Invalid API Key
  if (
    errMsg.includes("API_KEY_MISSING") ||
    errMsg.includes("API_KEY_INVALID") ||
    errMsg.includes("API key not valid") ||
    errMsg.includes("API key required")
  ) {
    return (
      `🔑 *Не настроен или недействителен Gemini API Ключ.*\n\n` +
      `Для работы бота необходим личный API ключ Gemini.\n` +
      `Нажми кнопку ниже *«🔑 Gemini API Ключ»* для быстрой инструкции и ввода ключа.`
    );
  }

  // Fallback generic friendly message
  return `⚠️ *Не удалось обработать запись.*\n\nПроизошла временная ошибка при обращении к ИИ. Попробуй надиктовать сообщение ещё раз.`;
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

  const categoryFreq: Record<string, number> = {};
  for (const g of activeGoals) {
    if (g.category) {
      categoryFreq[g.category] = (categoryFreq[g.category] || 0) + 1;
    }
  }
  const topCategories = Object.entries(categoryFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat);

  const categoryHint = topCategories.length > 0
    ? `\n💡 Предпочтительный баланс категорий пользователя: ${topCategories.join(", ")} (учитывай эти приоритеты при выборе категории).\n`
    : "";

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
- addToGoogleCalendar: true | false (⚠️ ВАЖНО: ставь true ТОЛЬКО ЕСЛИ пользователь прямо в голосовом сообщении озвучил просьбу внести/добавить/напомнить задачу в Календарь (например: "добавь в календарь", "занеси в гугл календарь", "поставь в календарь", "напомни в календаре"). Во всех остальных случаях ставь false!).

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
      "weekGoalTitle": "...",
      "addToGoogleCalendar": false
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
  activeGoals: Array<{ id: string; title: string; type: string; category: string }> = [],
  userApiKey?: string | null
): Promise<AIResponse> {
  const apiKey = userApiKey?.trim();
  if (!apiKey) {
    throw new Error("API_KEY_MISSING: Gemini API key not provided");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildPrompt(recordType, utcOffset, activeGoals);

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString("base64"),
      mimeType: "audio/ogg",
    },
  };

  const modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, audioPart]);
      const response = result.response;
      const text = response.text();

      const cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      const parsed = JSON.parse(cleaned) as AIResponse;
      return parsed;
    } catch (err: any) {
      console.warn(`[processVoiceWithAI] Model ${modelName} failed, trying next...`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("Не удалось обработать голосовую запись нейросетью.");
}

// ── Helper: Fuzzy Match Goal Title ──
function findFuzzyMatchingGoal(
  searchTitle: string,
  existingGoals: any[],
  targetType?: "week" | "month" | "year"
): any | undefined {
  if (!searchTitle || !searchTitle.trim()) return undefined;

  const normalizeStr = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const cleanSearch = normalizeStr(searchTitle);
  const searchTokens = cleanSearch.split(" ").filter(w => w.length > 2);

  let bestMatch: any = undefined;
  let highestScore = 0;

  for (const goal of existingGoals) {
    if (goal.status === "completed") continue;
    if (targetType && goal.type !== targetType) continue;

    const cleanGoalTitle = normalizeStr(goal.title);

    // 1. Direct substring match
    if (cleanGoalTitle.includes(cleanSearch) || cleanSearch.includes(cleanGoalTitle)) {
      return goal;
    }

    // 2. Token overlap score
    const goalTokens = cleanGoalTitle.split(" ").filter(w => w.length > 2);
    if (searchTokens.length === 0 || goalTokens.length === 0) continue;

    let overlapCount = 0;
    for (const st of searchTokens) {
      for (const gt of goalTokens) {
        if (st.includes(gt) || gt.includes(st)) {
          overlapCount++;
          break;
        }
      }
    }

    const score = overlapCount / Math.max(searchTokens.length, goalTokens.length);

    // Require at least 50% token overlap for fuzzy match
    if (score >= 0.5 && score > highestScore) {
      highestScore = score;
      bestMatch = goal;
    }
  }

  return bestMatch;
}

// ── Save data to MongoDB ──
async function saveTasksToUser(userId: string, tasks: BotTaskResult[]): Promise<string[]> {
  const createdNames: string[] = [];
  
  // We need existing goals for fuzzy matching, they are now in the Goal collection
  const existingGoals = await Goal.find({ userId });

  for (const task of tasks) {
    let matchedWeekGoalId: string | undefined = undefined;
    if (task.weekGoalTitle) {
      // Pass existingGoals which have 'goalId' and 'type' and 'status'
      // We map goalId -> id for the fuzzy matching function compatibility
      const mappedGoals = existingGoals.map((g: any) => ({ id: g.goalId, title: g.title, type: g.type, status: g.status }));
      const matchedGoal = findFuzzyMatchingGoal(task.weekGoalTitle, mappedGoals, "week");
      if (matchedGoal) matchedWeekGoalId = matchedGoal.id;
    }

    const newTask = {
      userId,
      taskId: crypto.randomUUID(),
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
      addToGoogleCalendar: !!task.addToGoogleCalendar,
      googleCalendarEventId: undefined as string | undefined
    };

    if (task.addToGoogleCalendar) {
      try {
        // syncTaskToGoogleCalendar expects id not taskId
        const gEventId = await syncTaskToGoogleCalendar(userId, { ...newTask, id: newTask.taskId } as any);
        if (gEventId) {
          newTask.googleCalendarEventId = gEventId;
        }
      } catch (gErr) {
        console.error("[bot] Google Calendar task sync error:", gErr);
      }
    }

    await Task.create(newTask);
    createdNames.push(task.name);
  }

  return createdNames;
}

async function saveNotesToUser(userId: string, notes: BotNoteResult[]): Promise<string[]> {
  const createdTitles: string[] = [];
  for (const note of notes) {
    const newNote = {
      userId,
      noteId: crypto.randomUUID(),
      date: getTodayDate(),
      title: note.title || "",
      content: note.content || "",
      noteType: note.noteType || "note",
      ideaCategory: note.ideaCategory || undefined,
    };
    await DayNote.create(newNote);
    createdTitles.push(note.title || "Без названия");
  }
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
  const createdTitles: string[] = [];
  const dbGoals = await Goal.find({ userId });

  for (const goal of goals) {
    const goalType = goal.goalType || "month";
    const timeLimitType = (goal.timeLimitType as any) || "current_period";
    const dates = calculateGoalDates(goalType, timeLimitType, utcOffset);
    const periods = getCalendarPeriod(goalType, utcOffset);
    const goalId = crypto.randomUUID();

    let parentId: string | undefined = undefined;
    if (goal.parentGoalTitle) {
      const expectedParentType = goalType === "week" ? "month" : goalType === "month" ? "year" : undefined;
      if (expectedParentType) {
        const mappedGoals = dbGoals.map((g: any) => ({ id: g.goalId, title: g.title, type: g.type, status: g.status }));
        const parentMatch = findFuzzyMatchingGoal(goal.parentGoalTitle, mappedGoals, expectedParentType);
        if (parentMatch) parentId = parentMatch.id;
      }
    }

    const planItems = (goal.plan || []).map(p => ({
      id: crypto.randomUUID(),
      text: p.text,
      done: !!p.done,
    }));

    const newGoal = {
      userId,
      goalId,
      type: goalType,
      title: goal.title,
      category: goal.category || "Mind",
      completed: false,
      xp: xpForGoal(goalType),
      linkedTaskIds: [],
      parentId,
      description: goal.description || "",
      plan: [], // Sub-tasks go into todayTasks
      timeLimitType: timeLimitType === "next_period" ? "custom" : timeLimitType,
      startDate: dates.startDate,
      endDate: dates.endDate,
      ...periods,
      status: "active",
    };

    await Goal.create(newGoal);
    createdTitles.push(goal.title);

    // If user explicitly stated sub-tasks in voice, add them to todayTasks
    for (const item of planItems) {
      const subTask = {
        userId,
        taskId: crypto.randomUUID(),
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
      };
      await Task.create(subTask);
    }
  }

  return createdTitles;
}

// ── Save Trading Note to MongoDB ──
async function saveTradingNoteToUser(userId: string, notes: BotTradingNoteResult[], utcOffset = 2): Promise<string[]> {
  const createdTitles: string[] = [];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const local = new Date(utc + utcOffset * 3600000);
  const todayStr = getTodayDate(utcOffset);
  const timeStr = `${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;

  for (const note of notes) {
    const validAssets = ["GER40", "EUR", "XAU", "GBP"];
    const asset = validAssets.includes(note.asset) ? note.asset : "GER40";
    const validTags = ["мысль", "идея", "ошибка"];
    const tag = validTags.includes(note.tag) ? note.tag : "мысль";

    const newNote = {
      userId,
      noteId: crypto.randomUUID(),
      title: note.title || "Торговая заметка",
      time: timeStr,
      asset,
      timeframe: note.timeframe || "H1",
      tag,
      text: note.text || "",
      date: todayStr,
      isTradingIdea: !!note.isTradingIdea,
      tradingIdeaDone: false,
    };
    await TradingNote.create(newNote);
    createdTitles.push(note.title || "Торговая заметка");
  }

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

  const bot = new Telegraf(token);

  // Set command menu in Telegram
  bot.telegram.setMyCommands([
    { command: "add", description: "➕ Добавить запись" },
    { command: "history", description: "📜 История голосовых сообщений" },
    { command: "status", description: "ℹ️ Статус аккаунта" },
    { command: "help", description: "❓ Помощь" },
  ]).catch(err => console.error("[bot] Error setting commands:", err));

  // ── Guard Helper: Check if user exists and has Gemini API Key ──
  const ensureUserHasApiKey = async (ctx: any): Promise<{ user: any; ok: boolean }> => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });

    if (!user) {
      await ctx.reply(
        "🔗 *Сначала привяжи свой аккаунт Trade Persona.*\n\n" +
        "Зайди в настройки на сайте → «Подключить Telegram».",
        { parse_mode: "Markdown", ...getMainMenuKeyboard() }
      );
      return { user: null, ok: false };
    }

    if (!user.geminiApiKey) {
      await ctx.reply(
        "⛔ *Доступ к функциям ИИ ограничен.*\n\n" +
        "У тебя не привязан личный Gemini API Ключ. Без него добавление задач, заметок, целей и просмотр истории недоступны.\n\n" +
        "Нажми кнопку ниже для прохождения 1-минутной инструкции и ввода ключа:",
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Инструкция: Как получить API ключ", "key_help")],
            [Markup.button.callback("✏️ Ввести API Ключ", "key_input")],
          ]),
        }
      );
      return { user, ok: false };
    }

    return { user, ok: true };
  };

  // ── Helper: Show Add Menu ──
  const showAddMenu = async (ctx: any) => {
    const { ok } = await ensureUserHasApiKey(ctx);
    if (!ok) return;

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
    const { user, ok } = await ensureUserHasApiKey(ctx);
    if (!ok || !user) return;

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

    // Button to clear voice history
    const clearKb = Markup.inlineKeyboard([
      [Markup.button.callback("🗑 Очистить историю ГС", "clear_voice_history")]
    ]);
    await ctx.reply("⚙️ *Управление историей:*", { parse_mode: "Markdown", ...clearKb });
  };

  // ── Action: Clear Voice History handlers ──
  bot.action("clear_voice_history", async (ctx) => {
    await ctx.answerCbQuery();
    const text =
      `🗑 *Удаление истории голосовых записей*\n\n` +
      `Вы уверены, что хотите полностью очистить историю сохранённых записей в боте?\n\n` +
      `_Примечание: Голосовые сообщения в чате Telegram останутся, очистится только список сохранённых логов._`;

    const kb = Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ Да, очистить", "confirm_clear_history"),
        Markup.button.callback("❌ Отмена", "cancel_clear_history"),
      ],
    ]);

    await ctx.reply(text, { parse_mode: "Markdown", ...kb });
  });

  bot.action("confirm_clear_history", async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: String(ctx.from!.id) });
    if (user) {
      const userData = await UserData.findOne({ userId: user._id });
      if (userData) {
        const existingData = (userData.data as any) || {};
        await UserData.findOneAndUpdate(
          { userId: user._id },
          { data: { ...existingData, botVoiceHistory: [] }, updatedAt: new Date() }
        );
      }
    }
    await ctx.reply("🗑 *История голосовых записей успешно очищена!*", {
      parse_mode: "Markdown",
      ...getMainMenuKeyboard(),
    });
  });

  bot.action("cancel_clear_history", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("❌ Очистка истории отменена.", getMainMenuKeyboard());
  });

  // ── Helper: Show API Key Instruction ──
  const showApiKeyInstruction = async (ctx: any) => {
    const text =
      `📖 *Как получить свой бесплатный Gemini API Ключ за 1 минуту:*\n\n` +
      `1️⃣ Перейди на официальный сайт Google AI Studio:\n` +
      `👉 https://aistudio.google.com/app/apikey\n\n` +
      `2️⃣ Войди под любым своим аккаунтом Google.\n\n` +
      `3️⃣ Нажми синюю кнопку *«Create API key»* (Создать API ключ).\n\n` +
      `4️⃣ Скопируй сгенерированный ключ (он начинается на \`AIzaSy...\`).\n\n` +
      `5️⃣ Вернись в этот чат Telegram и просто отправь скопированный ключ обычным текстовым сообщением!\n\n` +
      `🔒 *Безопасность:* Твой API ключ привязывается исключительно к твоему личному аккаунту Trade Persona и используется только для обработки твоих голосовых сообщений. Никто другой не имеет к нему доступа.`;

    const inlineKb = Markup.inlineKeyboard([
      [Markup.button.url("🌐 Открыть Google AI Studio", "https://aistudio.google.com/app/apikey")],
      [Markup.button.callback("✏️ Ввести API Ключ", "key_input")],
    ]);

    return ctx.reply(text, { parse_mode: "Markdown", ...inlineKb });
  };

  // ── Helper: Show API Key Menu ──
  const showApiKeyMenu = async (ctx: any) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (!user) {
      return ctx.reply("🔗 Сначала привяжи аккаунт Trade Persona.", getMainMenuKeyboard());
    }

    const key = user.geminiApiKey;
    const maskedKey = key ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : null;

    let text = "";
    if (maskedKey) {
      text =
        `🔑 *Твой Gemini API Ключ:* \`${maskedKey}\` (активен ✅)\n\n` +
        `Все твои голосовые сообщения обрабатываются через твой личный API ключ.\n\n` +
        `Если ты хочешь обновить или проверить ключ, нажми кнопки ниже.`;
    } else {
      text =
        `⚠️ *Gemini API Ключ не настроен.*\n\n` +
        `Для распознавания голосовых сообщений необходим личный бесплатный API ключ Gemini.\n\n` +
        `Нажми кнопку *«🔑 Инструкция»* ниже, чтобы узнать, как легко получить ключ за 1 минуту!`;
    }

    const buttons = [
      [Markup.button.callback("🔑 Инструкция: Как получить ключ", "key_help")],
      [Markup.button.callback(maskedKey ? "✏️ Изменить API Ключ" : "✏️ Ввести API Ключ", "key_input")],
    ];
    if (maskedKey) {
      buttons.push([Markup.button.callback("🗑 Удалить мой API ключ", "key_delete")]);
    }

    return ctx.reply(text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  };

  // ── Helper: Show Status ──
  const showStatus = async (ctx: any) => {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });
    if (user) {
      const keyStatus = user.geminiApiKey
        ? `\`${user.geminiApiKey.substring(0, 8)}...${user.geminiApiKey.substring(user.geminiApiKey.length - 4)}\` (активен ✅)`
        : "❌ Не настроен (нажми «🔑 Gemini API Ключ»)";

      return ctx.reply(
        `👤 *Статус аккаунта Trade Persona*\n\n` +
        `• *Email:* \`${user.email}\`\n` +
        `• *Gemini API Key:* ${keyStatus}\n` +
        `• *Статус бота:* Подключен ✅`,
        {
          parse_mode: "Markdown",
          ...getMainMenuKeyboard(),
        }
      );
    }
    return ctx.reply(
      "❌ *Аккаунт не привязан.*\n\nЗайди в настройки Trade Persona на сайте и нажми «Подключить Telegram».",
      { parse_mode: "Markdown", ...getMainMenuKeyboard() }
    );
  };

  // ── Helper: Show Help ──
  const showHelp = async (ctx: any) => {
    return ctx.reply(
      "📖 *Инструкция и лимиты работы с ботом:*\n\n" +
      "1️⃣ Нажми кнопку *➕ Добавить запись*\n" +
      "2️⃣ Выбери тип (*Задачи*, *Заметки* или *Цели*)\n" +
      "3️⃣ Запиши и отправь голосовое сообщение\n" +
      "4️⃣ ИИ автоматически распознает контекст, создаст задачи и привяжет их при необходимости!\n\n" +
      "📊 *Лимиты бесплатной нейросети Gemini API:*\n" +
      "• *15 запросов в минуту (RPM)* — пауза между ГС всего ~4 секунды.\n" +
      "• *1 500 запросов в день (RPD)* — до 1500 голосовых сообщений в сутки.\n" +
      "• *Личный API Ключ:* Твой ключ полностью независим от других пользователей.\n\n" +
      "_Если ИИ выдаёт сообщение о паузе (например, подожди 35 секунд), это встроенное ограничение бесплатного тарифа Google. Просто подожди указанное время и отправь сообщение повторно._",
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

  // ── Action: API Key callbacks ──
  bot.action("key_help", async (ctx) => {
    await ctx.answerCbQuery();
    await showApiKeyInstruction(ctx);
  });

  bot.action("key_input", async (ctx) => {
    await ctx.answerCbQuery();
    userState.set(ctx.from!.id, { type: "task", awaitingKeyInput: true });
    await ctx.reply(
      "✏️ *Введи твой Gemini API Ключ*\n\n" +
      "Скопируй ключ из Google AI Studio (начинается на `AIzaSy...`) и отправь его сообщением в этот чат.",
      { parse_mode: "Markdown" }
    );
  });

  bot.action("key_delete", async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: String(ctx.from!.id) });
    if (user) {
      await User.findByIdAndUpdate(user._id, { geminiApiKey: null });
      await UserSettings.findOneAndUpdate({ userId: user._id }, { geminiApiKey: null });
    }
    await ctx.reply("🗑 *Gemini API Ключ удалён.*", {
      parse_mode: "Markdown",
      ...getMainMenuKeyboard(),
    });
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

        const hasKey = !!user.geminiApiKey;
        let welcomeMsg = `✅ *Аккаунт успешно привязан!*\n\nТвой Telegram связан с аккаунтом \`${user.email}\`.\n\n`;

        if (!hasKey) {
          welcomeMsg +=
            `🔑 *Важный шаг:* Для работы бота укажи свой личный бесплатный Gemini API ключ.\n\n` +
            `Нажми кнопку ниже для простой 1-минутной инструкции!`;

          const inlineKb = Markup.inlineKeyboard([
            [Markup.button.callback("🔑 Инструкция: Как получить API ключ", "key_help")],
            [Markup.button.callback("✏️ Ввести API Ключ", "key_input")],
          ]);

          return ctx.reply(welcomeMsg, { parse_mode: "Markdown", ...inlineKb });
        } else {
          welcomeMsg += `Используй меню снизу для добавления записей!`;
          return ctx.reply(welcomeMsg, { parse_mode: "Markdown", ...getMainMenuKeyboard() });
        }
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
  bot.command("apikey", showApiKeyMenu);

  // ── Inline callback buttons — set record type ──
  bot.action("type_task", async (ctx) => {
    await ctx.answerCbQuery();
    const { ok } = await ensureUserHasApiKey(ctx);
    if (!ok) return;

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
    const { ok } = await ensureUserHasApiKey(ctx);
    if (!ok) return;

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
    const { ok } = await ensureUserHasApiKey(ctx);
    if (!ok) return;

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
    const { user, ok } = await ensureUserHasApiKey(ctx);
    if (!ok || !user) return;

    const state = userState.get(ctx.from.id);
    if (!state) {
      return ctx.reply(
        "⚠️ Сначала выбери тип записи.\n\nНажми *➕ Добавить запись* в меню снизу.",
        { parse_mode: "Markdown", ...getMainMenuKeyboard() }
      );
    }

    const processingMsg = await ctx.reply("⏳ Обрабатываю голосовое сообщение...");

    try {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const response = await fetch(fileLink.toString());
      if (!response.ok) throw new Error("Failed to download voice file");
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      const settings = await (await import("./mongodb")).UserSettings?.findOne({ userId: user._id });
      const utcOffset = settings?.utcOffset ?? 2;

      // Fetch active goals to pass to AI for smart linking (now from Goal collection)
      const activeGoalDocs = await Goal.find({ userId: user._id, status: { $ne: "completed" } }).lean();
      const activeGoals = activeGoalDocs.map((g: any) => ({ id: g.goalId, title: g.title, type: g.type, category: g.category }));

      // Fetch user's API key
      const userApiKey = user.geminiApiKey || settings?.geminiApiKey;

      const aiResult = await processVoiceWithAI(audioBuffer, state.type, utcOffset, activeGoals, userApiKey);

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

      const friendlyText = formatFriendlyErrorMessage(err);

      await ctx.reply(
        friendlyText,
        {
          parse_mode: "Markdown",
          ...(!user?.geminiApiKey
            ? Markup.inlineKeyboard([
                [Markup.button.callback("🔑 Инструкция: Как получить API ключ", "key_help")],
                [Markup.button.callback("✏️ Ввести API Ключ", "key_input")],
              ])
            : getMainMenuKeyboard()),
        }
      );
    }
  });

  // ── Reply Keyboard Text Handler ──
  bot.on(message("text"), async (ctx) => {
    const txt = ctx.message.text.trim();
    if (txt === "➕ Добавить запись") return showAddMenu(ctx);
    if (txt === "📜 История ГС") return showHistory(ctx);
    if (txt === "🔑 Gemini API Ключ") return showApiKeyMenu(ctx);
    if (txt === "ℹ️ Статус аккаунта") return showStatus(ctx);
    if (txt === "❓ Помощь") return showHelp(ctx);
    if (txt.startsWith("/")) return;

    const state = userState.get(ctx.from.id);

    // Handle Gemini API Key Input (if awaitingKeyInput OR text matches API Key structure)
    const looksLikeKey =
      txt.startsWith("AIzaSy") ||
      txt.startsWith("AQ.") ||
      (txt.length >= 30 && txt.length <= 90 && !txt.includes(" ") && !txt.startsWith("/"));

    if (state?.awaitingKeyInput || looksLikeKey) {
      const user = await User.findOne({ telegramId: String(ctx.from.id) });
      if (!user) {
        return ctx.reply("🔗 Сначала привяжи аккаунт Trade Persona.", getMainMenuKeyboard());
      }

      const testingMsg = await ctx.reply("🔄 *Проверяю API ключ в Google AI Studio...*", { parse_mode: "Markdown" });

      const check = await validateGeminiApiKey(txt);
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, testingMsg.message_id);
      } catch {}

      if (check.valid) {
        await User.findByIdAndUpdate(user._id, { geminiApiKey: txt });
        await UserSettings.findOneAndUpdate({ userId: user._id }, { geminiApiKey: txt }, { upsert: true });

        userState.delete(ctx.from.id);

        return ctx.reply(
          `✅ *Gemini API Ключ успешно сохранён и проверен!*\n\n` +
          `Теперь твои голосовые сообщения будут обрабатываться через твой личный бесплатный API ключ.`,
          { parse_mode: "Markdown", ...getMainMenuKeyboard() }
        );
      } else if (check.errorType === "oauth_token_unsupported") {
        return ctx.reply(
          `⚠️ *Ошибка формата ключа (Service Token)*\n\n` +
          `Ты сгенерировал Service Token из Google Cloud Console (начинается на \`AQ...\`), а не API Ключ для Google AI Studio.\n\n` +
          `👉 *Как получить правильный Gemini API Ключ:*\n` +
          `1. Перейди на официальный сайт: https://aistudio.google.com/app/apikey\n` +
          `2. Нажми кнопку *«Create API key»*\n` +
          `3. Скопируй сгенерированный ключ — он начинается на \`AIzaSy...\`!\n` +
          `4. Отправь скопированный ключ прямо в этот чат.`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.url("🌐 Открыть Google AI Studio", "https://aistudio.google.com/app/apikey")],
              [Markup.button.callback("🔑 Инструкция", "key_help")],
            ]),
          }
        );
      } else {
        return ctx.reply(
          `❌ *Введённый API ключ недействителен или не работает.*\n\n` +
          `Убедись, что скопировал ключ с сайта Google AI Studio (начинается на \`AIzaSy...\`) и попробуй ещё раз.\n\n` +
          `Нажми *«🔑 Инструкция»*, если нужна помощь.`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("🔑 Инструкция: Как получить ключ", "key_help")],
            ]),
          }
        );
      }
    }

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

// ──────────────────────────────────────────────────────────────────────────────
// CLOUDFLARE WORKER ENTRY POINT
// Telegram Bot Serverless Webhook — Zero-Touch Server Architecture
// ──────────────────────────────────────────────────────────────────────────────

import { getTelegramFilePath, transcribeAudioInMemory } from "./audio_stream";
import { runPocketPipeline } from "./pipeline";

interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GEMINI_API_KEY: string;
  RENDER_APP_URL: string;
  WORKER_SECRET_TOKEN: string;
}

// ── Types for Telegram Update ──
interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramAudio {
  file_id: string;
  duration: number;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  voice?: TelegramAudio;
  audio?: TelegramAudio;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

interface UserConfig {
  groqApiKey: string | null;
  geminiApiKey: string | null;
  botSetupStep: string | null; // null | 'awaiting_link' | 'awaiting_groq' | 'awaiting_gemini' | 'done'
  botRecordMode?: string; // 'tasks' | 'goals' | 'notes' | 'brainstorm'
  email?: string | null;
  googleCalendarConnected?: boolean;
}

// ── Send Telegram message helper ──
async function sendTelegramMessage(chatId: number, text: string, botToken: string, parseMode?: string, replyMarkup?: any): Promise<void> {
  const body: any = { chat_id: chatId, text, disable_web_page_preview: true };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok && parseMode) {
    // Retry without formatting if Telegram fails to parse Markdown/HTML entities
    delete body.parse_mode;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

// ── Answer callback query helper ──
async function answerCallbackQuery(callbackQueryId: string, botToken: string, text?: string): Promise<void> {
  const body: any = { callback_query_id: callbackQueryId };
  if (text) body.text = text;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Keyboards ──
function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "➕ Добавить" }],
      [{ text: "👤 Мой аккаунт" }, { text: "❓ Помощь" }],
    ],
    resize_keyboard: true,
  };
}

function getInlineModesKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📝 Задачи на день", callback_data: "mode_tasks" }],
      [{ text: "🎯 Цели", callback_data: "mode_goals" }],
      [{ text: "💡 Заметки и идеи", callback_data: "mode_notes" }],
      [{ text: "🧠 Брейн-шторм", callback_data: "mode_brainstorm" }],
    ]
  };
}

function getCleanUrl(url: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

// ── Lookup user's config from the main app's API ──
async function fetchUserConfig(telegramId: string, renderUrl: string, workerSecret: string): Promise<UserConfig | null> {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/user-config?telegramId=${telegramId}`, {
      headers: { "x-worker-secret": workerSecret },
    });
    if (!res.ok) return null;
    return await res.json() as UserConfig;
  } catch {
    return null;
  }
}

// ── Update user's config ──
async function updateUserConfig(telegramId: string, updates: any, renderUrl: string, workerSecret: string): Promise<{ ok: boolean, error?: string }> {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/user-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ telegramId, ...updates }),
    });
    const data = await res.json() as any;
    return data;
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ── Link Telegram account to Persona Life via magic token ──
async function linkAccount(token: string, telegramId: string, renderUrl: string, workerSecret: string): Promise<{ ok: boolean, email?: string, hasKeys?: boolean, error?: string }> {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/link-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ token, telegramId }),
    });
    return await res.json() as any;
  } catch {
    return { ok: false, error: "Network error" };
  }
}

// ── Push processed result back to main server ──
async function pushResultToServer(
  telegramId: string,
  messageId: number,
  transcript: string,
  result: Awaited<ReturnType<typeof runPocketPipeline>>,
  renderUrl: string,
  workerSecret: string,
  mode: string
): Promise<boolean> {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/audio-result`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({
        secretToken: workerSecret,
        telegramId,
        messageId: String(messageId),
        transcript,
        summary: result.executive_summary,
        actionItems: result.action_items,
        tags: result.semantic_tags,
        mindMap: result.mind_map_nodes,
        keyInsights: result.key_insights,
        topics: result.topics,
        sentiment: result.sentiment,
        noteType: result.note_type,
        questionsRaised: result.questions_raised,
        mode, // Pass mode so server knows NOT to create DayNote for brainstorm
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[pushResultToServer] Failed HTTP ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error(`[pushResultToServer] Network error: ${err.message}`);
    return false;
  }
}

// ── Format beautiful Telegram response ──
function formatResultMessage(
  result: Awaited<ReturnType<typeof runPocketPipeline>>,
  mode: string
): string {
  const lines: string[] = [];

  const modeEmoji: Record<string, string> = {
    brainstorm: "🧠",
    tasks: "📝",
    goals: "🎯",
    notes: "💡",
  };
  const modeTitle: Record<string, string> = {
    brainstorm: "Брейн-шторм",
    tasks: "Задачи из записи",
    goals: "Цели из записи",
    notes: "Анализ заметки",
  };
  const emoji = modeEmoji[mode] || "💡";
  const title = modeTitle[mode] || "Анализ записи";

  lines.push(`${emoji} *${title}*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  // Guard: ensure executive_summary is actually a string, not an object
  const summary = typeof result.executive_summary === "string"
    ? result.executive_summary
    : JSON.stringify(result.executive_summary);

  if (summary) {
    lines.push(`\n📋 *Суть:*\n${summary}`);
  }

  if (result.key_insights?.length) {
    lines.push(`\n💡 *Ключевые мысли:*`);
    result.key_insights.slice(0, 5).forEach((i: string) => {
      const ins = typeof i === "string" ? i : JSON.stringify(i);
      lines.push(`• ${ins}`);
    });
  }

  if (result.action_items?.length) {
    lines.push(`\n✅ *Задачи:*`);
    result.action_items.slice(0, 5).forEach((a: any) => {
      const priority = a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "⚪";
      const task = typeof a.task === "string" ? a.task : JSON.stringify(a.task);
      lines.push(`${priority} ${task}`);
    });
  }

  if (result.questions_raised?.length) {
    lines.push(`\n❓ *Открытые вопросы:*`);
    result.questions_raised.slice(0, 3).forEach((q: string) => lines.push(`• ${q}`));
  }

  if (result.semantic_tags?.length) {
    lines.push(`\n🏷 *Теги:* ${result.semantic_tags.slice(0, 6).map((t: string) => `#${t.replace(/\s+/g, "_")}`).join(" ")}`);
  }

  if (result.sentiment) {
    const mood: Record<string, string> = { positive: "😊", neutral: "😐", negative: "😔", mixed: "🤔" };
    const sentimentLabels: Record<string, string> = { positive: "Позитивное", neutral: "Нейтральное", negative: "Негативное", mixed: "Смешанное" };
    lines.push(`\n${mood[result.sentiment] || "😐"} *Настроение:* ${sentimentLabels[result.sentiment] || result.sentiment}`);
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━`);
  if (mode === "brainstorm") {
    lines.push(`🧠 _Запись сохранена в Брейн-шторм_`);
    lines.push(`_Открой вкладку Brainstorm в приложении для анализа!_`);
  } else if (mode === "tasks") {
    lines.push(`📝 _Задачи сохранены в Persona Life_`);
  } else if (mode === "goals") {
    lines.push(`🎯 _Цели сохранены в Persona Life_`);
  } else {
    lines.push(`✅ _Заметка сохранена в Persona Life_`);
  }

  return lines.join("\n");
}

// ── Main Worker Handler ──
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "POST") return new Response("OK");

    let update: TelegramUpdate;
    try {
      update = await request.json() as TelegramUpdate;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    // ── Handle Callback Query (Inline Buttons) ──
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || "";
      const telegramId = String(cb.from.id);
      
      if (data.startsWith("mode_")) {
        const mode = data.replace("mode_", ""); // "tasks", "goals", "notes", "brainstorm"
        const modeNames: Record<string, string> = {
          tasks: "📝 Задачи на день",
          goals: "🎯 Цели",
          notes: "💡 Заметки и идеи",
          brainstorm: "🧠 Брейн-шторм"
        };
        
        await updateUserConfig(telegramId, { botRecordMode: mode }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        
        const messageText = `✅ Режим изменён на: *${modeNames[mode] || mode}*\n\nОтправь голосовое сообщение, и оно будет обработано в этом формате.`;
        
        if (cb.message) {
          // Edit the message that had the inline keyboard
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id,
              text: messageText,
              parse_mode: "Markdown"
            })
          });
        } else {
          await sendTelegramMessage(cb.from.id, messageText, env.TELEGRAM_BOT_TOKEN, "Markdown");
        }
        await answerCallbackQuery(cb.id, env.TELEGRAM_BOT_TOKEN, "Режим изменён!");
      } else {
        await answerCallbackQuery(cb.id, env.TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK");
    }

    const message = update.message;
    if (!message) return new Response("OK");

    const chatId = message.chat.id;
    const telegramId = String(message.from?.id || "");
    const firstName = message.from?.first_name || "друг";

    if (!telegramId || telegramId === "0") return new Response("OK");

    // ── Handle /start command (with optional magic token) ──
    if (message.text?.startsWith("/start")) {
      const parts = message.text.trim().split(" ");
      const magicToken = parts[1] || null;

      if (magicToken) {
        await sendTelegramMessage(chatId, `🔗 Привязываю твой аккаунт Persona Life...`, env.TELEGRAM_BOT_TOKEN);
        const result = await linkAccount(magicToken, telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

        if (!result.ok) {
          if (result.error === "Token invalid or expired") {
            await sendTelegramMessage(chatId, `❌ *Ссылка недействительна или истекла.*\nПожалуйста, сгенерируй новую в настройках.`, env.TELEGRAM_BOT_TOKEN);
          } else {
            await sendTelegramMessage(chatId, `❌ Ошибка привязки: ${result.error}. Попробуй ещё раз.`, env.TELEGRAM_BOT_TOKEN);
          }
          return new Response("OK");
        }

        if (result.hasKeys) {
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\nЯ — Personedge, твой ИИ-помощник. Твои ключи настроены — отправляй голосовое!`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        } else {
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\n🔑 *Шаг 1 из 2: Groq API Key*\nОтправь мне ключ Groq (gsk_...)`, env.TELEGRAM_BOT_TOKEN);
        }
        return new Response("OK");
      }

      const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
      if (userConfig && userConfig.botSetupStep === "done") {
        await sendTelegramMessage(chatId, `👋 *С возвращением, ${firstName}!*\nЯ — Personedge, твой ИИ-помощник. Я всегда был рядом — теперь помогу тебе стать лучше.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
      } else {
        await sendTelegramMessage(chatId, `🔗 Привет! Я — Personedge, твой ИИ-помощник.\nСначала привяжи аккаунт Persona Life по ссылке из настроек.`, env.TELEGRAM_BOT_TOKEN);
      }
      return new Response("OK");
    }

    const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
    const step = userConfig?.botSetupStep || null;

    if (!userConfig) {
      await sendTelegramMessage(chatId, `🔗 Сначала нужно привязать аккаунт Persona Life.`, env.TELEGRAM_BOT_TOKEN);
      return new Response("OK");
    }

    // ── Handle text commands ──
    if (message.text) {
      const text = message.text.trim();

      if (text === "❓ Помощь" || text === "/help") {
        await sendTelegramMessage(chatId, `ℹ️ *Разделы Personedge:*\n\n` +
          `➕ *Добавить* — выбери режим (задачи, цели, заметки или брейн-шторм) и отправь голосовое — я всё разберу и разложу по местам\n` +
          `👤 *Мой аккаунт* — статус подключения, email и твои API-ключи\n` +
          `📜 *История* — список твоих голосовых записей\n` +
          `📅 *Google Календарь* — скажи «добавь в календарь» прямо в голосовом, и задача появится в календаре (если он подключён)\n\n` +
          `_Я — Personedge, твой личный ИИ-помощник. Я всегда был рядом — теперь помогу тебе стать лучше._`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      if (text === "👤 Мой аккаунт") {
        const keysStatus = `Groq: ${userConfig.groqApiKey ? '✅' : '❌'}\nGemini: ${userConfig.geminiApiKey ? '✅' : '❌'}`;
        const calStatus = userConfig.googleCalendarConnected ? "✅ подключён" : "❌ не подключён";
        const linked = userConfig.email ? `✅ Подключен\n• Email: \`${userConfig.email}\`` : "❌ Не подключен";
        await sendTelegramMessage(chatId, `👤 *Мой аккаунт*\n\n• Статус: ${linked}\n\n*API-ключи:*\n${keysStatus}\n\n*Google Календарь:* ${calStatus}\n\nДля перенастройки ключей отправь /reset\nОтвязать аккаунт можно в настройках веб-приложения.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      if (text === "➕ Добавить") {
        await sendTelegramMessage(chatId, `👇 *В каком формате обработать запись?*\nВыбери режим — и отправь голосовое сообщение:`, env.TELEGRAM_BOT_TOKEN, "Markdown", getInlineModesKeyboard());
        return new Response("OK");
      }

      if (text === "/reset") {
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_groq", groqApiKey: null, geminiApiKey: null }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `🔄 *Ключи сброшены*\nОтправь мне ключ Groq.`, env.TELEGRAM_BOT_TOKEN);
        return new Response("OK");
      }

      if (step === "awaiting_groq") {
        if (!text.startsWith("gsk_")) {
          await sendTelegramMessage(chatId, `⚠️ Ключ Groq должен начинаться с \`gsk_\``, env.TELEGRAM_BOT_TOKEN);
          return new Response("OK");
        }
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_gemini", groqApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `✅ *Groq ключ сохранён!*\nТеперь отправь Gemini API Key.`, env.TELEGRAM_BOT_TOKEN);
        return new Response("OK");
      }

      if (step === "awaiting_gemini") {
        await updateUserConfig(telegramId, { botSetupStep: "done", geminiApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `🎉 *Настройка завершена!*\nТеперь можешь отправлять голосовые.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      if (step === "done") {
        await sendTelegramMessage(chatId, `🎙 Отправь мне *голосовое сообщение*!`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      await sendTelegramMessage(chatId, `Используй /start чтобы начать.`, env.TELEGRAM_BOT_TOKEN);
      return new Response("OK");
    }

    const voiceData = message.voice || message.audio;
    if (!voiceData) return new Response("OK");

    if (step !== "done") {
      await sendTelegramMessage(chatId, `⚠️ Сначала заверши настройку ключей.`, env.TELEGRAM_BOT_TOKEN);
      return new Response("OK");
    }

    const groqApiKey = userConfig.groqApiKey;
    if (!groqApiKey) {
      await sendTelegramMessage(chatId, `❌ Groq API ключ не настроен. Сбрось через /reset`, env.TELEGRAM_BOT_TOKEN);
      return new Response("OK");
    }

    const currentMode = userConfig.botRecordMode || "notes";
    const modeLabels: Record<string, string> = { tasks: "📝 Задачи", goals: "🎯 Цели", notes: "💡 Заметки", brainstorm: "🧠 Брейн-шторм" };

    // Send progress message with estimated time based on audio duration
    const audioDuration = voiceData.duration || 30;
    const estimatedSec = Math.max(20, Math.min(90, Math.round(audioDuration * 0.5) + 15));

    const progressRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🧠 *Personedge думает...*\n\`${modeLabels[currentMode]} · ~${estimatedSec} сек\``,
        parse_mode: "Markdown",
      }),
    });
    const progressData = await progressRes.json() as any;
    const progressMsgId: number | null = progressData?.result?.message_id || null;

    // ── Simple & Reliable Architecture ──
    // Worker: receives webhook + sends file_id to Render (no CPU-heavy work)
    // Render: downloads audio from Telegram (inbound = FREE), transcribes Groq, analyzes Gemini, replies
    // Why: Cloudflare free plan has 30s wall-clock limit — audio download alone can exceed it
    const baseUrl = getCleanUrl(env.RENDER_APP_URL);

    ctx.waitUntil(
      fetch(`${baseUrl}/api/internal/process-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": env.WORKER_SECRET_TOKEN,
        },
        body: JSON.stringify({
          telegramId,
          chatId: String(chatId),
          messageId: String(message.message_id),
          progressMsgId: progressMsgId ? String(progressMsgId) : null,
          fileId: voiceData.file_id,
          botToken: env.TELEGRAM_BOT_TOKEN,
          mode: currentMode,
        }),
      }).catch((e) => {
        console.error("[Worker] Failed to call process-audio:", e.message);
        sendTelegramMessage(chatId, `❌ Сервер недоступен. Попробуй позже.`, env.TELEGRAM_BOT_TOKEN);
      })
    );

    return new Response("OK");
  },
};



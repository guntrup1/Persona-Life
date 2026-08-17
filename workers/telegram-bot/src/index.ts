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
  workerSecret: string
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
function formatResultMessage(result: Awaited<ReturnType<typeof runPocketPipeline>>, transcript: string): string {
  const lines: string[] = [];

  lines.push(`🧠 *Анализ голосовой заметки*`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━`);

  if (result.executive_summary) {
    lines.push(`\n📋 *Суть:*\n${result.executive_summary}`);
  }

  if (result.key_insights?.length) {
    lines.push(`\n💡 *Ключевые мысли:*`);
    result.key_insights.slice(0, 4).forEach((i: string) => lines.push(`• ${i}`));
  }

  if (result.action_items?.length) {
    lines.push(`\n✅ *Задачи:*`);
    result.action_items.slice(0, 5).forEach((a: any) => {
      const priority = a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "⚪";
      lines.push(`${priority} ${a.task}`);
    });
  }

  if (result.semantic_tags?.length) {
    lines.push(`\n🏷 *Теги:* ${result.semantic_tags.slice(0, 6).map((t: string) => `#${t}`).join(" ")}`);
  }

  if (result.sentiment) {
    const mood: Record<string, string> = { positive: "😊", neutral: "😐", negative: "😔", mixed: "🤔" };
    lines.push(`\n${mood[result.sentiment] || "😐"} *Настроение:* ${result.sentiment}`);
  }

  lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`✅ _Заметка сохранена в Persona Life_`);

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
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\nТвои ключи настроены!`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        } else {
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\n🔑 *Шаг 1 из 2: Groq API Key*\nОтправь мне ключ Groq (gsk_...)`, env.TELEGRAM_BOT_TOKEN);
        }
        return new Response("OK");
      }

      const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
      if (userConfig && userConfig.botSetupStep === "done") {
        await sendTelegramMessage(chatId, `👋 *С возвращением, ${firstName}!*\nЯ готов к работе.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
      } else {
        await sendTelegramMessage(chatId, `🔗 Сначала привяжи аккаунт Persona Life по ссылке из настроек.`, env.TELEGRAM_BOT_TOKEN);
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
        await sendTelegramMessage(chatId, `ℹ️ *Справка*\n\nБот работает по принципу BYOK. Лимиты зависят только от твоих ключей (Groq/Gemini).\nВыбирай нужный режим (через "➕ Добавить") и отправляй голосовое сообщение.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      if (text === "👤 Мой аккаунт") {
        const keysStatus = `Groq: ${userConfig.groqApiKey ? '✅' : '❌'}\nGemini: ${userConfig.geminiApiKey ? '✅' : '❌'}`;
        await sendTelegramMessage(chatId, `👤 *Твой аккаунт*\nEmail: ${userConfig.email || "Привязан"}\n\n*Ключи:*\n${keysStatus}\n\nДля перенастройки ключей отправь /reset\nОтвязать аккаунт можно в настройках веб-приложения.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return new Response("OK");
      }

      if (text === "➕ Добавить") {
        await sendTelegramMessage(chatId, `👇 В каком формате обработать следующее сообщение? Выбери режим:`, env.TELEGRAM_BOT_TOKEN, "Markdown", getInlineModesKeyboard());
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

    const currentMode = userConfig.botRecordMode || "notes";
    const modeLabels: Record<string, string> = { tasks: "📝 Задачи", goals: "🎯 Цели", notes: "💡 Заметки", brainstorm: "🧠 Брейн-шторм" };
    
    // Process audio asynchronously so Telegram receives 200 OK immediately
    ctx.waitUntil((async () => {
      await sendTelegramMessage(chatId, `⏳ *Обрабатываю (${modeLabels[currentMode]})...*`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());

      try {
        const groqApiKey = userConfig.groqApiKey || (env as any).GROQ_API_KEY;
        const geminiKey = userConfig.geminiApiKey || env.GEMINI_API_KEY;

        if (!groqApiKey) {
          await sendTelegramMessage(chatId, `❌ Groq API ключ не найден. /reset`, env.TELEGRAM_BOT_TOKEN);
          return;
        }

        const filePath = await getTelegramFilePath(voiceData.file_id, env.TELEGRAM_BOT_TOKEN);
        let transcript: string;
        try {
          transcript = await transcribeAudioInMemory(filePath, env.TELEGRAM_BOT_TOKEN, groqApiKey);
        } catch (whisperErr: any) {
          await sendTelegramMessage(chatId, `❌ Ошибка транскрибации: ${whisperErr.message}`, env.TELEGRAM_BOT_TOKEN);
          return;
        }

        if (!transcript || transcript.length < 3) {
          await sendTelegramMessage(chatId, `⚠️ Не удалось распознать речь.`, env.TELEGRAM_BOT_TOKEN);
          return;
        }

        // Pass the current mode to the pipeline
        const result = await runPocketPipeline(transcript, geminiKey, currentMode);

        await pushResultToServer(telegramId, message.message_id, transcript, result, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

        const replyText = formatResultMessage(result, transcript);
        await sendTelegramMessage(chatId, replyText, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());

      } catch (err: any) {
        await sendTelegramMessage(chatId, `❌ Ошибка: _${err?.message || "Неизвестная ошибка"}_`, env.TELEGRAM_BOT_TOKEN);
      }
    })());

    return new Response("OK");
  },
};

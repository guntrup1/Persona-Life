import type { Express } from "express";

// ── Telegram API Helpers ──
async function sendTelegramMessage(
  chatId: number,
  text: string,
  botToken: string,
  parseMode: string = "Markdown",
  replyMarkup: any = null
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok && parseMode === "Markdown") {
      delete body.parse_mode;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
  } catch (err: any) {
    console.error(`[sendTelegramMessage] error: ${err.message}`);
  }
}

// ── Keyboard Generators ──
function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "➕ Добавить" }],
      [{ text: "👤 Мой аккаунт" }, { text: "❓ Помощь" }],
    ],
    resize_keyboard: true,
    persistent: true,
  };
}

function getInlineModesKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🧠 Брейн-шторм", callback_data: "mode_brainstorm" }],
      [{ text: "📝 Задачи", callback_data: "mode_tasks" }, { text: "🎯 Цели", callback_data: "mode_goals" }],
      [{ text: "💡 Просто заметка", callback_data: "mode_notes" }],
    ],
  };
}

function getCleanUrl(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

// ── Server API Helpers ──
async function linkAccount(
  magicToken: string,
  telegramId: string,
  renderUrl: string,
  workerSecret: string
): Promise<{ ok: boolean; hasKeys?: boolean; error?: string }> {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/link-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ token: magicToken, telegramId }),
    });
    const data = await res.json() as any;
    if (!res.ok) return { ok: false, error: data.error || res.statusText };
    return { ok: true, hasKeys: data.hasKeys };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

async function fetchUserConfig(
  telegramId: string,
  renderUrl: string,
  workerSecret: string
) {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    const res = await fetch(`${baseUrl}/api/internal/user-config?telegramId=${telegramId}`, {
      headers: { "x-worker-secret": workerSecret },
    });
    if (!res.ok) return null;
    return await res.json() as any;
  } catch (err) {
    return null;
  }
}

async function updateUserConfig(
  telegramId: string,
  updates: any,
  renderUrl: string,
  workerSecret: string
) {
  try {
    const baseUrl = getCleanUrl(renderUrl);
    await fetch(`${baseUrl}/api/internal/user-config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": workerSecret,
      },
      body: JSON.stringify({ telegramId, ...updates }),
    });
  } catch (err) {
    console.error("[updateUserConfig]", err);
  }
}

export function registerTelegramWebhookRoutes(app: Express) {
  app.post("/api/telegram-webhook", async (req, res) => {
    res.send("OK");

    const update = req.body;
    if (!update) return;

    const env = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "8845042057:AAGHZysBa3BDbBeV6iBCwIG7qvKkPXvKVuA",
      WORKER_SECRET_TOKEN: process.env.WORKER_SECRET_TOKEN || "secret-persona-2026-xk9",
      RENDER_APP_URL: `http://localhost:${process.env.PORT || 5000}`
    };

    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const telegramId = String(cb.from.id);

      if (!chatId || !messageId) return;

      if (data?.startsWith("mode_")) {
        const newMode = data.replace("mode_", "");
        await updateUserConfig(telegramId, { botRecordMode: newMode }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

        const modeLabels: Record<string, string> = { tasks: "📝 Задачи", goals: "🎯 Цели", notes: "💡 Заметки", brainstorm: "🧠 Брейн-шторм" };
        const label = modeLabels[newMode] || newMode;

        await sendTelegramMessage(chatId, `✅ Режим изменён на: ${label}\n\nОтправь голосовое сообщение, и оно будет обработано в этом формате.`, env.TELEGRAM_BOT_TOKEN);
      }
      return;
    }

    const message = update.message;
    if (!message) return;

    const chatId = message.chat.id;
    const telegramId = String(message.from?.id || "");
    const firstName = message.from?.first_name || "друг";

    if (!telegramId || telegramId === "0") return;

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
          return;
        }

        if (result.hasKeys) {
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\nТвои ключи настроены!`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        } else {
          await sendTelegramMessage(chatId, `✅ *Аккаунт привязан!*\n🔑 *Шаг 1 из 2: Groq API Key*\nОтправь мне ключ Groq (gsk_...)`, env.TELEGRAM_BOT_TOKEN);
        }
        return;
      }

      const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
      if (userConfig && userConfig.botSetupStep === "done") {
        await sendTelegramMessage(chatId, `👋 *С возвращением, ${firstName}!*\nЯ готов к работе.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
      } else {
        await sendTelegramMessage(chatId, `🔗 Сначала привяжи аккаунт Persona Life по ссылке из настроек.`, env.TELEGRAM_BOT_TOKEN);
      }
      return;
    }

    const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
    const step = userConfig?.botSetupStep || null;

    if (!userConfig) {
      await sendTelegramMessage(chatId, `🔗 Сначала нужно привязать аккаунт Persona Life.`, env.TELEGRAM_BOT_TOKEN);
      return;
    }

    if (message.text) {
      const text = message.text.trim();

      if (text === "❓ Помощь" || text === "/help") {
        await sendTelegramMessage(chatId, `ℹ️ *Справка*\n\nБот работает по принципу BYOK. Лимиты зависят только от твоих ключей (Groq/Gemini).\nВыбирай нужный режим (через "➕ Добавить") и отправляй голосовое сообщение.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return;
      }

      if (text === "👤 Мой аккаунт") {
        const keysStatus = `Groq: ${userConfig.groqApiKey ? '✅' : '❌'}\nGemini: ${userConfig.geminiApiKey ? '✅' : '❌'}`;
        await sendTelegramMessage(chatId, `👤 *Твой аккаунт*\nEmail: ${userConfig.email || "Привязан"}\n\n*Ключи:*\n${keysStatus}\n\nДля перенастройки ключей отправь /reset\nОтвязать аккаунт можно в настройках веб-приложения.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return;
      }

      if (text === "➕ Добавить") {
        await sendTelegramMessage(chatId, `👇 В каком формате обработать следующее сообщение? Выбери режим:`, env.TELEGRAM_BOT_TOKEN, "Markdown", getInlineModesKeyboard());
        return;
      }

      if (text === "/reset") {
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_groq", groqApiKey: null, geminiApiKey: null }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `🔄 *Ключи сброшены*\nОтправь мне ключ Groq.`, env.TELEGRAM_BOT_TOKEN);
        return;
      }

      if (step === "awaiting_groq") {
        if (!text.startsWith("gsk_")) {
          await sendTelegramMessage(chatId, `⚠️ Ключ Groq должен начинаться с \`gsk_\``, env.TELEGRAM_BOT_TOKEN);
          return;
        }
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_gemini", groqApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `✅ *Groq ключ сохранён!*\nТеперь отправь Gemini API Key.`, env.TELEGRAM_BOT_TOKEN);
        return;
      }

      if (step === "awaiting_gemini") {
        await updateUserConfig(telegramId, { botSetupStep: "done", geminiApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId, `🎉 *Настройка завершена!*\nТеперь можешь отправлять голосовые.`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return;
      }

      if (step === "done") {
        await sendTelegramMessage(chatId, `🎙 Отправь мне *голосовое сообщение*!`, env.TELEGRAM_BOT_TOKEN, "Markdown", getMainMenuKeyboard());
        return;
      }

      await sendTelegramMessage(chatId, `Используй /start чтобы начать.`, env.TELEGRAM_BOT_TOKEN);
      return;
    }

    const voiceData = message.voice || message.audio;
    if (!voiceData) return;

    if (step !== "done") {
      await sendTelegramMessage(chatId, `⚠️ Сначала заверши настройку ключей.`, env.TELEGRAM_BOT_TOKEN);
      return;
    }

    const currentMode = userConfig.botRecordMode || "notes";
    const modeLabels: Record<string, string> = { tasks: "📝 Задачи", goals: "🎯 Цели", notes: "💡 Заметки", brainstorm: "🧠 Брейн-шторм" };

    await sendTelegramMessage(chatId, `⏳ *Обрабатываю (${modeLabels[currentMode]})...*`, env.TELEGRAM_BOT_TOKEN, "Markdown");

    const baseUrl = getCleanUrl(env.RENDER_APP_URL);
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
        fileId: voiceData.file_id,
        botToken: env.TELEGRAM_BOT_TOKEN,
        mode: currentMode,
      }),
    }).catch((e) => {
      console.error("[Webhook] Failed to call process-audio:", e.message);
      sendTelegramMessage(chatId, `❌ Сервер недоступен. Попробуй позже.`, env.TELEGRAM_BOT_TOKEN);
    });

  });
}

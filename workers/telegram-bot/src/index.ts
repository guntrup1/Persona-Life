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
}

interface UserConfig {
  groqApiKey: string | null;
  geminiApiKey: string | null;
  botSetupStep: string | null; // null | 'awaiting_link' | 'awaiting_groq' | 'awaiting_gemini' | 'done'
  email?: string | null;
}

// ── Send Telegram message helper ──
async function sendTelegramMessage(chatId: number, text: string, botToken: string, parseMode: string = "Markdown"): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
  });
}

// ── Lookup user's config from the main app's API ──
async function fetchUserConfig(telegramId: string, renderUrl: string, workerSecret: string): Promise<UserConfig | null> {
  try {
    const res = await fetch(`${renderUrl}/api/internal/user-config?telegramId=${telegramId}`, {
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
    const res = await fetch(`${renderUrl}/api/internal/user-config`, {
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
    const res = await fetch(`${renderUrl}/api/internal/link-telegram`, {
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
): Promise<void> {
  await fetch(`${renderUrl}/api/internal/audio-result`, {
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
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle POST (Telegram sends updates via POST)
    if (request.method !== "POST") {
      return new Response("OK");
    }

    let update: TelegramUpdate;
    try {
      update = await request.json() as TelegramUpdate;
    } catch {
      return new Response("Bad Request", { status: 400 });
    }

    const message = update.message;
    if (!message) {
      return new Response("OK"); // ignore non-message updates
    }

    const chatId = message.chat.id;
    const telegramId = String(message.from?.id || "");
    const firstName = message.from?.first_name || "друг";

    if (!telegramId || telegramId === "0") return new Response("OK");

    // ── Handle /start command (with optional magic token) ──
    if (message.text?.startsWith("/start")) {
      const parts = message.text.trim().split(" ");
      const magicToken = parts[1] || null;

      if (magicToken) {
        // User came via magic link from web app — link their account
        await sendTelegramMessage(chatId, `🔗 Привязываю твой аккаунт Persona Life...`, env.TELEGRAM_BOT_TOKEN);

        const result = await linkAccount(magicToken, telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

        if (!result.ok) {
          if (result.error === "Token invalid or expired") {
            await sendTelegramMessage(chatId,
              `❌ *Ссылка недействительна или истекла.*\n\nСсылки действуют 10 минут. Пожалуйста, зайди в настройки Persona Life и сгенерируй новую ссылку.`,
              env.TELEGRAM_BOT_TOKEN
            );
          } else if (result.error === "Telegram already linked to another account") {
            await sendTelegramMessage(chatId,
              `⚠️ *Этот Telegram аккаунт уже привязан к другому аккаунту Persona Life.*\n\nЕсли хочешь перепривязать, сначала отключи бот в настройках старого аккаунта.`,
              env.TELEGRAM_BOT_TOKEN
            );
          } else {
            await sendTelegramMessage(chatId,
              `❌ Ошибка привязки: ${result.error}. Попробуй ещё раз.`,
              env.TELEGRAM_BOT_TOKEN
            );
          }
          return new Response("OK");
        }

        // Successfully linked!
        if (result.hasKeys) {
          // Keys already set — go straight to done
          await sendTelegramMessage(chatId,
            `✅ *Аккаунт привязан!*\n\nАккаунт \`${result.email}\` успешно подключён к боту.\n\nТвои API ключи уже настроены! 🎉\n\n🎙 Отправляй голосовые сообщения — я буду их анализировать и сохранять в Persona Life!`,
            env.TELEGRAM_BOT_TOKEN
          );
        } else {
          // Need to setup keys
          await sendTelegramMessage(chatId,
            `✅ *Аккаунт привязан!*\n\nАккаунт \`${result.email}\` подключён к боту.\n\n━━━━━━━━━━━━━━━━━━━━━━\n🔑 *Теперь нужно настроить API ключи*\n\nБот работает по принципу BYOK (Bring Your Own Key) — ты используешь свои бесплатные ключи, лимиты полностью твои.\n\n*Шаг 1 из 2: Groq API Key*\nGroq даёт бесплатную и быструю транскрибацию аудио (Whisper).\n\n1️⃣ Перейди на [console.groq.com/keys](https://console.groq.com/keys)\n2️⃣ Нажми "Create API Key"\n3️⃣ Скопируй ключ и *отправь его сюда*`,
            env.TELEGRAM_BOT_TOKEN
          );
        }
        return new Response("OK");
      }

      // /start without token — show instructions to link account
      const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

      if (userConfig && userConfig.botSetupStep === "done") {
        // Already fully set up
        await sendTelegramMessage(chatId,
          `👋 *С возвращением, ${firstName}!*\n\n🎙 Отправляй мне голосовые сообщения — я буду анализировать их и сохранять в твой Persona Life.\n\n*Доступные команды:*\n/reset — сбросить настройки ключей\n/help — справка`,
          env.TELEGRAM_BOT_TOKEN
        );
      } else {
        // Not linked or not setup
        await sendTelegramMessage(chatId,
          `👋 *Привет, ${firstName}!*\n\nЯ — голосовой ИИ-ассистент для *Persona Life*.\n\n━━━━━━━━━━━━━━━━━━━━━━\n🔗 *Для начала нужно привязать аккаунт*\n\n1️⃣ Зайди в свой аккаунт на *Persona Life*\n2️⃣ Перейди в *Настройки* → раздел *Telegram*\n3️⃣ Нажми кнопку *"Привязать Telegram бот"*\n4️⃣ Перейди по сгенерированной ссылке\n\nАккаунт привяжется автоматически!`,
          env.TELEGRAM_BOT_TOKEN
        );
      }
      return new Response("OK");
    }

    // ── Fetch user state for all other messages ──
    const userConfig = await fetchUserConfig(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
    const step = userConfig?.botSetupStep || null;

    // ── Not linked — always remind ──
    if (!userConfig) {
      await sendTelegramMessage(chatId,
        `🔗 Сначала нужно привязать аккаунт Persona Life.\n\nЗайди в настройки на сайте Persona Life → раздел *Telegram* → нажми "Привязать Telegram бот".`,
        env.TELEGRAM_BOT_TOKEN
      );
      return new Response("OK");
    }

    // ── Handle text commands ──
    if (message.text) {
      const text = message.text.trim();

      if (text === "/help") {
        await sendTelegramMessage(chatId,
          `ℹ️ *Справка*\n\n🎙 Отправь голосовое сообщение — я расшифрую его, проанализирую и сохраню в Persona Life.\n\n*Команды:*\n/start — главное меню\n/reset — сбросить API ключи (перенастроить)\n/help — эта справка`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      if (text === "/reset") {
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_groq", groqApiKey: null, geminiApiKey: null }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId,
          `🔄 *Ключи сброшены*\n\n*Шаг 1 из 2: Groq API Key*\n\n1️⃣ Перейди на [console.groq.com/keys](https://console.groq.com/keys)\n2️⃣ Нажми "Create API Key"\n3️⃣ Скопируй ключ и *отправь его сюда*`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      // ── Onboarding State Machine ──
      if (step === "awaiting_groq") {
        if (!text.startsWith("gsk_")) {
          await sendTelegramMessage(chatId,
            `⚠️ Ключ Groq должен начинаться с \`gsk_\`\n\nПроверь ключ и отправь его ещё раз.\n\nПолучить ключ: [console.groq.com/keys](https://console.groq.com/keys)`,
            env.TELEGRAM_BOT_TOKEN
          );
          return new Response("OK");
        }
        await updateUserConfig(telegramId, { botSetupStep: "awaiting_gemini", groqApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId,
          `✅ *Groq ключ сохранён!*\n\n*Шаг 2 из 2: Gemini API Key*\nGemini от Google анализирует текст и извлекает задачи, идеи и теги.\n\n1️⃣ Перейди в [Google AI Studio](https://aistudio.google.com/app/apikey)\n2️⃣ Нажми "Create API Key"\n3️⃣ Скопируй ключ и *отправь его сюда*`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      if (step === "awaiting_gemini") {
        await updateUserConfig(telegramId, { botSetupStep: "done", geminiApiKey: text }, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
        await sendTelegramMessage(chatId,
          `🎉 *Настройка завершена!*\n\nВсё готово! Теперь отправляй мне голосовые сообщения.\n\nЯ буду:\n🎙 Расшифровывать аудио\n🧠 Анализировать содержание\n✅ Извлекать задачи и идеи\n🏷 Добавлять теги\n📥 Автоматически сохранять в Persona Life\n\n*Жду твоё первое голосовое!*`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      // ── User is fully set up but sending text ──
      if (step === "done") {
        await sendTelegramMessage(chatId,
          `🎙 Отправь мне *голосовое сообщение* — я его обработаю!\n\n_Текстовые сообщения не поддерживаются._\n/help — справка`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      // Fallback for any other state
      await sendTelegramMessage(chatId,
        `Используй /start чтобы начать.`,
        env.TELEGRAM_BOT_TOKEN
      );
      return new Response("OK");
    }

    // ── Handle Voice / Audio ──
    const voiceData = message.voice || message.audio;
    if (!voiceData) {
      return new Response("OK");
    }

    // Check setup is complete
    if (step !== "done") {
      await sendTelegramMessage(chatId,
        `⚠️ Сначала нужно завершить настройку API ключей.\n\nОтправь /start чтобы начать.`,
        env.TELEGRAM_BOT_TOKEN
      );
      return new Response("OK");
    }

    // Acknowledge receipt
    await sendTelegramMessage(chatId,
      `⏳ *Обрабатываю голосовую заметку...*\nЭто займёт несколько секунд.`,
      env.TELEGRAM_BOT_TOKEN
    );

    try {
      const groqApiKey = userConfig.groqApiKey || (env as any).GROQ_API_KEY;
      const geminiKey = userConfig.geminiApiKey || env.GEMINI_API_KEY;

      if (!groqApiKey) {
        await sendTelegramMessage(chatId,
          `❌ Groq API ключ не найден. Отправь /reset чтобы перенастроить.`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      // 1. Get file path from Telegram
      const filePath = await getTelegramFilePath(voiceData.file_id, env.TELEGRAM_BOT_TOKEN);

      // 2. Transcribe via Groq Whisper
      let transcript: string;
      try {
        transcript = await transcribeAudioInMemory(filePath, env.TELEGRAM_BOT_TOKEN, groqApiKey);
      } catch (whisperErr: any) {
        console.error("[worker] Groq Whisper failed:", whisperErr.message);
        await sendTelegramMessage(chatId,
          `❌ Ошибка транскрибации: ${whisperErr.message}\n\nПроверь правильность Groq ключа. Отправь /reset чтобы перенастроить.`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      if (!transcript || transcript.length < 3) {
        await sendTelegramMessage(chatId, `⚠️ Не удалось распознать речь. Попробуй говорить чётче.`, env.TELEGRAM_BOT_TOKEN);
        return new Response("OK");
      }

      // 3. Run AI Pipeline via Gemini
      const result = await runPocketPipeline(transcript, geminiKey);

      // 4. Push result to Persona Life
      await pushResultToServer(telegramId, message.message_id, transcript, result, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);

      // 5. Send formatted response
      const replyText = formatResultMessage(result, transcript);
      await sendTelegramMessage(chatId, replyText, env.TELEGRAM_BOT_TOKEN);

    } catch (err: any) {
      console.error("[worker] Fatal error:", err);
      await sendTelegramMessage(chatId,
        `❌ Произошла ошибка при обработке. Попробуй ещё раз.\n\n_${err?.message || "Неизвестная ошибка"}_`,
        env.TELEGRAM_BOT_TOKEN
      );
    }

    return new Response("OK");
  },
};

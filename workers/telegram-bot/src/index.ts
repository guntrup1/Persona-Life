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

// ── Send Telegram message helper ──
async function sendTelegramMessage(chatId: number, text: string, botToken: string, parseMode: string = "Markdown"): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

// ── Lookup user's Groq key from the main app's API ──
async function fetchUserGroqKey(telegramId: string, renderUrl: string, workerSecret: string): Promise<string | null> {
  try {
    const res = await fetch(`${renderUrl}/api/internal/user-config?telegramId=${telegramId}`, {
      headers: { "x-worker-secret": workerSecret },
    });
    if (!res.ok) return null;
    const data = await res.json() as { groqApiKey?: string };
    return data.groqApiKey || null;
  } catch {
    return null;
  }
}

// ── Push processed result back to main server ──
async function pushResultToServer(
  telegramId: string,
  messageId: number,
  transcript: string,
  result: ReturnType<typeof runPocketPipeline> extends Promise<infer T> ? T : never,
  renderUrl: string,
  workerSecret: string
): Promise<void> {
  await fetch(`${renderUrl}/api/internal/audio-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

  lines.push(`🎙 *Голосовая заметка обработана*`);
  lines.push(``);
  lines.push(`📝 *Суть:*`);
  lines.push(result.executive_summary);

  if (result.key_insights?.length > 0) {
    lines.push(``);
    lines.push(`💡 *Ключевые мысли:*`);
    result.key_insights.forEach(i => lines.push(`• ${i}`));
  }

  if (result.action_items?.length > 0) {
    lines.push(``);
    lines.push(`✅ *Задачи:*`);
    result.action_items.forEach(a => {
      const who = a.assignee ? ` \\(${a.assignee}\\)` : "";
      const prio = a.priority === "high" ? " 🔴" : a.priority === "medium" ? " 🟡" : " 🟢";
      lines.push(`• ${a.task}${who}${prio}`);
    });
  }

  if (result.semantic_tags?.length > 0) {
    lines.push(``);
    lines.push(`🏷 *Теги:* ${result.semantic_tags.map(t => `#${t.replace(/\s+/g, '_')}`).join(' ')}`);
  }

  if (result.note_type) {
    const typeEmoji: Record<string, string> = {
      idea: "💡", task: "✅", reflection: "🧘", trading: "📈", plan: "🗺️", other: "📌"
    };
    lines.push(``);
    lines.push(`📂 *Тип заметки:* ${typeEmoji[result.note_type] || "📌"} ${result.note_type}`);
  }

  lines.push(``);
  lines.push(`_Заметка сохранена в Persona Life_`);

  return lines.join('\n');
}

// ── Main Worker Handler ──
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle POST (Telegram sends updates via POST)
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
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

    // ── Handle /start and /help commands ──
    if (message.text) {
      const text = message.text.trim();

      if (text === "/start") {
        await sendTelegramMessage(chatId, 
          `👋 *Привет, ${firstName}!*\n\nЯ — голосовой ИИ-ассистент для *Persona Life*.\n\nОтправь мне голосовое сообщение — я расшифрую его, проанализирую и сохраню как умную заметку с задачами и тегами.\n\n🎙 *Просто нажми на микрофон!*`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      if (text === "/help") {
        await sendTelegramMessage(chatId,
          `ℹ️ *Как пользоваться:*\n\n1. Отправь голосовое сообщение\n2. Я расшифрую аудио через Whisper AI\n3. Обработаю через GPT и извлеку суть, задачи и теги\n4. Сохраню всё в Persona Life\n\n*Команды:*\n/start — приветствие\n/help — эта справка`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      // Unknown text — friendly hint
      await sendTelegramMessage(chatId,
        `🎙 Отправь мне *голосовое сообщение*, и я его обработаю!`,
        env.TELEGRAM_BOT_TOKEN
      );
      return new Response("OK");
    }

    // ── Handle Voice / Audio ──
    const voiceData = message.voice || message.audio;
    if (!voiceData) {
      return new Response("OK"); // Ignore other updates
    }

    // Respond immediately to Telegram (must respond within 60s)
    // We'll process async but Cloudflare Workers can hold the connection open briefly
    await sendTelegramMessage(chatId,
      `⏳ Обрабатываю голосовую заметку...\nЭто займёт несколько секунд.`,
      env.TELEGRAM_BOT_TOKEN
    );

    try {
      // 1. Lookup user's Groq key (BYOK model)
      const userGroqKey = await fetchUserGroqKey(telegramId, env.RENDER_APP_URL, env.WORKER_SECRET_TOKEN);
      const groqKey = userGroqKey || env.GEMINI_API_KEY; // fallback to env Groq key if available

      // 2. Get file path from Telegram
      const filePath = await getTelegramFilePath(voiceData.file_id, env.TELEGRAM_BOT_TOKEN);

      // 3. Transcribe in memory — ZERO disk I/O
      // Note: For Cloudflare Workers, we need a Groq API key for Whisper
      // If user has no Groq key, we'll use the fallback env key
      let transcript: string;
      try {
        // Try Groq Whisper first (best quality, lowest latency)
        const groqApiKey = userGroqKey || (env as any).GROQ_API_KEY;
        if (!groqApiKey) throw new Error("No Groq key available");
        transcript = await transcribeAudioInMemory(filePath, env.TELEGRAM_BOT_TOKEN, groqApiKey);
      } catch (whisperErr: any) {
        console.error("[worker] Groq Whisper failed:", whisperErr.message);
        await sendTelegramMessage(chatId,
          `❌ Ошибка транскрибации: ${whisperErr.message}\n\nПроверь настройки API-ключа в приложении.`,
          env.TELEGRAM_BOT_TOKEN
        );
        return new Response("OK");
      }

      if (!transcript || transcript.length < 3) {
        await sendTelegramMessage(chatId, `⚠️ Не удалось распознать речь. Попробуй говорить чётче.`, env.TELEGRAM_BOT_TOKEN);
        return new Response("OK");
      }

      // 4. Run Pocket Pipeline (with Map-Reduce for long transcripts)
      const result = await runPocketPipeline(transcript, env.GEMINI_API_KEY);

      // 5. Push result to main Render server
      await pushResultToServer(
        telegramId,
        message.message_id,
        transcript,
        result,
        env.RENDER_APP_URL,
        env.WORKER_SECRET_TOKEN
      );

      // 6. Send beautiful formatted response to user
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

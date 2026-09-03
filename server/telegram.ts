// One-way delivery of support reports and error notifications to the owner's Telegram chat.
// Token + chat id are read from env (never hardcoded). Only SUPPORT_CHAT_ID
// ever receives messages, so access to incoming reports stays with the owner.
//
// Required env vars (set in Render):
//   SUPPORT_BOT_TOKEN  — token of the OWNER's bot (your bot for receiving reports)
//   SUPPORT_CHAT_ID    — your Telegram user ID (where the bot sends reports to you)
//
// NOTE: TELEGRAM_BOT_TOKEN belongs to each USER's personal assistant bot — do NOT use it here.

/**
 * Send a message to an arbitrary Telegram chat via the owner's support bot.
 */
export async function sendTelegramMessage(
  chatId: string | undefined,
  text: string,
  token?: string
): Promise<boolean> {
  const botToken = token || process.env.SUPPORT_BOT_TOKEN;

  if (!botToken || !chatId) {
    console.warn(
      "[support] SUPPORT_BOT_TOKEN or SUPPORT_CHAT_ID not set — skipping Telegram delivery"
    );
    return false;
  }

  const safeText = text.length > 4000 ? text.slice(0, 4000) + "\n…(обрезано)" : text;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: safeText, parse_mode: "HTML" }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("[support] Telegram send failed:", res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[support] Telegram send error:", e);
    return false;
  }
}

/**
 * Convenience helper — sends to the configured owner chat (SUPPORT_CHAT_ID).
 */
export async function notifyOwner(text: string): Promise<boolean> {
  const chatId = process.env.SUPPORT_CHAT_ID;
  return sendTelegramMessage(chatId, text);
}

/**
 * Check if an error message/object looks like a Gemini API rate limit (429).
 */
export function isRateLimitError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("Too Many Requests") ||
    msg.includes("quota")
  );
}

// One-way delivery of support reports to the owner's Telegram chat.
// Token + chat id are read from env (never hardcoded). Only SUPPORT_CHAT_ID
// ever receives messages, so access to incoming reports stays with the owner.

export async function sendTelegramMessage(chatId: string | undefined, text: string, token?: string): Promise<boolean> {
  const botToken = token || process.env.SUPPORT_BOT_TOKEN;
  if (!botToken || !chatId) {
    console.warn("[support] SUPPORT_BOT_TOKEN or SUPPORT_CHAT_ID not set — skipping Telegram delivery");
    return false;
  }
  const safeText = text.length > 4000 ? text.slice(0, 4000) + "\n…(обрезано)" : text;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: safeText }),
    });
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

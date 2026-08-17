const fs = require('fs');
let code = fs.readFileSync('workers/telegram-bot/src/index.ts', 'utf8');

code = code.replace(/export interface Env [\s\S]+?\}/, '');

const startRegex = /export default \{[\s\S]+?async fetch\(request: Request, env: Env, ctx: ExecutionContext\): Promise<Response> \{/;
const replacementStart = `import type { Express } from "express";

export function registerTelegramWebhookRoutes(app: Express) {
  app.post("/api/telegram-webhook", async (req, res) => {
    res.send("OK");
    const update = req.body;
    if (!update) return;
    const env = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "8845042057:AAGHZysBa3BDbBeV6iBCwIG7qvKkPXvKVuA",
      WORKER_SECRET_TOKEN: process.env.WORKER_SECRET_TOKEN || "secret-persona-2026-xk9",
      RENDER_APP_URL: "https://persona-life-mw90.onrender.com"
    };`;

code = code.replace(startRegex, replacementStart);
code = code.replace(/return new Response\(\"OK\"\);?/g, 'return;');
code = code.replace(/if \(request\.method \!\=\= \"POST\"\) return;/, '');
code = code.replace(/let update: any;[\s\S]+?return;/g, '');

const waitRegex = /ctx\.waitUntil\([\s\S]+?\)\;/;
const replacementWait = `fetch(\`\${env.RENDER_APP_URL}/api/internal/process-audio\`, {
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
    });`;

code = code.replace(waitRegex, replacementWait);
code = code.replace(/return;\n  \},\n\};\n?$/, '  });\n}\n');

fs.writeFileSync('server/telegram-webhook.ts', code);
console.log('Conversion successful!');

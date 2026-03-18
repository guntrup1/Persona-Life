import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerAuthRoutes } from "./auth";

interface NewsItem {
  title: string;
  currency: string;
  impact: string;
  date: string;
  time: string;
  forecast: string;
  previous: string;
  actual: string;
  dateNormalized: string;
  day: "today" | "next" | "other";
}

interface NewsCache {
  fetchedAt: number;
  allHighImpact: NewsItem[];
  todayStr: string;
  nextStr: string;
}

let newsCache: NewsCache | null = null;
let fetchPromise: Promise<NewsCache> | null = null;

function parseXMLField(block: string, tag: string): string {
  // Handle CDATA: <tag><![CDATA[value]]></tag>
  const cdataMatch = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i")
  );
  if (cdataMatch) return cdataMatch[1].trim();
  // Handle plain: <tag>value</tag>
  const plainMatch = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  if (plainMatch) return plainMatch[1].trim();
  return "";
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function getBerlinDateString(offsetDays = 0): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const berlin = new Date(utc + 3600000 + offsetDays * 86400000); // UTC+1
  return berlin.toISOString().split("T")[0];
}

function parseDateFromFF(dateStr: string): string {
  if (!dateStr) return "";
  const s = dateStr.trim();

  // MM-DD-YYYY (Forex Factory format: "03-11-2026")
  const a = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (a) return `${a[3]}-${a[1].padStart(2, "0")}-${a[2].padStart(2, "0")}`;

  // MM/DD/YYYY
  const b = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (b) return `${b[3]}-${b[1].padStart(2, "0")}-${b[2].padStart(2, "0")}`;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  return "";
}

function parseTimeToMinutes(t: string): number {
  if (!t) return 9999;
  const a = t.match(/(\d+):(\d+)(am|pm)/i);
  if (a) {
    let h = parseInt(a[1]);
    const m = parseInt(a[2]);
    if (a[3].toLowerCase() === "pm" && h < 12) h += 12;
    if (a[3].toLowerCase() === "am" && h === 12) h = 0;
    return h * 60 + m;
  }
  const b = t.match(/(\d{1,2}):(\d{2})/);
  if (b) return parseInt(b[1]) * 60 + parseInt(b[2]);
  return 9999;
}

function shiftTime(timeStr: string, offsetHours: number): { time: string; dayDelta: number } {
  if (!timeStr) return { time: timeStr, dayDelta: 0 };
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!match) return { time: timeStr, dayDelta: 0 };

  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toLowerCase();

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  h += offsetHours;
  let dayDelta = 0;
  if (h >= 24) { h -= 24; dayDelta = 1; }
  if (h < 0) { h += 24; dayDelta = -1; }

  const newAmpm = h >= 12 ? "pm" : "am";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return { time: `${h12}:${String(m).padStart(2, "0")}${newAmpm}`, dayDelta };
}

function shiftDateStr(dateStr: string, days: number): string {
  if (!days || !dateStr) return dateStr;
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function extractHighImpact(xml: string) {
  const results: Array<{
    title: string; currency: string; impact: string; date: string;
    time: string; forecast: string; previous: string; actual: string;
    dateNormalized: string;
  }> = [];

  const blocks = xml.match(/<event>[\s\S]*?<\/event>/gi) || [];
  console.log(`[news] XML blocks: ${blocks.length}`);

  for (const block of blocks) {
    const currency = parseXMLField(block, "country").toUpperCase();
    if (!["USD", "EUR"].includes(currency)) continue;

    const impact = parseXMLField(block, "impact");
    if (impact !== "High") continue;

    const title = decodeHtml(parseXMLField(block, "title"));
    const rawDate = parseXMLField(block, "date");
    const time = parseXMLField(block, "time");
    const forecast = parseXMLField(block, "forecast");
    const previous = parseXMLField(block, "previous");
    const actual = parseXMLField(block, "actual");

    if (!title || !rawDate) continue;

    const dateNormalized = parseDateFromFF(rawDate);
    if (!dateNormalized) {
      console.log(`[news] could not parse date: "${rawDate}" for "${title}"`);
      continue;
    }

    const shifted = shiftTime(time, 1);
    const adjustedDate = shiftDateStr(dateNormalized, shifted.dayDelta);
    results.push({ title, currency, impact, date: rawDate, time: shifted.time, forecast, previous, actual, dateNormalized: adjustedDate });
  }

  return results;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchXML(url: string): Promise<string> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/xml, application/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(id);
    } catch (err) {
      clearTimeout(id);
      throw err;
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "75", 10);
      if (attempt === 0) {
        console.log(`[news] 429 — waiting ${retryAfter}s then retrying...`);
        await sleep(retryAfter * 1000);
        continue;
      }
      throw new Error(`HTTP 429 rate limited`);
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
  throw new Error("Max retries exceeded");
}

async function doFetch(): Promise<NewsCache> {
  const todayStr = getBerlinDateString();
  let rawEvents: Array<{
    title: string; currency: string; impact: string; date: string;
    time: string; forecast: string; previous: string; actual: string;
    dateNormalized: string;
  }> = [];

  try {
    console.log("[news] fetching thisweek...");
    const xml = await fetchXML("https://nfs.faireconomy.media/ff_calendar_thisweek.xml");
    const events = extractHighImpact(xml);
    console.log(`[news] thisweek → ${events.length} HIGH EUR/USD events`);
    rawEvents.push(...events);
  } catch (err) {
    console.error("[news] thisweek failed:", String(err));
  }

  // Brief pause to avoid rate limiting
  await sleep(800);

  try {
    console.log("[news] fetching nextweek...");
    const xml = await fetchXML("https://nfs.faireconomy.media/ff_calendar_nextweek.xml");
    const events = extractHighImpact(xml);
    console.log(`[news] nextweek → ${events.length} HIGH EUR/USD events`);
    rawEvents.push(...events);
  } catch (err) {
    console.log("[news] nextweek skip:", String(err).slice(0, 60));
  }

  rawEvents.sort((a, b) => {
    if (a.dateNormalized !== b.dateNormalized) return a.dateNormalized.localeCompare(b.dateNormalized);
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });

  const todayEvents = rawEvents.filter(e => e.dateNormalized === todayStr);
  const futureDates = [...new Set(rawEvents.map(e => e.dateNormalized).filter(d => d > todayStr))].sort();
  const nextStr = futureDates[0] || "";

  console.log(`[news] today=${todayStr}(${todayEvents.length}), next=${nextStr}(${rawEvents.filter(e => e.dateNormalized === nextStr).length})`);

  const allHighImpact: NewsItem[] = rawEvents
    .filter(e => e.dateNormalized === todayStr || (nextStr && e.dateNormalized === nextStr))
    .map(e => ({ ...e, day: e.dateNormalized === todayStr ? "today" : "next" }));

  return { fetchedAt: Date.now(), allHighImpact, todayStr, nextStr };
}

async function getNews(forceRefresh = false): Promise<NewsCache> {
  const todayStr = getBerlinDateString();
  const CACHE_MS = 30 * 60 * 1000; // 30 min

  // Return cache if fresh enough and not force-refreshing
  if (!forceRefresh && newsCache && newsCache.todayStr === todayStr && Date.now() - newsCache.fetchedAt < CACHE_MS) {
    return newsCache;
  }

  // Deduplicate concurrent fetches
  if (!fetchPromise) {
    fetchPromise = doFetch()
      .then(result => {
        newsCache = result;
        fetchPromise = null;
        return result;
      })
      .catch(err => {
        fetchPromise = null;
        throw err;
      });
  }

  try {
    return await fetchPromise;
  } catch {
    // If fetch fails and we have old cache, return it
    if (newsCache) return newsCache;
    return { fetchedAt: Date.now(), allHighImpact: [], todayStr, nextStr: "" };
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app);





  app.get("/api/news", async (req, res) => {
    try {
      const utcOffset = parseFloat(req.query.utcOffset as string);
      const cache = await getNews();

      if (!isNaN(utcOffset)) {
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const userTime = new Date(utc + utcOffset * 3600000);
        const todayStr = userTime.toISOString().split("T")[0];

        const futureDates = [...new Set(
          cache.allHighImpact
            .map(e => e.dateNormalized)
            .filter(d => d > todayStr)
        )].sort();
        const nextStr = futureDates[0] || "";

        const items = cache.allHighImpact.map(e => ({
          ...e,
          day: e.dateNormalized === todayStr ? "today" : (e.dateNormalized === nextStr ? "next" : "other"),
        }));

        return res.json({ items, todayStr, nextStr });
      }

      res.json({ items: cache.allHighImpact, todayStr: cache.todayStr, nextStr: cache.nextStr });
    } catch (err) {
      console.error("[api/news]", err);
      res.json({ items: [], todayStr: "", nextStr: "" });
    }
  });











  

  app.get("/api/news/today", async (_req, res) => {
    try {
      const cache = await getNews();
      res.json(cache.allHighImpact.filter(n => n.day === "today"));
    } catch {
      res.json([]);
    }
  });

  app.post("/api/news/refresh", async (_req, res) => {
    newsCache = null;
    fetchPromise = null;
    try {
      const cache = await getNews(true);
      res.json({ count: cache.allHighImpact.length, todayStr: cache.todayStr, nextStr: cache.nextStr });
    } catch (err) {
      console.error("[api/news/refresh]", err);
      res.json({ count: 0, error: String(err) });
    }
  });

  // ── Обратная связь ──
  app.post("/api/feedback", async (req, res) => {
    const { message, email } = req.body;
    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return res.status(400).json({ message: "Сообщение слишком короткое" });
    }
    try {
      const OWNER_EMAIL = process.env.FEEDBACK_EMAIL || process.env.BREVO_SENDER_EMAIL || "bigmon42086@gmail.com";
      const senderEmail = process.env.BREVO_SENDER_EMAIL || "bigmon42086@gmail.com";

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: { name: "Persona Life Feedback", email: senderEmail },
          to: [{ email: OWNER_EMAIL }],
          subject: `[Фидбек] от ${email || "анонима"}`,
          htmlContent: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
              <h2 style="color:#E11D48;letter-spacing:0.15em;font-size:18px;margin:0 0 8px;">PERSONA LIFE — ФИДБЕК</h2>
              <p style="color:#666;font-size:12px;margin:0 0 24px;">От: <strong style="color:#aaa">${email || "анонима"}</strong></p>
              <div style="background:#1a1a1a;border-left:3px solid #E11D48;padding:16px 20px;font-size:15px;line-height:1.6;color:#eee;white-space:pre-wrap;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <p style="color:#444;font-size:11px;margin-top:24px;">Отправлено: ${new Date().toLocaleString("ru-RU")}</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Feedback email error:", err);
        return res.status(500).json({ message: "Ошибка отправки" });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error("Feedback route error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  return httpServer;
}

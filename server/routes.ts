import type { Express } from "express";
import { createServer, type Server } from "http";

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
  fetchedAt: string;
  allHighImpact: NewsItem[];
  todayStr: string;
  nextStr: string;
}

let newsCache: NewsCache | null = null;

function parseXMLField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
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
  const berlinOffset = 1 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const berlin = new Date(utc + berlinOffset * 60000 + offsetDays * 86400000);
  return berlin.toISOString().split("T")[0];
}

function parseDateFromFF(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  const mmddyy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mmddyy) {
    const [, mm, dd, yyyy] = mmddyy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return cleaned;
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 9999;
  const amPm = timeStr.match(/(\d+):(\d+)(am|pm)/i);
  if (amPm) {
    let h = parseInt(amPm[1]);
    const m = parseInt(amPm[2]);
    const period = amPm[3].toLowerCase();
    if (period === "pm" && h < 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return h * 60 + m;
  }
  const h24 = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (h24) {
    return parseInt(h24[1]) * 60 + parseInt(h24[2]);
  }
  return 9999;
}

function extractAllHighImpact(xml: string): Array<{ title: string; currency: string; impact: string; date: string; time: string; forecast: string; previous: string; actual: string; dateNormalized: string }> {
  const events: Array<{ title: string; currency: string; impact: string; date: string; time: string; forecast: string; previous: string; actual: string; dateNormalized: string }> = [];
  const eventMatches = xml.match(/<event>[\s\S]*?<\/event>/gi) || [];

  for (const block of eventMatches) {
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

    if (!title) continue;

    const dateNormalized = parseDateFromFF(rawDate);
    if (!dateNormalized) continue;

    events.push({ title, currency, impact, date: rawDate, time, forecast, previous, actual, dateNormalized });
  }

  return events;
}

async function fetchXML(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LifeOS/1.0)",
        "Accept": "application/xml, text/xml, */*",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function fetchForexFactoryNews(): Promise<NewsCache> {
  const todayStr = getBerlinDateString();

  if (newsCache && newsCache.fetchedAt === todayStr) {
    return newsCache;
  }

  let rawEvents: Array<{ title: string; currency: string; impact: string; date: string; time: string; forecast: string; previous: string; actual: string; dateNormalized: string }> = [];

  try {
    const thisWeekXML = await fetchXML("https://nfs.faireconomy.media/ff_calendar_thisweek.xml");
    rawEvents.push(...extractAllHighImpact(thisWeekXML));
  } catch (err) {
    console.error("[news] Failed to fetch this week:", err);
  }

  try {
    const nextWeekXML = await fetchXML("https://nfs.faireconomy.media/ff_calendar_nextweek.xml");
    rawEvents.push(...extractAllHighImpact(nextWeekXML));
  } catch (err) {
    // next week might return 404 if not published yet - this is normal
  }

  // Sort all events by date then time
  rawEvents.sort((a, b) => {
    if (a.dateNormalized !== b.dateNormalized) return a.dateNormalized.localeCompare(b.dateNormalized);
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });

  // Find today's events
  const todayEvents = rawEvents.filter(e => e.dateNormalized === todayStr);

  // Find the nearest future day with high-impact events (strictly after today)
  const futureDates = [...new Set(rawEvents.map(e => e.dateNormalized).filter(d => d > todayStr))].sort();
  const nextStr = futureDates[0] || "";

  // Build final items
  const allHighImpact: NewsItem[] = rawEvents
    .filter(e => e.dateNormalized === todayStr || e.dateNormalized === nextStr)
    .map(e => ({
      ...e,
      day: e.dateNormalized === todayStr ? "today" : "next",
    }));

  const result: NewsCache = {
    fetchedAt: todayStr,
    allHighImpact,
    todayStr,
    nextStr,
  };

  newsCache = result;
  return result;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/news", async (req, res) => {
    try {
      const cache = await fetchForexFactoryNews();
      res.json({ items: cache.allHighImpact, todayStr: cache.todayStr, nextStr: cache.nextStr });
    } catch (err) {
      console.error("[api/news]", err);
      res.json({ items: [], todayStr: getBerlinDateString(), nextStr: "" });
    }
  });

  app.get("/api/news/today", async (req, res) => {
    try {
      const cache = await fetchForexFactoryNews();
      res.json(cache.allHighImpact.filter(n => n.day === "today"));
    } catch (err) {
      console.error("[api/news/today]", err);
      res.json([]);
    }
  });

  app.post("/api/news/refresh", async (req, res) => {
    newsCache = null;
    try {
      const cache = await fetchForexFactoryNews();
      res.json({ count: cache.allHighImpact.length });
    } catch (err) {
      res.json({ count: 0, error: String(err) });
    }
  });

  return httpServer;
}

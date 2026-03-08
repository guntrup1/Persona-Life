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
  day: "today" | "tomorrow" | "other";
}

interface NewsCache {
  fetchedAt: string;
  data: NewsItem[];
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
    const d = parsed.toISOString().split("T")[0];
    return d;
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

function extractEvents(xml: string, todayStr: string, tomorrowStr: string): NewsItem[] {
  const events: NewsItem[] = [];
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

    let day: "today" | "tomorrow" | "other" = "other";
    if (dateNormalized === todayStr) day = "today";
    else if (dateNormalized === tomorrowStr) day = "tomorrow";

    if (day === "other") continue;

    events.push({ title, currency, impact, date: rawDate, time, forecast, previous, actual, dateNormalized, day });
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

async function fetchForexFactoryNews(): Promise<NewsItem[]> {
  const todayStr = getBerlinDateString();

  if (newsCache && newsCache.fetchedAt === todayStr) {
    return newsCache.data;
  }

  const tomorrowStr = getBerlinDateString(1);

  let allEvents: NewsItem[] = [];

  try {
    const thisWeekXML = await fetchXML("https://nfs.faireconomy.media/ff_calendar_thisweek.xml");
    const thisWeekEvents = extractEvents(thisWeekXML, todayStr, tomorrowStr);
    allEvents.push(...thisWeekEvents);
  } catch (err) {
    console.error("[news] Failed to fetch this week:", err);
  }

  const tomorrowInNextWeek = tomorrowStr > todayStr;
  if (tomorrowInNextWeek && !allEvents.some(e => e.day === "tomorrow")) {
    try {
      const nextWeekXML = await fetchXML("https://nfs.faireconomy.media/ff_calendar_nextweek.xml");
      const nextWeekEvents = extractEvents(nextWeekXML, todayStr, tomorrowStr);
      allEvents.push(...nextWeekEvents);
    } catch (err) {
      console.error("[news] Failed to fetch next week:", err);
    }
  }

  allEvents.sort((a, b) => {
    if (a.day !== b.day) return a.day === "today" ? -1 : 1;
    return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
  });

  if (allEvents.length > 0 || !newsCache) {
    newsCache = { fetchedAt: todayStr, data: allEvents };
  }

  return newsCache?.data || allEvents;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/news", async (req, res) => {
    try {
      const news = await fetchForexFactoryNews();
      res.json(news);
    } catch (err) {
      console.error("[api/news]", err);
      res.json([]);
    }
  });

  app.get("/api/news/today", async (req, res) => {
    try {
      const news = await fetchForexFactoryNews();
      res.json(news.filter(n => n.day === "today"));
    } catch (err) {
      console.error("[api/news/today]", err);
      res.json([]);
    }
  });

  app.get("/api/news/tomorrow", async (req, res) => {
    try {
      const news = await fetchForexFactoryNews();
      res.json(news.filter(n => n.day === "tomorrow"));
    } catch (err) {
      console.error("[api/news/tomorrow]", err);
      res.json([]);
    }
  });

  app.post("/api/news/refresh", async (req, res) => {
    newsCache = null;
    try {
      const news = await fetchForexFactoryNews();
      res.json({ count: news.length });
    } catch (err) {
      res.json({ count: 0, error: String(err) });
    }
  });

  return httpServer;
}

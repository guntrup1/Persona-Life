import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

interface NewsItem {
  title: string;
  currency: string;
  impact: string;
  date: string;
  time: string;
  forecast: string;
  previous: string;
  actual: string;
}

let newsCache: { date: string; data: NewsItem[] } | null = null;

function parseXMLField(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function extractEvents(xml: string): NewsItem[] {
  const events: NewsItem[] = [];
  const eventMatches = xml.match(/<event>[\s\S]*?<\/event>/gi) || [];

  for (const block of eventMatches) {
    const currency = parseXMLField(block, "country");
    if (!["USD", "EUR"].includes(currency.toUpperCase())) continue;

    const impact = parseXMLField(block, "impact");
    const title = parseXMLField(block, "title")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    const date = parseXMLField(block, "date");
    const time = parseXMLField(block, "time");
    const forecast = parseXMLField(block, "forecast");
    const previous = parseXMLField(block, "previous");
    const actual = parseXMLField(block, "actual");

    if (!title) continue;

    events.push({ title, currency: currency.toUpperCase(), impact, date, time, forecast, previous, actual });
  }

  return events;
}

async function fetchForexFactoryNews(): Promise<NewsItem[]> {
  const today = new Date().toISOString().split("T")[0];

  if (newsCache && newsCache.date === today) {
    return newsCache.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.xml", {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LifeOS/1.0)",
        "Accept": "application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const events = extractEvents(text);

    newsCache = { date: today, data: events };
    return events;
  } catch (err) {
    console.error("[news] Failed to fetch Forex Factory:", err);
    if (newsCache) return newsCache.data;
    return [];
  }
}

function getBerlinDateString(): string {
  const now = new Date();
  const berlinOffset = 1 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const berlin = new Date(utc + berlinOffset * 60000);
  return berlin.toISOString().split("T")[0];
}

function parseDateFromFF(dateStr: string): string {
  if (!dateStr) return "";
  const cleaned = dateStr.trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return cleaned;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/news", async (req, res) => {
    try {
      const news = await fetchForexFactoryNews();
      const normalized = news.map(n => ({ ...n, dateNormalized: parseDateFromFF(n.date) }));
      res.json(normalized);
    } catch (err) {
      console.error("[api/news]", err);
      res.json([]);
    }
  });

  app.get("/api/news/today", async (req, res) => {
    try {
      const news = await fetchForexFactoryNews();
      const berlinToday = getBerlinDateString();
      const todayHigh = news.filter(n => {
        const dateNorm = parseDateFromFF(n.date);
        return dateNorm === berlinToday && n.impact === "High";
      });
      res.json(todayHigh);
    } catch (err) {
      console.error("[api/news/today]", err);
      res.json([]);
    }
  });

  app.post("/api/news/refresh", async (req, res) => {
    newsCache = null;
    try {
      const news = await fetchForexFactoryNews();
      res.json({ count: news.length });
    } catch (err) {
      res.json({ count: 0 });
    }
  });

  return httpServer;
}

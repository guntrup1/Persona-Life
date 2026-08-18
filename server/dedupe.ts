// Server-side duplicate protection for tasks, goals, notes and trading notes.
// Prevents the same entity being created twice (bot voice notes, UI double-clicks,
// routine auto-load on fresh devices, brainstorm exports, etc.).

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()\[\]{}"'«»—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export function stringsSimilar(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  // One contains the other ("выучить английский" vs "выучить английский за 3 месяца")
  if (na.length >= 8 && nb.includes(na)) return true;
  if (nb.length >= 8 && na.includes(nb)) return true;
  return 1 - levenshtein(na, nb) / maxLen >= 0.82;
}

export async function findDuplicateTask(model: any, userId: any, name: string, date?: string): Promise<any | null> {
  const filter: any = { userId };
  if (date) filter.date = date;
  const candidates = await model.find(filter).select("name").lean();
  for (const c of candidates) {
    if (stringsSimilar(c.name, name)) return c;
  }
  return null;
}

export async function findDuplicateGoal(model: any, userId: any, title: string): Promise<any | null> {
  const candidates = await model.find({ userId, status: { $ne: "completed" } }).select("title").lean();
  for (const c of candidates) {
    if (stringsSimilar(c.title, title)) return c;
  }
  return null;
}

const NOTE_LOOKBACK_DAYS = 60;

export async function findDuplicateDayNote(model: any, userId: any, content: string, title?: string): Promise<any | null> {
  const since = new Date(Date.now() - NOTE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const candidates = await model.find({ userId, date: { $gte: since } }).select("content title").lean();
  for (const c of candidates) {
    if (content && stringsSimilar(c.content, content)) return c;
    if (title && stringsSimilar(c.title || "", title)) return c;
  }
  return null;
}

export async function findDuplicateTradingNote(model: any, userId: any, text: string, title?: string): Promise<any | null> {
  const since = new Date(Date.now() - NOTE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const candidates = await model.find({ userId, date: { $gte: since } }).select("text title").lean();
  for (const c of candidates) {
    if (text && stringsSimilar(c.text, text)) return c;
    if (title && stringsSimilar(c.title || "", title)) return c;
  }
  return null;
}

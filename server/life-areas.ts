// ──────────────────────────────────────────────────────────────────────────────
// Canonical life-area categories — the ONLY categories the whole app uses
// (must stay in sync with client/src/lib/store.ts LIFE_AREAS)
// ──────────────────────────────────────────────────────────────────────────────

export const LIFE_AREAS = [
  "Body",
  "Mind",
  "Hard Skills",
  "Soft Skills",
  "Creativity",
  "Mission",
  "Finance",
] as const;

export type LifeArea = (typeof LIFE_AREAS)[number];

export const LIFE_AREAS_TEXT = LIFE_AREAS.join(", ");

// Gemini/LLM hallucinate arbitrary sphere names ("Health", "Здоровье", "Работа", ...).
// Map keywords → canonical category. Checked in order on the lowercased string,
// so more specific entries must come before more generic ones.
const LIFE_AREA_SYNONYMS: Array<[string, LifeArea]> = [
  // Money words that would otherwise be swallowed by generic keywords like "работ"/"курс" below
  ["заработ", "Finance"],
  ["зарплат", "Finance"],
  ["деньг", "Finance"],
  ["финанс", "Finance"],
  ["прирост", "Finance"],
  ["стартап", "Finance"],

  // Health / body
  ["health", "Body"],
  ["здоров", "Body"],
  ["body", "Body"],
  ["физическ", "Body"],
  ["спорт", "Body"],
  ["фитнес", "Body"],
  ["трениров", "Body"],
  ["тренаж", "Body"],
  ["бег", "Body"],
  ["пробеж", "Body"],
  ["сахар", "Body"],
  ["диет", "Body"],
  ["питани", "Body"],
  ["похуд", "Body"],
  ["сон", "Body"],
  ["медицин", "Body"],
  ["врач", "Body"],
  ["леч", "Body"],
  ["госпитал", "Body"],

  // Mind
  ["mind", "Mind"],
  ["разум", "Mind"],
  ["умны", "Mind"],
  ["мышл", "Mind"],
  ["психик", "Mind"],
  ["менталь", "Mind"],
  ["медитац", "Mind"],
  ["интеллект", "Mind"],
  ["настроени", "Mind"],
  ["эмоци", "Mind"],
  ["environment", "Mind"],
  ["окружен", "Mind"],

  // Hard Skills (career / education / work)
  ["hard skills", "Hard Skills"],
  ["hard skill", "Hard Skills"],
  ["карьер", "Hard Skills"],
  ["career", "Hard Skills"],
  ["работ", "Hard Skills"],
  ["work", "Hard Skills"],
  ["job", "Hard Skills"],
  ["професси", "Hard Skills"],
  ["навык", "Hard Skills"],
  ["skill", "Hard Skills"],
  ["учёб", "Hard Skills"],
  ["учеб", "Hard Skills"],
  ["обучен", "Hard Skills"],
  ["курс", "Hard Skills"],
  ["школ", "Hard Skills"],
  ["универ", "Hard Skills"],
  ["колледж", "Hard Skills"],
  ["студент", "Hard Skills"],
  ["экзамен", "Hard Skills"],
  ["язык", "Hard Skills"],
  ["language", "Hard Skills"],
  ["study", "Hard Skills"],
  ["learning", "Hard Skills"],
  ["education", "Hard Skills"],
  ["программир", "Hard Skills"],
  ["coding", "Hard Skills"],
  ["code", "Hard Skills"],
  ["проект", "Hard Skills"],

  // Soft Skills (communication / relationships)
  ["soft skills", "Soft Skills"],
  ["soft skill", "Soft Skills"],
  ["soft", "Soft Skills"],
  ["коммуник", "Soft Skills"],
  ["общен", "Soft Skills"],
  ["переговор", "Soft Skills"],
  ["встреч", "Soft Skills"],
  ["кино", "Soft Skills"],
  ["кофе", "Soft Skills"],
  ["партн", "Soft Skills"],
  ["relations", "Soft Skills"],
  ["отношени", "Soft Skills"],
  ["семья", "Soft Skills"],
  ["семей", "Soft Skills"],
  ["family", "Soft Skills"],
  ["друз", "Soft Skills"],
  ["friend", "Soft Skills"],
  ["нетворкинг", "Soft Skills"],

  // Creativity (art / hobbies / gifts)
  ["creativ", "Creativity"],
  ["творч", "Creativity"],
  ["креатив", "Creativity"],
  ["art", "Creativity"],
  ["музык", "Creativity"],
  ["music", "Creativity"],
  ["рису", "Creativity"],
  ["дизайн", "Creativity"],
  ["design", "Creativity"],
  ["хобби", "Creativity"],
  ["hobby", "Creativity"],
  ["подарк", "Creativity"],
  ["gift", "Creativity"],
  ["писат", "Creativity"],
  ["написа", "Creativity"],
  ["write", "Creativity"],
  ["фото", "Creativity"],
  ["съёмк", "Creativity"],
  ["video", "Creativity"],

  // Mission (purpose / spirit / meaning)
  ["mission", "Mission"],
  ["мисси", "Mission"],
  ["purpose", "Mission"],
  ["предназнач", "Mission"],
  ["смысл", "Mission"],
  ["духовн", "Mission"],
  ["spirit", "Mission"],
  ["видени", "Mission"],
  ["vision", "Mission"],
  ["ценност", "Mission"],
  ["благодарн", "Mission"],

  // Finance (money / trading / investing)
  ["finance", "Finance"],
  ["финанс", "Finance"],
  ["money", "Finance"],
  ["деньг", "Finance"],
  ["денег", "Finance"],
  ["заработ", "Finance"],
  ["wealth", "Finance"],
  ["богатств", "Finance"],
  ["инвестиц", "Finance"],
  ["invest", "Finance"],
  ["trading", "Finance"],
  ["трейдинг", "Finance"],
  ["трейдер", "Finance"],
  ["торговл", "Finance"],
  ["торгов", "Finance"],
  ["бирж", "Finance"],
  ["стратеги", "Finance"],
  ["рынок", "Finance"],
  ["доход", "Finance"],
  ["income", "Finance"],
  ["бюджет", "Finance"],
  ["budget", "Finance"],
  ["зарплат", "Finance"],
  ["salary", "Finance"],
  ["сбережен", "Finance"],
  ["депозит", "Finance"],
  ["акци", "Finance"],
  ["bitcoin", "Finance"],
  ["крипто", "Finance"],
  ["налог", "Finance"],
  ["счет", "Finance"],
];

/**
 * Map an arbitrary (LLM-provided, possibly hallucinated) sphere name to one of the
 * canonical LIFE_AREAS. Falls back to `fallback` (default "Mind") when nothing matches.
 */
export function mapToLifeArea(raw: string | null | undefined, fallback: LifeArea = "Mind"): LifeArea {
  if (!raw) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return fallback;

  // Exact match against canonical categories (e.g. "Hard Skills", "soft skills")
  for (const area of LIFE_AREAS) {
    if (normalized === area.toLowerCase()) return area;
  }

  // Keyword matching (order matters — more specific entries come first)
  for (const [keyword, area] of LIFE_AREA_SYNONYMS) {
    if (normalized.includes(keyword)) return area;
  }

  return fallback;
}
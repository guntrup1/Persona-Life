// ──────────────────────────────────────────────────────────────────────────────
// PIPELINE: Map-Reduce LLM Processing
// ──────────────────────────────────────────────────────────────────────────────

import {
  POCKET_PIPELINE_SYSTEM_PROMPT,
  CHUNK_SUMMARY_PROMPT,
  MAP_REDUCE_FINAL_PROMPT,
} from "./prompts";

const CHUNK_SIZE = 5000; // characters per chunk
const CHUNK_THRESHOLD = 6000; // if transcript longer than this, use Map-Reduce

export interface PocketResult {
  executive_summary: string;
  key_insights: string[];
  action_items: Array<{ task: string; assignee: string | null; priority: string }>;
  semantic_tags: string[];
  topics: string[];
  sentiment: string;
  mind_map_nodes: Array<{ entity: string; relation: string; target: string }>;
  questions_raised: string[];
  note_type: string;
}

/**
 * Split a long transcript into logical chunks at sentence boundaries.
 */
function chunkTranscript(text: string): string[] {
  if (text.length <= CHUNK_THRESHOLD) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }
    // Try to break at a sentence boundary (. ! ? or newline)
    const boundary = text.slice(end - 200, end + 200);
    const match = boundary.match(/[.!?\n]/);
    if (match && match.index !== undefined) {
      end = end - 200 + match.index + 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Robustly extract JSON from an LLM response that may contain extra text.
 * Tries multiple strategies to find and parse valid JSON.
 */
function extractJson(raw: string): any | null {
  if (!raw || typeof raw !== "string") return null;
  
  const trimmed = raw.trim();

  // Strategy 1: The response is already pure JSON
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch { /* fall through */ }
  }

  // Strategy 2: Find the LAST { and match to its closing } (handles preamble text)
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch { /* fall through */ }
  }

  // Strategy 3: Strip markdown code fences
  const stripped = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const sf = stripped.indexOf("{");
  const sl = stripped.lastIndexOf("}");
  if (sf !== -1 && sl !== -1 && sl > sf) {
    const candidate = stripped.slice(sf, sl + 1);
    try {
      return JSON.parse(candidate);
    } catch { /* fall through */ }
  }

  // Strategy 4: Try to fix truncated JSON by adding missing closing brackets/braces
  if (firstBrace !== -1) {
    let candidate = trimmed.slice(firstBrace);
    // count open brackets and add missing closing ones
    let opens = 0, openSquare = 0;
    for (const ch of candidate) {
      if (ch === "{") opens++;
      else if (ch === "}") opens--;
      else if (ch === "[") openSquare++;
      else if (ch === "]") openSquare--;
    }
    candidate = candidate + "]".repeat(Math.max(0, openSquare)) + "}".repeat(Math.max(0, opens));
    try {
      return JSON.parse(candidate);
    } catch { /* give up */ }
  }

  return null;
}

function parseJson(raw: string): PocketResult {
  const parsed = extractJson(raw);

  if (parsed && typeof parsed === "object" && parsed.executive_summary) {
    // Validate and normalise each field
    return {
      executive_summary: String(parsed.executive_summary || ""),
      key_insights: Array.isArray(parsed.key_insights)
        ? parsed.key_insights.map(String)
        : [],
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.map((a: any) => ({
            task: String(a.task || ""),
            assignee: a.assignee ?? null,
            priority: String(a.priority || "medium"),
          }))
        : [],
      semantic_tags: Array.isArray(parsed.semantic_tags)
        ? parsed.semantic_tags.map(String)
        : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      sentiment: String(parsed.sentiment || "neutral"),
      mind_map_nodes: Array.isArray(parsed.mind_map_nodes)
        ? parsed.mind_map_nodes.map((n: any) => ({
            entity: String(n.entity || ""),
            relation: String(n.relation || ""),
            target: String(n.target || ""),
          }))
        : [],
      questions_raised: Array.isArray(parsed.questions_raised)
        ? parsed.questions_raised.map(String)
        : [],
      note_type: String(parsed.note_type || "note"),
    };
  }

  // Absolute fallback: raw text as summary
  console.error("[pipeline] All JSON extraction strategies failed. Raw:", raw.slice(0, 300));
  return {
    executive_summary: raw.slice(0, 500) || "Обработка завершена",
    key_insights: [],
    action_items: [],
    semantic_tags: ["голосовое"],
    topics: [],
    sentiment: "neutral",
    mind_map_nodes: [],
    questions_raised: [],
    note_type: "note",
  };
}

/**
 * Call Gemini API with a given prompt and return the response text.
 */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  // Available models for this API key in 2026
  const modelsToTry = [
    { model: "gemini-3.6-flash",        apiVersion: "v1beta" },
    { model: "gemini-3.7-flash",        apiVersion: "v1beta" },
    { model: "gemini-flash-latest",     apiVersion: "v1beta" },
    { model: "gemini-2.5-flash",        apiVersion: "v1beta" }
  ];

  let lastError: Error = new Error("No Gemini models succeeded");
  let rateLimitError: Error | null = null;

  for (const { model, apiVersion } of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 3000,
        responseMimeType: "application/json",
      },
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 404 || res.status === 400) {
            // 400 may mean responseMimeType is not supported – retry without it
            if (res.status === 400 && attempt === 1) {
              const body2 = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
              };
              const res2 = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body2),
              });
              if (res2.ok) {
                const d2 = await res2.json() as any;
                const text2 = d2?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text2) return text2;
              }
            }
            lastError = new Error(`Gemini API ${res.status} on ${model} (${apiVersion}): ${errText}`);
            break; // try next model
          }
          if (res.status === 429) {
            rateLimitError = new Error(`Gemini API Rate Limit (429) на ${model}. Подождите и попробуйте снова.`);
            break; // try next model
          }
          if (res.status === 503) {
            lastError = new Error(`Gemini API 503 on model ${model}`);
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            break;
          }
          throw new Error(`Gemini API error (${res.status}): ${errText}`);
        }

        const data = await res.json() as any;
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error("Gemini returned no candidates (blocked or empty)");

        const text = candidate.content?.parts?.[0]?.text;
        if (!text) throw new Error("Gemini returned empty text response");

        return text;
      } catch (err: any) {
        lastError = err;
        break; // break attempt loop, try next model
      }
    }
  }

  if (rateLimitError) {
    throw rateLimitError;
  }
  throw lastError;
}

/**
 * Map step: summarize each chunk independently.
 */
async function mapChunks(chunks: string[], apiKey: string): Promise<string[]> {
  const summaryPromises = chunks.map((chunk, i) => {
    const prompt = `${CHUNK_SUMMARY_PROMPT}\n\n${chunk}`;
    return callGemini(prompt, apiKey).catch((err) => {
      console.error(`[pipeline] Chunk ${i} summary failed:`, err.message);
      return chunk.slice(0, 500); // fallback: use beginning of chunk
    });
  });
  return Promise.all(summaryPromises);
}

/**
 * Main pipeline entry point.
 * - Short transcripts (< 6000 chars): direct LLM call.
 * - Long transcripts: Map-Reduce strategy.
 */
export async function runPocketPipeline(
  transcript: string,
  geminiApiKey: string,
  mode: string = "notes"
): Promise<PocketResult> {
  const chunks = chunkTranscript(transcript);

  if (chunks.length === 1) {
    // ── Direct path ──
    const prompt = `${POCKET_PIPELINE_SYSTEM_PROMPT(mode)}\n\nTRANSCRIPT:\n${transcript}`;
    const raw = await callGemini(prompt, geminiApiKey);
    return parseJson(raw);
  }

  // ── Map-Reduce path ──
  console.log(`[pipeline] Transcript is ${transcript.length} chars. Using Map-Reduce with ${chunks.length} chunks.`);

  // Map: Summarize each chunk
  const chunkSummaries = await mapChunks(chunks, geminiApiKey);

  // Reduce: Final synthesis
  const finalPrompt = MAP_REDUCE_FINAL_PROMPT(chunkSummaries, mode);
  const raw = await callGemini(finalPrompt, geminiApiKey);
  return parseJson(raw);
}

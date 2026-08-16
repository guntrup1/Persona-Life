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
 * Call Gemini API with a given prompt and return the response text.
 */
async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${errText}`);
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  };

  return data.candidates[0]?.content?.parts[0]?.text || "";
}

/**
 * Parse raw LLM output into PocketResult, stripping any markdown wrappers.
 */
function parseJson(raw: string): PocketResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as PocketResult;
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

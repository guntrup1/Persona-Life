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
  // Available models for this API key in 2026
  const modelsToTry = [
    { model: "gemini-3.7-flash",        apiVersion: "v1beta" },
    { model: "gemini-3.6-flash",        apiVersion: "v1beta" },
    { model: "gemini-flash-latest",     apiVersion: "v1beta" },
    { model: "gemini-2.5-flash",        apiVersion: "v1beta" }
  ];

  let lastError: Error = new Error("No Gemini models succeeded");

  for (const { model, apiVersion } of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
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
            lastError = new Error(`Gemini API ${res.status} on ${model} (${apiVersion}): ${errText}`);
            break; // Break the attempt loop to try the NEXT model
          }
          if (res.status === 429) {
            throw new Error(`Gemini API Rate Limit (429) Exceeded. Пожалуйста, подождите немного перед следующим запросом.`); 
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
        // If it's a rate limit or another fatal error we deliberately threw, abort everything
        if (err.message.includes("Rate Limit (429)") || !err.message.includes("Gemini API 404")) {
           throw err; 
        }
        lastError = err;
        break; // break attempt loop, try next model
      }
    }
  }

  throw lastError;
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

  try {
    return JSON.parse(cleaned) as PocketResult;
  } catch {
    return {
      executive_summary: cleaned.slice(0, 300) || "Обработка завершена",
      key_insights: [cleaned.slice(0, 200)].filter(Boolean),
      action_items: [],
      semantic_tags: ["голосовое"],
      topics: [],
      sentiment: "neutral",
      mind_map_nodes: [],
      questions_raised: [],
      note_type: "note",
    };
  }
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

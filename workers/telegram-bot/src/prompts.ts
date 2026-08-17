// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS: Строгие шаблоны для LLM
// ──────────────────────────────────────────────────────────────────────────────

const getModeInstructions = (mode: string) => {
  switch (mode) {
    case "tasks":
      return `\nMODE: TASKS. Extract ALL action items. For each task include: what to do, who does it, and urgency. Be exhaustive.`;
    case "goals":
      return `\nMODE: GOALS. Extract long-term objectives, ambitions, and high-level strategy. Turn them into specific milestones in action_items.`;
    case "brainstorm":
      return `\nMODE: BRAINSTORM. Find connections between ideas, extract creative insights, identify contradictions and possibilities. Add rich mind_map_nodes.`;
    case "notes":
    default:
      return `\nMODE: NOTES. Extract all key thoughts, facts, observations. Tag comprehensively.`;
  }
};

// ── JSON FENCE used to guide the model ──
const JSON_FENCE = `<JSON_START>`;
const JSON_FENCE_END = `<JSON_END>`;

export const POCKET_PIPELINE_SYSTEM_PROMPT = (mode: string) => `You are an elite cognitive extraction AI. Analyze the voice transcript and return a structured JSON analysis.
${getModeInstructions(mode)}

TRANSCRIPT LANGUAGE: Detect the language of the transcript and use that SAME language for ALL output values (e.g. if Russian → all values in Russian).

ABSOLUTE RULES — VIOLATION WILL BREAK THE SYSTEM:
1. You MUST output ONLY a raw JSON object. Zero prose, zero explanation, zero markdown.
2. Your ENTIRE response must be exactly one valid JSON object starting with { and ending with }.
3. Do NOT wrap in \`\`\`json or any code block.
4. Do NOT say "Here is the JSON" or any other text before or after.
5. Every string value must be in the transcript's language.

JSON SCHEMA — fill ALL fields:
{
  "executive_summary": "2-3 sentence dense summary of the ENTIRE content",
  "key_insights": ["concrete insight 1", "concrete insight 2", "concrete insight 3"],
  "action_items": [
    { "task": "Specific actionable task", "assignee": null, "priority": "high" }
  ],
  "semantic_tags": ["tag1", "tag2", "tag3", "tag4"],
  "topics": ["main topic 1", "main topic 2"],
  "sentiment": "positive",
  "mind_map_nodes": [
    { "entity": "central concept", "relation": "leads to", "target": "outcome" }
  ],
  "questions_raised": ["open question if any"],
  "note_type": "reflection"
}

sentiment must be one of: positive, negative, neutral, mixed
note_type must be one of: idea, task, reflection, trading, plan, other

BEGIN JSON OUTPUT NOW:`;

export const CHUNK_SUMMARY_PROMPT = `You are a summarization AI. Condense the following transcript chunk into a dense 3-5 sentence summary preserving all key facts, names, numbers, and actionable points.

OUTPUT RULES:
- Output ONLY the summary text. Nothing else.
- No labels, no "Summary:", no formatting.
- Keep the same language as the input.

TRANSCRIPT CHUNK:`;

export const MAP_REDUCE_FINAL_PROMPT = (chunkSummaries: string[], mode: string) => `You are an elite cognitive extraction AI. Synthesize the following sequential summaries of a voice recording into a unified JSON analysis.
${getModeInstructions(mode)}

SUMMARIES:
${chunkSummaries.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join('\n')}

ABSOLUTE RULES — VIOLATION WILL BREAK THE SYSTEM:
1. Your ENTIRE response must be exactly one valid JSON object.
2. Start with { and end with }. No other text whatsoever.
3. All values in the SAME language as the summaries.

JSON SCHEMA — fill ALL fields:
{
  "executive_summary": "2-3 sentence synthesis of everything",
  "key_insights": ["insight 1", "insight 2", "insight 3", "insight 4"],
  "action_items": [
    { "task": "Specific actionable task", "assignee": null, "priority": "high" }
  ],
  "semantic_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "topics": ["topic1", "topic2"],
  "sentiment": "neutral",
  "mind_map_nodes": [
    { "entity": "central concept", "relation": "relates to", "target": "connected concept" }
  ],
  "questions_raised": ["open question if any"],
  "note_type": "reflection"
}

sentiment must be one of: positive, negative, neutral, mixed
note_type must be one of: idea, task, reflection, trading, plan, other

BEGIN JSON OUTPUT NOW:`;

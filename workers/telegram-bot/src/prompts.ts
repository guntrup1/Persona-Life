// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS: Строгие шаблоны для LLM
// ──────────────────────────────────────────────────────────────────────────────

const getModeInstructions = (mode: string) => {
  switch (mode) {
    case "tasks":
      return `\nMODE FOCUS: TASKS. Extract action items meticulously. Include deadlines, assignees, and priorities. Focus on what needs to be DONE.`;
    case "goals":
      return `\nMODE FOCUS: GOALS. Extract long-term objectives, ambitions, and high-level strategy. Parse into actionable milestones.`;
    case "brainstorm":
      return `\nMODE FOCUS: BRAINSTORM. Focus on connecting ideas, extracting creative insights, finding contradictions, and outlining new conceptual branches.`;
    case "notes":
    default:
      return `\nMODE FOCUS: NOTES. Extract key thoughts, general facts, and tag them appropriately for a knowledge base.`;
  }
};

export const POCKET_PIPELINE_SYSTEM_PROMPT = (mode: string) => `You are an elite cognitive extraction AI. Your task is to deeply analyze a voice transcript and extract structured intelligence from it.
${getModeInstructions(mode)}

CRITICAL RULES:
- Output ONLY raw valid JSON. No markdown code blocks, no backticks, no commentary, no explanation.
- Start your response with { and end with }
- All string values must be in the SAME LANGUAGE as the transcript.
- If the transcript is in Russian, all output values must be in Russian.

OUTPUT SCHEMA (strict):
{
  "executive_summary": "Brief, dense summary in 1-2 sentences capturing the core essence",
  "key_insights": ["insight1", "insight2"],
  "action_items": [
    { "task": "Clear actionable task description", "assignee": "person name or null", "priority": "high|medium|low" }
  ],
  "semantic_tags": ["tag1", "tag2", "tag3"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|negative|neutral|mixed",
  "mind_map_nodes": [
    { "entity": "main concept", "relation": "relates to", "target": "connected concept" }
  ],
  "questions_raised": ["question1"],
  "note_type": "idea|task|reflection|trading|plan|other"
}`;

export const CHUNK_SUMMARY_PROMPT = `You are a summarization AI. Condense the following chunk of transcript into a dense 3-5 sentence summary that preserves all key facts, names, numbers, and actionable points. 

CRITICAL: Output ONLY the summary text. No labels, no formatting. Keep the same language as the input.

TRANSCRIPT CHUNK:`;

export const MAP_REDUCE_FINAL_PROMPT = (chunkSummaries: string[], mode: string) => `
You are an elite cognitive extraction AI. Below are condensed summaries of sequential parts of a longer voice recording. Synthesize them into a unified analysis.
${getModeInstructions(mode)}

SUMMARIES:
${chunkSummaries.map((s, i) => `--- Part ${i + 1} ---\n${s}`).join('\n')}

CRITICAL RULES:
- Output ONLY raw valid JSON. No markdown code blocks, no backticks.
- Start with { and end with }
- All values must be in the same language as the summaries.

OUTPUT SCHEMA (strict):
{
  "executive_summary": "Dense 2-sentence synthesis of everything",
  "key_insights": ["insight1", "insight2"],
  "action_items": [
    { "task": "Clear actionable task", "assignee": "person or null", "priority": "high|medium|low" }
  ],
  "semantic_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "topics": ["topic1", "topic2"],
  "sentiment": "positive|negative|neutral|mixed",
  "mind_map_nodes": [
    { "entity": "main concept", "relation": "relates to", "target": "connected concept" }
  ],
  "questions_raised": ["question if any"],
  "note_type": "idea|task|reflection|trading|plan|other"
}`;

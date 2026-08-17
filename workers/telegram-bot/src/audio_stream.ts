// ──────────────────────────────────────────────────────────────────────────────
// AUDIO STREAM: Zero-Disk In-Memory Streaming
// ──────────────────────────────────────────────────────────────────────────────

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  RENDER_APP_URL: string;
  WORKER_SECRET_TOKEN: string;
}

/**
 * Get the Telegram file path for a given file_id.
 * Returns the file path string needed to build the download URL.
 */
export async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Telegram getFile failed: ${res.status}`);
  const data = await res.json() as { ok: boolean; result: { file_path: string } };
  if (!data.ok) throw new Error(`Telegram getFile not ok`);
  return data.result.file_path;
}

/**
 * Stream the audio file from Telegram directly into Groq Whisper API.
 * NO disk I/O — the audio bytes flow through memory only.
 *
 * Strategy:
 * 1. Fetch the file from Telegram as an ArrayBuffer.
 * 2. Build a FormData with the buffer as a Blob (no fs.writeFile).
 * 3. POST to Groq Whisper transcription endpoint.
 */
export async function transcribeAudioInMemory(
  filePath: string,
  botToken: string,
  groqApiKey: string
): Promise<string> {
  // 1. Download audio from Telegram into memory (ArrayBuffer)
  const telegramFileUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const audioResponse = await fetch(telegramFileUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio from Telegram: ${audioResponse.status}`);
  }
  const audioBuffer = await audioResponse.arrayBuffer();
  if (audioBuffer.byteLength === 0) {
    throw new Error("Downloaded audio file is empty (0 bytes)");
  }

  // 2. Build FormData with in-memory Blob (no disk write)
  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });
  formData.append("file", audioBlob, "audio.ogg");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "text");

  // 3. Send to Groq Whisper
  const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!transcribeRes.ok) {
    const errText = await transcribeRes.text();
    throw new Error(`Groq Whisper failed: ${transcribeRes.status} - ${errText}`);
  }

  // Groq returns plain text when response_format=text
  const transcript = await transcribeRes.text();
  return transcript.trim();
}

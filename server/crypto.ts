import crypto from "crypto";

// AES-256-GCM envelope for user API keys stored in MongoDB.
// Format: enc:v1:<iv base64>:<tag base64>:<ciphertext base64>
// Legacy plaintext values (stored before this feature) are passed through as-is.

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "persona-life-dev-fallback";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (typeof stored !== "string" || !stored.startsWith("enc:v1:")) {
    // Legacy plaintext value — return as-is
    return stored;
  }
  const parts = stored.split(":");
  if (parts.length !== 5) return stored;
  try {
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const data = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (e: any) {
    console.error("[crypto] decrypt failed:", e.message);
    return null;
  }
}

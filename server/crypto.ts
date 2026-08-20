import crypto from "crypto";

// AES-256-GCM envelope for user API keys stored in MongoDB.
// Format: enc:v1:<iv base64>:<tag base64>:<ciphertext base64>
//
// Key material comes from ENCRYPTION_KEY (preferred, production) with a legacy
// fallback to SHA-256(SESSION_SECRET) so values encrypted before ENCRYPTION_KEY
// was introduced keep decrypting. There is deliberately NO hardcoded fallback —
// a missing key is a fatal configuration error, never a silent security downgrade.
// WARNING: once ENCRYPTION_KEY is set, never change or remove it.

let cachedActiveKey: Buffer | null = null;
let activeKeyWarned = false;

function hashKeyMaterial(material: string): Buffer {
  return crypto.createHash("sha256").update(material).digest();
}

function getActiveKey(): Buffer {
  if (cachedActiveKey) return cachedActiveKey;
  const material = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!material) {
    throw new Error(
      "[crypto] ENCRYPTION_KEY (or legacy SESSION_SECRET) environment variable is required but not set"
    );
  }
  if (!process.env.ENCRYPTION_KEY && !activeKeyWarned) {
    activeKeyWarned = true;
    console.warn(
      "[crypto] ENCRYPTION_KEY not set — deriving key from SESSION_SECRET. Set ENCRYPTION_KEY in production."
    );
  }
  cachedActiveKey = hashKeyMaterial(material);
  return cachedActiveKey;
}

function getLegacyKey(): Buffer | null {
  return process.env.SESSION_SECRET ? hashKeyMaterial(process.env.SESSION_SECRET) : null;
}

function tryDecrypt(stored: string, key: Buffer): string | null {
  const parts = stored.split(":");
  if (parts.length !== 5) return null;
  try {
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const data = Buffer.from(parts[4], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getActiveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored || typeof stored !== "string") return null;
  if (!stored.startsWith("enc:v1:")) {
    // Legacy plaintext value — never return it as-is. The user must re-enter
    // the key (bot flow handles this gracefully via /reset).
    console.error("[crypto] Refusing to return legacy plaintext secret; key must be re-entered");
    return null;
  }
  const active = tryDecrypt(stored, getActiveKey());
  if (active !== null) return active;
  const legacyKey = getLegacyKey();
  if (legacyKey) {
    const legacy = tryDecrypt(stored, legacyKey);
    if (legacy !== null) return legacy;
  }
  console.error("[crypto] decrypt failed for stored secret (bad key or corrupted value)");
  return null;
}

// URL safety helpers: screenshots are external images; only plain HTTPS URLs
// are allowed. Everything else (javascript:, data:, vbscript:, //-relative,
// file:, etc.) is rejected so a stored value can never become a clickable link
// or inline asset in the client.

export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return false;
  if (!/^https:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
  } catch {
    return false;
  }
  return true;
}

// Recursively walks user data blobs and blanks out unsafe screenshot URLs.
// Only touches the known URL fields: `screenshotUrl` and `url` inside
// `screenshots` arrays (any nested depth).
export function sanitizeBlobUrls(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map(sanitizeBlobUrls);
  }
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === "screenshotUrl") {
        out[key] = isSafeImageUrl(value) ? (value as string) : "";
      } else if (key === "screenshots" && Array.isArray(value)) {
        out[key] = value.map((s: unknown) => {
          if (!s || typeof s !== "object") return s;
          const entry = s as Record<string, unknown>;
          const clean = { ...entry };
          if (typeof entry.url === "string" && !isSafeImageUrl(entry.url)) {
            clean.url = "";
          }
          return clean;
        });
      } else {
        out[key] = sanitizeBlobUrls(value);
      }
    }
    return out;
  }
  return data;
}
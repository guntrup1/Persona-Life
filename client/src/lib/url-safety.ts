// Client-side URL safety: only plain https URLs may be used as link targets or
// image sources. Blocks javascript:, data:, vbscript:, //-relative, file:, etc.

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
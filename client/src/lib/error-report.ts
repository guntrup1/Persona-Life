import { toast } from "@/hooks/use-toast";

let lastStack: { stack: string; time: number } | null = null;

function genErrorId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PL-${t}-${r}`;
}

function coerce(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "message" in v) return String((v as any).message);
  return v == null ? "" : String(v);
}

export async function reportError(opts: { title?: string; description?: string }): Promise<string> {
  const errorId = genErrorId();
  const payload = {
    errorId,
    title: opts.title || "",
    description: opts.description || "",
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    timestamp: new Date().toISOString(),
    stack: lastStack && Date.now() - lastStack.time < 120000 ? lastStack.stack : undefined,
  };
  try {
    const res = await fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      toast({ title: `Отчёт отправлен. Номер: ${errorId}` });
    } else {
      toast({ title: "Не удалось отправить отчёт", variant: "destructive" });
    }
  } catch {
    toast({ title: "Нет соединения — отчёт не отправлен", variant: "destructive" });
  }
  return errorId;
}

export function initErrorReporting() {
  if (typeof window === "undefined") return;
  window.onerror = (msg, src, line, col, err) => {
    lastStack = {
      stack: [String(msg), src && `at ${src}:${line}:${col}`, err?.stack].filter(Boolean).join("\n"),
      time: Date.now(),
    };
    toast({ title: "Произошла ошибка", description: coerce(msg).slice(0, 120), variant: "destructive" });
    return false;
  };
  window.onunhandledrejection = (ev) => {
    const reason: any = (ev as any)?.reason;
    lastStack = { stack: reason?.stack || coerce(reason), time: Date.now() };
    toast({ title: "Необработанная ошибка", description: coerce(reason?.message || reason).slice(0, 120), variant: "destructive" });
  };
}

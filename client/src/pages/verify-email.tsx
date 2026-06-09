import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";

function ResendForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleResend = async () => {
    if (!email) { setError(t.authPages.enterEmail); return; }
    setLoading(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setMessage(t.authPages.sendEmailSuccess);
      else setError(data.message || t.authPages.sendError);
    } catch {
      setError(t.authPages.netError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 w-full">
      <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
        Получить новую ссылку:
      </p>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder={t.authPages.yourEmail}
        className="w-full px-4 py-2 bg-background border border-border text-sm font-mono focus:outline-none focus:border-primary"
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {message && <p className="text-xs text-primary font-mono">{message}</p>}
      <button
        onClick={handleResend}
        disabled={loading}
        className="w-full px-6 py-2 bg-primary text-black font-display text-xs uppercase tracking-widest disabled:opacity-50"
        style={{ clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)" }}
      >
        {loading ? t.authPages.sendingLink : t.authPages.sendNewLink}
      </button>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "expired">("loading");
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("error"); return; }

    fetch(`/api/auth/verify-email?token=${token}`, { credentials: "include" })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("success");
          setTimeout(() => navigate("/"), 3000);
        } else if (data.expired) {
          setStatus("expired");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 p5-stripes opacity-40" />
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary p5-glow" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />

      <div className="relative z-10 text-center space-y-6 animate-slide-in-up w-full max-w-sm">
        <div className="font-p5 text-4xl tracking-widest" style={{ letterSpacing: "0.25em" }}>
          TRADE <span className="text-primary">PERSONA</span>
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-display text-sm text-muted-foreground uppercase tracking-widest">
              Проверяем токен...
            </p>
          </div>
        )}

        {status === "success" && (
          <div
            className="bg-card border border-primary/40 p-8 space-y-4 p5-glow-sm"
            style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
          >
            <div className="text-5xl">✅</div>
            <div className="font-p5 text-2xl text-primary tracking-widest">{t.authPages.emailVerified}</div>
            <p className="text-sm text-muted-foreground font-mono">
              Перенаправляем на страницу входа...
            </p>
          </div>
        )}

        {/* Ссылка истекла — показываем форму переотправки */}
        {status === "expired" && (
          <div
            className="bg-card border border-yellow-500/40 p-8 space-y-4"
            style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
          >
            <div className="text-5xl">⏰</div>
            <div className="font-p5 text-2xl text-yellow-400 tracking-widest">{t.authPages.linkExpired}</div>
            <p className="text-sm text-muted-foreground font-mono">
              Ссылка больше недействительна. Запросите новую.
            </p>
            <ResendForm />
            <button
              onClick={() => navigate("/")}
              className="w-full px-6 py-2 border border-border text-xs uppercase tracking-widest font-display"
            >
              На главную
            </button>
          </div>
        )}

        {/* Токен неверный или уже использован */}
        {status === "error" && (
          <div
            className="bg-card border border-red-500/40 p-8 space-y-4"
            style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
          >
            <div className="text-5xl">❌</div>
            <div className="font-p5 text-2xl text-red-400 tracking-widest">{t.authPages.linkInvalid}</div>
            <p className="text-sm text-muted-foreground font-mono">
              Ссылка уже использована или неверна.
            </p>
            <ResendForm />
            <button
              onClick={() => navigate("/")}
              className="w-full px-6 py-2 border border-border text-xs uppercase tracking-widest font-display"
            >
              На главную
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

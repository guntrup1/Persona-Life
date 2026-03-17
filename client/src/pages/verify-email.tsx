import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [, navigate] = useLocation();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setStatus("error"); return; }

    fetch(`/api/auth/verify-email?token=${token}`, { credentials: "include" })
      .then(res => {
        if (res.ok || res.redirected) {
          setStatus("success");
          setTimeout(() => navigate("/"), 3000);
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

      <div className="relative z-10 text-center space-y-6 animate-slide-in-up">
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
            <div className="font-p5 text-2xl text-primary tracking-widest">EMAIL ПОДТВЕРЖДЁН</div>
            <p className="text-sm text-muted-foreground font-mono">
              Перенаправляем на страницу входа...
            </p>
          </div>
        )}

        {status === "error" && (
          <div
            className="bg-card border border-red-500/40 p-8 space-y-4"
            style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
          >
            <div className="text-5xl">❌</div>
            <div className="font-p5 text-2xl text-red-400 tracking-widest">ССЫЛКА НЕДЕЙСТВИТЕЛЬНА</div>
            <p className="text-sm text-muted-foreground font-mono">
              Ссылка истекла или уже использована.
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-2 px-6 py-2 bg-primary text-white font-display text-xs uppercase tracking-widest"
              style={{ clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)" }}
            >
              На главную
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

/* ── Быстрое мигание неоновой вывески ── */
const flickerStyle = `
  @keyframes loginFlicker {
    0%,55%,100% { opacity:1; text-shadow:0 0 30px rgba(225,29,72,0.3) }
    58%          { opacity:0.7; text-shadow:none }
    60%          { opacity:1; text-shadow:0 0 30px rgba(225,29,72,0.3) }
    63%          { opacity:0.4; text-shadow:none }
    65%          { opacity:1; text-shadow:0 0 60px rgba(225,29,72,0.6), 0 0 120px rgba(225,29,72,0.2) }
    68%          { opacity:0.85; text-shadow:0 0 30px rgba(225,29,72,0.3) }
    70%          { opacity:0.5; text-shadow:none }
    72%          { opacity:1; text-shadow:0 0 30px rgba(225,29,72,0.3) }
  }
  .login-flicker {
    animation: loginFlicker 3s ease-in-out infinite;
  }
`;

export default function LoginPage() {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const verified = new URLSearchParams(window.location.search).get("verified") === "1";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    if (mode === "login") {
      const result = await login(email, password);
      if (result.error) {
        toast({ title: "Ошибка входа", description: result.error, variant: "destructive" });
      }
    } else {
      const result = await register(email, password);
      if (result.error) {
        toast({ title: "Ошибка регистрации", description: result.error, variant: "destructive" });
      } else if ((result as any).needsVerification) {
        setNeedsVerification(true);
      } else {
        toast({ title: "Аккаунт создан" });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 overflow-hidden relative">
      <style>{flickerStyle}</style>

      {/* Фоновые полосы */}
      <div className="absolute inset-0 p5-stripes opacity-60" />

      {/* Большой фоновый текст */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span
          className="font-p5 text-[20vw] text-primary/5 leading-none tracking-widest whitespace-nowrap"
          style={{ letterSpacing: "0.3em" }}
        >
          TRADE PERSONA
        </span>
      </div>

      {/* Боковые и горизонтальные акценты */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary p5-glow" />
      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary/30" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary p5-glow-sm" />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/40" />

      <div className="w-full max-w-sm relative z-10 animate-slide-in-up">

        {/* ── Логотип ── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <div
              className="w-14 h-14 bg-primary flex items-center justify-center p5-glow"
              style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
            >
              <span className="font-p5 text-white text-xl font-bold tracking-wider">TP</span>
            </div>
          </div>

          {/* Мигающий заголовок */}
          <div
            className="font-p5 text-4xl text-foreground tracking-widest leading-none login-flicker"
            style={{ letterSpacing: "0.25em" }}
          >
            TRADE
          </div>
          <div
            className="font-p5 text-2xl text-primary tracking-widest leading-none p5-glow-text"
            style={{ letterSpacing: "0.3em" }}
          >
            PERSONA
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
            Trading OS
          </div>
        </div>

        {/* ── Форма — без бордера, без clip-path ── */}
        <div className="bg-card p-6 relative">
          {/* Красная линия сверху вместо бордера */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary p5-glow-sm" />
          {/* Угловой акцент */}
          <div
            className="absolute top-0 right-0 w-4 h-4 bg-primary"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
          />

          {/* ── Табы — полные, без clip-path ── */}
          <div className="flex mb-6 gap-1">
            <button
              onClick={() => setMode("login")}
              data-testid="tab-login"
              style={{
                flex: 1,
                padding: "10px",
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                border: "none",
                clipPath: "none",
                borderRadius: 0,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: mode === "login" ? "hsl(var(--primary))" : "transparent",
                color: mode === "login" ? "#fff" : "hsl(var(--muted-foreground))",
                borderBottom: mode === "login" ? "none" : "1px solid hsl(var(--border))",
                boxShadow: mode === "login" ? "0 0 12px rgba(225,29,72,0.4)" : "none",
              }}
            >
              Войти
            </button>
            <button
              onClick={() => setMode("register")}
              data-testid="tab-register"
              style={{
                flex: 1,
                padding: "10px",
                fontFamily: "var(--font-display)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                border: "none",
                clipPath: "none",
                borderRadius: 0,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: mode === "register" ? "hsl(var(--primary))" : "transparent",
                color: mode === "register" ? "#fff" : "hsl(var(--muted-foreground))",
                borderBottom: mode === "register" ? "none" : "1px solid hsl(var(--border))",
                boxShadow: mode === "register" ? "0 0 12px rgba(225,29,72,0.4)" : "none",
              }}
            >
              Создать
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="bg-background border-border font-mono text-sm h-10"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1">
              <label className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                Пароль
              </label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Мин. 6 символов" : "••••••••"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="bg-background border-border font-mono text-sm h-10"
                data-testid="input-password"
              />
            </div>

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  style={{
                    background: "transparent",
                    border: "none",
                    clipPath: "none",
                    padding: "2px 0",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "hsl(var(--muted-foreground))",
                    cursor: "pointer",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "hsl(var(--primary))")}
                  onMouseLeave={e => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
                >
                  Забыл пароль?
                </button>
              </div>
            )}

            {/* ── Кнопка Войти — полная, без обрезания ── */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: "block",
                width: "100%",
                padding: "14px",
                marginTop: "8px",
                fontFamily: "var(--font-display)",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                border: "none",
                clipPath: "none",
                borderRadius: 0,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                background: "hsl(var(--primary))",
                color: "#fff",
                opacity: loading ? 0.5 : 1,
                boxShadow: loading ? "none" : "0 0 20px rgba(225,29,72,0.35)",
              }}
              data-testid="button-auth-submit"
            >
              {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </button>
          </form>

          {verified && (
            <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono text-center">
              ✅ Email подтверждён! Можешь войти.
            </div>
          )}

          {needsVerification && (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/30 text-xs font-mono space-y-2">
              <p className="text-primary font-bold">📧 Проверь почту!</p>
              <p className="text-muted-foreground">
                Отправили письмо на <span className="text-foreground">{email}</span>. Подтверди email чтобы войти.
              </p>
              {!resendDone ? (
                <button
                  onClick={async () => {
                    setResendLoading(true);
                    await fetch("/api/auth/resend-verification", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email }),
                    });
                    setResendLoading(false);
                    setResendDone(true);
                  }}
                  disabled={resendLoading}
                  style={{ background: "transparent", border: "none", clipPath: "none", cursor: "pointer", padding: 0 }}
                  className="text-primary hover:text-primary/80 underline transition-colors text-xs font-mono"
                >
                  {resendLoading ? "Отправляем..." : "Отправить повторно"}
                </button>
              ) : (
                <p className="text-green-400">✅ Письмо отправлено повторно</p>
              )}
            </div>
          )}

          <p className="text-center text-[10px] text-muted-foreground mt-4 font-mono">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              style={{ background: "transparent", border: "none", clipPath: "none", cursor: "pointer", padding: 0 }}
              className="text-primary font-bold text-[10px] font-mono"
              data-testid="button-switch-mode"
            >
              {mode === "login" ? "Создать" : "Войти"}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4 tracking-widest font-mono uppercase">
          Данные синхронизируются между устройствами
        </p>
      </div>
    </div>
  );
}

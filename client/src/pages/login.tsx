import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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

      {/* Фоновые диагональные линии P5 */}
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

      {/* Красная вертикальная полоса слева */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary p5-glow" />
      <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary/30" />

      {/* Горизонтальные акцентные линии */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary p5-glow-sm" />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/40" />

      <div className="w-full max-w-sm relative z-10 animate-slide-in-up">

        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div
              className="w-14 h-14 bg-primary flex items-center justify-center p5-glow"
              style={{ clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))" }}
            >
              <span className="font-p5 text-white text-xl font-bold tracking-wider">TP</span>
            </div>
          </div>
          <div
            className="font-p5 text-4xl text-foreground tracking-widest leading-none animate-p5-flicker"
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
            Gamified Trading OS
          </div>
        </div>

        {/* Форма */}
        <div
          className="bg-card border border-primary/30 p-6 relative p5-glow-sm"
          style={{ clipPath: "polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))" }}
        >
          {/* Угловой акцент */}
          <div className="absolute top-0 right-0 w-4 h-4 bg-primary"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
          />
          <div className="absolute bottom-0 left-0 w-4 h-4 bg-primary/40"
            style={{ clipPath: "polygon(0 0, 0 100%, 100% 100%)" }}
          />

          {/* Табы */}
          <div className="flex mb-6 border border-border overflow-hidden">
            <button
              className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-widest transition-all duration-150 ${
                mode === "login"
                  ? "bg-primary text-white p5-glow-sm"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              }`}
              style={mode === "login" ? { clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)" } : {}}
              onClick={() => setMode("login")}
              data-testid="tab-login"
            >
              Войти
            </button>
            <button
              className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-widest transition-all duration-150 ${
                mode === "register"
                  ? "bg-primary text-white p5-glow-sm"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              }`}
              style={mode === "register" ? { clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)" } : {}}
              onClick={() => setMode("register")}
              data-testid="tab-register"
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
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-mono uppercase tracking-wider"
                >
                  Забыл пароль?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className={`w-full py-3 font-display text-xs uppercase tracking-widest font-bold transition-all duration-150 mt-2 ${
                loading || !email.trim() || !password.trim()
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary text-white p5-glow-sm hover:p5-glow"
              }`}
              style={{ clipPath: "polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)" }}
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
              <p className="text-muted-foreground">Отправили письмо на <span className="text-foreground">{email}</span>. Подтверди email чтобы войти.</p>
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
                  className="text-primary hover:text-primary/80 underline transition-colors"
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
              className="text-primary font-bold hover:p5-glow-text transition-all"
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

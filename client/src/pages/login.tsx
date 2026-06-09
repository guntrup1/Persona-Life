import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useI18n, LangToggle } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Состояние для блока переотправки письма
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const handleResend = async () => {
    if (!email.trim()) {
      toast({ title: t.auth.enterEmail, variant: "destructive" });
      return;
    }
    setResendLoading(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResendDone(true);
    } catch {
      toast({ title: t.auth.errSend, variant: "destructive" });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setShowResend(false);
    setResendDone(false);

    if (mode === "login") {
      const result = await login(email, password);
      if (result.error) {
        // Если ошибка именно про верификацию — показываем блок переотправки
        if (result.error.toLowerCase().includes("подтверди") || result.error.toLowerCase().includes("верификац") || result.error.toLowerCase().includes("verif")) {
          setShowResend(true);
        }
        toast({ title: t.auth.errLogin, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.welcomeBack });
      }
    } else {
      const result = await register(email, password);
      if (result.error) {
        toast({ title: t.auth.errReg, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.created, description: t.auth.createdDesc });
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .slide-up { animation: slide-up 0.4s ease-out forwards; }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(180,0,0,0.3), 0 0 40px rgba(180,0,0,0.1); }
          50% { box-shadow: 0 0 30px rgba(180,0,0,0.5), 0 0 60px rgba(180,0,0,0.2); }
        }
        .glow-card { animation: glow-pulse 3s ease-in-out infinite; }
      `}</style>

      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>

      <div className="w-full max-w-sm slide-up">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce">🎭</div>
          <div className="font-display text-2xl font-bold text-foreground tracking-[0.2em] uppercase">
            Life OS
          </div>
          <div className="text-xs text-muted-foreground tracking-widest uppercase mt-1">
            Persona System
          </div>
        </div>

        <div className="border border-primary/30 rounded-2xl p-6 bg-card glow-card">
          <div className="flex rounded-xl overflow-hidden border border-card-border mb-6">
            <button
              className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
              onClick={() => { setMode("login"); setShowResend(false); setResendDone(false); }}
              data-testid="tab-login"
            >
              {t.auth.loginTab}
            </button>
            <button
              className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
              onClick={() => { setMode("register"); setShowResend(false); setResendDone(false); }}
              data-testid="tab-register"
            >
              {t.auth.registerTab}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                className="bg-background border-card-border font-mono"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                {t.auth.password}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "register" ? t.auth.min6 : "••••••••"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="bg-background border-card-border font-mono"
                data-testid="input-password"
              />
              {mode === "login" && (
                <div className="text-right">
                  <Link href="/forgot-password">
                    <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors uppercase tracking-wider font-display">
                      {t.auth.forgotPassword}
                    </span>
                  </Link>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full font-display uppercase tracking-[0.2em] text-xs h-11 rounded-xl mt-2"
              data-testid="button-auth-submit"
            >
              {loading ? "..." : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
            </Button>
          </form>

          {/* Блок переотправки — появляется только при ошибке верификации */}
          {showResend && (
            <div className="mt-4 p-4 border border-yellow-500/30 rounded-xl bg-yellow-500/5 space-y-3">
              {resendDone ? (
                <p className="text-xs text-primary font-mono text-center">
                  {t.auth.sent}
                </p>
              ) : (
                <>
                  <p className="text-xs text-yellow-400 font-mono text-center">
                    {t.auth.notVerified}
                  </p>
                  <Button
                    onClick={handleResend}
                    disabled={resendLoading}
                    variant="outline"
                    className="w-full text-xs font-display uppercase tracking-wider border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    {resendLoading ? t.auth.sending : t.auth.resend}
                  </Button>
                </>
              )}
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">
            {mode === "login" ? t.auth.noAccount : t.auth.hasAccount}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setShowResend(false); setResendDone(false); }}
              className="text-primary font-bold"
              data-testid="button-switch-mode"
            >
              {mode === "login" ? t.auth.registerTab : t.auth.loginTab}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6 tracking-wider">
          {t.auth.syncing}
        </p>
      </div>
    </div>
  );
}

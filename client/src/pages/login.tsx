import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    if (mode === "login") {
      const result = await login(email, password);
      if (result.error) {
        toast({ title: "Ошибка входа", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Добро пожаловать!" });
      }
    } else {
      const result = await register(email, password);
      if (result.error) {
        toast({ title: "Ошибка регистрации", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Аккаунт создан", description: "Вы вошли в систему" });
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
              onClick={() => setMode("login")}
              data-testid="tab-login"
            >
              Войти
            </button>
            <button
              className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-colors ${
                mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
              onClick={() => setMode("register")}
              data-testid="tab-register"
            >
              Создать
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
                Пароль
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Мин. 6 символов" : "••••••••"}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="bg-background border-card-border font-mono"
                data-testid="input-password"
              />
            </div>
            {mode === "login" && (
              <div className="text-right">
                <button onClick={() => navigate("/forgot-password")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                  Забыл пароль?
                </button>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full font-display uppercase tracking-[0.2em] text-xs h-11 rounded-xl mt-2"
              data-testid="button-auth-submit"
            >
              {loading ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {mode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary font-bold"
              data-testid="button-switch-mode"
            >
              {mode === "login" ? "Создать" : "Войти"}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6 tracking-wider">
          Данные синхронизируются между устройствами
        </p>
      </div>
    </div>
  );
}

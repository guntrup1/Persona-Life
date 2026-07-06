import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useI18n, LangToggle } from "@/lib/i18n";
import { TrendingUp, Activity, BarChart3, Newspaper, Calendar, ShieldAlert, Award, FileText, CheckCircle2, ChevronRight } from "lucide-react";

export default function LoginPage() {
  const { t, lang } = useI18n();
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  // Simulation animation states
  const [simEV, setSimEV] = useState(25.50);
  const [simDD, setSimDD] = useState(5.80);
  const [simLive, setSimLive] = useState(98.2);

  useEffect(() => {
    const interval = setInterval(() => {
      setSimEV(prev => {
        const next = prev + (Math.random() - 0.5) * 0.4;
        return parseFloat(Math.max(10, Math.min(45, next)).toFixed(2));
      });
      setSimDD(prev => {
        const next = prev + (Math.random() - 0.5) * 0.1;
        return parseFloat(Math.max(2, Math.min(9, next)).toFixed(2));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
        body: JSON.stringify({ email, lang }),
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
        if (result.error.toLowerCase().includes("подтверди") || result.error.toLowerCase().includes("верификац") || result.error.toLowerCase().includes("verif")) {
          setShowResend(true);
        }
        toast({ title: t.auth.errLogin, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.welcomeBack });
      }
    } else {
      const result = await register(email, password, lang);
      if (result.error) {
        toast({ title: t.auth.errReg, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.created, description: t.auth.createdDesc });
      }
    }

    setLoading(false);
  };

  const isRu = lang === "ru";

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-red-500/30 selection:text-red-200 relative overflow-x-hidden">
      

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-black text-sm text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]">P</div>
          <span className="font-bold tracking-[0.25em] text-sm text-white font-display">PERSONA OS</span>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-8 pb-20 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-center relative z-10">
        
        {/* Left Side: Copy */}
        <div className="space-y-6">
          <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-xs py-1 px-3 rounded-full hover:bg-red-500/10">
            {isRu ? "📊 Системность вместо геймификации" : "📊 Systematics over gamification"}
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
            {isRu ? (
              <>
                Превратите дисциплину в <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-yellow-500">чистую статистику</span>
              </>
            ) : (
              <>
                Turn your discipline into <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-yellow-500">raw statistics</span>
              </>
            )}
          </h1>
          <p className="text-zinc-400 text-base sm:text-lg leading-relaxed max-w-xl">
            {isRu 
              ? "Откажитесь от иллюзий. 90% трейдеров теряют депозиты не из-за плохих графиков, а из-за психологической нестабильности. Наш терминал собирает жесткие числовые метрики вашего прогресса, помогая победить овертрейдинг и тильт."
              : "Abandon illusions. 90% of traders fail not because of charts, but due to psychological instability. Our terminal captures raw numerical metrics of your trading discipline, helping you beat overtrading and tilt."}
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 max-w-md">
            <div>
              <p className="text-2xl font-bold text-white">0.0%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{isRu ? "Субъективных мнений" : "Subjective opinions"}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">100%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{isRu ? "Чистая аналитика" : "Pure analytics"}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">&lt;2.0%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">{isRu ? "Шанс просадки" : "Ruin probability"}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="border border-white/10 rounded-3xl p-6 bg-black/40 backdrop-blur-md shadow-2xl relative">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 via-primary/50 to-transparent" />
            <div className="absolute top-0 right-0 w-4 h-4 bg-red-600" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
            
            <div className="flex rounded-xl overflow-hidden border border-white/5 bg-black/60 mb-6 p-1">
              <button
                className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg ${
                  mode === "login" ? "bg-white/10 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                }`}
                onClick={() => { setMode("login"); setShowResend(false); setResendDone(false); }}
              >
                {t.auth.loginTab}
              </button>
              <button
                className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg ${
                  mode === "register" ? "bg-white/10 text-white shadow-inner" : "text-zinc-500 hover:text-zinc-300"
                }`}
                onClick={() => { setMode("register"); setShowResend(false); setResendDone(false); }}
              >
                {t.auth.registerTab}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-display text-xs uppercase tracking-wider text-zinc-500">
                  Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                  className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="font-display text-xs uppercase tracking-wider text-zinc-500">
                    {t.auth.password}
                  </Label>
                  {mode === "login" && (
                    <Link href="/forgot-password">
                      <span className="text-[10px] text-zinc-500 hover:text-red-400 cursor-pointer transition-colors uppercase tracking-wider font-display">
                        {t.auth.forgotPassword}
                      </span>
                    </Link>
                  )}
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? t.auth.min6 : "••••••••"}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-display uppercase tracking-[0.25em] text-xs h-11 rounded-xl mt-4 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
              >
                {loading ? "..." : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
              </Button>
            </form>

            {showResend && (
              <div className="mt-4 p-4 border border-yellow-500/20 rounded-2xl bg-yellow-500/5 space-y-3">
                {resendDone ? (
                  <p className="text-xs text-primary font-mono text-center">
                    {t.auth.sent}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-yellow-400/80 font-mono text-center">
                      {t.auth.notVerified}
                    </p>
                    <Button
                      onClick={handleResend}
                      disabled={resendLoading}
                      variant="outline"
                      className="w-full text-xs font-display uppercase tracking-wider border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 rounded-xl"
                    >
                      {resendLoading ? t.auth.sending : t.auth.resend}
                    </Button>
                  </>
                )}
              </div>
            )}

            <p className="text-center text-xs text-zinc-500 mt-4">
              {mode === "login" ? t.auth.noAccount : t.auth.hasAccount}{" "}
              <button
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setShowResend(false); setResendDone(false); }}
                className="text-red-500 font-bold hover:underline"
              >
                {mode === "login" ? t.auth.registerTab : t.auth.loginTab}
              </button>
            </p>
          </div>
        </div>
      </section>

      {/* Core Showcase: Trading tab (Monte Carlo & Portfolio Math) */}
      <section className="bg-black/30 border-y border-white/5 py-20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-emerald-400">
                <TrendingUp className="w-5 h-5 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest font-display">{isRu ? "Главное ядро платформы" : "Core System Core"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {isRu 
                  ? "Раздел «Трейдинг»: Чистый математический бэктест" 
                  : "Trading Tab: Pure Mathematical Backtesting"}
              </h2>
              <p className="text-zinc-400 leading-relaxed">
                {isRu 
                  ? "Сердцем платформы является симулятор Монте-Карло. Он берет ваши статистические показатели (винрейт, RR, частоту сделок) и симулирует 1000 альтернативных веток развития вашего счета. Это единственный верный способ рассчитать вероятность просадок и шанс прохождения проп-челленджей без субъективных иллюзий."
                  : "The heart of the system is the Monte Carlo portfolio simulator. It takes your metrics (winrate, RR, frequency) and runs 1000 alternative scenarios of your account growth. This is the only objective way to calculate DD risk and prop evaluation passing odds without assumptions."}
              </p>
              <div className="space-y-3 font-mono text-xs text-zinc-500">
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <p>{isRu ? "Точный расчет шансов Фазы 1, Фазы 2 и Live стадии" : "Exact Phase 1, Phase 2 and Live stage probability modeling"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <p>{isRu ? "Расчет Profit Factor на основе валовой прибыли и убытков" : "Profit Factor calculation based on gross wins & losses"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> <p>{isRu ? "Учет дневных лимитов (maxWinsPerDay) и комиссий брокера" : "Includes daily limit constraints (maxWinsPerDay) & broker slippages"}</p></div>
              </div>
            </div>

            {/* Simulated interactive mockup */}
            <div className="bg-black/60 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-xl rounded-full" />
              
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white tracking-wider uppercase font-display">Monte Carlo Simulator (Live Mockup)</span>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{isRu ? "Моделирование" : "Simulating"}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase font-semibold">{isRu ? "EV на сделку" : "EV per Trade"}</p>
                  <p className="text-lg font-bold text-white transition-all duration-300 font-mono">+{simEV.toFixed(2)}$</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase font-semibold">{isRu ? "Макс. Просадка" : "Max Drawdown"}</p>
                  <p className="text-lg font-bold text-yellow-400 transition-all duration-300 font-mono">{simDD.toFixed(2)}%</p>
                </div>
                <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-zinc-500 uppercase font-semibold">{isRu ? "Выживание" : "Survival Odds"}</p>
                  <p className="text-lg font-bold text-emerald-400 transition-all duration-300 font-mono">{simLive.toFixed(1)}%</p>
                </div>
              </div>

              {/* Animated Mock SVG Chart */}
              <div className="h-[140px] bg-black/40 rounded-2xl border border-white/5 flex items-end relative overflow-hidden p-2">
                <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                  {/* Grid Lines */}
                  <line x1="0" y1="10" x2="100" y2="10" stroke="#ffffff05" strokeWidth="0.5" />
                  <line x1="0" y1="25" x2="100" y2="25" stroke="#ffffff05" strokeWidth="0.5" />
                  <line x1="0" y1="40" x2="100" y2="40" stroke="#ffffff05" strokeWidth="0.5" />
                  
                  {/* Simulation Lines */}
                  <path d="M0,25 Q15,10 30,15 T60,5 T90,2 T100,0" fill="none" stroke="#22c55e" strokeWidth="1" className="opacity-40 animate-pulse" />
                  <path d="M0,25 Q20,35 40,30 T70,45 T90,48 T100,50" fill="none" stroke="#ef4444" strokeWidth="1" className="opacity-40 animate-pulse" />
                  <path d="M0,25 Q10,22 30,23 T50,20 T80,18 T100,15" fill="none" stroke="#eab308" strokeWidth="2" strokeDasharray="2 1" />
                </svg>
                <div className="absolute bottom-2 left-3 font-mono text-[9px] text-zinc-600">Step: 1000 / 1000 paths</div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Core Features: Details on each aspect */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-white text-center mb-16 uppercase tracking-wider font-display">
          {isRu ? "Инструменты Системного Роста" : "Tools of Systematic Growth"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="border border-white/5 rounded-3xl p-6 bg-white/5 space-y-4 hover:border-red-500/20 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{isRu ? "Bias и Дневник" : "Bias & Daily Journal"}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isRu 
                ? "Забудьте о хаотичных заметках. Записывайте утренний Bias, делайте декомпозицию аргументов (Pros/Cons), прикрепляйте скриншоты ваших сетапов. Система преобразует ваши рассуждения в сухие исторические цифры."
                : "Forget chaotic notes. Record your morning Bias, break down Pros/Cons arguments, and attach screenshots. The system turns your daily market bias into clean historical trade data."}
            </p>
          </div>

          <div className="border border-white/5 rounded-3xl p-6 bg-white/5 space-y-4 hover:border-emerald-500/20 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{isRu ? "Фокус Сессии (Помодоро)" : "Focus Sessions (Pomodoro)"}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isRu 
                ? "Время на графиках должно быть эффективным. Встроенный таймер фокуса измеряет время чистой концентрации. Мы сопоставим время ваших сессий с результатами торговли, выявляя перегрузки и тильт."
                : "Chart screen time must be optimized. Our built-in focus timer measures pure concentration. We map session durations against actual trade results to isolate overtrading and mental fatigue."}
            </p>
          </div>

          <div className="border border-white/5 rounded-3xl p-6 bg-white/5 space-y-4 hover:border-blue-500/20 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">{isRu ? "Дисциплинарный прогресс" : "Discipline Progress"}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {isRu 
                ? "Вместо пустой игровой прокачки, мы отслеживаем стабильность выполнения ваших торговых рутин (медитация, подготовка, разбор). Стрики и уровни здесь — это числовой показатель стабильности вашей дисциплины."
                : "Instead of generic gaming progression, we track your trading routines execution (prep, review, exercise). Your streak represents the numerical consistency of your operational discipline."}
            </p>
          </div>

        </div>
      </section>

      {/* News Feature Teaser */}
      <section className="bg-gradient-to-t from-red-950/10 to-transparent border-t border-white/5 py-20 relative">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <Badge className="bg-red-500/10 border-red-500/20 text-red-400 text-xs py-1 px-3 rounded-full hover:bg-red-500/10">
            {isRu ? "В разработке: Нейросетевой монитор новостей" : "In Development: AI News Monitor"}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            {isRu 
              ? "Скоро: Мониторинг и исторический анализ новостного влияния" 
              : "Coming Soon: Historical & Probabilistic News Impact Monitor"}
          </h2>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mx-auto text-sm sm:text-base">
            {isRu 
              ? "Мы разрабатываем модуль, который не просто показывает экономический календарь, а вычисляет математическую вероятность влияния событий (FOMC, CPI, NFP) на конкретный актив (Gold, EURUSD, GER40). Система проанализирует годы исторических данных и покажет точные исходы движения цены в первые 5, 15 и 60 минут после выхода аналогичных новостей."
              : "We are building an engine that goes beyond showing standard economic calendars: it computes the mathematical probability of high-impact events (FOMC, CPI, NFP) influencing specific assets (Gold, EURUSD, GER40) based on historical tick reactions over years of price data."}
          </p>
          <div className="flex justify-center items-center gap-4 text-xs font-mono text-zinc-500 pt-4">
            <span className="flex items-center gap-1.5"><Newspaper className="w-4 h-4 text-red-400" /> Forex Factory Aggregator</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-red-400" /> Historical Price Reaction Model</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 relative z-10">
        <p className="tracking-wider">© {new Date().getFullYear()} Persona OS. Dedicated to Systematic Discipline & Stat Validation.</p>
      </footer>

    </div>
  );
}

// Minimal Badge Component for styling
function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 text-xs font-medium border rounded-full ${className}`}>
      {children}
    </span>
  );
}

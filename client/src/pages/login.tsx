import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useI18n, LangToggle } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, Activity, BarChart3, Newspaper, 
  Calendar, ShieldAlert, Award, FileText, 
  CheckCircle2, ChevronRight, LayoutDashboard, 
  Target, Timer, Lightbulb, Settings, Lock
} from "lucide-react";

// ── Synthwave Warp Grid & Particles Canvas ─────────────────────────────────
function SynthwaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Track mouse position relative to canvas
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Grid config
    const gridSize = 45;
    const warpRadius = 160;
    const warpStrength = 45;

    // Particles config
    const particles: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.5 + 0.2,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw synthwave horizon glow
      const horizonY = height * 0.65;
      const grad = ctx.createLinearGradient(0, horizonY - 150, 0, horizonY + 200);
      grad.addColorStop(0, "rgba(220, 38, 38, 0)");
      grad.addColorStop(0.4, "rgba(220, 38, 38, 0.08)");
      grad.addColorStop(0.6, "rgba(147, 51, 234, 0.08)");
      grad.addColorStop(1, "rgba(5, 5, 5, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.strokeStyle = "rgba(220, 38, 38, 0.15)";
      ctx.lineWidth = 1;

      // Animate grid offset (scrolling down effect)
      offset = (offset + 0.3) % gridSize;

      // Draw horizontal lines with perspective
      const numLines = Math.ceil(height / gridSize) + 2;
      for (let i = -2; i < numLines; i++) {
        const yBase = i * gridSize + offset;
        ctx.beginPath();

        // Sample points along the width to apply mouse warp
        const steps = 40;
        for (let s = 0; s <= steps; s++) {
          const xBase = (s / steps) * width;
          let currentX = xBase;
          let currentY = yBase;

          // Warp calculation
          const dx = currentX - mouseRef.current.x;
          const dy = currentY - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < warpRadius) {
            const force = (warpRadius - dist) / warpRadius; // 0 to 1
            // Bending/indenting effect (pushing away from cursor)
            const dirX = dx / (dist || 1);
            const dirY = dy / (dist || 1);
            currentX += dirX * force * warpStrength;
            currentY += dirY * force * warpStrength;
          }

          if (s === 0) {
            ctx.moveTo(currentX, currentY);
          } else {
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.stroke();
      }

      // Draw vertical lines with warp
      const cols = Math.ceil(width / gridSize) + 2;
      for (let i = -1; i < cols; i++) {
        const xBase = i * gridSize;
        ctx.beginPath();

        const steps = 30;
        for (let s = 0; s <= steps; s++) {
          const yBase = (s / steps) * height;
          let currentX = xBase;
          let currentY = yBase;

          // Warp calculation
          const dx = currentX - mouseRef.current.x;
          const dy = currentY - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < warpRadius) {
            const force = (warpRadius - dist) / warpRadius;
            const dirX = dx / (dist || 1);
            const dirY = dy / (dist || 1);
            currentX += dirX * force * warpStrength;
            currentY += dirY * force * warpStrength;
          }

          if (s === 0) {
            ctx.moveTo(currentX, currentY);
          } else {
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.stroke();
      }

      // Render & update particles
      ctx.fillStyle = "rgba(220, 38, 38, 0.4)";
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }

        // Slight drift left/right
        p.x += Math.sin(p.y / 30) * 0.2;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${p.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(220, 38, 38, 0.8)";
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Interactive Inverting Mouse Follower ────────────────────────────────────
function MouseFollowerLens() {
  const lensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Direct DOM update for smooth lag-free translation
      lens.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div 
      ref={lensRef} 
      className="fixed top-0 left-0 w-24 h-24 rounded-full border border-red-500 bg-white mix-blend-difference pointer-events-none z-[9999] transition-all duration-300 ease-out hidden md:block scale-75 hover:scale-110"
      style={{ willChange: "transform" }}
    />
  );
}

// ── Trading Tab simulation mockup ───────────────────────────────────────────
function TradingSimulatorMockup({ lang }: { lang: "ru" | "en" }) {
  const [balance, setBalance] = useState(5000);
  const [winCount, setWinCount] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const [passed, setPassed] = useState(false);
  const [points, setPoints] = useState<number[]>([5000]);

  useEffect(() => {
    const id = setInterval(() => {
      if (failed || passed) {
        setBalance(5000);
        setWinCount(0);
        setTradeCount(0);
        setFailed(false);
        setPassed(false);
        setPoints([5000]);
        return;
      }

      setTradeCount(c => c + 1);
      const isWin = Math.random() < 0.54; 
      const risk = 50; 
      let nextBalance = balance;

      if (isWin) {
        nextBalance += risk * 1.9; 
        setWinCount(c => c + 1);
      } else {
        nextBalance -= risk;
      }

      if (nextBalance <= 4500) {
        setFailed(true);
      } else if (nextBalance >= 5400) {
        setPassed(true);
      }

      setBalance(Math.round(nextBalance));
      setPoints(p => [...p.slice(-12), Math.round(nextBalance)]);
    }, 1200);

    return () => clearInterval(id);
  }, [balance, failed, passed]);

  return (
    <div className="bg-[#0c0c0e]/80 border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-xl rounded-full" />
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <span className="text-zinc-500 font-bold uppercase tracking-wider font-display">MONTE-CARLO SIMULATOR</span>
        <span className={`text-[10px] px-2 py-0.5 rounded font-black ${failed ? 'bg-red-500/20 text-red-400' : passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400 animate-pulse'}`}>
          {failed ? (lang === 'ru' ? 'ПРОВАЛЕН' : 'FAILED') : passed ? (lang === 'ru' ? 'ПРОЙДЕН' : 'PASSED') : (lang === 'ru' ? 'СИМУЛЯЦИЯ...' : 'RUNNING...')}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase">{lang === 'ru' ? 'Баланс' : 'Equity'}</p>
          <p className="text-base font-bold text-white">${balance}</p>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase">{lang === 'ru' ? 'Сделки' : 'Trades'}</p>
          <p className="text-base font-bold text-white">{tradeCount}</p>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase">Win Rate</p>
          <p className="text-base font-bold text-white">{tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 54}%</p>
        </div>
      </div>

      {/* Interactive curve bars */}
      <div className="h-24 flex items-end justify-between gap-1 pt-2">
        {points.map((val, idx) => {
          const heightPct = Math.max(10, Math.min(100, ((val - 4300) / 1200) * 100));
          const isUp = idx === 0 ? true : val >= points[idx - 1];
          return (
            <div
              key={idx}
              className={`w-full rounded-t transition-all duration-300 ${isUp ? 'bg-emerald-500/40 border-t border-emerald-400' : 'bg-red-500/40 border-t border-red-400'}`}
              style={{ height: `${heightPct}%` }}
            />
          );
        })}
      </div>

      <div className="text-[10px] text-zinc-500 leading-tight">
        {lang === 'ru' 
          ? '* Текущие прогоны: слияние XAU/USD и GER40 при риске 1%. Учитывается лимит maxWinsPerDay = 1.'
          : '* Active paths: XAU/USD & GER40 correlation simulation. 1% Risk. constraint: maxWinsPerDay = 1.'}
      </div>
    </div>
  );
}

function NewsCorrelationMockup({ lang }: { lang: "ru" | "en" }) {
  return (
    <div className="bg-[#0c0c0e]/80 border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
      <div className="flex justify-between items-center border-b border-white/5 pb-3">
        <span className="text-zinc-500 font-bold uppercase tracking-wider font-display">NEWS CORRELATION ENGINE</span>
        <span className="text-[10px] text-zinc-500">USD / High Impact</span>
      </div>

      <div className="space-y-2">
        <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between items-center">
          <div>
            <p className="font-bold text-white">US CPI (Consumer Price Index)</p>
            <p className="text-[10px] text-zinc-500">{lang === 'ru' ? 'Потреб. инфляция США' : 'US Consumer Inflation'}</p>
          </div>
          <span className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-0.5 rounded">High Impact</span>
        </div>

        <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5 space-y-2">
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>{lang === 'ru' ? 'Историческое влияние (XAU/USD)' : 'Historical Impact (XAU/USD)'}</span>
            <span className="text-emerald-400">{lang === 'ru' ? 'Точность 74%' : 'Accuracy 74%'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white font-bold">{lang === 'ru' ? 'Шанс импульса > 80 пунктов:' : 'Probability of >80 pip impulse:'}</span>
            <span className="text-base font-black text-emerald-400">82.3%</span>
          </div>
          <div className="w-full bg-zinc-850 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82.3%' }} />
          </div>
        </div>
      </div>

      <div className="text-[10px] text-zinc-500 leading-tight">
        {lang === 'ru'
          ? '* Модели обучаются на выборке реакций за последние 5 лет с точностью до 15 секунд после выхода новостей.'
          : '* Impact forecasting weights are trained on a 5-year tick database mapped to 15s post-release reactions.'}
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#030304] text-zinc-100 font-sans selection:bg-red-500/30 selection:text-red-200 relative overflow-x-hidden">
      
      {/* Load Retro Fonts for Negative Pixel Hover Effect */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Outfit:wght@300;400;700;900&display=swap');
        
        .hover-pixel {
          transition: font-family 0.1s, font-size 0.1s, letter-spacing 0.1s;
        }
        .hover-pixel:hover {
          font-family: 'Press Start 2P', monospace !important;
          letter-spacing: -0.08em !important;
          font-size: 0.8em !important;
          text-shadow: 0 0 8px rgba(239, 68, 68, 0.8);
        }
        
        /* Pixel Scanline animation for News teaser */
        .scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.25) 50%
          ), linear-gradient(
            90deg,
            rgba(255, 0, 0, 0.06),
            rgba(0, 255, 0, 0.02),
            rgba(0, 0, 255, 0.06)
          );
          background-size: 100% 4px, 3px 100%;
          pointer-events: none;
        }

        .crt-blink {
          animation: crt-blink-anim 1.5s infinite;
        }
        @keyframes crt-blink-anim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Warping perspective grid and particles */}
      <SynthwaveCanvas />

      {/* Cursor negation filter for desktops */}
      <MouseFollowerLens />

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-black text-sm text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]">P</div>
          <span className="font-bold tracking-[0.25em] text-sm text-white font-display uppercase">Persona Life OS</span>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center relative z-10">
        
        {/* Left Side: Product Intro Copy */}
        <div className="space-y-6">
          <Badge className="bg-red-500/10 hover:bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1 text-xs uppercase tracking-widest rounded-full font-mono">
            {isRu ? "Оцифровка Системности и Результатов" : "Discipline & Stats Operating System"}
          </Badge>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white font-display uppercase hover-pixel cursor-default">
            {isRu ? (
              <>
                Прекратите сливать из-за тильта. Начните анализировать себя.
              </>
            ) : (
              <>
                Stop blowing accounts to tilt. Track your stats.
              </>
            )}
          </h1>
          
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-xl">
            {isRu ? (
              "Persona Life OS — это система анализа личной эффективности и дисциплины, созданная специально для трейдеров. Мы убрали геймификацию и сфокусировались на жестких цифрах вашего поведения: времени чистого фокуса на графиках, торговых сессиях, декомпозиции целей и симуляции Монте-Карло."
            ) : (
              "Persona Life OS is a discipline workbench designed by a trader, for traders. We skipped standard game achievements to focus strictly on raw behavioral numbers: screen focus time, sessions calendar, goal execution, and path-dependent Monte Carlo simulation."
            )}
          </p>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 max-w-md">
            <div>
              <p className="text-2xl font-black text-white font-mono">0.0%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{isRu ? "Иллюзий" : "Subjectivity"}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400 font-mono">100%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{isRu ? "Чистая логика" : "Hard Data"}</p>
            </div>
            <div>
              <p className="text-2xl font-black text-red-500 font-mono">&lt;2.0%</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{isRu ? "Риск слива" : "Ruin probability"}</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="flex justify-center">
          <div className="w-full max-w-md border border-white/10 rounded-3xl p-8 bg-zinc-950/40 backdrop-blur-xl shadow-2xl relative">
            <div className="absolute top-0 right-0 w-6 h-6 bg-red-600 rounded-tr-3xl shadow-[0_0_10px_rgba(220,38,38,0.5)]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
            
            <div className="flex rounded-xl overflow-hidden border border-white/5 mb-6 bg-black/60 p-1">
              <button
                className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg ${
                  mode === "login" ? "bg-white/10 text-white shadow-inner font-black" : "text-zinc-500 hover:text-zinc-300"
                }`}
                onClick={() => { setMode("login"); setShowResend(false); setResendDone(false); }}
                data-testid="tab-login"
              >
                {t.auth.loginTab}
              </button>
              <button
                className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg ${
                  mode === "register" ? "bg-white/10 text-white shadow-inner font-black" : "text-zinc-500 hover:text-zinc-300"
                }`}
                onClick={() => { setMode("register"); setShowResend(false); setResendDone(false); }}
                data-testid="tab-register"
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
                  data-testid="input-email"
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
                  data-testid="input-password"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-display uppercase tracking-[0.25em] text-xs h-11 rounded-xl mt-4 shadow-[0_0_20px_rgba(220,38,38,0.2)] font-bold"
                data-testid="button-auth-submit"
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
                data-testid="button-switch-mode"
              >
                {mode === "login" ? t.auth.registerTab : t.auth.loginTab}
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Trading tab deep-dive (The Key Feature) */}
      <section className="bg-black/30 border-y border-white/5 py-20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
            
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-red-500">
                <TrendingUp className="w-5 h-5 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest font-display">{isRu ? "Основа платформы" : "Platform core"}</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase font-display hover-pixel cursor-default">
                {isRu 
                  ? "Раздел Трейдинг — оцифровка вашего математического ожидания" 
                  : "Trading Section — Digitizing Your Expected Value"}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {isRu 
                  ? "Наша вкладка «Трейдинг» — это не просто таблица сделок, это инструмент валидации вашего торгового плана. Она объединяет подробный торговый журнал с симулятором Монте-Карло. Вместо надежд вы получаете сухие цифры: вероятность уйти в просадку, влияние комиссии брокера и точный шанс пройти обе фазы проп-челленджа при риске 1%."
                  : "Our Trading section is a workbench to validate your statistical edge. It integrates a trade journal with a path-dependent Monte Carlo simulation engine. Instead of blind assumptions, you get verified statistics: maximum drawdown probability, broker slippage impact, and the exact odds of passing prop challenges."}
              </p>
              <div className="space-y-3 font-mono text-xs text-zinc-500">
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Симуляция 1000 эквити-кривых с учетом лимитов (maxWinsPerDay)" : "Simulating 1000 equity paths under strict maxWinsPerDay rules"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Расчет Profit Factor и чистого EV на сделку" : "Calculates Profit Factor & exact Expected Value per trade"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Экспорт ИИ-датасетов (JSON) для ваших нейросетей" : "AI-ready dataset exports (JSON) containing full algorithm specs"}</p></div>
              </div>
            </div>

            {/* Simulated interactive mockup */}
            <TradingSimulatorMockup lang={lang} />

          </div>
        </div>
      </section>

      {/* Feature Grid: Descriptions of all 8 sections */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black text-white text-center mb-16 uppercase tracking-wider font-display hover-pixel cursor-default">
          {isRu ? "Архитектура Системности" : "Systems Architecture"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Hub */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Главный Хаб" : "Main Hub"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Дашборд дня. Отображает активные фазы торговли, часы сессий, дневной фокус и список задач дисциплины."
                : "Cockpit of your day. Displays active trading sessions, focus minutes, and daily operational discipline tasks."}
            </p>
          </div>

          {/* Card 2: Tasks */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Задачи и Рутина" : "Tasks & Routines"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Формирование привычек. Создавайте повторяющиеся шаблоны рутины для системной подготовки к торгам."
                : "Operational checklist. Build repeating templates for your pre-market routine and checklist executions."}
            </p>
          </div>

          {/* Card 3: Goals */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Декомпозиция целей" : "Goals Breakdown"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Каскад целей. Разбивайте масштабные годовые и месячные цели на конкретные еженедельные вехи."
                : "Goal cascading. Break down long-term yearly and monthly milestones into actionable weekly targets."}
            </p>
          </div>

          {/* Card 4: Focus Timer */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Таймер Фокуса" : "Focus Timer"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Борьба с FOMO. Помодоро-таймер фиксирует время работы над анализом графиков, исключая хаотичные входы."
                : "Tilt prevention. Tracks deep concentration chart blocks, restricting aimless screen watching and FOMO."}
            </p>
          </div>

          {/* Card 5: Trading bias */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Дневник Bias" : "Daily Bias Log"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Фиксация контекста. Записывайте дневной Bias, заносите аргументы за и против (Pros/Cons) и скрины."
                : "Context tracking. Formulate your morning Bias, list pros/cons arguments, and save chart screenshots."}
            </p>
          </div>

          {/* Card 6: Ideas */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Банк Идей" : "Ideas Repository"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Сбор гипотез. Мгновенно сохраняйте инсайты и новые торговые модели для последующего бэктестинга."
                : "Hypothesis collector. Capture insights and new setup patterns instantly for future backtest validations."}
            </p>
          </div>

          {/* Card 7: Calendar */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Календарь Биасов" : "Bias Calendar"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Исторический срез. Просматривайте архив дневных биасов и торговых заметок по дням."
                : "Historical overview. Browse your daily bias archives and journal remarks day by day in calendar layout."}
            </p>
          </div>

          {/* Card 8: Settings */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover:border-red-500/20 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Настройки сессий" : "Session Settings"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Калибровка. Настраивайте свои активные торговые сессии для сопоставления с результатами торговли."
                : "Calibration. Custom fit your timezone and session frames to align statistics with your execution."}
            </p>
          </div>

        </div>
      </section>

      {/* News Teaser with locked pixel COMING SOON overlay */}
      <section className="border-t border-white/5 bg-zinc-950/20 py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
            
            <div className="space-y-6">
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 font-mono text-xs">{isRu ? "В разработке" : "In Development"}</Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase font-display hover-pixel cursor-default">
                {isRu 
                  ? "Мониторинг и исторический анализ новостного влияния" 
                  : "Smart News Aggregator & Probability Forecasting"}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {isRu 
                  ? "Экономические новости — главный источник непредвиденной волатильности. Скоро платформа будет автоматически мониторить экономический календарь, собирать данные и рассчитывать вероятность и силу влияния событий (CPI, FOMC, NFP) на выбранные вами активы. Анализ строится на основе исторических реакций цены за последние 5 лет."
                  : "Macroeconomic reports are the prime source of tail risk. Soon, the engine will automatically parse the Forex Factory calendar, gather reaction database tables, and calculate the mathematical probability and expected pip deviation of events (CPI, FOMC, NFP) on majors and Gold, mapped against 5 years of historical tick charts."}
              </p>
            </div>

            {/* News Teaser Container with overlay lock */}
            <div className="relative border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              {/* Actual mockup blurred */}
              <div className="blur-[5px] select-none pointer-events-none opacity-45">
                <NewsCorrelationMockup lang={lang} />
              </div>

              {/* Retro Pixel Coming Soon Overlay */}
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/75 z-20 p-6 text-center border border-red-500/30 rounded-3xl">
                <div className="scanlines" />
                <Lock className="w-12 h-12 text-red-500 animate-pulse mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <h3 className="font-mono text-base font-bold text-red-500 tracking-[0.2em] crt-blink uppercase" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', textShadow: '0 0 5px rgba(239, 68, 68, 0.8)' }}>
                  COMING SOON
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-3 max-w-[280px] leading-relaxed">
                  {isRu 
                    ? "[СТАТУС: МОДЕЛИРОВАНИЕ ИСТОРИЧЕСКИХ ДАННЫХ В ПРОЦЕССЕ]" 
                    : "[STATUS: HISTORICAL DATA AGGREGATION IN PROGRESS]"}
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 relative z-10 font-mono">
        <p className="tracking-wider">© {new Date().getFullYear()} Persona OS. Dedicated to Systematic Discipline & Stat Validation.</p>
      </footer>

    </div>
  );
}



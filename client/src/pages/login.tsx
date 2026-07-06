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

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX,
        y: e.clientY,
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

    const gridSize = 45;
    const warpRadius = 200; // Wider deformation reach
    const warpStrength = 28; // Subtle inward gravity well

    const particles: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.6,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }

    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Deep dark synthwave backdrop
      const horizonY = height * 0.65;
      const grad = ctx.createLinearGradient(0, horizonY - 200, 0, horizonY + 250);
      grad.addColorStop(0, "rgba(220, 38, 38, 0)");
      grad.addColorStop(0.4, "rgba(220, 38, 38, 0.04)");
      grad.addColorStop(0.7, "rgba(147, 51, 234, 0.04)");
      grad.addColorStop(1, "rgba(3, 3, 4, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Grid stroke styling
      ctx.strokeStyle = "rgba(220, 38, 38, 0.08)";
      ctx.lineWidth = 1;

      offset = (offset + 0.2) % gridSize;

      // Draw horizontal lines (inward gravity deformation)
      const numLines = Math.ceil(height / gridSize) + 2;
      for (let i = -2; i < numLines; i++) {
        const yBase = i * gridSize + offset;
        ctx.beginPath();

        const steps = 50;
        for (let s = 0; s <= steps; s++) {
          const xBase = (s / steps) * width;
          let currentX = xBase;
          let currentY = yBase;

          const dx = currentX - mouseRef.current.x;
          const dy = currentY - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < warpRadius) {
            const force = (warpRadius - dist) / warpRadius;
            const dirX = dx / (dist || 1);
            const dirY = dy / (dist || 1);
            // Subtract to bend/pull inward towards the cursor position
            currentX -= dirX * force * warpStrength;
            currentY -= dirY * force * warpStrength;
          }

          if (s === 0) {
            ctx.moveTo(currentX, currentY);
          } else {
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.stroke();
      }

      // Draw vertical lines (inward gravity deformation)
      const cols = Math.ceil(width / gridSize) + 2;
      for (let i = -1; i < cols; i++) {
        const xBase = i * gridSize;
        ctx.beginPath();

        const steps = 40;
        for (let s = 0; s <= steps; s++) {
          const yBase = (s / steps) * height;
          let currentX = xBase;
          let currentY = yBase;

          const dx = currentX - mouseRef.current.x;
          const dy = currentY - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < warpRadius) {
            const force = (warpRadius - dist) / warpRadius;
            const dirX = dx / (dist || 1);
            const dirY = dy / (dist || 1);
            currentX -= dirX * force * warpStrength;
            currentY -= dirY * force * warpStrength;
          }

          if (s === 0) {
            ctx.moveTo(currentX, currentY);
          } else {
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.stroke();
      }

      // Drift particles upward
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        p.x += Math.sin(p.y / 50) * 0.1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 38, 38, ${p.opacity})`;
        ctx.fill();
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

  return <canvas ref={canvasRef} className="fixed inset-0 w-screen h-screen pointer-events-none z-0" />;
}

// ── Custom Dot to Circle Inverting Cursor ───────────────────────────────────
function CustomCursor() {
  const lensRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    document.body.classList.add("landing-cursor");

    const handleMouseMove = (e: MouseEvent) => {
      lens.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    };

    // Expand cursor on hovering targets
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (
        target.tagName === "H1" || 
        target.tagName === "H2" || 
        target.tagName === "H3" || 
        target.tagName === "A" || 
        target.tagName === "BUTTON" || 
        target.classList.contains("hover-target") ||
        target.closest(".hover-target")
      )) {
        setIsHovered(true);
      } else {
        setIsHovered(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      document.body.classList.remove("landing-cursor");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  return (
    <div 
      ref={lensRef} 
      className={`fixed top-0 left-0 rounded-full pointer-events-none z-[9999] transition-all duration-300 ease-out hidden md:block ${
        isHovered 
          ? "w-32 h-32 bg-white border border-red-500/40 mix-blend-difference" 
          : "w-2.5 h-2.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"
      }`}
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
    <div className="bg-[#0b0b0d]/90 border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
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
          <p className="text-base font-bold text-white font-mono">${balance}</p>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase">{lang === 'ru' ? 'Сделки' : 'Trades'}</p>
          <p className="text-base font-bold text-white font-mono">{tradeCount}</p>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase">Win Rate</p>
          <p className="text-base font-bold text-white font-mono">{tradeCount > 0 ? Math.round((winCount / tradeCount) * 100) : 54}%</p>
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
    <div className="bg-[#0b0b0d]/90 border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden backdrop-blur-md">
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
    <div className="min-h-screen bg-[#030304] text-zinc-100 font-sans relative overflow-x-hidden">
      
      {/* Global CSS settings for custom cursor and font load */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&family=Press+Start+2P&family=JetBrains+Mono:wght@400;700&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif !important;
        }

        body.landing-cursor {
          cursor: none !important;
        }
        body.landing-cursor a, 
        body.landing-cursor button, 
        body.landing-cursor input, 
        body.landing-cursor textarea {
          cursor: none !important;
        }
        
        /* Reveal animation on page load */
        .reveal-text {
          animation: reveal-anim 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(20px);
        }
        .delay-1 { animation-delay: 150ms; }
        .delay-2 { animation-delay: 300ms; }
        .delay-3 { animation-delay: 450ms; }

        @keyframes reveal-anim {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Hover animations for cards and interactive inputs */
        .hover-glow-card {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s;
        }
        .hover-glow-card:hover {
          transform: translateY(-4px);
          border-color: rgba(220, 38, 38, 0.25);
          box-shadow: 0 10px 30px -10px rgba(220, 38, 38, 0.15);
        }

        /* Scanlines for News Teaser Overlay */
        .scanlines {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            rgba(18, 16, 16, 0) 50%, 
            rgba(0, 0, 0, 0.45) 50%
          );
          background-size: 100% 4px;
          pointer-events: none;
        }

        .crt-blink {
          animation: crt-blink-anim 2.5s infinite;
        }
        @keyframes crt-blink-anim {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.25; }
        }
      `}</style>

      {/* Warping grid canvas and particle engine */}
      <SynthwaveCanvas />

      {/* Trailing Inverting Circle Cursor */}
      <CustomCursor />

      {/* Background Chalk Trading Easter Eggs */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[-4deg] absolute top-[22%] left-[10%] cursor-none">
          [ORDER BLOCK - 15m]
        </div>
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[6deg] absolute top-[30%] left-[82%] cursor-none">
          [Liq Pool ⬇]
        </div>
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[-8deg] absolute top-[55%] left-[5%] cursor-none">
          [FVG / Fair Value Gap]
        </div>
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[3deg] absolute top-[70%] left-[75%] cursor-none">
          [BOS / CHoCH]
        </div>
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[-3deg] absolute bottom-[22%] left-[15%] cursor-none">
          [Risk : Reward = 1 : 3.5]
        </div>
        <div className="hover-target text-white/5 font-mono text-[9px] uppercase border border-dashed border-white/5 p-2 rounded rotate-[5deg] absolute bottom-[10%] left-[78%] cursor-none">
          [Premium / Discount]
        </div>
      </div>

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
        
        {/* Left Side: Copy */}
        <div className="space-y-6">
          <Badge className="bg-red-500/10 hover:bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1 text-xs uppercase tracking-widest rounded-full font-mono reveal-text">
            {isRu ? "Оцифровка Системности и Результатов" : "Discipline & Stats Operating System"}
          </Badge>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white font-display uppercase cursor-default reveal-text delay-1">
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
          
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-xl reveal-text delay-2">
            {isRu ? (
              "Persona Life OS — это система анализа личной эффективности и дисциплины, созданная специально для трейдеров. Мы убрали геймификацию и сфокусировались на жестких цифрах вашего поведения: времени чистого фокуса на графиках, торговых сессиях, декомпозиции целей и симуляции Монте-Карло."
            ) : (
              "Persona Life OS is a discipline workbench designed by a trader, for traders. We skipped standard game achievements to focus strictly on raw behavioral numbers: screen focus time, sessions calendar, goal execution, and path-dependent Monte Carlo simulation."
            )}
          </p>
          
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10 max-w-md reveal-text delay-3">
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
        <div className="flex justify-center reveal-text delay-2">
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
                  className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm h-10"
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
                  className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm h-10"
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
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase font-display cursor-default">
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
        <h2 className="text-3xl font-black text-white text-center mb-16 uppercase tracking-wider font-display cursor-default">
          {isRu ? "Архитектура Системности" : "Systems Architecture"}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Hub */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Главный Хаб" : "Main Hub"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Ваша стартовая панель. Отображает активные торговые сессии (London/New York/Asia), текущий прогресс дня, помодоро-таймер и динамические графики стабильности. Никаких отвлекающих факторов — только фокус на текущих задачах и дисциплине."
                : "Cockpit of your day. Displays active trading sessions, focus minutes, and daily operational discipline tasks. Zero distractions — pure focus on execution."}
            </p>
          </div>

          {/* Card 2: Tasks */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Задачи и Рутина" : "Tasks & Routines"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Разделение задач на рутинные чек-листы перед началом торгов и дневные операционные задачи. Позволяет автоматизировать подготовку (медитация, проверка новостей, анализ графиков HTF) и исключить вход в рынок без предварительного чек-листа."
                : "Operational checklist. Build repeating templates for your pre-market routine and checklist executions. Prevents impulsive market entries."}
            </p>
          </div>

          {/* Card 3: Goals */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Декомпозиция целей" : "Goals Breakdown"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Древовидная структура целей. Связывайте годовые финансовые цели с месячными вехами просадки/профита и недельными задачами. Каждое действие на рынке должно быть обосновано глобальной целью."
                : "Goal cascading. Break down long-term yearly and monthly milestones into actionable weekly targets. Tie physical goals to trading performance."}
            </p>
          </div>

          {/* Card 4: Focus Timer */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Timer className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Таймер Фокуса" : "Focus Timer"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Инструмент контроля времени нахождения перед графиками. Помодоро-таймер с фиксированием чистой фокусировки. Помогает предотвратить овертрейдинг, отслеживая минуты внимания и связывая их с вашим эмоциональным состоянием."
                : "Tilt prevention. Tracks deep concentration chart blocks, restricting aimless screen watching and FOMO. Matches focus time with trading results."}
            </p>
          </div>

          {/* Card 5: Trading bias */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Дневник Bias" : "Daily Bias Log"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Журнал контекста старших таймфреймов. Определение направления дня (Bias), взвешивание факторов за и против (Pros/Cons), скриншоты разметки HTF. Накапливает статистическую выборку точности вашего рыночного контекста."
                : "Context tracking. Formulate your morning Bias, list pros/cons arguments, and save chart screenshots. Builds a record of your structural understanding."}
            </p>
          </div>

          {/* Card 6: Ideas */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Банк Идей" : "Ideas Repository"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Банк для хранения торговых моделей и гипотез. Позволяет зафиксировать сетап вне рынка, описать условия входа и правила сопровождения для последующей проверки в тестере."
                : "Hypothesis collector. Capture insights and new setup patterns instantly for future backtest validations. Separate ideas from execution."}
            </p>
          </div>

          {/* Card 7: Calendar */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Календарь Биасов" : "Bias Calendar"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Сетка истории вашего торгового мышления. Календарь позволяет проанализировать, в какие дни недели у вас наибольшая точность определения Bias, и скорректировать торговую активность."
                : "Historical overview. Browse your daily bias archives and journal remarks day by day in calendar layout. Spot weekdays with poor discipline."}
            </p>
          </div>

          {/* Card 8: Settings */}
          <div className="border border-white/5 rounded-3xl p-6 bg-zinc-950/20 space-y-4 hover-glow-card">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white uppercase font-display">{isRu ? "Настройки сессий" : "Session Settings"}</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isRu 
                ? "Настройка вашего торгового времени. Задавайте точные интервалы сессий (UTC) для автоматического сопоставления времени сделок и выявления периодов наибольшей убыточности."
                : "Calibration. Custom fit your timezone and session frames to align statistics with your execution. Restrict trading outside defined hours."}
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
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase font-display cursor-default">
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
                <h3 className="font-mono text-base font-bold text-red-500 tracking-[0.2em] crt-blink uppercase animate-pulse" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px', textShadow: '0 0 5px rgba(239, 68, 68, 0.8)' }}>
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

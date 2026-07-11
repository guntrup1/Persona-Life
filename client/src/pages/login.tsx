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
  Target, Timer, Lightbulb, Settings, Lock, X,
  Terminal, AlertTriangle, Play
} from "lucide-react";

// ── Typewriter Text Effect ──────────────────────────────────────────────────
function TypewriterHeading({ text, className = "" }: { text: string; className?: string }) {
  const [displayedText, setDisplayedText] = useState("");
  
  useEffect(() => {
    const hasAnimated = sessionStorage.getItem(`typed-${text}`);
    if (hasAnimated) {
      setDisplayedText(text);
      return;
    }
    
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        sessionStorage.setItem(`typed-${text}`, "true");
      }
    }, 35);
    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{displayedText}</span>;
}

// ── Count-up Odometer Stat (Hover-Restartable) ──────────────────────────────
function CountUpStat({ value, suffix = "", duration = 1200 }: { value: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [trigger, setTrigger] = useState(0);
  
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(0);
      return;
    }
    
    const increment = end / (duration / 16); 
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration, trigger]);

  const isFloat = value % 1 !== 0;
  return (
    <span 
      onMouseEnter={() => setTrigger(t => t + 1)}
      className="cursor-none hover-target inline-block select-none"
    >
      {isFloat ? count.toFixed(1) : Math.floor(count)}{suffix}
    </span>
  );
}

// ── MirrorWord Component (Grid-based, prevents cropping & shifts) ───────────
function MirrorWord({ normal, opposite, className = "", style = {} }: { normal: string; opposite: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span 
      className={`relative select-none hover-target cursor-none text-red-500 font-bold border-b border-dashed border-red-500/60 pb-0.5 px-1 hover:text-red-400 transition-colors ${className}`}
      style={{ verticalAlign: "middle", display: "inline-grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr", ...style }}
    >
      {/* Layer 1: Normal Word */}
      <span style={{ gridArea: "1/1", visibility: "visible" }} className="text-inherit whitespace-nowrap">
        {normal}
      </span>

      {/* Invisible spacer: reserves width for the wider of the two words */}
      <span style={{ gridArea: "1/1", visibility: "hidden" }} className="pointer-events-none select-none uppercase font-black whitespace-nowrap">
        {opposite.length > normal.length ? opposite : normal}
      </span>

      {/* Layer 2: Opposite Word with solid bg to cover normal text inside the circle */}
      <span 
        data-lens-target="true"
        className="text-white font-black bg-[#030304] select-none pointer-events-none whitespace-nowrap"
        style={{
          position: "absolute",
          inset: 0,
          clipPath: `circle(0px at 0px 0px)`,
          willChange: "clip-path",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {opposite}
      </span>
    </span>
  );
}

// ── ActionButton Component (Sleek P5 Royal double border + cursor mask) ──────
function ActionButton({ normal, opposite, onClick, className = "" }: { normal: string; opposite: string; onClick?: () => void; className?: string }) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const oppositeRef = useRef<HTMLDivElement>(null);

  return (
    <button
      ref={containerRef}
      onClick={onClick}
      className={`relative select-none hover-target cursor-none overflow-visible px-8 py-4 bg-[#0c0c0e] border border-white/25 text-white font-display font-black text-xs sm:text-sm uppercase tracking-widest rounded-xl shadow-[4px_4px_0_#dc2626] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_#dc2626] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#dc2626] flex items-center justify-center gap-2 ${className}`}
    >
      {/* Layer 1: Normal text */}
      <div className="flex items-center gap-2 text-white">
        <span>{normal}</span>
        <ChevronRight className="w-4 h-4 text-red-500" />
      </div>

      {/* Layer 2: Opposite text — solid bg covers normal text in circle */}
      <div
        ref={oppositeRef}
        data-lens-target="true"
        className="absolute inset-0 bg-[#030304] text-white font-black rounded-xl flex items-center justify-center gap-2 pointer-events-none select-none"
        style={{
          clipPath: "circle(0px at 0px 0px)",
          willChange: "clip-path",
        }}
      >
        <span>{opposite}</span>
        <ChevronRight className="w-4 h-4 text-red-500" />
      </div>
    </button>
  );
}

// ── OppositeText Component (Direct DOM, Buttery Smooth 60fps) ──────────────
function OppositeText({ normal, opposite, className = "" }: { normal: string; opposite: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const oppositeRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className={`relative select-none hover-target cursor-none inline-block ${className}`}
      style={{ verticalAlign: "top" }}
    >
      {/* Layer 1: Normal text - inherits parent color */}
      <div data-lens-normal="true" className="text-inherit">
        {normal}
      </div>

      {/* Layer 2: Opposite warning */}
      <div 
        ref={oppositeRef}
        data-lens-target="true"
        className="absolute inset-0 text-white font-black bg-[#030304] select-none pointer-events-none text-[1.04em] tracking-wide text-left"
        style={{
          clipPath: `circle(0px at 0px 0px)`,
          willChange: "clip-path",
        }}
      >
        <span className="w-full block">{opposite}</span>
      </div>
    </div>
  );
}

// ── EasterEgg Component (Scattered chalk references with secret mirrors) ───
interface EasterEggProps {
  text: string;
  oppositeText: string;
  className?: string;
  style?: React.CSSProperties;
}

function EasterEgg({ text, oppositeText, className = "", style = {} }: EasterEggProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const oppositeRef = useRef<HTMLDivElement>(null);

  return (
    <div 
      ref={containerRef}
      className={`hover-target text-white/10 font-mono text-[9px] uppercase border border-dashed border-white/15 p-3 rounded cursor-none pointer-events-auto hover:text-white hover:border-red-500/35 transition-all bg-transparent select-none absolute ${className}`}
      style={style}
    >
      {/* Layer 1: Faint default text */}
      <div className="text-inherit">
        {text}
      </div>

      {/* Layer 2: Revealed negative secret warning */}
      <div 
        ref={oppositeRef}
        data-lens-target="true"
        className="absolute inset-0 text-red-500 font-black bg-[#030304] flex items-center justify-center p-3 rounded text-center select-none pointer-events-none"
        style={{
          clipPath: `circle(0px at 0px 0px)`,
          willChange: "clip-path",
        }}
      >
        <span className="w-full text-white font-black text-center text-[9px] tracking-wide">{oppositeText}</span>
      </div>
    </div>
  );
}

// ── LogoLetter Component (Logo letter box inverting PERSONA -> TRADERS) ──────
interface LogoLetterProps {
  normal: string;
  opposite: string;
  bgClass: string;
  shadowClass: string;
  jitterClass: string;
}

function LogoLetter({ normal, opposite, bgClass, shadowClass, jitterClass }: LogoLetterProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const oppositeRef = useRef<HTMLSpanElement>(null);

  return (
    <span 
      ref={containerRef}
      className={`relative select-none hover-target cursor-none inline-block w-10 h-10 text-center font-display text-xl border border-black font-black transition-all ${bgClass} ${shadowClass} ${jitterClass}`}
      style={{ lineHeight: "2.3rem" }} 
    >
      {/* Layer 1: Normal Letter */}
      <span className="absolute inset-0 flex items-center justify-center text-inherit">{normal}</span>

      {/* Layer 2: Opposite Letter (revealed inside difference cursor) */}
      <span 
        ref={oppositeRef}
        data-lens-target="true"
        className="absolute inset-0 text-white font-black bg-[#030304] flex items-center justify-center text-center select-none pointer-events-none"
        style={{
          clipPath: `circle(0px at 0px 0px)`,
          willChange: "clip-path",
        }}
      >
        <span className="w-full block text-white font-black text-center">{opposite}</span>
      </span>
    </span>
  );
}

// ── P5 Royal Styled Logo (Deconstructed Letter Boxes PERSONA -> TRADERS) ─────
function P5Logo() {
  const [jitter, setJitter] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setJitter(true);
      setTimeout(() => setJitter(false), 200);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const letters = [
    { normal: "P", opposite: "T", bg: "bg-red-600 text-white", shadow: "shadow-[3px_3px_0_#fff]", jitter: jitter ? "transform -rotate-12 skew-x-[-12deg]" : "transform -rotate-3 skew-x-[-6deg]" },
    { normal: "E", opposite: "R", bg: "bg-zinc-950 text-white", shadow: "shadow-[-2px_3px_0_#ef4444]", jitter: jitter ? "transform rotate-12 skew-x-[12deg]" : "transform rotate-3 skew-x-[4deg]" },
    { normal: "R", opposite: "A", bg: "bg-white text-black", shadow: "shadow-[3px_-2px_0_#000]", jitter: jitter ? "transform -rotate-12 skew-x-[-15deg]" : "transform -rotate-6 skew-x-[-8deg]" },
    { normal: "S", opposite: "D", bg: "bg-red-600 text-white", shadow: "shadow-[2px_3px_0_#fff]", jitter: jitter ? "transform rotate-6 skew-x-[10deg]" : "transform rotate-2 skew-x-[6deg]" },
    { normal: "O", opposite: "E", bg: "bg-zinc-950 text-white", shadow: "shadow-[-3px_-2px_0_#ef4444]", jitter: jitter ? "transform -rotate-6 skew-x-[-8deg]" : "transform -rotate-2 skew-x-[-2deg]" },
    { normal: "N", opposite: "R", bg: "bg-white text-black", shadow: "shadow-[3px_3px_0_#000]", jitter: jitter ? "transform rotate-12 skew-x-[15deg]" : "transform rotate-6 skew-x-[8deg]" },
    { normal: "A", opposite: "S", bg: "bg-red-600 text-white", shadow: "shadow-[-2px_3px_0_#fff]", jitter: jitter ? "transform -rotate-12 skew-x-[-10deg]" : "transform -rotate-3 skew-x-[-5deg]" }
  ];

  return (
    <div className="flex items-center gap-1 font-black select-none scale-90 md:scale-100 origin-left">
      {letters.map((letObj, idx) => (
        <LogoLetter
          key={idx}
          normal={letObj.normal}
          opposite={letObj.opposite}
          bgClass={letObj.bg}
          shadowClass={letObj.shadow}
          jitterClass={letObj.jitter}
        />
      ))}
      <span className="text-red-500 font-mono text-xs ml-3 tracking-[0.2em] font-black uppercase skew-x-[-12deg] drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">Life OS</span>
    </div>
  );
}

// ── Barcode Scanner Text Component ──────────────────────────────────────────
function BarcodeScannerText({ lang }: { lang: "ru" | "en" }) {
  const words = lang === "ru" 
    ? ["ТОРГУЙ", "АНАЛИЗИРУЙ", "ДЕЙСТВУЙ", "ФИЛЬТРУЙ", "ТИЛЬТУЙ", "СТАНОВИСЬ ЛУЧШЕ", "СОБИРАЙ СТАТИСТИКУ"]
    : ["TRADE", "ANALYZE", "EXECUTE", "FILTER", "TILT", "EVOLVE", "TRACK STATS"];
  
  const [index, setIndex] = useState(0);
  const [sweep, setSweep] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSweep(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        setSweep(false);
      }, 500); // Change word mid-sweep
    }, 2500);
    return () => clearInterval(id);
  }, [words]);

  return (
    <div className="relative border border-white/10 rounded-2xl bg-zinc-950/60 p-5 flex flex-col items-center justify-center min-h-[120px] overflow-hidden shadow-2xl max-w-sm mx-auto">
      {/* Background Barcode lines */}
      <div className="absolute inset-x-0 bottom-2 top-2 flex justify-between opacity-5 select-none pointer-events-none px-4">
        {[...Array(24)].map((_, i) => (
          <div 
            key={i} 
            className="bg-white h-full" 
            style={{ width: `${(i % 3) + 1}px` }} 
          />
        ))}
      </div>

      {/* Sweeping Laser Line */}
      <div 
        className={`absolute inset-y-0 w-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.9)] transition-all ease-in-out duration-1000 ${
          sweep ? "left-[95%]" : "left-[5%]"
        }`} 
      />

      <div className="text-zinc-500 font-mono text-[9px] tracking-widest mb-1.5 select-none uppercase">
        {lang === 'ru' ? 'СКАНИРОВАНИЕ РАЗУМА' : 'BEHAVIOR SCANNER'}
      </div>

      <div 
        className={`font-display text-2xl sm:text-3xl font-black text-white tracking-widest text-center transition-all duration-300 ${
          sweep ? "blur-sm opacity-50 scale-95" : "blur-0 opacity-100 scale-100"
        }`}
        style={{ textShadow: "0 0 10px rgba(255,255,255,0.1)" }}
      >
        {words[index]}
      </div>
    </div>
  );
}

// ── Synthwave Warp Grid & Particles Canvas (Bulges Outward) ─────────────────
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
    const warpRadius = 200;
    const warpStrength = 28; // Push outward strength

    const particles: { x: number; y: number; size: number; speed: number; opacity: number; hue: number }[] = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.3,
        speed: Math.random() * 0.35 + 0.05,
        opacity: Math.random() * 0.25 + 0.05,
        hue: Math.random() < 0.2 ? 150 : 0, // 20% emerald, 80% red
      });
    }

    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const horizonY = height * 0.65;
      const grad = ctx.createLinearGradient(0, horizonY - 200, 0, horizonY + 250);
      grad.addColorStop(0, "rgba(220, 38, 38, 0)");
      grad.addColorStop(0.4, "rgba(220, 38, 38, 0.04)");
      grad.addColorStop(0.7, "rgba(147, 51, 234, 0.04)");
      grad.addColorStop(1, "rgba(3, 3, 4, 1)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(220, 38, 38, 0.09)";
      ctx.lineWidth = 1;

      offset = (offset + 0.15) % gridSize;

      // Draw horizontal lines (Deform/Bulge outward away from cursor)
      const numLines = Math.ceil(height / gridSize) + 2;
      for (let i = -2; i < numLines; i++) {
        const yBase = i * gridSize + offset;
        ctx.beginPath();

        const steps = 40;
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

      // Draw vertical lines (Deform/Bulge outward)
      const cols = Math.ceil(width / gridSize) + 2;
      for (let i = -1; i < cols; i++) {
        const xBase = i * gridSize;
        ctx.beginPath();

        const steps = 30;
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

      // Render Drift Particles
      particles.forEach((p) => {
        p.y -= p.speed;
        if (p.y < 0) {
          p.y = height;
          p.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        // Red particles are main; emerald particles as accent
        if (p.hue === 150) {
          ctx.fillStyle = `rgba(52, 211, 153, ${p.opacity})`;
        } else {
          ctx.fillStyle = `rgba(220, 38, 38, ${p.opacity})`;
        }
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

// ── Inverting Dot to Circle Custom Cursor ───────────────────────────────────
function CustomCursor() {
  const lensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lens = lensRef.current;
    if (!lens) return;

    document.body.classList.add("landing-cursor");

    let hoverTargetRects: DOMRect[] = [];
    const cacheRects = () => {
      const els = document.querySelectorAll(".hover-target");
      hoverTargetRects = Array.from(els).map(el => el.getBoundingClientRect());
    };

    // Initial cache + refresh on scroll/resize
    setTimeout(cacheRects, 200);
    window.addEventListener("resize", cacheRects, { passive: true });
    window.addEventListener("scroll", cacheRects, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      lens.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;

      // Expand if cursor is within 80px of any hover-target center
      const isNear = hoverTargetRects.some(rect => {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.hypot(e.clientX - cx, e.clientY - cy) < 80;
      });
      if (isNear) lens.classList.add("lens-active");
      else if (!lens.classList.contains("lens-active-hover")) lens.classList.remove("lens-active");
    };

    // Expand cursor ONLY on hovering explicit negative/easter egg targets
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (
        target.classList.contains("hover-target") ||
        target.closest(".hover-target")
      )) {
        lens.classList.add("lens-active");
        lens.classList.add("lens-active-hover");
      } else {
        lens.classList.remove("lens-active-hover");
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      document.body.classList.remove("landing-cursor");
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      window.removeEventListener("resize", cacheRects);
      window.removeEventListener("scroll", cacheRects);
    };
  }, []);

  return (
    <div 
      ref={lensRef} 
      className="custom-lens hidden md:block"
    />
  );
}

// ── Standalone Custom Mockup Components ─────────────────────────────────────
function HubMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center items-center h-full min-h-[220px] font-mono text-xs w-full">
      <div className="relative w-32 h-32 flex items-center justify-center border-4 border-dashed border-red-500/35 rounded-full animate-spin duration-10000">
        <div className="absolute inset-2 border-2 border-emerald-500/30 rounded-full" />
        <div className="absolute font-sans text-lg font-black text-white select-none animate-pulse">82%</div>
      </div>
      <p className="text-[10px] text-zinc-500 mt-4 uppercase tracking-widest">{isRu ? "СТАБИЛЬНОСТЬ ДИСЦИПЛИНЫ" : "DISCIPLINE STABILITY INDEX"}</p>
    </div>
  );
}

function TasksMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  const [checked, setChecked] = useState([false, false, false]);

  useEffect(() => {
    const interval = setInterval(() => {
      setChecked(prev => {
        if (prev[2]) return [false, false, false];
        if (prev[1]) return [prev[0], prev[1], true];
        if (prev[0]) return [prev[0], true, prev[2]];
        return [true, prev[1], prev[2]];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center space-y-3 h-full min-h-[220px] font-mono text-xs text-zinc-400 w-full">
      <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
        <input type="checkbox" checked={checked[0]} readOnly className="accent-red-500 h-4 w-4" />
        <span className={checked[0] ? "line-through text-zinc-500" : "text-white"}>
          {isRu ? "Анализ новостного фона" : "Check Forex Factory Calendar"}
        </span>
      </div>
      <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
        <input type="checkbox" checked={checked[1]} readOnly className="accent-red-500 h-4 w-4" />
        <span className={checked[1] ? "line-through text-zinc-500" : "text-white"}>
          {isRu ? "Разметка HTF структуры" : "Mark HTF Market Structure"}
        </span>
      </div>
      <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/5">
        <input type="checkbox" checked={checked[2]} readOnly className="accent-red-500 h-4 w-4" />
        <span className={checked[2] ? "line-through text-zinc-500" : "text-white"}>
          {isRu ? "Фокусировка и вход (1% риска)" : "Execute trade according to setup"}
        </span>
      </div>
    </div>
  );
}

function GoalsMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center space-y-4 h-full min-h-[220px] font-mono text-xs w-full">
      <div className="border border-red-500/20 bg-red-500/5 p-3 rounded-xl text-center">
        <span className="text-[10px] text-zinc-500 block uppercase">{isRu ? "ЦЕЛЬ ГОДА" : "YEAR GOAL"}</span>
        <span className="font-bold text-white text-sm">{isRu ? "Funded-счет $100,000" : "Get $100K Funded Account"}</span>
      </div>
      <div className="text-center text-zinc-600 animate-bounce">↓</div>
      <div className="border border-white/5 bg-white/5 p-2.5 rounded-xl text-center">
        <span className="text-[10px] text-zinc-500 block uppercase">{isRu ? "ШАГ МЕСЯЦА" : "MONTH STEP"}</span>
        <span className="font-bold text-white text-xs">{isRu ? "Бэктест Gold 300+ дней" : "Backtest Gold 300+ days"}</span>
      </div>
    </div>
  );
}

function TimerMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  const [time, setTime] = useState(25 * 60);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(t => (t > 0 ? t - 1 : 25 * 60));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const m = Math.floor(time / 60).toString().padStart(2, '0');
  const s = (time % 60).toString().padStart(2, '0');

  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center items-center h-full min-h-[220px] font-mono text-xs w-full">
      <div className="text-3xl font-black text-red-500 tracking-widest drop-shadow-[0_0_10px_rgba(239,68,68,0.4)] animate-pulse">
        {m}:{s}
      </div>
      <p className="text-[10px] text-zinc-500 mt-4 uppercase tracking-widest">{isRu ? "АКТИВНАЯ ФОКУС-СЕССИЯ" : "FOCUS BLOCK RUNNING"}</p>
    </div>
  );
}

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
    <div className="bg-[#0b0b0d] border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden w-full">
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
          ? '* Текущие прогоны: слияние XAU/USD и GER40 при риске 1%.'
          : '* Active paths: XAU/USD & GER40 correlation simulation at 1% risk per trade.'}
      </div>
    </div>
  );
}

function IdeasMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center space-y-3 h-full min-h-[220px] font-mono text-xs text-zinc-300 w-full">
      <div className="border border-white/10 p-3 rounded-xl bg-white/5 relative">
        <span className="text-[9px] text-zinc-500 block uppercase font-bold">{isRu ? "Идея #12" : "Idea #12"}</span>
        <span className="text-white font-bold">{isRu ? "Разворотный FVG на XAU" : "Gold HTF FVG Reversal model"}</span>
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      </div>
    </div>
  );
}

function CalendarMockup({ lang }: { lang: "ru" | "en" }) {
  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-4 flex flex-col justify-center h-full min-h-[220px] font-mono text-xs w-full">
      <div className="grid grid-cols-7 gap-1">
        {[...Array(28)].map((_, i) => {
          const isWin = i % 5 === 0;
          const isLoss = i % 7 === 0;
          return (
            <div 
              key={i} 
              className={`aspect-square rounded border flex items-center justify-center text-[8px] font-bold ${
                isWin ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                isLoss ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                'bg-white/5 border-white/10 text-zinc-600'
              }`}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsMockup({ lang }: { lang: "ru" | "en" }) {
  return (
    <div className="bg-[#0b0b0d] border border-white/5 rounded-2xl p-6 flex flex-col justify-center space-y-3 h-full min-h-[220px] font-mono text-xs w-full">
      <div className="flex justify-between">
        <span>NY session:</span>
        <span className="text-red-400 font-bold">13:00 - 17:00 UTC</span>
      </div>
      <div className="flex justify-between">
        <span>London session:</span>
        <span className="text-red-400 font-bold">08:00 - 11:00 UTC</span>
      </div>
    </div>
  );
}

// ── News Aggregator Mockup ──────────────────────────────────────────────────
function NewsCorrelationMockup({ lang }: { lang: "ru" | "en" }) {
  return (
    <div className="bg-[#0b0b0d] border border-white/10 rounded-3xl p-6 font-mono text-xs text-zinc-300 space-y-4 shadow-2xl relative overflow-hidden w-full">
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

// ── News Monitor Mockup ──────────────────────────────────────────────────────
function NewsMonitorMockup({ lang }: { lang: "ru" | "en" }) {
  const isRu = lang === "ru";
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Simulated upcoming news events — times countdown in realtime
  const baseNow = Date.now();
  const events = [
    { time: baseNow + (23 - tick) * 60000,  impact: "high",   name: isRu ? "ИПЦ (CPI) США" : "US CPI YoY",     curr: "USD", pair: "XAU/USD", actual: null,    forecast: "3.1%", prev: "3.4%" },
    { time: baseNow + (47 - tick) * 60000,  impact: "high",   name: isRu ? "Заседание ФРС" : "FOMC Decision",  curr: "USD", pair: "EUR/USD", actual: null,    forecast: "5.50%", prev: "5.50%" },
    { time: baseNow + (112 - tick) * 60000, impact: "medium", name: isRu ? "Индекс PMI" : "Services PMI",     curr: "EUR", pair: "EUR/USD", actual: null,    forecast: "52.4", prev: "51.9" },
    { time: baseNow + (180 - tick) * 60000, impact: "low",    name: isRu ? "Запасы нефти" : "Crude Inventories", curr: "USD", pair: "WTI",    actual: null,    forecast: "-1.8M", prev: "+2.1M" },
    { time: baseNow - 5 * 60000,            impact: "high",   name: isRu ? "NFP США" : "US NFP",              curr: "USD", pair: "USD/JPY", actual: "206K",  forecast: "185K", prev: "175K" },
  ];

  const formatCountdown = (ms: number) => {
    if (ms < 0) return isRu ? "ВЫШЛО" : "RELEASED";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (m > 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const impactColor: Record<string, string> = {
    high:   "text-red-400 border-red-500/50 bg-red-500/10",
    medium: "text-amber-400 border-amber-500/50 bg-amber-500/10",
    low:    "text-zinc-400 border-zinc-600/50 bg-zinc-700/10",
  };
  const impactDot: Record<string, string> = {
    high: "bg-red-500", medium: "bg-amber-400", low: "bg-zinc-500",
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[#060608] overflow-hidden font-mono text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-zinc-300 uppercase tracking-widest text-[10px] font-bold">
            {isRu ? "ЭКОНОМИЧЕСКИЙ КАЛЕНДАРЬ" : "ECONOMIC CALENDAR"}
          </span>
        </div>
        <span className="text-zinc-600 text-[10px]">
          {new Date().toLocaleDateString(isRu ? "ru-RU" : "en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_56px_72px_56px] gap-1 px-3 py-1.5 border-b border-white/5">
        <span className="text-zinc-600 text-[9px] uppercase tracking-widest">{isRu ? "Событие" : "Event"}</span>
        <span className="text-zinc-600 text-[9px] uppercase tracking-widest text-right">{isRu ? "До" : "In"}</span>
        <span className="text-zinc-600 text-[9px] uppercase tracking-widest text-right">{isRu ? "Факт" : "Actual"}</span>
        <span className="text-zinc-600 text-[9px] uppercase tracking-widest text-right">{isRu ? "Прогноз" : "Fcst"}</span>
      </div>

      {/* Events list */}
      <div className="divide-y divide-white/4">
        {events.map((ev, i) => {
          const msLeft = ev.time - baseNow;
          const released = msLeft < 0;
          return (
            <div
              key={i}
              className={`grid grid-cols-[1fr_56px_72px_56px] gap-1 items-center px-3 py-2 transition-colors ${released ? "opacity-60" : "hover:bg-white/3"}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${impactDot[ev.impact]} ${!released && ev.impact === "high" ? "animate-pulse" : ""}`} />
                <div className="min-w-0">
                  <span className="text-zinc-200 text-[10px] block truncate">{ev.name}</span>
                  <span className={`text-[9px] px-1 rounded border ${impactColor[ev.impact]}`}>{ev.curr} · {ev.pair}</span>
                </div>
              </div>
              <span className={`text-right text-[9px] ${released ? "text-zinc-600" : msLeft < 30 * 60000 ? "text-red-400 font-bold" : "text-zinc-400"}`}>
                {formatCountdown(msLeft)}
              </span>
              <span className={`text-right text-[10px] font-bold ${ev.actual ? (parseFloat(ev.actual) > parseFloat(ev.forecast ?? "0") ? "text-emerald-400" : "text-red-400") : "text-zinc-600"}`}>
                {ev.actual ?? "—"}
              </span>
              <span className="text-right text-[10px] text-zinc-500">{ev.forecast}</span>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-zinc-600 text-[9px]">
          {isRu ? "* Исторический анализ — в разработке" : "* Historical reaction analysis — coming soon"}
        </span>
        <span className="text-zinc-700 text-[9px] flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-500 inline-block animate-pulse" />
          {isRu ? "LIVE" : "LIVE"}
        </span>
      </div>
    </div>
  );
}

// ── Interactive Modules Slider (Architecture of Consistency) ────────────────
interface ModuleTab {
  id: string;
  icon: any;
  titleRu: string;
  titleEn: string;
  noteRu: string;
  noteEn: string;
  descRu: string;
  descEn: string;
  renderMockup: () => React.ReactNode;
}

function ModulesShowcaseSlider({ lang }: { lang: "ru" | "en" }) {
  const [activeTab, setActiveTab] = useState(0);
  const [terminalLog, setTerminalLog] = useState<string[]>(["[SYS] OS initialized.", "[SYS] Awaiting input..."]);
  const [glitchTrigger, setGlitchTrigger] = useState(false);
  const isRu = lang === "ru";

  const tabs: ModuleTab[] = [
    {
      id: "hub",
      icon: LayoutDashboard,
      titleRu: "Главный Хаб",
      titleEn: "Main Hub",
      noteRu: "то, чего тебе не хватало",
      noteEn: "what you were missing",
      descRu: "Панель мониторинга дня. Выводит активные сессии, сессии фокуса, задачи дисциплины и динамические круги прогресса.",
      descEn: "Cockpit of your day. Displays active trading sessions, focus minutes, discipline checklists, and progress metrics.",
      renderMockup: () => <HubMockup lang={lang} />
    },
    {
      id: "tasks",
      icon: CheckCircle2,
      titleRu: "Задачи и Рутина",
      titleEn: "Tasks & Routines",
      noteRu: "то, что ты игнорировал",
      noteEn: "what you kept ignoring",
      descRu: "Создавайте шаблоны повторяющихся действий (чек-листы подготовки к сессии, медитации) для жесткого следования торговому плану.",
      descEn: "Build routine templates (session preparation checklists, meditation) to secure disciplined, structural executions.",
      renderMockup: () => <TasksMockup lang={lang} />
    },
    {
      id: "trading",
      icon: TrendingUp,
      titleRu: "Торговля",
      titleEn: "Trading",
      noteRu: "сделки которые ты не записывал",
      noteEn: "trades you never logged",
      descRu: "Торговый журнал, календарь биасов и симулятор Монте-Карло в одном разделе. Загружайте статистику бэктеста и симулируйте 1000 путей эквити для расчёта шансов прохождения проп-челленджей.",
      descEn: "Trade journal, bias calendar and Monte Carlo simulator in one section. Upload backtest stats and calculate exact odds of passing prop evaluations.",
      renderMockup: () => <TradingSimulatorMockup lang={lang} />
    },
    {
      id: "news",
      icon: Newspaper,
      titleRu: "Мониторинг Новостей",
      titleEn: "News Monitor",
      noteRu: "новости которые ты пропустил",
      noteEn: "news you missed and got burned",
      descRu: "Все ключевые макроэкономические события дня в одном месте. CPI, NFP, FOMC, GDP — время до релиза, валюты и уровень волатильности. В будущем — исторический анализ реакций.",
      descEn: "All critical macro events for today in one place. CPI, NFP, FOMC, GDP — countdown, currencies affected, and volatility rating. Historical analysis of past reactions coming soon.",
      renderMockup: () => <NewsMonitorMockup lang={lang} />
    },
    {
      id: "goals",
      icon: Target,
      titleRu: "Декомпозиция целей",
      titleEn: "Goals Decomposition",
      noteRu: "то, куда ты не дошёл",
      noteEn: "where you never arrived",
      descRu: "Связывайте годовые финансовые цели с месячными лимитами просадки и недельными шагами. Дисциплина подчиняется целям.",
      descEn: "Chain yearly financial goals to monthly drawdown budgets and weekly steps. Operational discipline meets target goals.",
      renderMockup: () => <GoalsMockup lang={lang} />
    },
    {
      id: "ideas",
      icon: Lightbulb,
      titleRu: "Банк Торговых Идей",
      titleEn: "Ideas Vault",
      noteRu: "идеи что ты забыл проверить",
      noteEn: "ideas you forgot to test",
      descRu: "Отделяйте мгновенные идеи и сетапы от реального исполнения. Сохраняйте торговые модели вне терминала для будущих тестов.",
      descEn: "Isolate immediate setup hypotheses from execution. File potential patterns outside the terminal for future validation.",
      renderMockup: () => <IdeasMockup lang={lang} />
    },
    {
      id: "timer",
      icon: Timer,
      titleRu: "Таймер Фокуса",
      titleEn: "Focus Timer",
      noteRu: "время, которое ты тратил впустую",
      noteEn: "time you wasted on noise",
      descRu: "Помодоро-таймер фиксирует время чистой концентрации на анализе графиков. Защищает от переутомления и спонтанных трейдов.",
      descEn: "Pomodoro Focus Timer logs chart concentration sessions, keeping you alert and preventing spontaneous trading entries.",
      renderMockup: () => <TimerMockup lang={lang} />
    },
    {
      id: "settings",
      icon: Settings,
      titleRu: "Калибровка Сессий",
      titleEn: "Session Calibration",
      noteRu: "время когда ты торговал не в своё окно",
      noteEn: "when you traded outside your window",
      descRu: "Настройка личного торгового времени и часового пояса. Запрещает торговлю вне интервалов вашей сессии.",
      descEn: "Adjust trading hours and timezones. Block out chart execution settings outside your optimal session times.",
      renderMockup: () => <SettingsMockup lang={lang} />
    }
  ];

  const currentTab = tabs[activeTab];

  const handleTabChange = (idx: number) => {
    setActiveTab(idx);
    setGlitchTrigger(true);
    setTimeout(() => setGlitchTrigger(false), 250);

    const key = tabs[idx].id.toUpperCase();
    const time = new Date().toLocaleTimeString();
    setTerminalLog(prev => [
      ...prev.slice(-3),
      `[${time}] CALIBRATING ${key}...`,
      `[${time}] ${key} MODULE LOADED [OK]`
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.8fr] gap-8 border border-white/5 rounded-3xl p-6 bg-zinc-900/40 relative overflow-hidden">
      
      {/* CRT Blinking Grid Lines Overlay inside showcase */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-20" />

      {/* Sidebar selection */}
      <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-4 lg:pb-0 border-b lg:border-b-0 lg:border-r border-white/5 pr-0 lg:pr-4 relative z-10">
        
        {/* Systems Diagnostic Header */}
        <div className="hidden lg:flex items-center gap-2 pb-3 mb-2 border-b border-white/5 font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
          <Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span>{isRu ? "СТАТУС: АКТИВЕН" : "SYS: OPERATIONAL"}</span>
        </div>

        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = idx === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(idx)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 shrink-0 text-left cursor-none group ${
                isActive 
                  ? "bg-red-600/10 text-red-400 border border-red-500/20 font-bold shadow-[0_0_15px_rgba(220,38,38,0.05)]" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'scale-110 text-red-500' : 'group-hover:scale-105'}`} />
                <span className="relative hover-target cursor-none" style={{ display: "inline-grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr" }}>
                  <span data-lens-normal="true" style={{ gridArea: "1/1", visibility: "visible" }} className="text-xs uppercase tracking-wider font-display text-inherit whitespace-nowrap">
                    {isRu ? tab.titleRu : tab.titleEn}
                  </span>
                  {/* Spacer reserves width for the annotation if it is wider */}
                  <span style={{ gridArea: "1/1", visibility: "hidden" }} className="text-[10px] font-mono lowercase whitespace-nowrap pointer-events-none">
                    {isRu ? tab.noteRu : tab.noteEn}
                  </span>
                  {/* School note negative annotation */}
                  <span
                    data-lens-target="true"
                    className="text-red-300 font-mono italic bg-[#030304] select-none pointer-events-none whitespace-nowrap text-[10px] lowercase rounded-xl"
                    style={{
                      position: "absolute",
                      inset: 0,
                      clipPath: "circle(0px at 0px 0px)",
                      willChange: "clip-path",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {isRu ? tab.noteRu : tab.noteEn}
                  </span>
                </span>
              </div>

              {/* Glowing LED Status Light indicator */}
              <span className={`w-1.5 h-1.5 rounded-full ml-3 ${
                isActive ? "bg-red-500 animate-ping" : "bg-zinc-800"
              }`} />
            </button>
          );
        })}
      </div>

      {/* Main active detail preview */}
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 items-center relative z-10">
        
        <div className={`space-y-4 transition-all ${glitchTrigger ? 'blur-[1px] translate-x-[2px] opacity-75' : 'blur-0 translate-x-0 opacity-100'}`}>
          <h3 className="text-xl font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
            <span className="w-2 h-2 bg-red-600 animate-pulse rounded-full" />
            {isRu ? currentTab.titleRu : currentTab.titleEn}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed min-h-[70px]">
            {isRu ? currentTab.descRu : currentTab.descEn}
          </p>

          {/* Interactive Shell Diagnostic Log */}
          <div className="border border-white/5 bg-black/60 rounded-xl p-3.5 font-mono text-[9px] text-emerald-500 space-y-1 shadow-inner relative overflow-hidden">
            <div className="absolute top-1 right-2 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/20 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-pulse delay-100" />
            </div>
            <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5 mb-1.5 text-zinc-500">
              <Terminal className="w-3.5 h-3.5 text-red-500" />
              <span>DIAGNOSTICS_SHELL v1.0.4</span>
            </div>
            {terminalLog.map((log, i) => (
              <div key={i} className="truncate">{log}</div>
            ))}
          </div>
        </div>

        <div className={`h-full flex items-center justify-center transition-all ${glitchTrigger ? 'scale-[0.99] rotate-[-0.5deg]' : 'scale-100 rotate-0'}`}>
          <div className="w-full h-full max-w-[320px]">
            {currentTab.renderMockup()}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Auth Modal Overlay ──────────────────────────────────────────────────────
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: "ru" | "en";
}

function AuthModal({ isOpen, onClose, lang }: AuthModalProps) {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    setErrorMsg("");

    if (mode === "login") {
      const result = await login(email, password);
      if (result.error) {
        if (result.error.toLowerCase().includes("подтверди") || result.error.toLowerCase().includes("верификац") || result.error.toLowerCase().includes("verif")) {
          setShowResend(true);
        }
        setErrorMsg(result.error);
        toast({ title: t.auth.errLogin, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.welcomeBack });
        onClose();
      }
    } else {
      const result = await register(email, password, lang);
      if (result.error) {
        setErrorMsg(result.error);
        toast({ title: t.auth.errReg, description: result.error, variant: "destructive" });
      } else {
        toast({ title: t.auth.created, description: t.auth.createdDesc });
      }
    }

    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4" style={{ isolation: "isolate" }}>
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-none" 
        onClick={onClose} 
      />
      
      <div 
        className="w-full max-w-md border border-white/10 rounded-3xl p-8 bg-[#0c0c0e]/95 shadow-2xl relative z-10 animate-in zoom-in-95 duration-200"
        style={{ transform: "rotate(-1deg)" }}
      >
        <div className="absolute top-0 right-0 w-6 h-6 bg-red-650 rounded-tr-3xl shadow-[0_0_15px_rgba(220,38,38,0.6)]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white cursor-none"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex rounded-xl overflow-hidden border border-white/5 mb-6 bg-black/60 p-1 mt-4">
          <button
            className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg cursor-none ${
              mode === "login" ? "bg-white/10 text-white font-black" : "text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => { setMode("login"); setShowResend(false); setResendDone(false); }}
          >
            {t.auth.loginTab}
          </button>
          <button
            className={`flex-1 py-2 text-xs font-display font-bold uppercase tracking-wider transition-all rounded-lg cursor-none ${
              mode === "register" ? "bg-white/10 text-white font-black" : "text-zinc-500 hover:text-zinc-300"
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
              className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm h-10 cursor-none"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="font-display text-xs uppercase tracking-wider text-zinc-500">
                {t.auth.password}
              </Label>
              {mode === "login" && (
                <Link href="/forgot-password">
                  <span className="text-[10px] text-zinc-500 hover:text-red-400 cursor-none transition-colors uppercase tracking-wider font-display">
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
              className="bg-black/60 border-white/5 focus-visible:ring-red-500/50 rounded-xl text-sm h-10 cursor-none"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-display uppercase tracking-[0.25em] text-xs h-11 rounded-xl mt-4 shadow-[0_0_20px_rgba(220,38,38,0.3)] font-bold cursor-none"
          >
            {loading ? "..." : mode === "login" ? t.auth.loginBtn : t.auth.registerBtn}
          </Button>

          {/* Inline error display — always visible inside modal, no z-index issues */}
          {errorMsg && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/8 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
              <p className="text-red-300 text-xs font-mono leading-relaxed">{errorMsg}</p>
            </div>
          )}
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
                  className="w-full text-xs font-display uppercase tracking-wider border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 rounded-xl cursor-none"
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
            className="text-red-500 font-bold hover:underline cursor-none"
          >
            {mode === "login" ? t.auth.registerTab : t.auth.loginTab}
          </button>
        </p>
      </div>
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────
export default function LoginPage() {
  const { t, lang } = useI18n();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const isRu = lang === "ru";

  // ── Global Coordinates Masking Coordinator ──
  useEffect(() => {
    let frameId = 0;
    let mx = -9999, my = -9999;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (frameId) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        const targets = document.querySelectorAll('[data-lens-target="true"]');
        targets.forEach(el => {
          const rect = el.getBoundingClientRect();
          const x = mx - rect.left;
          const y = my - rect.top;
          (el as HTMLElement).style.clipPath = `circle(60px at ${x}px ${y}px)`;
        });
      });
    };

    window.addEventListener("mousemove", handleGlobalMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030304] text-zinc-100 font-sans relative overflow-x-hidden">
      
      {/* Global CSS settings for custom cursor and font load */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;850;900&family=Press+Start+2P&family=JetBrains+Mono:wght@400;700&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif !important;
        }

        body.landing-cursor,
        body.landing-cursor *,
        body.landing-cursor *::before,
        body.landing-cursor *::after,
        body.landing-cursor a,
        body.landing-cursor button,
        body.landing-cursor input,
        body.landing-cursor textarea,
        body.landing-cursor select,
        body.landing-cursor label,
        body.landing-cursor [role="button"],
        body.landing-cursor [tabindex] {
          cursor: none !important;
        }

        /* Pure CSS Custom lens cursor that scales smoothly and inverts color */
        .custom-lens {
          position: fixed;
          top: 0;
          left: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0) 100%);
          box-shadow: 0 0 8px 2px rgba(255,255,255,0.7), 0 0 20px 4px rgba(220,38,38,0.25);
          pointer-events: none;
          z-index: 9999;
          transform: translate(-50%, -50%);
          will-change: transform, width, height, box-shadow;
          transition:
            width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
            height 0.3s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1),
            background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Active circle state — clean ring, NO mix-blend-mode (clip-path handles text) */
        .custom-lens.lens-active {
          width: 120px;
          height: 120px;
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.35);
          box-shadow:
            0 0 20px 4px rgba(220,38,38,0.15),
            0 0 40px 10px rgba(220,38,38,0.06),
            inset 0 0 20px 3px rgba(255,255,255,0.04);
        }

        /* Hitbox expansion pseudo-element to trigger cursor scale-up early */
        .hover-target {
          position: relative;
          display: inline-block;
        }
        
        /* Hitbox expansions extend 35px in all directions. */
        .hover-target::before {
          content: '';
          position: absolute;
          inset: -35px;
          background: transparent;
          pointer-events: auto;
          z-index: -1;
        }
        
        /* Reveal animation on page load */
        .reveal-text {
          animation: reveal-anim 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(12px);
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

        /* Glitch text effect */
        .glitch-text {
          position: relative;
          text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
            -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
            0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
          animation: glitch-anim 500ms infinite;
        }
        @keyframes glitch-anim {
          0% {
            text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
              -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
              0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
          }
          14% {
            text-shadow: 0.05em 0 0 rgba(255, 0, 0, 0.75),
              -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
              0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
          }
          15% {
            text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
              0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
              -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
          }
          49% {
            text-shadow: -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
              0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
              -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
          }
          50% {
            text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
              0.05em 0 0 rgba(0, 255, 0, 0.75),
              0 -0.05em 0 rgba(0, 255, 0, 0.75);
          }
          99% {
            text-shadow: 0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
              0.05em 0 0 rgba(0, 255, 0, 0.75),
              0 -0.05em 0 rgba(0, 255, 0, 0.75);
          }
          100% {
            text-shadow: -0.025em 0 0 rgba(255, 0, 0, 0.75),
              -0.025em -0.025em 0 rgba(0, 255, 0, 0.75),
              -0.025em -0.05em 0 rgba(0, 0, 255, 0.75);
          }
        }
      `}</style>

      {/* Warping grid canvas and particle engine */}
      <SynthwaveCanvas />

      {/* Trailing Inverting Circle Cursor */}
      <CustomCursor />

      {/* Background Chalk Trading Easter Eggs (Scattered & Layered with scan mirror overlays) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        {/* Row 1 */}
        <EasterEgg text="[ORDER BLOCK - 15m]" oppositeText="[INSTITUTIONAL BUY ZONE]" className="top-[8%] left-[4%]" />
        <EasterEgg text="[Discipline > Talent]" oppositeText="[90% FAIL DUE TO EGO]" className="top-[8%] left-[45%] rotate-[-4deg]" />
        <EasterEgg text="[Liq Pool ⬇]" oppositeText="[RETAIL STOP LOSS HUNT]" className="top-[8%] left-[82%] rotate-[6deg]" />

        {/* Row 2 */}
        <EasterEgg text="[Premium Array: 78.6% Fib]" oppositeText="[HIGH PROBABILITY SHORT]" className="top-[28%] left-[2%] rotate-[8deg]" />
        <EasterEgg text="[HTF Daily Bias: Bullish]" oppositeText="[DO NOT FIGHT THE TREND]" className="top-[24%] left-[42%] rotate-[-3deg]" />
        <EasterEgg text="[Asia Session High Sweep]" oppositeText="[FAKE OUT - SEEK SHORTS]" className="top-[28%] left-[84%] rotate-[-6deg]" />

        {/* Row 3 */}
        <EasterEgg text="[FVG / Fair Value Gap]" oppositeText="[IMBALANCE WILL BE FILLED]" className="top-[48%] left-[3%] rotate-[-8deg]" />
        <EasterEgg text="[Optimal Trade Entry: 70.5%]" oppositeText="[CONFLUENCE ZONE]" className="top-[44%] left-[40%] rotate-[9deg]" />
        <EasterEgg text="[BOS / CHoCH]" oppositeText="[MARKET STRUCTURE SHIFT]" className="top-[48%] left-[85%] rotate-[3deg]" />

        {/* Row 4 */}
        <EasterEgg text="[No FOMO Allowed]" oppositeText="[WAIT FOR THE RETEST]" className="top-[68%] left-[4%] rotate-[-5deg]" />
        <EasterEgg text="[Expected Value: E(X) > 0]" oppositeText="[MATH IS YOUR SHIELD]" className="top-[64%] left-[44%] rotate-[-9deg]" />
        <EasterEgg text="[Volatility Warning: NFP]" oppositeText="[STAY CASH DURING RELEASE]" className="top-[68%] left-[82%] rotate-[4deg]" />

        {/* Row 5 */}
        <EasterEgg text="[Risk : Reward = 1 : 3.5]" oppositeText="[WIN RATE CAN BE 30%]" className="top-[86%] left-[6%] rotate-[-3deg]" />
        <EasterEgg text="[Standard Deviation: 2.5 Sigma]" oppositeText="[MEAN REVERSION PROBABLE]" className="top-[82%] left-[41%] rotate-[11deg]" />
        <EasterEgg text="[Premium / Discount]" oppositeText="[BUY LOW SELL HIGH ONLY]" className="top-[86%] left-[80%] rotate-[5deg]" />

        {/* Extra scattered background indicators - strictly outside main content */}
        <EasterEgg text="[Drawdown Limit: -5% Daily]" oppositeText="[BLOWING ACCOUNT WARNING]" className="top-[94%] left-[2%] rotate-[4deg]" />
        <EasterEgg text="[Plan the Trade. Trade the Plan.]" oppositeText="[NO IMPULSIVE ENTRIES]" className="top-[92%] left-[46%] rotate-[-7deg]" />
        <EasterEgg text="[London Session Open: Killzone]" oppositeText="[HIGH VOLATILITY EXPANSION]" className="top-[94%] left-[85%] rotate-[-6deg]" />
        <EasterEgg text="[Breaker Block Validation]" oppositeText="[SUPPORT BECOMES RESISTANCE]" className="top-[58%] left-[92%] rotate-[12deg]" />
        <EasterEgg text="[Slippage Cost: -0.2 pips]" oppositeText="[AVOID MARKET ORDERS]" className="top-[78%] left-[91%] rotate-[-10deg]" />
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5 relative z-10">
        <P5Logo />
        <div className="flex items-center gap-3">
          {/* Contact Author button */}
          <a
            href="https://t.me/TraderJey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 border border-white/10 hover:border-white/25 text-zinc-400 hover:text-white font-display text-xs uppercase tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 cursor-none bg-white/5 hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.945-.924c-.64-.203-.652-.64.135-.954l11.57-4.461c.537-.194 1.006.131.964.893z"/>
            </svg>
            {isRu ? "Автор" : "Author"}
          </a>
          <button 
            onClick={() => setIsAuthOpen(true)}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-display text-xs uppercase tracking-widest rounded-xl transition-all hover:scale-105 active:scale-95 cursor-none shadow-[0_0_15px_rgba(220,38,38,0.3)] font-bold"
          >
            {isRu ? "Войти в систему" : "Log In"}
          </button>
          <LangToggle />
        </div>
      </header>

      {/* Centered Hero Section (Compact Offsets) */}
      <main className="max-w-4xl mx-auto px-6 py-8 md:py-16 text-center relative z-10 flex flex-col items-center justify-center space-y-6">
        
        <Badge className="bg-red-500/10 hover:bg-red-500/10 text-red-400 border-red-500/20 px-3 py-1 text-xs uppercase tracking-widest rounded-full font-mono reveal-text">
          {isRu ? "Операционная Система Трейдера" : "Discipline & Stats Operating System"}
        </Badge>
        
        <h1 className="text-4xl md:text-5xl lg:text-7.5xl font-black tracking-tight leading-none text-white font-display uppercase cursor-default reveal-text delay-1 max-w-3xl">
          {isRu ? (
            <>
              Прекратите сливать из-за <MirrorWord normal="тильта" opposite="потери" />. Оцифруйте <MirrorWord normal="дисциплину" opposite="характер" />.
            </>
          ) : (
            <>
              Stop blowing accounts to <MirrorWord normal="tilt" opposite="fear" />. Track your <MirrorWord normal="discipline" opposite="behavior" />.
            </>
          )}
        </h1>
        
        <p className="text-zinc-200 text-sm md:text-base leading-relaxed max-w-xl reveal-text delay-2">
          {isRu ? (
            "Trade Persona — это инструмент самоанализа для трейдеров, которые стремятся быть больше, чем просто участниками рынка. Мы сфокусировались на детальном расчете вашего математического ожидания, мониторинге сессий, контроле эмоций, времени чистого фокуса и автоматическом учете рисков."
          ) : (
            "Trade Persona is a self-analytical workspace built for traders who aim to be more than just market participants. We focus strictly on validating your mathematical edge, session monitoring, emotional control, deep concentration tracking, and automated risk parameters."
          )}
        </p>
        
        {/* Center Barcode Scanner Switcher */}
        <div className="reveal-text delay-2 w-full max-w-sm pt-2">
          <BarcodeScannerText lang={lang} />
        </div>

        {/* CTA + Quick Stats Grid */}
        <div className="space-y-6 reveal-text delay-3 w-full flex flex-col items-center pt-2">
          
          {/* ActionButton with integrated proactive hover lens and custom red offset shadow */}
          <ActionButton 
            onClick={() => setIsAuthOpen(true)}
            normal={isRu ? "ОЦИФРОВАТЬ ДИСЦИПЛИНУ" : "DIGITIZE CONSISTENCY"}
            opposite={isRu ? "ХВАТИТ СЛИВАТЬ ДЕПОЗИТ" : "STOP BLOWING ACCOUNTS"}
            className="animate-bounce"
          />

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10 w-full max-w-md">
            <div className="space-y-1">
              <p className="text-2xl font-black text-white font-mono">
                <CountUpStat value={0.0} suffix="%" />
              </p>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                {isRu ? (
                  <MirrorWord normal="иллюзий" opposite="мечтаний" />
                ) : (
                  <MirrorWord normal="illusions" opposite="delusions" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-black text-emerald-400 font-mono">
                <CountUpStat value={100} suffix="%" />
              </p>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                {isRu ? (
                  <MirrorWord normal="чистая логика" opposite="холодный расчёт" />
                ) : (
                  <MirrorWord normal="pure logic" opposite="cold calculus" />
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-black text-red-500 font-mono">
                &lt;<CountUpStat value={2.0} suffix="%" />
              </p>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                {isRu ? (
                  <MirrorWord normal="риск руины" opposite="цена ошибки" />
                ) : (
                  <MirrorWord normal="ruin risk" opposite="mistake toll" />
                )}
              </div>
            </div>
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
                {isRu ? (
                  <>
                    Раздел Трейдинг — оцифровка вашего <MirrorWord normal="матожидания" opposite="настоящих рисков" />
                  </>
                ) : (
                  <>
                    Trading Section — Digitizing Your <MirrorWord normal="expected value" opposite="slippage reality" />
                  </>
                )}
              </h2>
              <p className="text-zinc-200 leading-relaxed text-sm">
                {isRu 
                  ? "Наша вкладка «Трейдинг» — это не просто таблица сделок, это инструмент валидации вашего торгового плана. Она объединяет подробный торговый журнал с симулятором Монте-Карло. Вместо надежд вы получаете сухие цифры: вероятность уйти в просадку, влияние комиссии брокера и точный шанс пройти обе фазы проп-челленджа при риске 1%."
                  : "Our Trading section is a workbench to validate your statistical edge. It integrates a trade journal with a path-dependent Monte Carlo simulation engine. Instead of blind assumptions, you get verified statistics: maximum drawdown probability, broker slippage impact, and the exact odds of passing prop challenges."}
              </p>
              <div className="space-y-3 font-mono text-xs text-zinc-300">
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Симуляция 1000 вариантов развития эквити с учетом дневных ограничений" : "Simulation of 1000 equity paths with daily limits accounted for"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Точный расчет математического ожидания и фактора прибыли" : "Precise calculation of profit factor and expected value"}</p></div>
                <div className="flex gap-2 items-start"><CheckCircle2 className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <p>{isRu ? "Экспорт торговой статистики в формат JSON для внешнего анализа" : "Export trade statistics to JSON format for custom analysis"}</p></div>
              </div>
            </div>

            {/* Simulated interactive mockup */}
            <TradingSimulatorMockup lang={lang} />

          </div>
        </div>
      </section>

      {/* Feature Slider: Architecture of Consistency (Архитектура Системности) */}
      <section className="max-w-7xl mx-auto px-6 py-20 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-white uppercase tracking-wider font-display cursor-default">
            {isRu ? (
              <>
                Архитектура <MirrorWord normal="Системности" opposite="Дисциплины" />
              </>
            ) : (
              <>
                Architecture of <MirrorWord normal="Consistency" opposite="Discipline" />
              </>
            )}
          </h2>
          <p className="text-zinc-200 max-w-xl mx-auto text-sm">
            {isRu ? "Интерактивная демонстрация работы каждого отдельного модуля нашей операционной системы трейдера." : "Interactive showcase explaining the mechanics of each individual Trader OS module."}
          </p>
        </div>

        <ModulesShowcaseSlider lang={lang} />
      </section>

      {/* News Teaser with locked economic news forecast card */}
      <section className="border-t border-white/5 bg-zinc-950/20 py-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-20 items-center">
            
            <div className="space-y-6">
              <Badge className="bg-red-500/10 text-red-400 border-red-500/20 font-mono text-xs">{isRu ? "В разработке" : "In Development"}</Badge>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight uppercase font-display cursor-default">
                {isRu ? (
                  <>
                    Мониторинг и исторический анализ новостного <MirrorWord normal="влияния" opposite="безумия" />
                  </>
                ) : (
                  <>
                    Monitoring and historical analysis of news <MirrorWord normal="impact" opposite="madness" />
                  </>
                )}
              </h2>
              <p className="text-zinc-200 leading-relaxed text-sm">
                {isRu 
                  ? "Экономические новости — главный источник непредвиденной волатильности. Скоро платформа будет автоматически мониторить экономический календарь, собирать данные и рассчитывать вероятность и силу влияния событий (CPI, FOMC, NFP) на выбранные вами активы. Анализ строится на основе исторических реакций цены за последние 5 лет."
                  : "Macroeconomic reports are the prime source of tail risk. Soon, the engine will automatically parse the Forex Factory calendar, gather reaction database tables, and calculate the mathematical probability and expected pip deviation of events (CPI, FOMC, NFP) on majors and Gold, mapped against 5 years of historical tick charts."}
              </p>
            </div>

            {/* News Teaser Container with overlay lock */}
            <div 
              className="relative border border-white/10 rounded-3xl shadow-2xl"
            >
              {/* Actual mockup blurred */}
              <div className="blur-[5px] select-none pointer-events-none opacity-45">
                <NewsCorrelationMockup lang={lang} />
              </div>

              {/* Retro Pixel Coming Soon Overlay */}
              <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/85 z-20 p-6 text-center border border-red-500/35 rounded-3xl">
                <div className="scanlines" />
                <Lock className="w-12 h-12 text-red-500 animate-pulse mb-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                
                {/* Coming Soon — always shows "COMING SOON" in English; opposite reveals localized warning in negative */}
                <div className="h-8 flex items-center justify-center">
                  <MirrorWord 
                    normal="COMING SOON"
                    opposite={isRu ? "ТЫ ЕЩЕ НЕ ГОТОВ" : "YOU ARE NOT READY"} 
                    className="font-mono font-bold text-red-500 tracking-[0.2em] uppercase glitch-text"
                    style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', borderBottom: 'none' }}
                  />
                </div>
                
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

      {/* Auth Modal Overlay */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} lang={lang} />

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 relative z-10 font-mono">
        <p className="tracking-wider">© {new Date().getFullYear()} Persona OS. Dedicated to Systematic Discipline & Stat Validation.</p>
      </footer>

    </div>
  );
}

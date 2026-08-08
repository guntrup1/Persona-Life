import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { useStore, getTodayDate, xpForFocus, type TimerMode } from "@/lib/store";
import { Play, Pause, RotateCcw, Brain, X, Minimize2, Maximize2, FileText, Pin, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export function openSystemPipWindow() {
  const event = new CustomEvent("trigger-open-pip");
  window.dispatchEvent(event);
}

export function FloatingTimerWidget() {
  const { state, actions } = useStore();
  const { toast } = useToast();
  const { t } = useI18n();

  const isOpen = !!state.timerWidgetOpen;

  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [duration, setDuration] = useState<number>(25);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [running, setRunning] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const [note, setNote] = useState<string>("");
  const [minimized, setMinimized] = useState<boolean>(false);

  // System PiP Window state
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Position state for in-browser overlay fallback
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("floating_timer_pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: Math.max(20, window.innerWidth - 290), y: Math.max(20, window.innerHeight - 340) };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRunning(false);
            setCompleted(true);
            const xp = xpForFocus(duration);
            actions.addFocusSession({
              duration,
              mode,
              xp,
              date: getTodayDate(),
              completedAt: new Date().toISOString(),
              note: note.trim() || undefined,
            });
            toast({
              title: t.timer.sessionCompleted,
              description: t.timer.xpReceived.replace("{xp}", xp.toString()),
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, duration, mode, note, actions, toast, t]);

  // Synchronously open Document Picture-in-Picture window inside user click gesture
  const openSystemPip = useCallback(async () => {
    if (pipWindow) {
      pipWindow.focus();
      return;
    }

    if ("documentPictureInPicture" in window) {
      try {
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 270,
          height: 250,
        });

        pip.document.documentElement.className = "dark";
        pip.document.body.className = "dark bg-[#09090b] text-foreground p-0 m-0 overflow-hidden font-sans select-none antialiased";

        // Copy styles
        const styleNodes = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"));
        styleNodes.forEach(node => {
          pip.document.head.appendChild(node.cloneNode(true));
        });

        const customStyle = pip.document.createElement("style");
        customStyle.textContent = `
          :root {
            --background: 240 10% 3.9%;
            --foreground: 0 0% 98%;
            --card: 240 10% 3.9%;
            --card-foreground: 0 0% 98%;
            --primary: 346.8 77.2% 49.8%;
            --primary-foreground: 355.7 100% 97.3%;
            --border: 240 3.7% 15.9%;
            --input: 240 3.7% 15.9%;
          }
          * { box-sizing: border-box; }
          body {
            background-color: #09090b !important;
            color: #fafafa !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `;
        pip.document.head.appendChild(customStyle);

        pip.addEventListener("pagehide", () => {
          setPipWindow(null);
          actions.setTimerWidgetOpen(false);
        });

        setPipWindow(pip);
        actions.setTimerWidgetOpen(true);
      } catch (err) {
        console.error("Document PiP request error:", err);
      }
    } else {
      // Fallback popup window
      const pop = window.open("", "TimerPip", "width=270,height=250,resizable=yes,scrollbars=no");
      if (pop) {
        pop.document.documentElement.className = "dark";
        pop.document.body.className = "dark bg-[#09090b] text-white p-0 m-0 overflow-hidden font-sans select-none";
        const styleNodes = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"));
        styleNodes.forEach(node => {
          pop.document.head.appendChild(node.cloneNode(true));
        });
        pop.addEventListener("beforeunload", () => {
          setPipWindow(null);
          actions.setTimerWidgetOpen(false);
        });
        setPipWindow(pop);
        actions.setTimerWidgetOpen(true);
      }
    }
  }, [pipWindow, actions]);

  // Listen for user trigger event
  useEffect(() => {
    const handleTrigger = () => {
      openSystemPip();
    };
    window.addEventListener("trigger-open-pip", handleTrigger);
    return () => {
      window.removeEventListener("trigger-open-pip", handleTrigger);
    };
  }, [openSystemPip]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 240, dragRef.current.posX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 200, dragRef.current.posY + dy));
      const newPos = { x: newX, y: newY };
      setPos(newPos);
      try {
        localStorage.setItem("floating_timer_pos", JSON.stringify(newPos));
      } catch {}
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const resetTimer = () => {
    setTimeLeft(duration * 60);
    setRunning(false);
    setCompleted(false);
    setNote("");
  };

  const changeMode = (newMode: TimerMode, mins: number) => {
    setMode(newMode);
    setDuration(mins);
    setTimeLeft(mins * 60);
    setRunning(false);
    setCompleted(false);
  };

  const renderTimerContent = (isPip = false) => (
    <div className="bg-[#09090b] border border-red-500/40 text-foreground rounded-2xl overflow-hidden w-full shadow-[0_0_25px_rgba(239,68,68,0.3)] h-full flex flex-col justify-between p-3 select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
        <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-red-400">
          <Brain className="w-3.5 h-3.5 animate-pulse text-red-500" />
          <span>Persona Focus</span>
        </div>
        <div className="flex items-center gap-1">
          {!isPip && (
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              title={minimized ? "Развернуть" : "Свернуть"}
            >
              {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={() => {
              if (isPip && pipWindow) pipWindow.close();
              actions.setTimerWidgetOpen(false);
            }}
            className="p-1 text-muted-foreground hover:text-red-400 rounded transition-colors"
            title="Закрыть"
            data-testid="button-close-timer-widget"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Minimized view (in-browser fallback only) */}
      {!isPip && minimized ? (
        <div className="p-2 flex items-center justify-between gap-2">
          <span className="font-mono text-lg font-bold text-foreground pl-2">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <button
            onClick={() => setRunning(!running)}
            className={`p-1.5 rounded-full ${running ? "bg-amber-500 text-black" : "bg-red-500 text-white"}`}
          >
            {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      ) : (
        /* Full view */
        <div className="space-y-2.5 pt-2 flex-1 flex flex-col justify-between">
          {/* Mode selection buttons */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => changeMode("pomodoro", 25)}
              className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                mode === "pomodoro" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              25m
            </button>
            <button
              onClick={() => changeMode("deep-work", 90)}
              className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                mode === "deep-work" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              90m
            </button>
            <button
              onClick={() => changeMode("custom", 60)}
              className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                mode === "custom" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              60m
            </button>
          </div>

          {/* Digital Timer Readout */}
          <div className="text-center py-1">
            <div className="font-display font-extrabold text-3xl tracking-tight tabular-nums text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </div>
            {completed && (
              <div className="text-xs text-red-400 font-display font-semibold mt-0.5 animate-pulse">
                +{xpForFocus(duration)} XP!
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={resetTimer}
              className="p-2 text-muted-foreground hover:text-white border border-border rounded-xl hover:bg-muted/40 transition-colors"
              title="Сбросить"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setRunning(!running)}
              className={`flex-1 py-1.5 px-3 rounded-xl font-display text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                running
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              }`}
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {running ? t.timer.pause : t.timer.start}
            </button>
          </div>

          {/* Session note input */}
          <div className="space-y-1 pt-1 border-t border-white/10">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-display">
              <FileText className="w-3 h-3 text-red-400" />
              <span>Заметка к сессии</span>
            </div>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Что удалось сделать?"
              className="w-full text-xs bg-muted/30 border border-white/10 rounded-lg px-2.5 py-1 text-white placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50 font-sans"
            />
          </div>
        </div>
      )}
    </div>
  );

  // Render System PiP portal if active
  if (pipWindow) {
    return ReactDOM.createPortal(renderTimerContent(true), pipWindow.document.body);
  }

  if (!isOpen) return null;

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onMouseDown={handleMouseDown}
      className={`fixed z-[9999] select-none transition-shadow ${
        isDragging ? "cursor-grabbing shadow-2xl scale-[1.02]" : "cursor-grab shadow-xl"
      }`}
      data-testid="floating-timer-widget"
    >
      <div className="w-64">{renderTimerContent(false)}</div>
    </div>
  );
}

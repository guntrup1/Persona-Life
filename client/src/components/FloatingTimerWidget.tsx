import React, { useState, useEffect, useRef } from "react";
import { useStore, getTodayDate, xpForFocus, type TimerMode } from "@/lib/store";
import { Play, Pause, RotateCcw, Brain, X, Minimize2, Maximize2, Check, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

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

  // Position state with drag functionality
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("floating_timer_pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 280, y: window.innerHeight - 340 };
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

  if (!isOpen) return null;

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

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onMouseDown={handleMouseDown}
      className={`fixed z-[9999] select-none transition-shadow ${
        isDragging ? "cursor-grabbing shadow-2xl scale-[1.02]" : "cursor-grab shadow-xl"
      }`}
      data-testid="floating-timer-widget"
    >
      <div className="bg-black/90 border border-primary/50 backdrop-blur-md text-foreground rounded-2xl overflow-hidden w-64 shadow-[0_0_25px_rgba(239,68,68,0.2)]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-primary/20 border-b border-primary/30">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-primary">
            <Brain className="w-3.5 h-3.5 animate-pulse" />
            <span>Focus Widget</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
              title={minimized ? "Развернуть" : "Свернуть"}
            >
              {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
            <button
              onClick={() => actions.setTimerWidgetOpen(false)}
              className="p-1 text-muted-foreground hover:text-red-400 rounded transition-colors"
              title="Закрыть виджет"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Minimized view */}
        {minimized ? (
          <div className="p-2 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-bold text-foreground pl-2">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <button
              onClick={() => setRunning(!running)}
              className={`p-1.5 rounded-full ${running ? "bg-amber-500 text-black" : "bg-primary text-primary-foreground"}`}
            >
              {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          /* Full view */
          <div className="p-3 space-y-3">
            {/* Mode selection */}
            <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
              <button
                onClick={() => changeMode("pomodoro", 25)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-colors ${
                  mode === "pomodoro" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                25m
              </button>
              <button
                onClick={() => changeMode("deep-work", 90)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-colors ${
                  mode === "deep-work" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                90m
              </button>
              <button
                onClick={() => changeMode("custom", 60)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-colors ${
                  mode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                60m
              </button>
            </div>

            {/* Timer readout */}
            <div className="text-center py-1">
              <div className="font-display font-extrabold text-3xl tracking-tight tabular-nums text-foreground">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
              {completed && (
                <div className="text-xs text-primary font-display font-semibold mt-1">
                  +{xpForFocus(duration)} XP!
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={resetTimer}
                className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setRunning(!running)}
                className={`flex-1 py-1.5 px-4 rounded-xl font-display text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  running ? "bg-amber-500 text-black hover:bg-amber-400" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {running ? t.timer.pause : t.timer.start}
              </button>
            </div>

            {/* Session note input */}
            <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-display">
                <FileText className="w-3 h-3 text-primary" />
                <span>Заметка к сессии</span>
              </div>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Что удалось сделать?"
                className="w-full text-xs bg-muted/40 border border-border rounded-lg px-2 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

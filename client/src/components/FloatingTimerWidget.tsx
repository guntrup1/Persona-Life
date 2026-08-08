import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useStore, xpForFocus, type TimerMode } from "@/lib/store";
import {
  getTimerState,
  subscribeTimer,
  setTimerMode,
  setTimerNote,
  toggleTimer,
  resetTimer,
  setOnTimerComplete,
  isPipOpen,
  closePip,
} from "@/lib/timer-state";
import { Play, Pause, RotateCcw, Brain, X, Minimize2, Maximize2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

export function FloatingTimerWidget() {
  const { state, actions } = useStore();
  const { toast } = useToast();
  const { t } = useI18n();

  const ts = useSyncExternalStore(subscribeTimer, getTimerState, getTimerState);
  const pipActive = useSyncExternalStore(subscribeTimer, isPipOpen, isPipOpen);

  const isOpen = !!state.timerWidgetOpen && !pipActive;
  const [minimized, setMinimized] = useState<boolean>(false);

  // Position state for in-browser draggable widget
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem("floating_timer_pos");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: Math.max(20, window.innerWidth - 290), y: Math.max(20, window.innerHeight - 340) };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({ startX: 0, startY: 0, posX: 0, posY: 0 });

  // Register timer completion callback
  useEffect(() => {
    setOnTimerComplete((session) => {
      actions.addFocusSession(session);
      toast({
        title: t.timer.sessionCompleted,
        description: t.timer.xpReceived.replace("{xp}", session.xp.toString()),
      });
    });
    return () => setOnTimerComplete(null);
  }, [actions, toast, t]);

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

  const minutes = Math.floor(ts.timeLeft / 60);
  const seconds = ts.timeLeft % 60;

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onMouseDown={handleMouseDown}
      className={`fixed z-[9999] select-none transition-shadow ${
        isDragging ? "cursor-grabbing shadow-2xl scale-[1.02]" : "cursor-grab shadow-xl"
      }`}
      data-testid="floating-timer-widget"
    >
      <div className="bg-[#09090b] border border-red-500/40 text-foreground rounded-2xl overflow-hidden w-64 shadow-[0_0_25px_rgba(239,68,68,0.3)] flex flex-col justify-between p-3">
        {/* Header bar */}
        <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
          <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-red-400">
            <Brain className="w-3.5 h-3.5 animate-pulse text-red-500" />
            <span>Persona Focus</span>
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
              title="Закрыть"
              data-testid="button-close-timer-widget"
            >
              <X className="w-3.5 h-3.5" />
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
              onClick={() => toggleTimer()}
              className={`p-1.5 rounded-full ${ts.running ? "bg-amber-500 text-black" : "bg-red-500 text-white"}`}
            >
              {ts.running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          /* Full view */
          <div className="space-y-2.5 pt-2 flex-1 flex flex-col justify-between">
            {/* Mode selection buttons */}
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg border border-white/5">
              <button
                onClick={() => setTimerMode("pomodoro", 25)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                  ts.mode === "pomodoro" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                25m
              </button>
              <button
                onClick={() => setTimerMode("deep-work", 90)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                  ts.mode === "deep-work" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                90m
              </button>
              <button
                onClick={() => setTimerMode("custom", 60)}
                className={`flex-1 py-1 text-[10px] font-display rounded font-semibold transition-all ${
                  ts.mode === "custom" ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                60m
              </button>
            </div>

            {/* Timer Readout */}
            <div className="text-center py-1">
              <div className="font-display font-extrabold text-3xl tracking-tight tabular-nums text-white drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </div>
              {ts.completed && (
                <div className="text-xs text-red-400 font-display font-semibold mt-0.5 animate-pulse">
                  +{xpForFocus(ts.duration)} XP!
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => resetTimer()}
                className="p-2 text-muted-foreground hover:text-white border border-border rounded-xl hover:bg-muted/40 transition-colors"
                title="Сбросить"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleTimer()}
                className={`flex-1 py-1.5 px-3 rounded-xl font-display text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md ${
                  ts.running
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                }`}
              >
                {ts.running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {ts.running ? t.timer.pause : t.timer.start}
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
                value={ts.note}
                onChange={e => setTimerNote(e.target.value)}
                placeholder="Что удалось сделать?"
                className="w-full text-xs bg-muted/30 border border-white/10 rounded-lg px-2.5 py-1 text-white placeholder:text-muted-foreground focus:outline-none focus:border-red-500/50 font-sans"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

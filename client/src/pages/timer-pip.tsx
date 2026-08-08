import React, { useSyncExternalStore } from "react";
import {
  getTimerState,
  subscribeTimer,
  setTimerMode,
  setTimerNote,
  toggleTimer,
  resetTimer,
} from "@/lib/timer-state";
import { xpForFocus, type TimerMode } from "@/lib/store";
import { Play, Pause, RotateCcw, Brain, X, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function TimerPipPage() {
  const ts = useSyncExternalStore(subscribeTimer, getTimerState, getTimerState);
  const { t } = useI18n();

  const minutes = Math.floor(ts.timeLeft / 60);
  const seconds = ts.timeLeft % 60;

  return (
    <div className="min-h-screen w-screen bg-[#09090b] text-foreground p-3 flex flex-col justify-between select-none font-sans border border-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.3)] box-border">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-red-500/20 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-red-400">
          <Brain className="w-3.5 h-3.5 animate-pulse text-red-500" />
          <span>Persona Focus</span>
        </div>
        <button
          onClick={() => window.close()}
          className="p-1 text-muted-foreground hover:text-red-400 rounded transition-colors"
          title="Закрыть окно"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode selection buttons */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg border border-white/5 mt-2">
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

      {/* Digital Timer Readout */}
      <div className="text-center py-2 flex-1 flex flex-col justify-center items-center">
        <div className="font-display font-extrabold text-4xl tracking-tight tabular-nums text-white drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        {ts.completed && (
          <div className="text-xs text-red-400 font-display font-semibold mt-1 animate-pulse">
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
      <div className="space-y-1 pt-2 border-t border-white/10 mt-2">
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
  );
}

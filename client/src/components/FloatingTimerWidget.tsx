import React, { useState, useEffect, useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";
import { useStore, xpForFocus } from "@/lib/store";
import {
  getTimerState,
  subscribeTimer,
  setTimerMode,
  setTimerNote,
  toggleTimer,
  resetTimer,
  setOnTimerComplete,
  getPipWindow,
  closePipWindow,
} from "@/lib/timer-state";
import { Play, Pause, RotateCcw, Brain, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import type { TimerMode } from "@/lib/store";

// ─── Shared Timer Content (rendered inside PiP window or in-browser) ──

function TimerWidgetContent({ onClose }: { onClose: () => void }) {
  const ts = useSyncExternalStore(subscribeTimer, getTimerState, getTimerState);
  const { t } = useI18n();

  const minutes = Math.floor(ts.timeLeft / 60);
  const seconds = ts.timeLeft % 60;

  const changeMode = (mode: TimerMode, mins: number) => {
    setTimerMode(mode, mins);
  };

  return (
    <div style={{
      background: "#09090b",
      border: "1px solid rgba(239,68,68,0.4)",
      borderRadius: "16px",
      overflow: "hidden",
      width: "100%",
      height: "100%",
      boxShadow: "0 0 25px rgba(239,68,68,0.3)",
      display: "flex",
      flexDirection: "column",
      padding: "12px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#fafafa",
      boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: "8px",
        borderBottom: "1px solid rgba(239,68,68,0.2)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#ef4444" }}>
          <Brain style={{ width: 14, height: 14, color: "#ef4444" }} />
          <span>Persona Focus</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
          onMouseLeave={e => (e.currentTarget.style.color = "#666")}
          title="Закрыть"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Mode buttons */}
      <div style={{
        display: "flex",
        gap: "4px",
        background: "rgba(255,255,255,0.05)",
        padding: "4px",
        borderRadius: "8px",
        marginTop: "10px",
        border: "1px solid rgba(255,255,255,0.03)",
      }}>
        {([["pomodoro", 25, "25m"], ["deep-work", 90, "90m"], ["custom", 60, "60m"]] as const).map(([m, d, label]) => (
          <button
            key={m}
            onClick={() => changeMode(m as TimerMode, d)}
            style={{
              flex: 1,
              padding: "4px 0",
              fontSize: "10px",
              fontWeight: 700,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s",
              background: ts.mode === m ? "#ef4444" : "transparent",
              color: ts.mode === m ? "#fff" : "#888",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timer display */}
      <div style={{
        textAlign: "center",
        padding: "10px 0 6px",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}>
        <div style={{
          fontSize: "36px",
          fontWeight: 800,
          letterSpacing: "-1px",
          color: "#fff",
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 20px rgba(239,68,68,0.4)",
          lineHeight: 1,
        }}>
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        {ts.completed && (
          <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: 600, marginTop: "4px" }}>
            +{xpForFocus(ts.duration)} XP!
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => resetTimer()}
          style={{
            padding: "6px",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            color: "#888",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.background = "transparent"; }}
          title="Сбросить"
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
        </button>
        <button
          onClick={() => toggleTimer()}
          style={{
            flex: 1,
            padding: "7px 12px",
            borderRadius: "10px",
            border: "none",
            fontWeight: 700,
            fontSize: "12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.15s",
            background: ts.running ? "#f59e0b" : "#ef4444",
            color: ts.running ? "#000" : "#fff",
            boxShadow: ts.running ? "none" : "0 0 15px rgba(239,68,68,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {ts.running ? <Pause style={{ width: 14, height: 14 }} /> : <Play style={{ width: 14, height: 14 }} />}
          {ts.running ? t.timer.pause : t.timer.start}
        </button>
      </div>

      {/* Note input */}
      <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#888", marginBottom: "4px" }}>
          <FileText style={{ width: 12, height: 12, color: "#ef4444" }} />
          <span>Заметка к сессии</span>
        </div>
        <input
          type="text"
          value={ts.note}
          onChange={e => setTimerNote(e.target.value)}
          placeholder="Что удалось сделать?"
          style={{
            width: "100%",
            fontSize: "11px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px",
            padding: "5px 10px",
            color: "#fafafa",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(239,68,68,0.5)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>
    </div>
  );
}

// ─── Main Widget Component (mounts in App.tsx) ────────────────────────

export function FloatingTimerWidget() {
  const { actions } = useStore();
  const { toast } = useToast();
  const { t } = useI18n();

  // Register completion handler (only this component does it since it's always mounted)
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

  // Subscribe to PiP window changes
  const pip = useSyncExternalStore(subscribeTimer, getPipWindow, getPipWindow);
  const [pipRoot, setPipRoot] = useState<ReactDOM.Root | null>(null);

  // Create/destroy React root in PiP window
  useEffect(() => {
    if (pip) {
      const container = pip.document.getElementById("pip-root");
      if (container) {
        container.style.cssText = "width:100%;height:100%;";
        const root = ReactDOM.createRoot(container);
        setPipRoot(root);
        return () => {
          root.unmount();
          setPipRoot(null);
        };
      }
    } else {
      setPipRoot(null);
    }
  }, [pip]);

  // Render into PiP window when root is ready
  useEffect(() => {
    if (pipRoot) {
      pipRoot.render(
        <PipTimerContent onClose={closePipWindow} />
      );
    }
  });

  return null; // This component renders nothing in the main document
}

// Wrapper to provide i18n context in PiP window
function PipTimerContent({ onClose }: { onClose: () => void }) {
  return <TimerWidgetContent onClose={onClose} />;
}

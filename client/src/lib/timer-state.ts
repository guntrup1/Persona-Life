import { getTodayDate, xpForFocus, type TimerMode } from "./store";

// ─── Shared Timer State ───────────────────────────────────────────────
// This module holds the single source of truth for the timer countdown.
// Both timer.tsx and FloatingTimerWidget subscribe to it so they always
// show the exact same values.

interface TimerState {
  mode: TimerMode;
  duration: number;   // minutes
  timeLeft: number;   // seconds
  totalTime: number;  // seconds
  running: boolean;
  completed: boolean;
  note: string;
}

let state: TimerState = {
  mode: "pomodoro",
  duration: 25,
  timeLeft: 25 * 60,
  totalTime: 25 * 60,
  running: false,
  completed: false,
  note: "",
};

let intervalId: ReturnType<typeof setInterval> | null = null;
let onCompleteCallback: ((session: {
  duration: number;
  mode: TimerMode;
  xp: number;
  date: string;
  completedAt: string;
  note?: string;
}) => void) | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(l => l());
}

// ─── Public API ───────────────────────────────────────────────────────

export function getTimerState(): Readonly<TimerState> {
  return state;
}

export function subscribeTimer(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function setOnTimerComplete(cb: typeof onCompleteCallback) {
  onCompleteCallback = cb;
}

export function setTimerMode(mode: TimerMode, mins: number) {
  stopInterval();
  state = { ...state, mode, duration: mins, timeLeft: mins * 60, totalTime: mins * 60, running: false, completed: false };
  notify();
}

export function setTimerNote(note: string) {
  state = { ...state, note };
  notify();
}

export function startTimer() {
  if (state.running || state.completed) return;
  state = { ...state, running: true };
  runInterval();
  notify();
}

export function pauseTimer() {
  stopInterval();
  state = { ...state, running: false };
  notify();
}

export function toggleTimer() {
  if (state.running) pauseTimer();
  else startTimer();
}

export function resetTimer() {
  stopInterval();
  state = {
    ...state,
    timeLeft: state.duration * 60,
    totalTime: state.duration * 60,
    running: false,
    completed: false,
    note: "",
  };
  notify();
}

// ─── Interval Logic (single interval) ─────────────────────────────────

function stopInterval() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function runInterval() {
  stopInterval();
  intervalId = setInterval(() => {
    const newTimeLeft = state.timeLeft - 1;
    if (newTimeLeft <= 0) {
      stopInterval();
      const xp = xpForFocus(state.duration);
      state = { ...state, timeLeft: 0, running: false, completed: true };
      notify();
      if (onCompleteCallback) {
        onCompleteCallback({
          duration: state.duration,
          mode: state.mode,
          xp,
          date: getTodayDate(),
          completedAt: new Date().toISOString(),
          note: state.note.trim() || undefined,
        });
      }
    } else {
      state = { ...state, timeLeft: newTimeLeft };
      notify();
    }
  }, 1000);
}

// ─── PiP Window Management ────────────────────────────────────────────

let pipWindow: Window | null = null;

export function getPipWindow(): Window | null {
  return pipWindow;
}

export function setPipWindowRef(w: Window | null) {
  pipWindow = w;
  notify();
}

/**
 * MUST be called synchronously inside a user click handler.
 * This is critical: Document PiP API requires an active user gesture.
 */
export async function openPipWindow(): Promise<Window | null> {
  if (pipWindow) {
    pipWindow.focus();
    return pipWindow;
  }

  // ── Try Document Picture-in-Picture (always-on-top, no browser chrome) ──
  if ("documentPictureInPicture" in window) {
    try {
      const pip = await (window as any).documentPictureInPicture.requestWindow({
        width: 280,
        height: 260,
      });

      // Apply dark theme on <html> and <body>
      pip.document.documentElement.className = "dark";
      pip.document.body.style.cssText =
        "background:#09090b!important;color:#fafafa!important;margin:0!important;padding:0!important;overflow:hidden;font-family:system-ui,-apple-system,sans-serif";

      // Clone ALL style/link nodes from main document
      Array.from(document.querySelectorAll("style, link[rel='stylesheet']")).forEach((node: Element) => {
        pip.document.head.appendChild(node.cloneNode(true));
      });

      // Inject CSS design tokens as fallback
      const s = pip.document.createElement("style");
      s.textContent = `
        :root{--background:240 10% 3.9%;--foreground:0 0% 98%;--card:240 10% 3.9%;--card-foreground:0 0% 98%;--primary:346.8 77.2% 49.8%;--primary-foreground:355.7 100% 97.3%;--secondary:240 3.7% 15.9%;--secondary-foreground:0 0% 98%;--muted:240 3.7% 15.9%;--muted-foreground:240 5% 64.9%;--accent:240 3.7% 15.9%;--accent-foreground:0 0% 98%;--border:240 3.7% 15.9%;--input:240 3.7% 15.9%;--ring:346.8 77.2% 49.8%;--radius:0.5rem}
        *{box-sizing:border-box}
        body{background:#09090b!important;color:#fafafa!important;font-family:system-ui,-apple-system,sans-serif!important;margin:0!important;padding:0!important;overflow:hidden!important}
      `;
      pip.document.head.appendChild(s);

      // Create render target container
      const container = pip.document.createElement("div");
      container.id = "pip-root";
      pip.document.body.appendChild(container);

      pip.addEventListener("pagehide", () => {
        setPipWindowRef(null);
      });

      setPipWindowRef(pip);
      return pip;
    } catch (err) {
      console.error("Document PiP request failed:", err);
    }
  }

  // ── Fallback: popup window (NOT always-on-top, but styled) ──────────
  const pop = window.open("", "PersonaTimer", "popup=yes,width=280,height=260,toolbar=no,menubar=no,location=no,status=no,resizable=no");
  if (pop) {
    pop.document.documentElement.className = "dark";
    pop.document.title = "Persona Focus";
    pop.document.body.style.cssText =
      "background:#09090b!important;color:#fafafa!important;margin:0!important;padding:0!important;overflow:hidden;font-family:system-ui,-apple-system,sans-serif";
    Array.from(document.querySelectorAll("style, link[rel='stylesheet']")).forEach((node: Element) => {
      pop.document.head.appendChild(node.cloneNode(true));
    });
    const s = pop.document.createElement("style");
    s.textContent = `
      :root{--background:240 10% 3.9%;--foreground:0 0% 98%;--primary:346.8 77.2% 49.8%;--primary-foreground:355.7 100% 97.3%;--border:240 3.7% 15.9%;--input:240 3.7% 15.9%;--muted:240 3.7% 15.9%;--muted-foreground:240 5% 64.9%}
      *{box-sizing:border-box}
      body{background:#09090b!important;color:#fafafa!important;font-family:system-ui,-apple-system,sans-serif!important;margin:0!important;padding:0!important;overflow:hidden!important}
    `;
    pop.document.head.appendChild(s);
    const container = pop.document.createElement("div");
    container.id = "pip-root";
    pop.document.body.appendChild(container);
    pop.addEventListener("beforeunload", () => {
      setPipWindowRef(null);
    });
    setPipWindowRef(pop);
    return pop;
  }

  return null;
}

export function closePipWindow() {
  if (pipWindow) {
    pipWindow.close();
  }
  pipWindow = null;
  notify();
}

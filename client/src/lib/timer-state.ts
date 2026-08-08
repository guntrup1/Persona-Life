import { getTodayDate, xpForFocus, type TimerMode } from "./store";
import { playTimerRingtone, type TimerSound } from "./timer-audio";

// ─── Single Source of Truth for Timer Countdown ───────────────────────

interface TimerState {
  mode: TimerMode;
  duration: number;
  timeLeft: number;
  totalTime: number;
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
  duration: number; mode: TimerMode; xp: number;
  date: string; completedAt: string; note?: string;
}) => void) | null = null;

const listeners = new Set<() => void>();
function notify(broadcast = true) {
  listeners.forEach(l => l());
  if (broadcast && channel) {
    try {
      channel.postMessage({ type: "TIMER_STATE_SYNC", state });
    } catch {}
  }
}

// ─── Cross-Window BroadcastChannel Sync ───────────────────────────────
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("persona_timer_channel") : null;

if (channel) {
  channel.onmessage = (event) => {
    if (event.data && event.data.type === "TIMER_STATE_SYNC") {
      state = event.data.state;
      notify(false); // Update local listeners without echoing back
    }
  };
}

export function getTimerState(): Readonly<TimerState> { return state; }
export function subscribeTimer(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function setOnTimerComplete(cb: typeof onCompleteCallback) { onCompleteCallback = cb; }

export function setTimerMode(mode: TimerMode, mins: number) {
  stopInterval();
  state = { ...state, mode, duration: mins, timeLeft: mins * 60, totalTime: mins * 60, running: false, completed: false };
  notify();
}

export function setTimerNote(note: string) {
  state = { ...state, note };
  notify();
}

export function toggleTimer() {
  if (state.running) { stopInterval(); state = { ...state, running: false }; }
  else if (!state.completed) { state = { ...state, running: true }; runInterval(); }
  notify();
}

export function resetTimer() {
  stopInterval();
  state = { ...state, timeLeft: state.duration * 60, totalTime: state.duration * 60, running: false, completed: false, note: "" };
  notify();
}

function stopInterval() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function runInterval() {
  stopInterval();
  intervalId = setInterval(() => {
    const next = state.timeLeft - 1;
    if (next <= 0) {
      stopInterval();
      const xp = xpForFocus(state.duration);
      state = { ...state, timeLeft: 0, running: false, completed: true };
      notify();
      
      // Play completion ringtone
      try {
        const rawStore = localStorage.getItem("lifeos_v2");
        if (rawStore) {
          const parsed = JSON.parse(rawStore);
          const sound = (parsed.timerSound || "bell") as TimerSound;
          playTimerRingtone(sound);
        } else {
          playTimerRingtone("bell");
        }
      } catch {
        playTimerRingtone("bell");
      }

      onCompleteCallback?.({
        duration: state.duration, mode: state.mode, xp,
        date: getTodayDate(), completedAt: new Date().toISOString(),
        note: state.note.trim() || undefined,
      });
    } else {
      state = { ...state, timeLeft: next };
      notify();
    }
  }, 1000);
}

// ─── PiP / Popout Desktop Window Launcher ────────────────────────────
let externalWin: Window | null = null;

export function isPipOpen(): boolean {
  return !!externalWin && !externalWin.closed;
}

export async function tryOpenPip(): Promise<boolean> {
  if (externalWin && !externalWin.closed) {
    externalWin.focus();
    return true;
  }

  // 1. Try Document Picture-in-Picture API (Chrome/Edge native PiP)
  if ("documentPictureInPicture" in window) {
    try {
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({
        width: 280, height: 270,
      });

      pip.document.documentElement.style.cssText = "background:#09090b;margin:0;padding:0";
      pip.document.body.style.cssText = "background:#09090b;color:#fafafa;margin:0;padding:0;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;user-select:none";

      Array.from(document.querySelectorAll("style, link[rel='stylesheet']")).forEach((node: Element) => {
        pip.document.head.appendChild(node.cloneNode(true));
      });

      pip.document.body.innerHTML = buildPipHTML();
      attachPipListeners(pip);
      startPipUpdater(pip);

      pip.addEventListener("pagehide", () => {
        cleanupPip();
        notify();
      });

      externalWin = pip;
      notify();
      return true;
    } catch (e) {
      console.warn("Document PiP request failed, falling back to desktop popout window:", e);
    }
  }

  // 2. Open desktop popout window /timer-pip (allows moving outside Opera onto desktop)
  const left = Math.max(50, window.screen.width - 320);
  const top = Math.max(50, window.screen.height - 350);
  const pop = window.open(
    "/timer-pip",
    "PersonaTimerWin",
    `width=280,height=270,left=${left},top=${top},resizable=yes,scrollbars=no,menubar=no,toolbar=no,location=no,directories=no,status=no`
  );

  if (pop) {
    pop.addEventListener("beforeunload", () => {
      cleanupPip();
      notify();
    });
    externalWin = pop;
    notify();
    return true;
  }

  return false;
}

export function closePip() {
  if (externalWin && !externalWin.closed) {
    try { externalWin.close(); } catch {}
  }
  cleanupPip();
  notify();
}

function cleanupPip() {
  externalWin = null;
}

function buildPipHTML(): string {
  return `
  <div id="tw" style="background:#09090b;border:1px solid rgba(239,68,68,0.4);border-radius:16px;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:12px;color:#fafafa;font-family:system-ui,-apple-system,sans-serif">
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px;border-bottom:1px solid rgba(239,68,68,0.2)">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#ef4444">⦿ Persona Focus</span>
      <button id="pip-close" style="background:none;border:none;color:#666;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px" title="Закрыть">✕</button>
    </div>
    <div style="display:flex;gap:4px;background:rgba(255,255,255,0.05);padding:4px;border-radius:8px;margin-top:10px">
      <button data-mode="pomodoro" data-dur="25" class="mb" style="flex:1;padding:4px 0;font-size:10px;font-weight:700;border:none;border-radius:6px;cursor:pointer;background:#ef4444;color:#fff;text-transform:uppercase;letter-spacing:0.05em">25m</button>
      <button data-mode="deep-work" data-dur="90" class="mb" style="flex:1;padding:4px 0;font-size:10px;font-weight:700;border:none;border-radius:6px;cursor:pointer;background:transparent;color:#888;text-transform:uppercase;letter-spacing:0.05em">90m</button>
      <button data-mode="custom" data-dur="60" class="mb" style="flex:1;padding:4px 0;font-size:10px;font-weight:700;border:none;border-radius:6px;cursor:pointer;background:transparent;color:#888;text-transform:uppercase;letter-spacing:0.05em">60m</button>
    </div>
    <div style="text-align:center;padding:12px 0 8px;flex:1;display:flex;flex-direction:column;justify-content:center">
      <div id="pip-time" style="font-size:38px;font-weight:800;letter-spacing:-1px;color:#fff;font-variant-numeric:tabular-nums;text-shadow:0 0 20px rgba(239,68,68,0.4);line-height:1">25:00</div>
      <div id="pip-xp" style="font-size:12px;color:#ef4444;font-weight:600;margin-top:4px;display:none">+5 XP!</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <button id="pip-reset" style="padding:6px 8px;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#888;cursor:pointer;font-size:14px" title="Сбросить">↺</button>
      <button id="pip-toggle" style="flex:1;padding:7px 12px;border-radius:10px;border:none;font-weight:700;font-size:12px;cursor:pointer;background:#ef4444;color:#fff;text-transform:uppercase;letter-spacing:0.05em;box-shadow:0 0 15px rgba(239,68,68,0.4)">▶ Старт</button>
    </div>
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
      <div style="font-size:10px;color:#888;margin-bottom:4px">📝 Заметка к сессии</div>
      <input id="pip-note" type="text" placeholder="Что удалось сделать?" style="width:100%;font-size:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 10px;color:#fafafa;outline:none;box-sizing:border-box;font-family:inherit" />
    </div>
  </div>`;
}

function attachPipListeners(pip: Window) {
  pip.document.getElementById("pip-close")?.addEventListener("click", () => closePip());
  pip.document.getElementById("pip-toggle")?.addEventListener("click", () => toggleTimer());
  pip.document.getElementById("pip-reset")?.addEventListener("click", () => resetTimer());
  pip.document.getElementById("pip-note")?.addEventListener("input", (e) => {
    setTimerNote((e.target as HTMLInputElement).value);
  });
  pip.document.querySelectorAll(".mb").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = (btn as HTMLElement).dataset.mode as TimerMode;
      const dur = Number((btn as HTMLElement).dataset.dur);
      setTimerMode(mode, dur);
    });
  });
}

function startPipUpdater(pip: Window) {
  setInterval(() => {
    if (!externalWin || externalWin.closed) return;
    const s = state;
    const m = Math.floor(s.timeLeft / 60);
    const sec = s.timeLeft % 60;

    const timeEl = pip.document.getElementById("pip-time");
    if (timeEl) timeEl.textContent = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;

    const toggleEl = pip.document.getElementById("pip-toggle");
    if (toggleEl) {
      toggleEl.textContent = s.running ? "⏸ Пауза" : "▶ Старт";
      toggleEl.style.background = s.running ? "#f59e0b" : "#ef4444";
      toggleEl.style.color = s.running ? "#000" : "#fff";
      toggleEl.style.boxShadow = s.running ? "none" : "0 0 15px rgba(239,68,68,0.4)";
    }

    const xpEl = pip.document.getElementById("pip-xp");
    if (xpEl) {
      xpEl.style.display = s.completed ? "block" : "none";
      if (s.completed) xpEl.textContent = `+${xpForFocus(s.duration)} XP!`;
    }

    pip.document.querySelectorAll(".mb").forEach(btn => {
      const bMode = (btn as HTMLElement).dataset.mode;
      (btn as HTMLElement).style.background = bMode === s.mode ? "#ef4444" : "transparent";
      (btn as HTMLElement).style.color = bMode === s.mode ? "#fff" : "#888";
    });

    const noteEl = pip.document.getElementById("pip-note") as HTMLInputElement | null;
    if (noteEl && pip.document.activeElement !== noteEl) {
      noteEl.value = s.note;
    }
  }, 100);
}

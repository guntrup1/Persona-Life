import { useSyncExternalStore } from "react";
import { useState } from "react";
import { useStore, xpForFocus, type TimerMode } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Brain, Check, Flame, Zap, FileText, ChevronDown, ChevronRight, Pin, Volume2, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import { getTodayDate } from "@/lib/store";
import {
  getTimerState,
  subscribeTimer,
  setTimerMode,
  setTimerNote,
  toggleTimer,
  resetTimer as resetTimerState,
  tryOpenPip,
  isPipOpen,
  closePip,
} from "@/lib/timer-state";
import { previewTimerRingtone, type TimerSound } from "@/lib/timer-audio";

const getModes = (t: any): { key: TimerMode; label: string; duration: number; xp: number; color: string }[] => [
  { key: "pomodoro", label: "Pomodoro", duration: 25, xp: 5, color: "text-red-400" },
  { key: "deep-work", label: "Deep Work", duration: 90, xp: 25, color: "text-blue-400" },
  { key: "custom", label: t.timer.customTimer, duration: 60, xp: 15, color: "text-purple-400" },
];

const SOUND_OPTIONS: { value: TimerSound; label: string; icon: string }[] = [
  { value: "bell", label: "Колокольчик", icon: "🔔" },
  { value: "digital", label: "Цифровой", icon: "📟" },
  { value: "gong", label: "Гонг", icon: "🧘" },
  { value: "none", label: "Без звука", icon: "🔇" },
];

function TimerRing({ progress, radius, stroke }: { progress: number; radius: number; stroke: number }) {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg height={radius * 2} width={radius * 2} className="timer-ring">
      <circle
        stroke="hsl(var(--muted))"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke="hsl(var(--primary))"
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference + " " + circumference}
        style={{ strokeDashoffset }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
        className="timer-ring-progress"
      />
    </svg>
  );
}

export default function TimerPage() {
  const { state, actions } = useStore();
  const { t, lang } = useI18n();

  const ts = useSyncExternalStore(subscribeTimer, getTimerState, getTimerState);
  const isPinned = useSyncExternalStore(subscribeTimer, isPipOpen, isPipOpen);

  const [customMinutes, setCustomMinutes] = useState(60);
  const [historyOpen, setHistoryOpen] = useState(true);

  const minutes = Math.floor(ts.timeLeft / 60);
  const seconds = ts.timeLeft % 60;
  const progress = ((ts.totalTime - ts.timeLeft) / ts.totalTime) * 100;

  const modeConfig = getModes(t).find(m => m.key === ts.mode)!;
  const currentDuration = ts.mode === "custom" ? customMinutes : modeConfig.duration;
  const currentXp = xpForFocus(currentDuration);
  const activeSound = state.timerSound || "bell";

  const handleModeChange = (mode: TimerMode) => {
    const m = getModes(t).find(x => x.key === mode)!;
    const dur = mode === "custom" ? customMinutes : m.duration;
    setTimerMode(mode, dur);
  };

  const handleCustomMinutesChange = (mins: number) => {
    setCustomMinutes(mins);
    if (ts.mode === "custom") {
      setTimerMode("custom", mins);
    }
  };

  const todayXP = state.focusSessions
    .filter(s => s.date === getTodayDate())
    .reduce((sum, s) => sum + s.xp, 0);

  const todayCount = state.focusSessions.filter(s => s.date === getTodayDate()).length;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            {t.nav.timer.toUpperCase()}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (isPinned || state.timerWidgetOpen) {
                closePip();
                actions.setTimerWidgetOpen(false);
              } else {
                const ok = await tryOpenPip();
                if (!ok) {
                  actions.setTimerWidgetOpen(true);
                }
              }
            }}
            className={`gap-1.5 border-primary/40 font-display text-xs ${(isPinned || state.timerWidgetOpen) ? "bg-primary/20 text-primary" : ""}`}
            data-testid="button-toggle-floating-timer"
          >
            <Pin className="w-3.5 h-3.5" />
            {(isPinned || state.timerWidgetOpen) ? "Виджет прикреплён" : "Прикрепить виджет"}
          </Button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 flex-wrap">
          {getModes(t).map(mode => (
            <button
              key={mode.key}
              onClick={() => handleModeChange(mode.key)}
              className={`px-4 py-2 rounded-md font-display text-sm font-semibold transition-all border ${
                ts.mode === mode.key
                  ? "bg-primary text-primary-foreground border-primary p5-glow-sm"
                  : "bg-card border-card-border text-muted-foreground hover-elevate"
              }`}
              data-testid={`timer-mode-${mode.key}`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {ts.mode === "custom" && (
          <Card className="p-3 border-card-border animate-slide-in-up">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-display flex-shrink-0">{t.timer.minutes}</Label>
              <Input
                type="number"
                min="1"
                max="180"
                value={customMinutes}
                onChange={e => handleCustomMinutesChange(Math.max(1, Math.min(180, Number(e.target.value))))}
                className="w-24 font-mono"
                data-testid="input-custom-minutes"
              />
              <span className="text-xs text-muted-foreground">{t.timer.xpForSession} <span className="text-primary font-bold">{xpForFocus(customMinutes)}</span></span>
            </div>
          </Card>
        )}

        {/* Main Timer Display */}
        <Card className="p-6 border-card-border">
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex items-center justify-center">
              <TimerRing progress={progress} radius={110} stroke={8} />
              <div className="absolute text-center">
                <div className="font-display font-bold text-5xl text-foreground tabular-nums">
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </div>
                <div className={`font-display text-sm mt-1 ${modeConfig.color}`}>{modeConfig.label}</div>
                {ts.completed && (
                  <div className="font-display text-xs text-primary mt-1 animate-slide-in-up">
                    +{currentXp} XP!
                  </div>
                )}
              </div>
            </div>

            {/* Note Input */}
            <div className="w-full max-w-sm space-y-1">
              <Label htmlFor="session-note" className="text-xs text-muted-foreground font-display flex items-center gap-1">
                <FileText className="w-3 h-3 text-primary" />
                Заметка к текущей сессии
              </Label>
              <Input
                id="session-note"
                value={ts.note}
                onChange={e => setTimerNote(e.target.value)}
                placeholder="Что вы планируете или успели сделать?"
                className="text-xs bg-background/50 border-border"
                data-testid="input-session-note"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={() => resetTimerState()}
                data-testid="button-timer-reset"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              {ts.completed ? (
                <Button
                  size="lg"
                  onClick={() => resetTimerState()}
                  className="gap-2 px-8 p5-glow-sm"
                  data-testid="button-timer-restart"
                >
                  <Check className="w-4 h-4" />
                  {t.timer.newSession}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => toggleTimer()}
                  className="gap-2 px-8 p5-glow-sm"
                  data-testid={ts.running ? "button-timer-pause" : "button-timer-start"}
                >
                  {ts.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {ts.running ? t.timer.pause : t.timer.start}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span>{currentDuration} мин</span>
              <span className="text-primary font-bold">+{currentXp} XP</span>
            </div>
          </div>
        </Card>

        {/* Ringtone Sound Settings */}
        <Card className="p-3 border-card-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-primary" />
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-foreground">Звук окончания таймера</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SOUND_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    actions.setTimerSound(opt.value);
                    previewTimerRingtone(opt.value);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-display flex items-center gap-1 border transition-all ${
                    activeSound === opt.value
                      ? "bg-primary/20 border-primary text-primary font-bold"
                      : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-card-border text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-display text-xs text-muted-foreground uppercase tracking-wider">{t.timer.todaySessions}</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">{todayCount}</div>
          </Card>
          <Card className="p-3 border-card-border text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-display text-xs text-muted-foreground uppercase tracking-wider">{t.timer.focusXp}</span>
            </div>
            <div className="font-display text-2xl font-bold text-primary">{todayXP}</div>
          </Card>
        </div>

        {/* History */}
        {state.focusSessions.length > 0 && (
          <Card className="p-4 border-card-border">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full flex items-center justify-between font-display text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                {t.timer.history} ({state.focusSessions.length})
              </span>
              {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {historyOpen && (
              <div className="space-y-2 max-h-56 overflow-auto mt-3 animate-slide-in-up">
                {[...state.focusSessions].reverse().slice(0, 20).map(session => (
                  <div key={session.id} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        session.mode === "pomodoro" ? "bg-red-400" :
                        session.mode === "deep-work" ? "bg-blue-400" : "bg-purple-400"
                      }`} />
                      <span className="font-display text-xs text-foreground truncate">
                        {session.mode === "pomodoro" ? "Pomodoro" : session.mode === "deep-work" ? "Deep Work" : "Custom"}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{session.duration} мин</span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {session.note && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-primary hover:text-primary/80 transition-colors p-1" title="Посмотреть заметку">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3 bg-card border-card-border shadow-xl">
                            <div className="text-xs font-display font-bold uppercase text-primary mb-1">Заметка к сессии</div>
                            <p className="text-xs text-foreground font-sans whitespace-pre-wrap">{session.note}</p>
                          </PopoverContent>
                        </Popover>
                      )}
                      <span className="font-mono text-xs text-primary">+{session.xp} XP</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(session.completedAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: "2-digit", month: "short" })}
                      </span>
                      <button
                        onClick={() => actions.deleteFocusSession(session.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                        title="Удалить из истории"
                        data-testid={`delete-session-${session.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

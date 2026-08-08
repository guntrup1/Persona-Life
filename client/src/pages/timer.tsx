import { useState, useEffect, useRef, useCallback } from "react";
import { useStore, xpForFocus, type TimerMode } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Brain, Check, Flame, Zap, FileText, ChevronDown, ChevronRight, ExternalLink, Pin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { getTodayDate } from "@/lib/store";

const getModes = (t: any): { key: TimerMode; label: string; duration: number; xp: number; color: string }[] => [
  { key: "pomodoro", label: "Pomodoro", duration: 25, xp: 5, color: "text-red-400" },
  { key: "deep-work", label: "Deep Work", duration: 90, xp: 25, color: "text-blue-400" },
  { key: "custom", label: t.timer.customTimer, duration: 60, xp: 15, color: "text-purple-400" },
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
  const { toast } = useToast();
  const { t, lang } = useI18n();

  const [selectedMode, setSelectedMode] = useState<TimerMode>("pomodoro");
  const [customMinutes, setCustomMinutes] = useState(60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sessionNote, setSessionNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getModeConfig = useCallback(() => {
    const mode = getModes(t).find(m => m.key === selectedMode)!;
    const duration = selectedMode === "custom" ? customMinutes : mode.duration;
    return { ...mode, duration, xp: xpForFocus(duration) };
  }, [selectedMode, customMinutes, t]);

  const resetTimer = useCallback(() => {
    const config = getModeConfig();
    setTimeLeft(config.duration * 60);
    setTotalTime(config.duration * 60);
    setRunning(false);
    setCompleted(false);
    setSessionNote("");
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [getModeConfig]);

  useEffect(() => {
    resetTimer();
  }, [selectedMode, customMinutes, resetTimer]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setRunning(false);
            setCompleted(true);
            const config = getModeConfig();
            actions.addFocusSession({
              duration: config.duration,
              mode: selectedMode,
              xp: config.xp,
              date: getTodayDate(),
              completedAt: new Date().toISOString(),
              note: sessionNote.trim() || undefined,
            });
            toast({ title: t.timer.sessionCompleted, description: t.timer.xpReceived.replace("{xp}", config.xp.toString()) });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, selectedMode, sessionNote, actions, toast, t, getModeConfig]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const config = getModeConfig();

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
            onClick={() => actions.setTimerWidgetOpen(!state.timerWidgetOpen)}
            className={`gap-1.5 border-primary/40 font-display text-xs ${state.timerWidgetOpen ? "bg-primary/20 text-primary" : ""}`}
            data-testid="button-toggle-floating-timer"
          >
            <Pin className="w-3.5 h-3.5" />
            {state.timerWidgetOpen ? "Виджет прикреплён" : "Прикрепить виджет"}
          </Button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 flex-wrap">
          {getModes(t).map(mode => (
            <button
              key={mode.key}
              onClick={() => { setSelectedMode(mode.key); setRunning(false); }}
              className={`px-4 py-2 rounded-md font-display text-sm font-semibold transition-all border ${
                selectedMode === mode.key
                  ? "bg-primary text-primary-foreground border-primary p5-glow-sm"
                  : "bg-card border-card-border text-muted-foreground hover-elevate"
              }`}
              data-testid={`timer-mode-${mode.key}`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        {selectedMode === "custom" && (
          <Card className="p-3 border-card-border animate-slide-in-up">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-display flex-shrink-0">{t.timer.minutes}</Label>
              <Input
                type="number"
                min="1"
                max="180"
                value={customMinutes}
                onChange={e => setCustomMinutes(Math.max(1, Math.min(180, Number(e.target.value))))}
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
                <div className={`font-display text-sm mt-1 ${config.color}`}>{config.label}</div>
                {completed && (
                  <div className="font-display text-xs text-primary mt-1 animate-slide-in-up">
                    +{config.xp} XP!
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
                value={sessionNote}
                onChange={e => setSessionNote(e.target.value)}
                placeholder="Что вы планируете или успели сделать?"
                className="text-xs bg-background/50 border-border"
                data-testid="input-session-note"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                size="icon"
                variant="outline"
                onClick={resetTimer}
                data-testid="button-timer-reset"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              {completed ? (
                <Button
                  size="lg"
                  onClick={resetTimer}
                  className="gap-2 px-8 p5-glow-sm"
                  data-testid="button-timer-restart"
                >
                  <Check className="w-4 h-4" />
                  {t.timer.newSession}
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => setRunning(!running)}
                  className="gap-2 px-8 p5-glow-sm"
                  data-testid={running ? "button-timer-pause" : "button-timer-start"}
                >
                  {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {running ? t.timer.pause : t.timer.start}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span>{config.duration} мин</span>
              <span className="text-primary font-bold">+{config.xp} XP</span>
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

        {/* History Collapsible Card */}
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
                {[...state.focusSessions].reverse().slice(0, 15).map(session => (
                  <div key={session.id} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
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

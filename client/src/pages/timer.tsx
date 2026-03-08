import { useState, useEffect, useRef, useCallback } from "react";
import { useStore, xpForFocus, type TimerMode } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw, Timer, Check, Flame, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTodayDate } from "@/lib/store";

const MODES: { key: TimerMode; label: string; duration: number; xp: number; color: string }[] = [
  { key: "pomodoro", label: "Pomodoro", duration: 25, xp: 5, color: "text-red-400" },
  { key: "deep-work", label: "Deep Work", duration: 90, xp: 25, color: "text-blue-400" },
  { key: "custom", label: "Свой таймер", duration: 60, xp: 15, color: "text-purple-400" },
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

  const [selectedMode, setSelectedMode] = useState<TimerMode>("pomodoro");
  const [customMinutes, setCustomMinutes] = useState(60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const getModeConfig = useCallback(() => {
    const mode = MODES.find(m => m.key === selectedMode)!;
    const duration = selectedMode === "custom" ? customMinutes : mode.duration;
    return { ...mode, duration, xp: xpForFocus(duration) };
  }, [selectedMode, customMinutes]);

  const resetTimer = useCallback(() => {
    const config = getModeConfig();
    setTimeLeft(config.duration * 60);
    setTotalTime(config.duration * 60);
    setRunning(false);
    setCompleted(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [getModeConfig]);

  useEffect(() => {
    resetTimer();
  }, [selectedMode, customMinutes]);

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
            });
            toast({ title: "Сессия завершена!", description: `Получено +${config.xp} XP` });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

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
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          Фокус таймер
        </h1>

        <div className="flex gap-2 flex-wrap">
          {MODES.map(mode => (
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
              <Label className="text-sm font-display flex-shrink-0">Минут:</Label>
              <Input
                type="number"
                min="1"
                max="180"
                value={customMinutes}
                onChange={e => setCustomMinutes(Math.max(1, Math.min(180, Number(e.target.value))))}
                className="w-24 font-mono"
                data-testid="input-custom-minutes"
              />
              <span className="text-xs text-muted-foreground">XP за сессию: <span className="text-primary font-bold">{xpForFocus(customMinutes)}</span></span>
            </div>
          </Card>
        )}

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
                  Новая сессия
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => setRunning(!running)}
                  className="gap-2 px-8 p5-glow-sm"
                  data-testid={running ? "button-timer-pause" : "button-timer-start"}
                >
                  {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {running ? "Пауза" : "Старт"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span>{config.duration} мин</span>
              <span className="text-primary font-bold">+{config.xp} XP</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-card-border text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-display text-xs text-muted-foreground uppercase tracking-wider">Сессии сегодня</span>
            </div>
            <div className="font-display text-2xl font-bold text-foreground">{todayCount}</div>
          </Card>
          <Card className="p-3 border-card-border text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-display text-xs text-muted-foreground uppercase tracking-wider">XP за фокус</span>
            </div>
            <div className="font-display text-2xl font-bold text-primary">{todayXP}</div>
          </Card>
        </div>

        {state.focusSessions.length > 0 && (
          <Card className="p-4 border-card-border">
            <div className="font-display text-xs uppercase tracking-widest text-muted-foreground mb-3">История сессий</div>
            <div className="space-y-2 max-h-48 overflow-auto">
              {[...state.focusSessions].reverse().slice(0, 10).map(session => (
                <div key={session.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      session.mode === "pomodoro" ? "bg-red-400" :
                      session.mode === "deep-work" ? "bg-blue-400" : "bg-purple-400"
                    }`} />
                    <span className="font-display text-xs text-foreground">
                      {session.mode === "pomodoro" ? "Pomodoro" : session.mode === "deep-work" ? "Deep Work" : "Custom"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{session.duration} мин</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary">+{session.xp} XP</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(session.completedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

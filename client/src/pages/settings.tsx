import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TradingSession {
  name: string;
  start: number;
  end: number;
  enabled: boolean;
}

interface UserSettings {
  utcOffset: number;
  workStart: number;
  workEnd: number;
  restStart: number;
  restEnd: number;
  sleepStart: number;
  sleepEnd: number;
  tradingSessions: TradingSession[];
}

const DEFAULT_SESSIONS: TradingSession[] = [
  { name: "Азия", start: 3, end: 8, enabled: true },
  { name: "Франкфурт", start: 8, end: 9, enabled: true },
  { name: "Лондон", start: 9, end: 14, enabled: true },
  { name: "Нью-Йорк", start: 14, end: 17, enabled: true },
];

const UTC_OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const H = (h: number) => `${String(h).padStart(2, "0")}:00`;

const STATUS_ROWS = [
  { emoji: "😴", key: "sleep",  label: "Сон",     startKey: "sleepStart", endKey: "sleepEnd" },
  { emoji: "💪", key: "work",   label: "Работа",  startKey: "workStart",  endKey: "workEnd"  },
  { emoji: "☕", key: "rest",   label: "Отдых",   startKey: "restStart",  endKey: "restEnd"  },
  { emoji: "🌙", key: "evening",label: "Вечер",   startKey: "restEnd",    endKey: "sleepStart"},
] as const;

function Row({ label, startVal, endVal, onStart, onEnd }: {
  label: string;
  startVal: number;
  endVal: number;
  onStart: (v: number) => void;
  onEnd: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-xs text-muted-foreground w-16 font-display">{label}</span>
      <Select value={String(startVal)} onValueChange={v => onStart(Number(v))}>
        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>{HOURS.map(h => <SelectItem key={h} value={String(h)}>{H(h)}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">—</span>
      <Select value={String(endVal)} onValueChange={v => onEnd(Number(v))}>
        <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>{HOURS.map(h => <SelectItem key={h} value={String(h)}>{H(h)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    utcOffset: 1,
    workStart: 9, workEnd: 18,
    restStart: 18, restEnd: 23,
    sleepStart: 23, sleepEnd: 7,
    tradingSessions: DEFAULT_SESSIONS,
  });

  useEffect(() => {
    fetch("/api/user/settings", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            ...data.settings,
            tradingSessions: data.settings.tradingSessions?.length
              ? data.settings.tradingSessions
              : DEFAULT_SESSIONS,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const setSession = (i: number, field: keyof TradingSession, value: string | number | boolean) => {
    const sessions = [...settings.tradingSessions];
    sessions[i] = { ...sessions[i], [field]: value };
    set("tradingSessions", sessions);
  };

  const addSession = () => {
    set("tradingSessions", [
      ...settings.tradingSessions,
      { name: "Новая", start: 10, end: 12, enabled: true },
    ]);
  };

  const removeSession = (i: number) => {
    set("tradingSessions", settings.tradingSessions.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast({ title: "Сохранено ✓" });
        localStorage.setItem("userSettings", JSON.stringify(settings));
        window.dispatchEvent(new Event("settingsUpdated"));
      } else {
        toast({ title: "Ошибка", variant: "destructive" });
      }
    } catch {
      toast({ title: "Нет соединения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Загрузка...</p>
    </div>
  );

  const { utcOffset } = settings;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-lg mx-auto p-4 space-y-3">

        {/* Заголовок */}
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="font-display text-lg font-bold uppercase tracking-wider">Настройки</h1>
        </div>

        {/* Часовой пояс */}
        <Card className="p-3 border-card-border rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">Часовой пояс</span>
          </div>
          <Select value={String(utcOffset)} onValueChange={v => set("utcOffset", Number(v))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UTC_OFFSETS.map(o => (
                <SelectItem key={o} value={String(o)}>
                  {o >= 0 ? `UTC+${o}` : `UTC${o}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {/* Статусы */}
        <Card className="p-3 border-card-border rounded-2xl">
          <div className="font-display text-xs font-bold uppercase tracking-wider mb-2">Статусы</div>
          <div className="divide-y divide-border/50">
            <Row label="😴 Сон"    startVal={settings.sleepStart} endVal={settings.sleepEnd}
              onStart={v => set("sleepStart", v)} onEnd={v => set("sleepEnd", v)} />
            <Row label="💪 Работа" startVal={settings.workStart}  endVal={settings.workEnd}
              onStart={v => set("workStart", v)}  onEnd={v => set("workEnd", v)} />
            <Row label="☕ Отдых"  startVal={settings.restStart}  endVal={settings.restEnd}
              onStart={v => set("restStart", v)}  onEnd={v => set("restEnd", v)} />
          </div>
        </Card>

        {/* Торговые сессии */}
        <Card className="p-3 border-card-border rounded-2xl">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowSessions(s => !s)}
          >
            <span className="font-display text-xs font-bold uppercase tracking-wider">📈 Торговые сессии</span>
            {showSessions
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showSessions && (
            <div className="mt-3 space-y-2">
              {settings.tradingSessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() => setSession(i, "enabled", !s.enabled)}
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 transition-colors ${
                      s.enabled ? "bg-primary border-primary" : "bg-transparent border-muted-foreground"
                    }`}
                  />
                  <Input
                    value={s.name}
                    onChange={e => setSession(i, "name", e.target.value)}
                    className="h-7 text-xs w-24 flex-shrink-0"
                  />
                  <Select value={String(s.start)} onValueChange={v => setSession(i, "start", Number(v))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{HOURS.map(h => <SelectItem key={h} value={String(h)}>{H(h)}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">—</span>
                  <Select value={String(s.end)} onValueChange={v => setSession(i, "end", Number(v))}>
                    <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{HOURS.map(h => <SelectItem key={h} value={String(h)}>{H(h)}</SelectItem>)}</SelectContent>
                  </Select>
                  <button
                    onClick={() => removeSession(i)}
                    className="text-muted-foreground hover:text-red-400 transition-colors text-xs flex-shrink-0"
                  >✕</button>
                </div>
              ))}
              <button
                onClick={addSession}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-display mt-1"
              >
                + Добавить сессию
              </button>
            </div>
          )}
        </Card>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full font-display uppercase tracking-widest h-10 rounded-full text-xs"
        >
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}

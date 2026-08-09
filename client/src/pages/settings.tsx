import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, Clock, ChevronDown, ChevronUp, Globe, Bot, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

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
  workDays: number[];
  googleReminderMinutes?: number;
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
  const { t, lang, setLang } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWorkSection, setShowWorkSection] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [settings, setSettings] = useState<UserSettings>({
    utcOffset: 1,
    workStart: 9, workEnd: 18,
    restStart: 18, restEnd: 23,
    sleepStart: 23, sleepEnd: 7,
    tradingSessions: DEFAULT_SESSIONS,
    workDays: [1, 2, 3, 4, 5],
  });
  const [telegramStatus, setTelegramStatus] = useState<{ linked: boolean; telegramId: string | null } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalLoading, setGoogleCalLoading] = useState(false);

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
            workDays: data.settings.workDays?.length
              ? data.settings.workDays
              : [1, 2, 3, 4, 5],
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetch("/api/telegram/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.linked === "boolean") {
          setTelegramStatus(data);
        }
      })
      .catch(() => {});

    fetch("/api/auth/google/status", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.connected === "boolean") {
          setGoogleCalendarConnected(data.connected);
        }
      })
      .catch(() => {});

    // Handle postMessage from OAuth popup
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_CALENDAR_CONNECTED") {
        setGoogleCalendarConnected(true);
        setGoogleCalLoading(false);
        toast({ title: lang === "ru" ? "✅ Google Календарь успешно подключен!" : "✅ Google Calendar connected!" });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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
      { name: lang === "ru" ? "Новая" : "New", start: 10, end: 12, enabled: true },
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
        toast({ title: t.settings.saved });
        localStorage.setItem("userSettings", JSON.stringify(settings));
        window.dispatchEvent(new Event("settingsUpdated"));
      } else {
        toast({ title: t.settings.error, variant: "destructive" });
      }
    } catch {
      toast({ title: t.settings.noConn, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTelegramLink = async () => {
    setTelegramLoading(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.link) {
        window.open(data.link, "_blank");
        toast({ title: lang === "ru" ? "Откройте Telegram и нажмите Start" : "Open Telegram and click Start" });
      } else if (data.linked) {
        toast({ title: lang === "ru" ? "Уже привязан" : "Already linked" });
        setTelegramStatus({ linked: true, telegramId: data.telegramId });
      } else {
        toast({ title: lang === "ru" ? "Ошибка генерации ссылки" : "Error generating link", variant: "destructive" });
      }
    } catch {
      toast({ title: t.settings.noConn, variant: "destructive" });
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramUnlink = async () => {
    setTelegramLoading(true);
    try {
      const res = await fetch("/api/telegram/unlink", { method: "DELETE", credentials: "include" });
      if (res.ok) {
        setTelegramStatus({ linked: false, telegramId: null });
        toast({ title: lang === "ru" ? "Аккаунт отвязан" : "Account unlinked" });
      }
    } catch {
      toast({ title: t.settings.noConn, variant: "destructive" });
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleCalLoading(true);
    try {
      const res = await fetch("/api/auth/google/url", { credentials: "include" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "width=520,height=620,left=400,top=100");
      } else {
        toast({ title: lang === "ru" ? "Ошибка получения ссылки" : "Failed to get auth URL", variant: "destructive" });
        setGoogleCalLoading(false);
      }
    } catch {
      toast({ title: lang === "ru" ? "Ошибка подключения" : "Connection error", variant: "destructive" });
      setGoogleCalLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setGoogleCalLoading(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", { method: "POST", credentials: "include" });
      if (res.ok) {
        setGoogleCalendarConnected(false);
        toast({ title: lang === "ru" ? "Google Календарь отключен" : "Google Calendar disconnected" });
      }
    } catch {
      toast({ title: lang === "ru" ? "Ошибка отключения" : "Disconnect error", variant: "destructive" });
    } finally {
      setGoogleCalLoading(false);
    }
  };

  const handleFullSync = async () => {
    setGoogleCalLoading(true);
    try {
      const res = await fetch("/api/calendar/full-sync", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        toast({
          title: lang === "ru"
            ? `✅ Двусторонняя синхронизация завершена (Обновлено: ${data.synced}, Удалено: ${data.deleted})`
            : `✅ 2-Way sync complete (Updated: ${data.synced}, Deleted: ${data.deleted})`,
        });
      } else {
        toast({ title: lang === "ru" ? "Ошибка синхронизации" : "Sync error", variant: "destructive" });
      }
    } catch {
      toast({ title: lang === "ru" ? "Ошибка связи с сервером" : "Server error", variant: "destructive" });
    } finally {
      setGoogleCalLoading(false);
    }
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <p className="text-muted-foreground text-sm">{t.loading}</p>
    </div>
  );

  const { utcOffset } = settings;

  const DAYS = [
    { label: "Пн", day: 1 },
    { label: "Вт", day: 2 },
    { label: "Ср", day: 3 },
    { label: "Чт", day: 4 },
    { label: "Пт", day: 5 },
    { label: "Сб", day: 6 },
    { label: "Вс", day: 0 },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-3">

        {/* Заголовок */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-primary" />
          <h1 className="font-display text-lg font-bold uppercase tracking-wider">{t.settings.title}</h1>
        </div>

        {/* Язык интерфейса */}
        <Card className="p-3 border-card-border rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">{t.settings.language}</span>
          </div>
          <Select value={lang} onValueChange={(v: any) => setLang(v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ru">Русский (RU)</SelectItem>
              <SelectItem value="en">English (EN)</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {/* Часовой пояс */}
        <Card className="p-3 border-card-border rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">{t.settings.timezone}</span>
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

        {/* Рабочие дни и статусы (Сворачиваемый блок) */}
        <Card className="p-3 border-card-border rounded-2xl space-y-3">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowWorkSection(s => !s)}
          >
            <span className="font-display text-xs font-bold uppercase tracking-wider">🗓️ Рабочие дни и статусы</span>
            {showWorkSection
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showWorkSection && (
            <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Выбор рабочих дней */}
              <div className="space-y-1.5">
                <span className="text-xs text-muted-foreground font-display font-medium">Рабочие дни недели:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map(({ label, day }) => {
                    const active = (settings.workDays || [1, 2, 3, 4, 5]).includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const current = settings.workDays || [1, 2, 3, 4, 5];
                          const next = active
                            ? current.filter(d => d !== day)
                            : [...current, day];
                          set("workDays", next);
                        }}
                        className={`px-3 py-1.5 text-xs rounded-xl font-display font-bold transition-all border ${
                          active
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Статусы дня */}
              <div className="space-y-1 border-t border-border/50 pt-3">
                <div className="font-display text-xs font-bold uppercase tracking-wider mb-1 text-muted-foreground">{t.settings.statuses}</div>
                <div className="divide-y divide-border/50">
                  <Row label={`😴 ${t.settings.sleep}`}    startVal={settings.sleepStart} endVal={settings.sleepEnd}
                    onStart={v => set("sleepStart", v)} onEnd={v => set("sleepEnd", v)} />
                  <Row label={`💪 ${t.settings.work}`} startVal={settings.workStart}  endVal={settings.workEnd}
                    onStart={v => set("workStart", v)}  onEnd={v => set("workEnd", v)} />
                  <Row label={`☕ ${t.settings.rest}`}  startVal={settings.restStart}  endVal={settings.restEnd}
                    onStart={v => set("restStart", v)}  onEnd={v => set("restEnd", v)} />
                  <Row label={`🌙 ${t.settings.evening}`}  startVal={settings.restEnd}  endVal={settings.sleepStart}
                    onStart={v => set("restEnd", v)}  onEnd={v => set("sleepStart", v)} />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Торговые сессии (Сворачиваемый блок) */}
        <Card className="p-3 border-card-border rounded-2xl">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowSessions(s => !s)}
          >
            <span className="font-display text-xs font-bold uppercase tracking-wider">📈 {t.settings.tradingSessions}</span>
            {showSessions
              ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
              : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showSessions && (
            <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
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
                {t.settings.addSession}
              </button>
            </div>
          )}
        </Card>

        {/* Telegram Bot */}
        <Card className="p-3 border-card-border rounded-2xl space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              {lang === "ru" ? "Telegram Бот" : "Telegram Bot"}
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "ru" 
                ? "Голосовой ИИ-ассистент: добавляйте задачи, заметки и цели голосовыми сообщениями прямо из Telegram."
                : "Voice AI Assistant: add tasks, notes, and goals via voice messages directly from Telegram."}
            </p>
            
            {telegramStatus?.linked ? (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-emerald-400 font-medium">
                  {lang === "ru" ? "✅ Аккаунт привязан" : "✅ Account linked"}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] uppercase tracking-wider"
                  onClick={handleTelegramUnlink}
                  disabled={telegramLoading}
                >
                  {lang === "ru" ? "Отвязать" : "Unlink"}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full mt-1 h-8 text-xs font-display uppercase tracking-widest bg-[#2AABEE] hover:bg-[#229ED9] text-white"
                onClick={handleTelegramLink}
                disabled={telegramLoading || telegramStatus === null}
              >
                {telegramLoading 
                  ? (lang === "ru" ? "Загрузка..." : "Loading...") 
                  : (lang === "ru" ? "Подключить Telegram" : "Connect Telegram")}
              </Button>
            )}
          </div>
        </Card>

        {/* Google Calendar Integration */}
        <Card className="p-3 border-card-border rounded-2xl space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              {lang === "ru" ? "Google Календарь" : "Google Calendar"}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {lang === "ru"
                ? "Автоматическая синхронизация задач с Google Календарём. Все задачи с датой и временем будут отображаться как события в вашем Google Calendar."
                : "Automatic task sync with Google Calendar. All tasks with date & time will appear as events in your Google Calendar."}
            </p>

            {googleCalendarConnected ? (
              <div className="space-y-3 mt-1 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400 font-medium">
                    {lang === "ru" ? "✅ Календарь подключен" : "✅ Calendar connected"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] uppercase tracking-wider"
                    onClick={handleGoogleDisconnect}
                    disabled={googleCalLoading}
                  >
                    {lang === "ru" ? "Отключить" : "Disconnect"}
                  </Button>
                </div>

                {/* Шаблон напоминания по умолчанию */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-display font-medium">
                    {lang === "ru" ? "🔔 Время напоминания в Google Календаре:" : "🔔 Google Calendar Reminder Time:"}
                  </span>
                  <Select
                    value={String(settings.googleReminderMinutes ?? 30)}
                    onValueChange={v => set("googleReminderMinutes", Number(v))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">⏱️ За 15 минут</SelectItem>
                      <SelectItem value="30">⏱️ За 30 минут (по умолчанию)</SelectItem>
                      <SelectItem value="60">⌛ За 1 час</SelectItem>
                      <SelectItem value="120">⌛ За 2 часа</SelectItem>
                      <SelectItem value="180">⌛ За 3 часа</SelectItem>
                      <SelectItem value="720">🌙 За 12 часов</SelectItem>
                      <SelectItem value="1440">📅 За 1 день</SelectItem>
                      <SelectItem value="2880">📅 За 2 дня</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ручная двусторонняя синхронизация */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-display uppercase tracking-wider gap-1.5"
                  onClick={handleFullSync}
                  disabled={googleCalLoading}
                >
                  🔄 {lang === "ru" ? "Запустить двустороннюю синхронизацию" : "Run 2-Way Sync"}
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="w-full mt-1 h-8 text-xs font-display uppercase tracking-widest bg-[#4285F4] hover:bg-[#3367D6] text-white"
                onClick={handleGoogleConnect}
                disabled={googleCalLoading}
              >
                {googleCalLoading
                  ? (lang === "ru" ? "Загрузка..." : "Loading...")
                  : (lang === "ru" ? "Подключить Google Календарь" : "Connect Google Calendar")}
              </Button>
            )}
          </div>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full font-display uppercase tracking-widest h-10 rounded-full text-xs"
        >
          {saving ? t.settings.saving : t.settings.save}
        </Button>

        {/* Contact Author */}
        <a
          href="https://t.me/TraderJey"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full border border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground font-display text-xs uppercase tracking-widest h-10 rounded-full transition-all hover:bg-primary/5"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current text-primary" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.945-.924c-.64-.203-.652-.64.135-.954l11.57-4.461c.537-.194 1.006.131.964.893z"/>
          </svg>
          {lang === "ru" ? "Связаться с автором" : "Contact Author"}
        </a>
      </div>
    </div>
  );
}

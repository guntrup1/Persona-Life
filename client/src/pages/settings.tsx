import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Clock, Sun, Moon, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserSettings {
  utcOffset: number;
  workStart: number;
  workEnd: number;
  restStart: number;
  restEnd: number;
  sleepStart: number;
  sleepEnd: number;
}

const UTC_OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12);

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    utcOffset: 1,
    workStart: 9,
    workEnd: 18,
    restStart: 18,
    restEnd: 23,
    sleepStart: 23,
    sleepEnd: 7,
  });

  useEffect(() => {
    fetch("/api/user/settings", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        toast({ title: "Настройки сохранены" });
        // Сохраняем в localStorage для мгновенного доступа
        localStorage.setItem("userSettings", JSON.stringify(settings));
        window.dispatchEvent(new Event("settingsUpdated"));
      } else {
        toast({ title: "Ошибка сохранения", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка соединения", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof UserSettings, value: number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground font-display text-sm">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="font-display text-xl font-bold uppercase tracking-wider">Настройки</h1>
        </div>

        {/* UTC */}
        <Card className="p-4 space-y-4 border-card-border rounded-2xl">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-display text-sm font-bold uppercase tracking-wider">Часовой пояс</span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">UTC смещение</Label>
            <Select value={String(settings.utcOffset)} onValueChange={v => set("utcOffset", Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UTC_OFFSETS.map(offset => (
                  <SelectItem key={offset} value={String(offset)}>
                    {offset >= 0 ? `UTC+${offset}` : `UTC${offset}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Рабочее время */}
        <Card className="p-4 space-y-4 border-card-border rounded-2xl">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="font-display text-sm font-bold uppercase tracking-wider">Рабочее время 💪</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Начало</Label>
              <Select value={String(settings.workStart)} onValueChange={v => set("workStart", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Конец</Label>
              <Select value={String(settings.workEnd)} onValueChange={v => set("workEnd", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Отдых */}
        <Card className="p-4 space-y-4 border-card-border rounded-2xl">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-primary" />
            <span className="font-display text-sm font-bold uppercase tracking-wider">Время отдыха ☕</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Начало</Label>
              <Select value={String(settings.restStart)} onValueChange={v => set("restStart", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Конец</Label>
              <Select value={String(settings.restEnd)} onValueChange={v => set("restEnd", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Сон */}
        <Card className="p-4 space-y-4 border-card-border rounded-2xl">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-primary" />
            <span className="font-display text-sm font-bold uppercase tracking-wider">Время сна 😴</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Засыпаю</Label>
              <Select value={String(settings.sleepStart)} onValueChange={v => set("sleepStart", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-display uppercase tracking-wider">Просыпаюсь</Label>
              <Select value={String(settings.sleepEnd)} onValueChange={v => set("sleepEnd", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.map(h => <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Превью статуса */}
        <Card className="p-4 border-card-border rounded-2xl">
          <div className="font-display text-sm font-bold uppercase tracking-wider mb-3">Статусы по времени</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">😴 <span>Сон: {hourLabel(settings.sleepStart)} – {hourLabel(settings.sleepEnd)}</span></div>
            <div className="flex items-center gap-2">🌅 <span>Утро: {hourLabel(settings.sleepEnd)} – {hourLabel(settings.workStart)}</span></div>
            <div className="flex items-center gap-2">💪 <span>Работа: {hourLabel(settings.workStart)} – {hourLabel(settings.workEnd)}</span></div>
            <div className="flex items-center gap-2">☕ <span>Отдых: {hourLabel(settings.restStart)} – {hourLabel(settings.restEnd)}</span></div>
            <div className="flex items-center gap-2">🌙 <span>Вечер: {hourLabel(settings.restEnd)} – {hourLabel(settings.sleepStart)}</span></div>
          </div>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full font-display uppercase tracking-widest h-11 rounded-full">
          {saving ? "Сохраняем..." : "Сохранить настройки"}
        </Button>
      </div>
    </div>
  );
}

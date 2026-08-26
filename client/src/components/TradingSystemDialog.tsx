import { useState } from "react";
import { Plus, X, Clock, Trash2, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EditableChecklist, ChecklistItemData } from "@/components/EditableChecklist";
import { MotionDialogContent, MotionItem, MotionList } from "@/components/motion";
import { useStore, ASSETS, TradeAsset, TradeSession, TimeframeDescription } from "@/lib/store";

const SESSION_PRESETS: { label: string; start: string; end: string }[] = [
  { label: "Азия", start: "02:00", end: "09:00" },
  { label: "Лондон", start: "10:00", end: "13:00" },
  { label: "Нью-Йорк", start: "15:30", end: "18:00" },
];

const TF_OPTIONS = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];

export function TradingSystemDialog({
  systemId,
  asset,
  open,
  onOpenChange,
  readOnly,
}: {
  systemId?: string;
  asset?: TradeAsset;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  readOnly?: boolean;
}) {
  const { state, actions } = useStore();
  const existing = systemId ? state.tradingSystems.find((t) => t.id === systemId) : undefined;
  const isView = !!readOnly;

  const [assetSel, setAssetSel] = useState<TradeAsset>(existing?.asset ?? asset ?? "GER40");
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<"intraday" | "swing">(existing?.type ?? "intraday");
  const [sessions, setSessions] = useState<TradeSession[]>(
    existing?.sessions?.length
      ? existing.sessions
      : type === "swing"
      ? []
      : [
          { id: crypto.randomUUID(), label: "Лондон", start: "10:00", end: "13:00", enabled: true },
          { id: crypto.randomUUID(), label: "Нью-Йорк", start: "15:30", end: "18:00", enabled: true },
        ]
  );
  const [backtestLink, setBacktestLink] = useState(existing?.backtestLink ?? "");
  const [timeframeDescriptions, setTimeframeDescriptions] = useState<TimeframeDescription[]>(
    existing?.timeframeDescriptions?.length
      ? existing.timeframeDescriptions
      : [{ id: crypto.randomUUID(), tf: "1H", description: "", link: "" }]
  );
  const [checklistItems, setChecklistItems] = useState<ChecklistItemData[]>(
    existing?.checklistItems ?? []
  );

  const addSession = (label: string, start: string, end: string) =>
    setSessions((s) => [...s, { id: crypto.randomUUID(), label, start, end, enabled: true }]);
  const updateSession = (id: string, patch: Partial<TradeSession>) =>
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeSession = (id: string) => setSessions((s) => s.filter((x) => x.id !== id));

  const addTf = () =>
    setTimeframeDescriptions((d) => [...d, { id: crypto.randomUUID(), tf: "15m", description: "", link: "" }]);
  const updateTf = (id: string, patch: Partial<TimeframeDescription>) =>
    setTimeframeDescriptions((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeTf = (id: string) => setTimeframeDescriptions((d) => d.filter((x) => x.id !== id));

  const save = () => {
    const payload = {
      asset: assetSel,
      name: name.trim(),
      type,
      sessions,
      backtestLink: backtestLink.trim(),
      timeframeDescriptions,
      checklistItems,
    };
    if (existing) {
      actions.updateTradingSystem(existing.id, payload);
    } else {
      actions.addTradingSystem({ ...payload, id: crypto.randomUUID() } as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
      <MotionDialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {isView ? "Торговая система (просмотр)" : existing ? "Торговая система" : "Новая торговая система"}
            <Badge variant="outline" className="ml-1">{assetSel}</Badge>
          </DialogTitle>
          <DialogDescription>
            {isView
              ? "Просмотр привязанной системы. Редактирование доступно из общей книжки систем."
              : "Опишите систему для актива. Чек-лист будет подставляться в ежедневные биасы этого актива."}
          </DialogDescription>
        </DialogHeader>

        <div className={`space-y-5 py-2 ${isView ? "pointer-events-none select-none opacity-90" : ""}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Актив</Label>
              <Select value={assetSel} onValueChange={(v) => setAssetSel(v as TradeAsset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSETS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Название (необязательно)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. ict лондон" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Тип</Label>
            <div className="flex gap-2">
              {(["intraday", "swing"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={type === t ? "default" : "outline"}
                  onClick={() => setType(t)}
                >
                  {t === "intraday" ? "Внутридневная" : "Свинг"}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Торговые сессии</Label>
              <div className="flex flex-wrap gap-1">
                {SESSION_PRESETS.map((p) => (
                  <Button key={p.label} type="button" size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => addSession(p.label, p.start, p.end)}>
                    <Plus className="h-3 w-3" />{p.label}
                  </Button>
                ))}
              </div>
            </div>
            <MotionList className="space-y-2">
              {sessions.map((s) => (
                <MotionItem key={s.id}>
                  <div className="flex items-center gap-2 rounded-md border border-border p-2">
                    <Input
                      value={s.label}
                      onChange={(e) => updateSession(s.id, { label: e.target.value })}
                      placeholder="Метка"
                      className="h-8 w-28 text-sm"
                    />
                    <Input type="time" value={s.start} onChange={(e) => updateSession(s.id, { start: e.target.value })} className="h-8 w-24 text-sm" />
                    <span className="text-xs text-muted-foreground">—</span>
                    <Input type="time" value={s.end} onChange={(e) => updateSession(s.id, { end: e.target.value })} className="h-8 w-24 text-sm" />
                    <Switch checked={s.enabled} onCheckedChange={(v) => updateSession(s.id, { enabled: v })} />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => removeSession(s.id)}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </MotionItem>
              ))}
            </MotionList>
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground">Нет сессий. Добавьте пресет или опишите свои окна.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Таймфреймы и описание</Label>
            <MotionList className="space-y-2">
              {timeframeDescriptions.map((tf) => (
                <MotionItem key={tf.id}>
                  <div className="flex items-start gap-2 rounded-md border border-border p-2">
                    <Select value={tf.tf} onValueChange={(v) => updateTf(tf.id, { tf: v })}>
                      <SelectTrigger className="h-8 w-20 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TF_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 space-y-1">
                      <Input value={tf.description} onChange={(e) => updateTf(tf.id, { description: e.target.value })}
                        placeholder="Описание входа/условий" className="h-8 text-sm" />
                      <Input value={tf.link} onChange={(e) => updateTf(tf.id, { link: e.target.value })}
                        placeholder="Ссылка на пример (необязательно)" className="h-8 text-sm" />
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => removeTf(tf.id)}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </MotionItem>
              ))}
            </MotionList>
            <Button type="button" size="sm" variant="outline" onClick={addTf}><Plus className="h-3.5 w-3.5" />Добавить ТФ</Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Ссылка на бэктест (необязательно)</Label>
            <Input value={backtestLink} onChange={(e) => setBacktestLink(e.target.value)} placeholder="https://…" />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Чек-лист (подставляется в биасы)</Label>
            <EditableChecklist items={checklistItems} onChange={setChecklistItems} />
          </div>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          {isView ? (
            <span />
          ) : existing ? (
            <Button type="button" variant="ghost" className="text-destructive"
              onClick={() => { actions.deleteTradingSystem(existing.id); onOpenChange(false); }}>
              <Trash2 className="h-3.5 w-3.5" />Удалить
            </Button>
          ) : (<span />)}
          {isView ? (
            <Button type="button" onClick={() => onOpenChange(false)}>Закрыть</Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="button" onClick={save}>Сохранить</Button>
            </div>
          )}
        </DialogFooter>
      </MotionDialogContent>
      </DialogContent>
    </Dialog>
  );
}

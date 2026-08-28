import { useState, type ReactNode } from "react";
import { Plus, X, Clock, Trash2, BookOpen, ExternalLink, Check } from "lucide-react";
import { RemoteImage } from "./remote-image";
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
import { TradingSystemShareCard } from "@/components/ShareSystemCard";
import { useStore, ASSETS, TradeAsset, TradeSession, TimeframeDescription, TradingSystem } from "@/lib/store";

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
  const [holdFrom, setHoldFrom] = useState(existing?.holdFrom ?? "");
  const [holdTo, setHoldTo] = useState(existing?.holdTo ?? "");
  const [breakevenRules, setBreakevenRules] = useState(existing?.breakevenRules ?? "");
  const [skipDayRules, setSkipDayRules] = useState(existing?.skipDayRules ?? "");
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
      holdFrom,
      holdTo,
      breakevenRules: breakevenRules.trim(),
      skipDayRules: skipDayRules.trim(),
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

        {isView && existing ? (
          <TradingSystemShareCard system={existing} />
        ) : (
          <div className="space-y-5 py-2">
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
                  onClick={() => {
                    setType(t);
                    if (t === "swing") {
                      setSessions([]);
                      setHoldFrom("");
                      setHoldTo("");
                    }
                  }}
                >
                  {t === "intraday" ? "Внутридневная" : "Свинг"}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {type !== "swing" ? (
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

              <div className="flex items-center gap-2 pt-1">
                <Label className="flex items-center gap-1.5 text-sm"><Clock className="h-3.5 w-3.5" />Удержание позиции (от — до)</Label>
                <Input type="time" value={holdFrom} onChange={(e) => setHoldFrom(e.target.value)} className="h-8 w-24 text-sm" />
                <span className="text-xs text-muted-foreground">—</span>
                <Input type="time" value={holdTo} onChange={(e) => setHoldTo(e.target.value)} className="h-8 w-24 text-sm" />
              </div>
              <p className="text-xs text-muted-foreground">Время, когда позиция может быть активна, и до которого она должна быть закрыта.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Свинг-система: торговые сессии и удержание позиции не применяются.</p>
          )}

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
            <Label>Условия без убытка</Label>
            <Textarea value={breakevenRules} onChange={(e) => setBreakevenRules(e.target.value)}
              placeholder="Когда и как переводить сделку в безубыток (уровни, правила)…" className="min-h-[64px] text-sm" />
          </div>

          <div className="space-y-2">
            <Label>Условия Skip-day</Label>
            <Textarea value={skipDayRules} onChange={(e) => setSkipDayRules(e.target.value)}
              placeholder="В какие дни/условия не входить в сделку (новости, дни недели)…" className="min-h-[64px] text-sm" />
          </div>

          <Separator />

            <div className="space-y-2">
              <Label>Чек-лист (подставляется в биасы)</Label>
              <EditableChecklist items={checklistItems} onChange={setChecklistItems} />
            </div>
          </div>
        )}

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

function ConditionCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function SystemView({ system }: { system: TradingSystem }) {
  const enabledSessions = system.sessions?.filter((s) => s.enabled) || [];
  const isIntraday = system.type !== "swing";
  return (
    <div className="space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">{system.asset}</span>
        {system.name && <span className="text-sm font-medium text-foreground">{system.name}</span>}
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          {isIntraday ? "Внутридневная" : "Свинг"}
        </span>
      </div>

      {system.backtestLink && (
        <a href={system.backtestLink} target="_blank" rel="noreferrer"
           className="inline-flex items-center gap-1.5 text-sm text-primary underline">
          <ExternalLink className="h-3.5 w-3.5" />Бэктест
        </a>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {isIntraday && enabledSessions.length > 0 && (
          <ConditionCell label="Торговые сессии">
            <div className="flex flex-wrap gap-1.5">
              {enabledSessions.map((s) => (
                <span key={s.id} className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                  {s.label}: {s.start}–{s.end}
                </span>
              ))}
            </div>
          </ConditionCell>
        )}

        {isIntraday && (system.holdFrom || system.holdTo) && (
          <ConditionCell label="Удержание позиции">
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm text-foreground">
              {system.holdFrom || "—"} – {system.holdTo || "—"}
            </span>
          </ConditionCell>
        )}

        <ConditionCell label="Условия без убытка">
          {system.breakevenRules?.trim() ? (
            <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground">{system.breakevenRules}</p>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </ConditionCell>

        <ConditionCell label="Условия Skip-day">
          {system.skipDayRules?.trim() ? (
            <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground">{system.skipDayRules}</p>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </ConditionCell>
      </div>

      {system.timeframeDescriptions?.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Таймфреймы</div>
          {system.timeframeDescriptions.map((tf) => (
            <div key={tf.id} className="rounded-md border border-border p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">{tf.tf}</span>
                {tf.link && (
                  <a href={tf.link} target="_blank" rel="noreferrer"
                     className="inline-flex items-center gap-1 text-xs text-primary underline">
                    <ExternalLink className="h-3 w-3" />Открыть
                  </a>
                )}
              </div>
              {tf.description && <p className="text-sm text-foreground">{tf.description}</p>}
              {tf.link && (
                <a href={tf.link} target="_blank" rel="noreferrer" className="block">
                  <RemoteImage src={tf.link} alt={tf.tf} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {system.checklistItems?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Чек-лист</div>
          <ul className="space-y-1">
            {system.checklistItems.map((it) => (
              <li key={it.id} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 text-primary shrink-0" />
                <span>{it.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

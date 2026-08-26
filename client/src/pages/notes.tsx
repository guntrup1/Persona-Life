import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, ASSETS, type TradeAsset, type NoteTag, type BiasDirection, type ScreenshotEntry, getTodayDate } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonteCarloSimulator } from "@/components/MonteCarloSimulator";
import { RemoteImage } from "@/components/remote-image";
import { ZoomableImage } from "@/components/zoomable-image";
import { BiasChecklistView } from "@/components/BiasChecklistView";
import { TradingSystemsPanel } from "@/components/TradingSystemsPanel";
import { TradingSystemDialog } from "@/components/TradingSystemDialog";
import { FileText, Plus, Trash2, Clock, CandlestickChart, ArrowUpRight, ArrowDownRight, MoveRight, Camera, X, Pencil, Puzzle, CheckCircle, Circle, BookOpen } from "lucide-react";

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
const getTags = (t: any): { value: NoteTag; label: string; color: string }[] => [
  { value: "мысль", label: t.hub.thought, color: "text-blue-400 border-blue-500/30" },
  { value: "идея", label: "Идея", color: "text-green-400 border-green-500/30" },
  { value: "ошибка", label: "Ошибка", color: "text-red-400 border-red-500/30" },
];

const TF_OPTIONS = ["1D", "4H", "H1", "M15"];

const entryList = (b: any): ScreenshotEntry[] =>
  b?.screenshots?.length ? b.screenshots.map((s: ScreenshotEntry) => ({ tf: s.tf, url: s.url }))
    : b?.screenshotUrl ? [{ tf: "1D", url: b.screenshotUrl }]
    : [];

function AddBiasDialog({ onAdd, editBias }: { onAdd: (b: any) => any; editBias?: any }) {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<TradeAsset>(editBias?.asset || "GER40");
  const [direction, setDirection] = useState<BiasDirection>(editBias?.direction || "bullish");
  const [pros, setPros] = useState(editBias?.pros || "");
  const [cons, setCons] = useState(editBias?.cons || "");
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>(() => entryList(editBias));
  const [systemId, setSystemId] = useState<string>(editBias?.systemId || "");
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const { state } = useStore();

  useEffect(() => {
    if (editBias) {
      setAsset(editBias.asset);
      setDirection(editBias.direction);
      setPros(editBias.pros);
      setCons(editBias.cons);
      setSystemId(editBias?.systemId || "");
      setScreenshots(entryList(editBias));
    }
  }, [editBias]);

  const updateShot = (i: number, patch: Partial<ScreenshotEntry>) =>
    setScreenshots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const addShot = () => {
    const used = new Set(screenshots.map(s => s.tf));
    const next = TF_OPTIONS.find(tf => !used.has(tf)) ?? TF_OPTIONS[0];
    setScreenshots(prev => [...prev, { tf: next, url: "" }]);
  };
  const removeShot = (i: number) => setScreenshots(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = screenshots.filter(s => s.url.trim()).map(s => ({ tf: s.tf, url: s.url.trim() }));
    const ok = await onAdd({
      date: editBias?.date || getTodayDate(),
      asset,
      direction,
      pros,
      cons,
      screenshotUrl: undefined,
      screenshots: clean.length ? clean : undefined,
      systemId: systemId || undefined,
    });
    if (ok) {
      toast({ title: editBias ? "✅ BIAS обновлён" : "✅ BIAS сохранён" });
    } else {
      toast({ title: "Не удалось сохранить BIAS", variant: "destructive" });
    }
    if (!editBias) {
      setAsset("GER40");
      setDirection("bullish");
      setPros("");
      setCons("");
      setScreenshots([]);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editBias ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`bias-edit-${editBias.id}`}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1" data-testid="button-add-bias">
            <Plus className="w-3.5 h-3.5" />
            Bias
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editBias ? t.notes.editBias : t.notes.dailyBias}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.notes.asset}</Label>
              <Select value={asset} onValueChange={(v) => setAsset(v as TradeAsset)}>
                <SelectTrigger data-testid="select-bias-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.notes.direction}</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as BiasDirection)}>
                <SelectTrigger data-testid="select-bias-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bullish">Bullish ▲</SelectItem>
                  <SelectItem value="bearish">Bearish ▼</SelectItem>
                  <SelectItem value="neutral">Neutral →</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Торговая система (необязательно)</Label>
            <Select
              value={systemId || "__none__"}
              onValueChange={(v) => {
                if (v === "__none__") { setSystemId(""); return; }
                setSystemId(v);
                const sys = state.tradingSystems.find((t) => t.id === v);
                if (sys) setAsset(sys.asset);
              }}
            >
              <SelectTrigger data-testid="select-bias-system">
                <SelectValue placeholder="Без системы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Без системы</SelectItem>
                {state.tradingSystems.map((sys) => (
                  <SelectItem key={sys.id} value={sys.id}>
                    {sys.asset} · {sys.name || (sys.type === "intraday" ? "Внутридневная" : "Свинг")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Чек-лист из выбранной системы подставится в этот биас.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-green-500">{t.notes.pros}</Label>
            <Textarea
              value={pros}
              onChange={e => setPros(e.target.value)}
              placeholder={t.notes.prosPlaceholder}
              className="min-h-[80px] text-sm"
              data-testid="input-bias-pros"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-red-500">{t.notes.cons}</Label>
            <Textarea
              value={cons}
              onChange={e => setCons(e.target.value)}
              placeholder={t.notes.consPlaceholder}
              className="min-h-[80px] text-sm"
              data-testid="input-bias-cons"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.notes.screenshot}</Label>
            {screenshots.map((s, i) => (
              <div key={i} className="space-y-1.5 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Select value={s.tf} onValueChange={(v) => updateShot(i, { tf: v })}>
                    <SelectTrigger className="w-[76px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TF_OPTIONS.map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="url"
                    value={s.url}
                    onChange={e => updateShot(i, { url: e.target.value })}
                    placeholder={t.notes.screenshotLinkPlaceholder}
                    className="text-sm"
                    data-testid={`input-screenshot-link-${i}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeShot(i)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {s.url && /^https?:\/\/.+/i.test(s.url.trim()) && (
                  <RemoteImage bordered src={s.url.trim()} alt={`Bias screenshot ${s.tf}`} variant="thumb" />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={addShot}
              data-testid="button-add-screenshot"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.notes.addImage}
            </Button>
          </div>

          <Button type="submit" className="w-full" data-testid="button-bias-submit">
            Сохранить Bias
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddNoteDialog({ onAdd, editNote, testId = "button-add-note" }: { onAdd: (n: any) => void; editNote?: any; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(editNote?.title || "");
  const [asset, setAsset] = useState<TradeAsset>(editNote?.asset || "none");
  const [timeframe, setTimeframe] = useState<string>(editNote?.timeframe || "none");
  const [tag, setTag] = useState<NoteTag>(editNote?.tag || "мысль");
  const [text, setText] = useState(editNote?.text || "");
  const [time, setTime] = useState(editNote?.time || new Date().toTimeString().slice(0, 5));
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>(() => entryList(editNote));
  const [isTradingIdea, setIsTradingIdea] = useState(editNote?.isTradingIdea || false);
  const { t, lang } = useI18n();

  useEffect(() => {
    if (editNote) {
      setTitle(editNote.title || "");
      setAsset(editNote.asset);
      setTimeframe(editNote.timeframe);
      setTag(editNote.tag);
      setText(editNote.text);
      setTime(editNote.time);
      setScreenshots(entryList(editNote));
      setIsTradingIdea(editNote.isTradingIdea || false);
    }
  }, [editNote]);

  const updateShot = (i: number, patch: Partial<ScreenshotEntry>) =>
    setScreenshots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const addShot = () => {
    const used = new Set(screenshots.map(s => s.tf));
    const next = TF_OPTIONS.find(tf => !used.has(tf)) ?? TF_OPTIONS[0];
    setScreenshots(prev => [...prev, { tf: next, url: "" }]);
  };
  const removeShot = (i: number) => setScreenshots(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const clean = screenshots.filter(s => s.url.trim()).map(s => ({ tf: s.tf, url: s.url.trim() }));
    onAdd({
      title: title.trim(),
      time,
      asset,
      timeframe,
      tag,
      text: text.trim(),
      screenshotUrl: undefined,
      screenshots: clean.length ? clean : undefined,
      isTradingIdea: tag === "идея" ? isTradingIdea : false,
      date: editNote?.date || getTodayDate(),
    });
    if (!editNote) {
      setTitle("");
      setText("");
      setScreenshots([]);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editNote ? (
          <Button size="icon" variant="ghost" className="h-8 w-8" data-testid={`note-edit-${editNote.id}`}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        ) : (
          <Button size="sm" className="gap-1" data-testid={testId}>
            <Plus className="w-3.5 h-3.5" />
            {t.notes.addNote}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editNote ? t.notes.editNote : t.notes.tradingNotes}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.notes.title}</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t.notes.titlePlaceholder}
              data-testid="input-note-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.notes.asset}</Label>
              <Select value={asset} onValueChange={(v) => setAsset(v as TradeAsset)}>
                <SelectTrigger data-testid="select-note-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.notes.noAsset}</SelectItem>
                  {ASSETS.map(a => a !== "none" ? <SelectItem key={a} value={a}>{a}</SelectItem> : null)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.notes.timeframe}</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.notes.noTf}</SelectItem>
                  {TIMEFRAMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.notes.time}</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                data-testid="input-note-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.notes.tag}</Label>
              <Select value={tag} onValueChange={(v) => setTag(v as NoteTag)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getTags(t).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.notes.noteText}</Label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t.notes.noteTextPlaceholder}
              className="min-h-[120px]"
              data-testid="input-note-text"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t.notes.screenshot}</Label>
            {screenshots.map((s, i) => (
              <div key={i} className="space-y-1.5 p-2 rounded-lg border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <Select value={s.tf} onValueChange={(v) => updateShot(i, { tf: v })}>
                    <SelectTrigger className="w-[76px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TF_OPTIONS.map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="url"
                    value={s.url}
                    onChange={e => updateShot(i, { url: e.target.value })}
                    placeholder={t.notes.screenshotLinkPlaceholder}
                    className="text-sm"
                    data-testid={`input-note-screenshot-link-${i}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeShot(i)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {s.url && /^https?:\/\/.+/i.test(s.url.trim()) && (
                  <RemoteImage bordered src={s.url.trim()} alt={`Note screenshot ${s.tf}`} variant="thumb" />
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={addShot}
              data-testid="button-note-add-screenshot"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.notes.addImage}
            </Button>
          </div>

          {tag === "идея" && (
            <div className="flex items-center justify-between py-1">
              <div className="space-y-0.5">
                <Label htmlFor="trading-idea-toggle" className="text-yellow-400 flex items-center gap-1">
                  <Puzzle className="w-3.5 h-3.5" />
                  Торговая идея
                </Label>
                <div className="text-[10px] text-muted-foreground">{t.notes.tradingIdeaDesc}</div>
              </div>
              <Switch
                id="trading-idea-toggle"
                checked={isTradingIdea}
                onCheckedChange={setIsTradingIdea}
                data-testid="switch-trading-idea"
              />
            </div>
          )}

          <Button type="submit" className="w-full" data-testid="button-note-submit">
            Сохранить заметку
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function NotesPage() {
  const { state, actions, todayBiases } = useStore();
  const { t, lang } = useI18n();
  const [mainTab, setMainTab] = useState("journal");
  const [filterAsset, setFilterAsset] = useState<TradeAsset | "all">("all");
  const [filterTag, setFilterTag] = useState<NoteTag | "all">("all");
  const [filterPeriod, setFilterPeriod] = useState<"today" | "week" | "month" | "all">("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editor, setEditor] = useState<{ systemId?: string; asset?: TradeAsset; readOnly?: boolean } | null>(null);

  const today = getTodayDate();

  const localDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getFilterDates = () => {
    if (filterPeriod === "today") return [today];
    if (filterPeriod === "week") {
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(localDateStr(d));
      }
      return dates;
    }
    if (filterPeriod === "month") {
      const dates = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(localDateStr(d));
      }
      return dates;
    }
    return null;
  };

  const filteredNotes = [...state.tradingNotes]
    .reverse()
    .filter(note => {
      if (note.isTradingIdea) return false;
      if (filterAsset !== "all" && note.asset !== filterAsset) return false;
      if (filterTag !== "all" && note.tag !== filterTag) return false;
      const dates = getFilterDates();
      if (dates && !dates.includes(note.date)) return false;
      return true;
    });

  const tagInfo = (tag: NoteTag) => getTags(t).find(t => t.value === tag)!;

  const directionBadge = (dir: BiasDirection) => {
    switch (dir) {
      case "bullish": return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1">Bullish <ArrowUpRight className="w-3 h-3" /></Badge>;
      case "bearish": return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1">Bearish <ArrowDownRight className="w-3 h-3" /></Badge>;
      default: return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 gap-1">Neutral <MoveRight className="w-3 h-3" /></Badge>;
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="w-full bg-black/40 border border-white/5 mb-6">
            <TabsTrigger value="journal" className="flex-1">{t.simulator?.tabJournal || "Дневник сделок"}</TabsTrigger>
            <TabsTrigger value="simulator" className="flex-1">{t.simulator?.tabSimulator || "Симулятор исторических данных"}</TabsTrigger>
          </TabsList>
          <TabsContent value="journal" className="space-y-6 m-0">
        {/* Daily Bias Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <CandlestickChart className="w-5 h-5 text-primary" />
              {t.notes.dailyBias.toUpperCase()}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPanelOpen(true)}>
                <BookOpen className="w-3.5 h-3.5" />Системы
              </Button>
              <AddBiasDialog onAdd={actions.addDailyBias} />
            </div>
          </div>

          {todayBiases.length === 0 ? (
            <Card className="p-6 text-center border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">{t.notes.noBiasToday}</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todayBiases.map(bias => (
                <Card key={bias.id} className="p-4 border-card-border space-y-3 hover-elevate group" data-testid={`bias-${bias.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm font-bold border-primary/30 text-primary">
                        {bias.asset}
                      </Badge>
                      {bias.systemId && state.tradingSystems.find((t) => t.id === bias.systemId) && (
                        <Badge variant="secondary" className="text-xs">
                          {state.tradingSystems.find((t) => t.id === bias.systemId)!.name || "система"}
                        </Badge>
                      )}
                      {directionBadge(bias.direction)}
                    </div>
                    <div className="flex items-center gap-1">
                      {bias.systemId && state.tradingSystems.find((t) => t.id === bias.systemId) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setEditor({ systemId: bias.systemId, readOnly: true })}
                          aria-label="Просмотр торговой системы"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <AddBiasDialog
                        onAdd={(updates) => actions.updateDailyBias(bias.id, updates)}
                        editBias={bias}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => actions.deleteDailyBias(bias.id)}
                        data-testid={`bias-delete-${bias.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-green-500 uppercase tracking-tight">Pros</span>
                      <p className="text-muted-foreground line-clamp-3">{bias.pros || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="font-bold text-red-500 uppercase tracking-tight">Cons</span>
                      <p className="text-muted-foreground line-clamp-3">{bias.cons || "—"}</p>
                    </div>
                  </div>

                  {(() => {
                    const shots = bias.screenshots?.length ? bias.screenshots : (bias.screenshotUrl ? [{ tf: "1D", url: bias.screenshotUrl }] : []);
                    if (!shots.length) return null;
                    return (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                        {shots.map((s, i) => (
                          <Dialog key={i}>
                            <DialogTrigger asChild>
                              <div className="relative aspect-video cursor-pointer group/thumb overflow-hidden rounded-md border border-border">
                                {s.tf && (
                                  <span className="absolute top-1 left-1 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white/90 border border-white/10">
                                    {s.tf}
                                  </span>
                                )}
                                <RemoteImage bordered={false} src={s.url} alt={`Bias screenshot ${s.tf}`} variant="thumb" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                  <Camera className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-transparent">
                              <ZoomableImage src={s.url} alt={`Bias screenshot ${s.tf}`} />
                            </DialogContent>
                          </Dialog>
                        ))}
                      </div>
                    );
                  })()}
                  <BiasChecklistView biasId={bias.id} date={bias.date} />
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t.notes.tradingNotes.toUpperCase()}
          </h2>
          <AddNoteDialog onAdd={actions.addTradingNote} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterPeriod} onValueChange={(v: any) => setFilterPeriod(v)}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.notes.all}</SelectItem>
              <SelectItem value="today">{t.notes.today}</SelectItem>
              <SelectItem value="week">{t.notes.week}</SelectItem>
              <SelectItem value="month">{t.notes.month}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAsset} onValueChange={(v: any) => setFilterAsset(v)}>
            <SelectTrigger className="w-28" data-testid="select-filter-asset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.notes.allAssets}</SelectItem>
              {ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterTag} onValueChange={(v: any) => setFilterTag(v)}>
            <SelectTrigger className="w-28" data-testid="select-filter-tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.notes.allTags}</SelectItem>
              {getTags(t).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground font-mono ml-auto">{filteredNotes.length}  {t.notes.notesCount}</span>
        </div>

        {filteredNotes.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-border">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-display text-sm text-muted-foreground">Нет торговых  {t.notes.notesCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.notes.noNotesDesc}</p>
            <div className="mt-4">
              <AddNoteDialog onAdd={actions.addTradingNote} testId="button-add-note-empty" />
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map(note => {
              const tag = tagInfo(note.tag);
              return (
                <Card key={note.id} className="p-4 border-card-border hover-elevate" data-testid={`note-${note.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                          {note.asset && note.asset !== "none" ? note.asset : "—"}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                          {note.timeframe && note.timeframe !== "none" ? note.timeframe : "—"}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${tag.color}`}>
                          {tag.label}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="w-3 h-3" />
                           <span className="font-mono">{note.time || "—"}</span>
                          <span className="font-mono">·</span>
                          <span className="font-mono">
                            {new Date(note.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      </div>
                      {note.title && (
                        <h3 className="text-sm font-bold text-foreground mb-1">{note.title}</h3>
                      )}
                      <p className="text-sm text-foreground leading-relaxed">{note.text}</p>
                      {(() => {
                        const shots = note.screenshots?.length ? note.screenshots : (note.screenshotUrl ? [{ tf: "1D", url: note.screenshotUrl }] : []);
                        if (!shots.length) return null;
                        return (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                            {shots.map((s, i) => (
                              <Dialog key={i}>
                                <DialogTrigger asChild>
                                  <div className="relative aspect-video cursor-pointer group/thumb overflow-hidden rounded-md border border-border">
                                    {s.tf && (
                                      <span className="absolute top-1 left-1 z-10 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/70 text-white/90 border border-white/10">
                                        {s.tf}
                                      </span>
                                    )}
                                    <RemoteImage bordered={false} src={s.url} alt={`Note screenshot ${s.tf}`} variant="thumb" />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity pointer-events-none">
                                      <Camera className="w-5 h-5 text-white" />
                                    </div>
                                  </div>
                                </DialogTrigger>
                                <DialogContent className="max-w-5xl p-0 overflow-hidden border-none bg-transparent">
                                  <ZoomableImage src={s.url} alt={`Note screenshot ${s.tf}`} />
                                </DialogContent>
                              </Dialog>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      <AddNoteDialog
                        onAdd={(updates) => actions.updateTradingNote(note.id, updates)}
                        editNote={note}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`note-delete-${note.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t.notes.deleteNoteQ}</AlertDialogTitle>
                            <AlertDialogDescription>{t.notes.deleteNoteDesc}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t.notes.cancel}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => actions.deleteTradingNote(note.id)}>{t.notes.delete}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Trading Ideas Section */}
        <TradingIdeasSection />
          </TabsContent>
          <TabsContent value="simulator" className="m-0">
            <MonteCarloSimulator />
          </TabsContent>
        </Tabs>

        <TradingSystemsPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          onEdit={(e) => { setPanelOpen(false); setEditor(e); }}
        />
        {editor && (
          <TradingSystemDialog
            key={editor.systemId || editor.asset || "new"}
            systemId={editor.systemId}
            asset={editor.asset}
            readOnly={editor.readOnly}
            open={!!editor}
            onOpenChange={(o) => { if (!o) setEditor(null); }}
          />
        )}
      </div>
    </div>
  );
}

function TradingIdeasSection() {
  const { state, actions } = useStore();
  const { t, lang } = useI18n();
  const [showDone, setShowDone] = useState(false);

  const tradingIdeas = state.tradingNotes
    .filter(n => n.isTradingIdea)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const activeIdeas = tradingIdeas.filter(n => !n.tradingIdeaDone);
  const doneIdeas = tradingIdeas.filter(n => n.tradingIdeaDone);
  const displayedIdeas = showDone ? tradingIdeas : activeIdeas;

  if (tradingIdeas.length === 0) return null;

  return (
    <section className="space-y-3 pt-4 border-t border-border">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Puzzle className="w-5 h-5 text-yellow-400" />
          {t.notes.tradingIdeas || 'Торговые идеи'}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {activeIdeas.length} {t.notes.active}{doneIdeas.length > 0 && ` · ${doneIdeas.length} {t.notes.completedCount}`}
          </span>
          {doneIdeas.length > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showDone}
                onChange={e => setShowDone(e.target.checked)}
                className="accent-green-500"
                data-testid="checkbox-show-done-ideas"
              />
              <span className="text-xs text-muted-foreground">{t.notes.completed}</span>
            </label>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {displayedIdeas.map(idea => (
          <Card
            key={idea.id}
            className={`p-3 border-card-border hover-elevate group ${idea.tradingIdeaDone ? "opacity-60" : ""}`}
            data-testid={`trading-idea-${idea.id}`}
          >
            <div className="flex items-start gap-3">
              <button
                className="flex-shrink-0 mt-0.5"
                onClick={() => actions.updateTradingNote(idea.id, { tradingIdeaDone: !idea.tradingIdeaDone })}
                data-testid={`trading-idea-toggle-${idea.id}`}
              >
                {idea.tradingIdeaDone ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Circle className="w-5 h-5 text-yellow-400" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className="text-xs font-mono font-bold text-primary border-primary/30">
                    {idea.asset && idea.asset !== "none" ? idea.asset : "—"}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                    {idea.timeframe && idea.timeframe !== "none" ? idea.timeframe : "—"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {idea.time || "—"} · {new Date(idea.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: "2-digit", month: "short" })}
                  </span>
                </div>
                {idea.title && (
                  <h3 className={`text-sm font-bold mb-0.5 ${idea.tradingIdeaDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {idea.title}
                  </h3>
                )}
                <p className={`text-sm leading-relaxed ${idea.tradingIdeaDone ? "text-muted-foreground" : "text-foreground"}`}>
                  {idea.text}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <AddNoteDialog
                  onAdd={(updates) => actions.updateTradingNote(idea.id, updates)}
                  editNote={idea}
                  testId={`trading-idea-edit-${idea.id}`}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`trading-idea-delete-${idea.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.notes.deleteNoteQ}</AlertDialogTitle>
                      <AlertDialogDescription>{t.notes.deleteNoteDesc}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.notes.cancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => actions.deleteTradingNote(idea.id)}>{t.notes.delete}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

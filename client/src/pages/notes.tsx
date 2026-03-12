import { useState, useRef, useEffect } from "react";
import { useStore, type TradeAsset, type NoteTag, type BiasDirection, getTodayDate, compressImage } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { FileText, Plus, Trash2, Clock, TrendingUp, ArrowUpRight, ArrowDownRight, MoveRight, Camera, X, Pencil, Lightbulb, CheckCircle, Circle } from "lucide-react";

const ASSETS: TradeAsset[] = ["GER40", "EUR", "XAU", "GBP"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
const TAGS: { value: NoteTag; label: string; color: string }[] = [
  { value: "мысль", label: "Мысль", color: "text-blue-400 border-blue-500/30" },
  { value: "идея", label: "Идея", color: "text-green-400 border-green-500/30" },
  { value: "ошибка", label: "Ошибка", color: "text-red-400 border-red-500/30" },
];

function AddBiasDialog({ onAdd, editBias }: { onAdd: (b: any) => void; editBias?: any }) {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<TradeAsset>(editBias?.asset || "GER40");
  const [direction, setDirection] = useState<BiasDirection>(editBias?.direction || "bullish");
  const [pros, setPros] = useState(editBias?.pros || "");
  const [cons, setCons] = useState(editBias?.cons || "");
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(editBias?.screenshotUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editBias) {
      setAsset(editBias.asset);
      setDirection(editBias.direction);
      setPros(editBias.pros);
      setCons(editBias.cons);
      setScreenshotUrl(editBias.screenshotUrl);
    }
  }, [editBias]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setScreenshotUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      date: editBias?.date || getTodayDate(),
      asset,
      direction,
      pros,
      cons,
      screenshotUrl,
    });
    if (!editBias) {
      setAsset("GER40");
      setDirection("bullish");
      setPros("");
      setCons("");
      setScreenshotUrl(undefined);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editBias ? "Редактировать BIAS" : "Дневной BIAS"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Актив</Label>
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
              <Label>Направление</Label>
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
            <Label className="text-green-500">Аргументы ЗА (Pros)</Label>
            <Textarea
              value={pros}
              onChange={e => setPros(e.target.value)}
              placeholder="Почему лонг? Факторы, уровни..."
              className="min-h-[80px] text-sm"
              data-testid="input-bias-pros"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-red-500">Аргументы ПРОТИВ (Cons)</Label>
            <Textarea
              value={cons}
              onChange={e => setCons(e.target.value)}
              placeholder="Риски, контр-аргументы..."
              className="min-h-[80px] text-sm"
              data-testid="input-bias-cons"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Скриншот (опционально)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-screenshot"
              >
                <Camera className="w-4 h-4" />
                {screenshotUrl ? "Изменить скриншот" : "Загрузить скриншот"}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              {screenshotUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setScreenshotUrl(undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {screenshotUrl && (
              <div className="mt-2 rounded-md overflow-hidden border border-border aspect-video relative">
                <img src={screenshotUrl} alt="Bias screenshot" className="object-cover w-full h-full" />
              </div>
            )}
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
  const [asset, setAsset] = useState<TradeAsset>(editNote?.asset || "GER40");
  const [timeframe, setTimeframe] = useState(editNote?.timeframe || "H1");
  const [tag, setTag] = useState<NoteTag>(editNote?.tag || "мысль");
  const [text, setText] = useState(editNote?.text || "");
  const [time, setTime] = useState(editNote?.time || new Date().toTimeString().slice(0, 5));
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(editNote?.screenshotUrl);
  const [isTradingIdea, setIsTradingIdea] = useState(editNote?.isTradingIdea || false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editNote) {
      setTitle(editNote.title || "");
      setAsset(editNote.asset);
      setTimeframe(editNote.timeframe);
      setTag(editNote.tag);
      setText(editNote.text);
      setTime(editNote.time);
      setScreenshotUrl(editNote.screenshotUrl);
      setIsTradingIdea(editNote.isTradingIdea || false);
    }
  }, [editNote]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setScreenshotUrl(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({
      title: title.trim(),
      time,
      asset,
      timeframe,
      tag,
      text: text.trim(),
      screenshotUrl,
      isTradingIdea: tag === "идея" ? isTradingIdea : false,
      date: editNote?.date || getTodayDate(),
    });
    if (!editNote) {
      setTitle("");
      setText("");
      setScreenshotUrl(undefined);
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
            Добавить заметку
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{editNote ? "Редактировать заметку" : "Торговая заметка"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Заголовок</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Напр: Ложный пробой уровня..."
              data-testid="input-note-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Актив</Label>
              <Select value={asset} onValueChange={(v) => setAsset(v as TradeAsset)}>
                <SelectTrigger data-testid="select-note-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Таймфрейм</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Время</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                data-testid="input-note-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Тег</Label>
              <Select value={tag} onValueChange={(v) => setTag(v as NoteTag)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAGS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Текст заметки</Label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Мысли по рынку, наблюдения, анализ..."
              className="min-h-[120px]"
              data-testid="input-note-text"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Скриншот (опционально)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-note-upload-screenshot"
              >
                <Camera className="w-4 h-4" />
                {screenshotUrl ? "Изменить скриншот" : "Загрузить скриншот"}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              {screenshotUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setScreenshotUrl(undefined)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {screenshotUrl && (
              <div className="mt-2 rounded-md overflow-hidden border border-border aspect-video relative">
                <img src={screenshotUrl} alt="Note screenshot" className="object-cover w-full h-full" />
              </div>
            )}
          </div>

          {tag === "идея" && (
            <div className="flex items-center justify-between py-1">
              <div className="space-y-0.5">
                <Label htmlFor="trading-idea-toggle" className="text-yellow-400 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Торговая идея
                </Label>
                <div className="text-[10px] text-muted-foreground">Сохранить в список торговых идей</div>
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
  const [filterAsset, setFilterAsset] = useState<TradeAsset | "all">("all");
  const [filterTag, setFilterTag] = useState<NoteTag | "all">("all");
  const [filterPeriod, setFilterPeriod] = useState<"today" | "week" | "month" | "all">("all");

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
      if (filterAsset !== "all" && note.asset !== filterAsset) return false;
      if (filterTag !== "all" && note.tag !== filterTag) return false;
      const dates = getFilterDates();
      if (dates && !dates.includes(note.date)) return false;
      return true;
    });

  const tagInfo = (tag: NoteTag) => TAGS.find(t => t.value === tag)!;

  const directionBadge = (dir: BiasDirection) => {
    switch (dir) {
      case "bullish": return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 gap-1">Bullish <ArrowUpRight className="w-3 h-3" /></Badge>;
      case "bearish": return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 gap-1">Bearish <ArrowDownRight className="w-3 h-3" /></Badge>;
      default: return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 gap-1">Neutral <MoveRight className="w-3 h-3" /></Badge>;
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Daily Bias Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Дневной BIAS
            </h2>
            <AddBiasDialog onAdd={actions.addDailyBias} />
          </div>

          {todayBiases.length === 0 ? (
            <Card className="p-6 text-center border-dashed border-border bg-muted/30">
              <p className="text-sm text-muted-foreground">На сегодня BIAS не определен</p>
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
                      {directionBadge(bias.direction)}
                    </div>
                    <div className="flex items-center gap-1">
                      {bias.date === today && (
                        <AddBiasDialog
                          onAdd={(updates) => actions.updateDailyBias(bias.id, updates)}
                          editBias={bias}
                        />
                      )}
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

                  {bias.screenshotUrl && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <div className="cursor-pointer rounded-md overflow-hidden border border-border aspect-video mt-2 relative hover:opacity-90 transition-opacity">
                          <img src={bias.screenshotUrl} alt="Bias screenshot" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-transparent">
                        <img src={bias.screenshotUrl} alt="Bias screenshot" className="w-full h-auto" />
                      </DialogContent>
                    </Dialog>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
          <h2 className="font-display text-lg font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Торговые заметки
          </h2>
          <AddNoteDialog onAdd={actions.addTradingNote} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterPeriod} onValueChange={(v: any) => setFilterPeriod(v)}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterAsset} onValueChange={(v: any) => setFilterAsset(v)}>
            <SelectTrigger className="w-28" data-testid="select-filter-asset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все активы</SelectItem>
              {ASSETS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterTag} onValueChange={(v: any) => setFilterTag(v)}>
            <SelectTrigger className="w-28" data-testid="select-filter-tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все теги</SelectItem>
              {TAGS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground font-mono ml-auto">{filteredNotes.length} заметок</span>
        </div>

        {filteredNotes.length === 0 ? (
          <Card className="p-10 text-center border-dashed border-border">
            <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-display text-sm text-muted-foreground">Нет торговых заметок</p>
            <p className="text-xs text-muted-foreground mt-1">Добавь наблюдения и мысли по рынку</p>
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
                          {note.asset}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                          {note.timeframe}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${tag.color}`}>
                          {tag.label}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="w-3 h-3" />
                          <span className="font-mono">{note.time}</span>
                          <span className="font-mono">·</span>
                          <span className="font-mono">
                            {new Date(note.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                          </span>
                        </div>
                      </div>
                      {note.title && (
                        <h3 className="text-sm font-bold text-foreground mb-1">{note.title}</h3>
                      )}
                      <p className="text-sm text-foreground leading-relaxed">{note.text}</p>
                      {note.screenshotUrl && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="cursor-pointer rounded-md overflow-hidden border border-border aspect-video mt-3 relative hover:opacity-90 transition-opacity w-48">
                              <img src={note.screenshotUrl} alt="Note screenshot" className="object-cover w-full h-full" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                                <Camera className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-transparent">
                            <img src={note.screenshotUrl} alt="Note screenshot" className="w-full h-auto" />
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {note.date === today && (
                        <AddNoteDialog
                          onAdd={(updates) => actions.updateTradingNote(note.id, updates)}
                          editNote={note}
                        />
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="flex-shrink-0" data-testid={`note-delete-${note.id}`}>
                            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
                            <AlertDialogDescription>Эта заметка будет удалена навсегда.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => actions.deleteTradingNote(note.id)}>Удалить</AlertDialogAction>
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
      </div>
    </div>
  );
}

function TradingIdeasSection() {
  const { state, actions } = useStore();
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
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          Торговые идеи
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-mono">
            {activeIdeas.length} активных{doneIdeas.length > 0 && ` · ${doneIdeas.length} выполнено`}
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
              <span className="text-xs text-muted-foreground">Выполненные</span>
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
                    {idea.asset}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                    {idea.timeframe}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {idea.time} · {new Date(idea.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
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
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

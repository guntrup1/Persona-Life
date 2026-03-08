import { useState } from "react";
import { useStore, type TradeAsset, type NoteTag } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { FileText, Plus, Trash2, Clock, Tag, TrendingUp } from "lucide-react";
import { getTodayDate } from "@/lib/store";

const ASSETS: TradeAsset[] = ["GER40", "EUR", "XAU", "GBP"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1"];
const TAGS: { value: NoteTag; label: string; color: string }[] = [
  { value: "мысль", label: "Мысль", color: "text-blue-400 border-blue-500/30" },
  { value: "идея", label: "Идея", color: "text-green-400 border-green-500/30" },
  { value: "ошибка", label: "Ошибка", color: "text-red-400 border-red-500/30" },
];

function AddNoteDialog({ onAdd, testId = "button-add-note" }: { onAdd: (n: any) => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [asset, setAsset] = useState<TradeAsset>("GER40");
  const [timeframe, setTimeframe] = useState("H1");
  const [tag, setTag] = useState<NoteTag>("мысль");
  const [text, setText] = useState("");
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({
      time,
      asset,
      timeframe,
      tag,
      text: text.trim(),
      date: getTodayDate(),
    });
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1" data-testid={testId}>
          <Plus className="w-3 h-3" />
          Добавить заметку
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Торговая заметка</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <Button type="submit" className="w-full" data-testid="button-note-submit">
            Сохранить заметку
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function NotesPage() {
  const { state, actions } = useStore();
  const [filterAsset, setFilterAsset] = useState<TradeAsset | "all">("all");
  const [filterTag, setFilterTag] = useState<NoteTag | "all">("all");
  const [filterPeriod, setFilterPeriod] = useState<"today" | "week" | "month" | "all">("all");

  const today = getTodayDate();

  const getFilterDates = () => {
    if (filterPeriod === "today") return [today];
    if (filterPeriod === "week") {
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }
      return dates;
    }
    if (filterPeriod === "month") {
      const dates = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Торговые заметки
          </h1>
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
                      <p className="text-sm text-foreground leading-relaxed">{note.text}</p>
                    </div>
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
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

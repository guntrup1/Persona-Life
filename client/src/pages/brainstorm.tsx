import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Brain, Loader2, ArrowRight, Save, Copy, Trash2,
  Calendar, ChevronLeft, ChevronRight, Lightbulb, ListChecks, FileText
} from "lucide-react";
import { useStore, getTodayDate } from "@/lib/store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrainstormSession {
  _id: string;
  theme: string;
  prompt: string;
  keyInsights: string[];
  actionPlan: Array<{ step: number; task: string }>;
  newIdeas: string[];
  createdAt: string;
  sourceNoteIds: any[];
}

interface ProcessedNote {
  _id: string;
  executive_summary: string;
  raw_transcript: string;
  semantic_tags: string[];
  status: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getDateKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BrainstormCard({
  session,
  onExportIdea,
  onCopy,
  onDelete,
}: {
  session: BrainstormSession;
  onExportIdea: (idea: string) => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="p-5 rounded-2xl border-border/60 bg-gradient-to-br from-card to-card/60 space-y-5 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-base text-primary leading-tight mb-1">{session.theme}</h3>
          {session.prompt && (
            <p className="text-xs text-muted-foreground italic truncate">"{session.prompt}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {new Date(session.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить сессию?</AlertDialogTitle>
                <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(session._id)} className="bg-destructive hover:bg-destructive/90">
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Insights */}
        {session.keyInsights?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground/70 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Инсайты
            </h4>
            <ul className="space-y-1.5">
              {session.keyInsights.map((ins, i) => (
                <li key={i} className="text-sm text-muted-foreground bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 leading-relaxed">
                  {ins}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Plan */}
        {session.actionPlan?.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-foreground/70 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <ListChecks className="w-3.5 h-3.5 text-emerald-500" /> План действий
            </h4>
            <div className="space-y-1.5">
              {session.actionPlan.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[9px] font-bold mt-0.5 flex-shrink-0">
                    {step.step || i + 1}
                  </div>
                  <span className="text-sm text-muted-foreground leading-relaxed">{step.task}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Ideas */}
        {session.newIdeas?.length > 0 && (
          <div className="md:col-span-2">
            <h4 className="text-xs font-semibold text-foreground/70 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Lightbulb className="w-3.5 h-3.5 text-purple-500" /> Новые идеи
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {session.newIdeas.map((idea, i) => (
                <div key={i} className="group/idea relative bg-purple-500/5 border border-purple-500/15 rounded-lg p-3 hover:border-purple-500/40 transition-colors">
                  <p className="text-sm text-muted-foreground leading-relaxed pr-14">{idea}</p>
                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover/idea:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopy(idea)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-500 hover:text-emerald-400"
                      onClick={() => onExportIdea(idea)}
                      title="Сохранить в Идеи"
                    >
                      <Save className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BrainstormPage() {
  const { toast } = useToast();
  const { actions } = useStore();

  // Notes for selector
  const [notes, setNotes] = useState<ProcessedNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());

  // Generator
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Dashboard
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Day selector
  const allDates = Array.from(
    new Set(sessions.map(s => getDateKey(s.createdAt)))
  ).sort().reverse();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Select first date when sessions load
  useEffect(() => {
    if (allDates.length > 0 && !selectedDate) {
      setSelectedDate(allDates[0]);
    }
  }, [allDates.length]);

  const sessionsForDay = sessions.filter(
    s => getDateKey(s.createdAt) === selectedDate
  );

  // ── Load notes ──
  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch("/api/processed-audios");
      const data = await res.json();
      if (data.audios) setNotes(data.audios);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  // ── Load sessions ──
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/brainstorms");
      const data = await res.json();
      if (data.brainstorms) setSessions(data.brainstorms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadSessions();
  }, []);

  const toggleNote = (id: string) => {
    const newSet = new Set(selectedNotes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedNotes(newSet);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (selectedNotes.size === 0) {
      toast({ title: "Выберите хотя бы одну заметку", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      const res = await fetch("/api/brainstorms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: Array.from(selectedNotes), prompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");

      toast({ title: "✅ Брейн-шторм завершен!" });
      setSelectedNotes(new Set());
      setPrompt("");

      // Refresh sessions and switch to dashboard
      await loadSessions();
      setActiveTab("dashboard");

      // Auto-select today
      const todayKey = getDateKey(data.session.createdAt);
      setSelectedDate(todayKey);

    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Export idea ──
  const handleExportIdea = (idea: string) => {
    actions.addDayNote(getTodayDate(), idea, "idea", "Brainstorm Idea");
    toast({ title: "💡 Идея сохранена в раздел Идеи!" });
  };

  // ── Copy ──
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  // ── Delete session ──
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/brainstorms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Ошибка удаления");
      setSessions(prev => prev.filter(s => s._id !== id));
      toast({ title: "Сессия удалена" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1280px] mx-auto space-y-6">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Brainstorm</h1>
          <p className="text-sm text-muted-foreground">Генерация идей на основе голосовых заметок</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="dashboard" className="gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5" /> Дашборд
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2 text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Новый брейн-шторм
          </TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD TAB ── */}
        <TabsContent value="dashboard" className="mt-4">
          {loadingSessions ? (
            <div className="flex justify-center items-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Brain className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p className="font-display font-semibold text-foreground/70 mb-1">Нет брейн-штормов</p>
                <p className="text-sm text-muted-foreground">Перейдите во вкладку "Новый брейн-шторм" чтобы начать</p>
              </div>
              <Button onClick={() => setActiveTab("generate")} className="gap-2">
                <Sparkles className="w-4 h-4" /> Создать первый
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Left: Day selector */}
              <div className="lg:col-span-1">
                <Card className="p-3 rounded-2xl border-border/60 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">По дням</p>
                  {allDates.map(dateKey => {
                    const count = sessions.filter(s => getDateKey(s.createdAt) === dateKey).length;
                    const isSelected = dateKey === selectedDate;
                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDate(dateKey)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between group ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30 text-primary"
                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          {new Date(dateKey).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-4 px-1.5 ${isSelected ? "border-primary/40 text-primary" : "border-border/50"}`}
                        >
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </Card>
              </div>

              {/* Right: Sessions for selected day */}
              <div className="lg:col-span-3 space-y-4">
                {selectedDate && (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="font-display font-semibold text-lg">
                        {formatDate(selectedDate)}
                      </h2>
                      <Badge variant="outline" className="text-xs border-border/60">
                        {sessionsForDay.length} {sessionsForDay.length === 1 ? "сессия" : "сессий"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-4">
                      {sessionsForDay.map(session => (
                        <BrainstormCard
                          key={session._id}
                          session={session}
                          onExportIdea={handleExportIdea}
                          onCopy={handleCopy}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── GENERATE TAB ── */}
        <TabsContent value="generate" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Selector */}
            <div className="lg:col-span-1">
              <Card className="p-4 rounded-2xl border-border/60 flex flex-col" style={{ height: "560px" }}>
                <div className="mb-3">
                  <h2 className="font-display font-semibold mb-0.5">Выберите заметки</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedNotes.size > 0
                      ? `Выбрано: ${selectedNotes.size}`
                      : "Выберите 1–5 голосовых заметок"}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {loadingNotes ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 gap-3">
                      <FileText className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground text-center">
                        Нет голосовых заметок. Отправьте голосовое сообщение в Telegram-бот.
                      </p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <label
                        key={note._id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer group ${
                          selectedNotes.has(note._id)
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/40 hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={selectedNotes.has(note._id)}
                          onCheckedChange={() => toggleNote(note._id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug mb-1 line-clamp-2">
                            {note.executive_summary || note.raw_transcript?.slice(0, 80) || "Без названия"}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(note.createdAt).toLocaleDateString("ru-RU")}
                            </span>
                            {note.status === "completed" && (
                              <Badge variant="outline" className="text-[9px] px-1 h-3.5 border-emerald-500/30 text-emerald-500">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Generator */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5 rounded-2xl border-border/60 space-y-4">
                <div>
                  <h2 className="font-display font-semibold mb-0.5">Что проанализировать?</h2>
                  <p className="text-xs text-muted-foreground">
                    Введите конкретный запрос или оставьте пустым — AI найдёт главное сам.
                  </p>
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Например: Сформируй план на неделю из этих мыслей..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleGenerate()}
                    className="h-10 bg-background/50"
                  />

                  <div className="flex flex-wrap gap-2">
                    {["Найди противоречия", "Составь план", "Объедини идеи", "Выдели главное"].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setPrompt(preset)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || selectedNotes.size === 0}
                    className="w-full h-11 gap-2 font-semibold"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Генерирую...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Запустить брейн-шторм
                        {selectedNotes.size > 0 && (
                          <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                            {selectedNotes.size}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* How it works */}
              <Card className="p-4 rounded-2xl border-border/60 bg-muted/20">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Как это работает
                </h3>
                <div className="space-y-2">
                  {[
                    { icon: "🎙️", text: "Выбери 1–5 голосовых заметок из списка слева" },
                    { icon: "✍️", text: "Введи конкретный вопрос или выбери пресет" },
                    { icon: "🤖", text: "AI проанализирует заметки и вернёт инсайты + план" },
                    { icon: "💡", text: "Сохрани любую идею в основной раздел одним кликом" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="text-base leading-5">{item.icon}</span>
                      <span className="leading-5">{item.text}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

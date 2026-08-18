import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, Brain, Loader2, ArrowRight, Save, Copy, Trash2,
  Calendar, Paperclip, X, History, Lightbulb, ListChecks, ArrowUp
} from "lucide-react";
import { useStore, getTodayDate } from "@/lib/store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrainstormSession {
  _id: string;
  theme?: string;
  prompt?: string;
  executive_summary?: string;
  key_insights?: string[];
  action_items?: Array<{ task: string; priority?: string }>;
  newIdeas?: string[];
  createdAt: string;
  sourceNoteIds: any[];
}

interface ProcessedNote {
  _id: string;
  title?: string | null;
  executive_summary: string;
  raw_transcript: string;
  semantic_tags: string[];
  status: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNoteTitle(note: ProcessedNote | undefined): string {
  if (!note) return "Заметка";
  if (note.title?.trim()) return note.title;
  const s = (note.executive_summary || note.raw_transcript || "").trim();
  if (!s) return "Заметка";
  const m = s.match(/^(.{0,50}[.!?…])\s/);
  if (m) return m[1];
  return s.length > 50 ? s.slice(0, 50).trimEnd() + "…" : s;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

function getDateKey(dateStr: string) {
  return new Date(dateStr).toISOString().slice(0, 10);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RichResponseCard({
  session,
  onExportIdea,
  onExportTask,
  onExportInsight,
  onCopy,
  onDelete,
}: {
  session: BrainstormSession;
  onExportIdea: (idea: string) => void;
  onExportTask: (task: string) => void;
  onExportInsight: (insight: string) => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-4xl mx-auto my-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* User Message Bubble */}
      <div className="flex justify-end w-full">
        <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl rounded-br-sm px-5 py-3 max-w-[80%] shadow-md">
          {session.prompt ? (
            <p className="text-sm text-white/90">{session.prompt}</p>
          ) : (
            <p className="text-sm text-white/60 italic">Без конкретного запроса (Авто-анализ)</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2 opacity-70">
            {session.sourceNoteIds?.map((note: any, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 h-4 bg-white/5 text-white/50 border-none">
                📎 Заметка
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* AI Response Block */}
      <div className="flex justify-start w-full group relative">
        <div className="absolute -left-10 top-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20 hidden sm:flex">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        
        <Card className="w-full bg-[#121212]/80 backdrop-blur-xl border-white/5 rounded-2xl sm:rounded-tl-sm p-4 sm:p-6 shadow-xl space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display font-semibold text-lg text-white/90 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
              {session.theme}
            </h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-white/40 hover:text-red-400 hover:bg-white/5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить результат?</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/60">Это действие нельзя отменить.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white">Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(session._id)} className="bg-red-500/80 hover:bg-red-500 text-white">
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Executive Summary (Краткая выжимка) */}
          {session.executive_summary && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white/80 leading-relaxed italic border-l-4 border-l-indigo-500">
              {session.executive_summary}
            </div>
          )}

          {/* Key Insights (Ключевые инсайты) */}
          {(session.key_insights?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Brain className="w-4 h-4" />
                <h4 className="text-sm font-semibold uppercase tracking-wider">Ключевые инсайты</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(session.key_insights ?? []).map((insight, idx) => (
                  <div key={idx} className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 p-4 rounded-xl text-sm text-purple-100/80 leading-relaxed relative overflow-hidden group/insight">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50" />
                    {insight}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/insight:opacity-100 transition-opacity bg-[#121212]/80 backdrop-blur-md rounded-md px-1 py-0.5">
                      <Button onClick={() => onCopy(insight)} size="icon" variant="ghost" className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10">
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button onClick={() => onExportInsight(insight)} size="icon" variant="ghost" className="h-6 w-6 text-purple-400/70 hover:text-purple-400 hover:bg-purple-400/10">
                        <Save className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Ideas */}
          {(session.newIdeas?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <Lightbulb className="w-4 h-4" />
                <h4 className="text-sm font-semibold uppercase tracking-wider">Новые идеи</h4>
              </div>
              <div className="flex flex-col gap-2">
                {(session.newIdeas ?? []).map((idea, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl group/idea hover:bg-white/[0.04] transition-colors">
                    <p className="text-sm text-white/80 leading-snug flex-1">{idea}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover/idea:opacity-100 transition-opacity flex-shrink-0">
                      <Button onClick={() => onCopy(idea)} size="icon" variant="ghost" className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => onExportIdea(idea)} size="icon" variant="ghost" className="h-7 w-7 text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-400/10">
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan */}
          {(session.action_items?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <ListChecks className="w-4 h-4" />
                <h4 className="text-sm font-semibold uppercase tracking-wider">План действий</h4>
              </div>
              <div className="space-y-2">
                {(session.action_items ?? []).map((step, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl hover:bg-white/[0.04] transition-colors group/task">
                    <div className="flex items-start gap-3">
                      <Checkbox id={`step-${session._id}-${idx}`} className="mt-0.5 border-white/20 data-[state=checked]:bg-indigo-500" />
                      <label htmlFor={`step-${session._id}-${idx}`} className="text-sm text-white/80 leading-snug cursor-pointer select-none">
                        <span className="font-semibold text-white/50 mr-2">{idx + 1}.</span>
                        {step.task}
                      </label>
                    </div>
                    <Button onClick={() => onExportTask(step.task)} size="icon" variant="ghost" className="h-7 w-7 text-indigo-400/70 hover:text-indigo-400 hover:bg-indigo-400/10 opacity-0 group-hover/task:opacity-100 transition-opacity flex-shrink-0">
                      <Save className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-[10px] text-white/30 text-right pt-2 border-t border-white/5">
            {new Date(session.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BrainstormPage() {
  const { actions } = useStore();
  const { toast } = useToast();

  const [notes, setNotes] = useState<ProcessedNote[]>([]);
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showOnlyToday, setShowOnlyToday] = useState(false);
  
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(true);
  
  const feedRef = useRef<HTMLDivElement>(null);
  // Map of session._id -> DOM element for anchor navigation
  const sessionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Thematic templates — each sends a focused instruction on top of the full analysis
  const PRESETS: Array<{ label: string; prompt: string }> = [
    { label: "Выдели главное", prompt: "Выдели самое главное из записей: ключевые мысли, выводы и 3-5 конкретных действий." },
    { label: "Составь план", prompt: "Составь подробный пошаговый план действий на основе записей: конкретные шаги с приоритетами." },
    { label: "Найди противоречия", prompt: "Найди противоречия и внутренние конфликты в моих мыслях, покажи слепые зоны, о которых я не говорю прямо." },
    { label: "Объедини идеи", prompt: "Объедини разрозненные идеи из записей в целостную концепцию и предложи новые прорывные идеи." },
    { label: "Трейдинг", prompt: "Разбери записи с точки зрения трейдинга: торговые идеи, сетапы, анализ рынка, ошибки в сделках и план по управлению рисками." },
    { label: "Личный рост", prompt: "Проанализируй записи с точки зрения личного роста: привычки, психология, страхи, цели и конкретные зоны развития." },
    { label: "Обучение и навыки", prompt: "Проанализируй записи с точки зрения обучения: какие навыки стоит развивать, план обучения и полезные ресурсы." },
    { label: "Проект и бизнес", prompt: "Проанализируй записи с точки зрения проекта или бизнеса: идея, продукт, аудитория, риски и первые шаги запуска." },
    { label: "План на неделю", prompt: "Составь план на неделю из записей: распредели задачи по дням с приоритетами и конкретными шагами." },
    { label: "Вопросы для размышления", prompt: "Сформулируй глубокие вопросы для самоанализа на основе записей, чтобы я лучше понял себя." },
  ];

  // ── Load notes ──
  const loadNotes = useCallback(async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch("/api/processed-audios?mode=brainstorm", { credentials: "include" });
      const data = await res.json();
      if (data.audios) setNotes(data.audios.filter((n: any) => n.status === "completed"));
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
      const res = await fetch("/api/brainstorms", { credentials: "include" });
      const data = await res.json();
      if (data.brainstorms) {
        // Sort sessions from oldest to newest for chat feed
        setSessions(data.brainstorms.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadSessions().then(() => {
      // Check if we came from calendar link
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session");
      if (sessionId) {
        setTimeout(() => scrollToSession(sessionId), 500); // Wait for render
      }
    });
  }, []);

  // ── Auto-scroll to bottom on new session (non-blocking) ──
  useEffect(() => {
    if (!feedRef.current || isGenerating) return;
    requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    });
  }, [sessions]);

  // ── Scroll to specific session (anchor navigation from history) ──
  const scrollToSession = useCallback((sessionId: string) => {
    setSheetOpen(false);
    // Small delay to let the sheet close animation finish
    setTimeout(() => {
      const el = sessionRefs.current[sessionId];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Flash highlight
        el.style.transition = "box-shadow 0.3s ease";
        el.style.boxShadow = "0 0 0 2px rgba(99, 102, 241, 0.5)";
        setTimeout(() => { if (el) el.style.boxShadow = ""; }, 1500);
      }
    }, 300);
  }, []);


  const toggleNote = (id: string) => {
    const newSet = new Set(selectedNotes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedNotes(newSet);
  };

  // ── Generate ──
  const handleGenerate = async () => {
    if (selectedNotes.size === 0 && !prompt) {
      toast({ title: "Выберите заметку или введите текст", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    const currentPrompt = prompt;
    setPrompt(""); // Clear input immediately

    try {
      const res = await fetch("/api/brainstorms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ noteIds: Array.from(selectedNotes), prompt: currentPrompt }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации");

      toast({ title: "✅ Брейн-шторм завершен!" });
      // Keep the selected note(s) as working context — user clears them manually
      // (tap ✕ on a chip) once the work with that note is done.

      // Reload to show the new card
      await loadSessions();

    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
      setPrompt(currentPrompt); // Restore input on error
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportIdea = (idea: string) => {
    actions.addDayNote(getTodayDate(), idea, "idea", "Brainstorm Idea");
    toast({ title: "💡 Идея сохранена!" });
  };

  const handleExportTask = (task: string) => {
    actions.addTodayTask({ 
      name: task, 
      type: "today", 
      date: getTodayDate(), 
      difficulty: "medium", 
      category: "Mind", 
      xp: 25
    });
    toast({ title: "✅ Задача добавлена в план на сегодня!" });
  };

  const handleExportInsight = (insight: string) => {
    actions.addDayNote(getTodayDate(), insight, "note", "Brainstorm Insight");
    toast({ title: "🧠 Инсайт сохранен в заметки!" });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/brainstorms/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Ошибка удаления");
      setSessions(prev => prev.filter(s => s._id !== id));
      toast({ title: "Сессия удалена" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/processed-audios/${noteId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Ошибка удаления");
      setNotes(prev => prev.filter(n => n._id !== noteId));
      setSelectedNotes(prev => { const s = new Set(prev); s.delete(noteId); return s; });
      toast({ title: "Голосовая заметка удалена" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  const handleClearAllNotes = async () => {
    try {
      const res = await fetch("/api/processed-audios/all", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Ошибка очистки");
      setNotes([]);
      setSelectedNotes(new Set());
      toast({ title: "Все голосовые заметки удалены" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-[#0A0A0A] text-white overflow-hidden">
      
      {/* Top Header */}
      <div className="absolute top-0 inset-x-0 h-16 bg-[#0A0A0A]/80 backdrop-blur-md z-10 border-b border-white/5 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/10">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-display font-semibold tracking-tight leading-none mb-1">Brainstorm</h1>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Personedge</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Today Filter Toggle */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowOnlyToday(!showOnlyToday)}
            className={`h-9 gap-2 rounded-xl transition-colors ${showOnlyToday ? "bg-indigo-500/20 text-indigo-400" : "text-white/60 hover:text-white hover:bg-white/10"}`}
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Сегодня</span>
          </Button>

          {/* History Drawer */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 gap-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">История</span>
              </Button>
            </SheetTrigger>
          <SheetContent className="bg-[#121212] border-l border-white/5 text-white w-[85vw] sm:max-w-md p-0">
            <SheetHeader className="p-6 border-b border-white/5">
              <SheetTitle className="text-white">История сессий</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-80px)] p-6">
              {sessions.length === 0 ? (
                <p className="text-white/40 text-center text-sm mt-10">Истории пока нет</p>
              ) : (
                <div className="space-y-6">
                  {Array.from(new Set(sessions.map(s => getDateKey(s.createdAt)))).reverse().map(dateKey => (
                    <div key={dateKey} className="space-y-3">
                      <div className="sticky top-0 bg-[#121212] py-1 text-xs font-semibold uppercase tracking-wider text-white/40 z-10">
                        {formatDate(dateKey)}
                      </div>
                      {sessions.filter(s => getDateKey(s.createdAt) === dateKey).reverse().map(session => (
                        <div
                          key={session._id}
                          onClick={() => scrollToSession(session._id)}
                          className="bg-[#1C1C1E] p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-[#252528] hover:border-indigo-500/30 transition-all duration-200 group relative"
                        >
                          <div className="pr-8">
                            <p className="text-sm font-medium text-white/90 truncate group-hover:text-white transition-colors">{session.theme}</p>
                            <p className="text-xs text-white/40 mt-1 truncate">{session.prompt || "Авто-анализ"}</p>
                            <p className="text-[10px] text-indigo-400/50 mt-1.5 font-medium">↗ Перейти к сессии</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(session._id); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-red-400/0 group-hover:text-red-400/70 hover:!text-red-400 hover:bg-red-500/10 transition-all"
                            title="Удалить сессию"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      {/* Main Feed Area - overflow-y-auto with hardware acceleration */}
      <div 
        ref={feedRef}
        className="flex-1 overflow-y-auto pt-24 pb-48 px-4 sm:px-6 md:px-10"
        style={{ WebkitOverflowScrolling: "touch", willChange: "scroll-position" }}
      >
        {loadingSessions ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-white/20" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-full border border-purple-500/20 animate-[ping_3s_ease-in-out_infinite]" />
              <Brain className="w-8 h-8 text-purple-400/80 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]" />
            </div>
            <h2 className="text-2xl font-display font-semibold text-white/90 mb-2">Готов к идеям</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              Прикрепи голосовые заметки 📎 или просто задай вопрос — и я начну брейн-шторм.
            </p>
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full pb-10">
            {sessions
              .filter(session => !showOnlyToday || new Date(session.createdAt).toISOString().slice(0, 10) === getTodayDate())
              .map(session => (
              <div
                key={session._id}
                id={`session-${session._id}`}
                ref={el => { sessionRefs.current[session._id] = el; }}
                className="scroll-mt-20"
              >
                <RichResponseCard
                  session={session}
                  onExportIdea={handleExportIdea}
                  onExportTask={handleExportTask}
                  onExportInsight={handleExportInsight}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
              </div>
            ))}
            {isGenerating && (
              <div className="flex justify-start w-full mt-6 mb-2 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-[#1C1C1E] border border-white/5 rounded-2xl rounded-tl-sm px-6 py-5 shadow-md flex flex-col gap-4 w-full max-w-sm ml-0 sm:ml-7 relative">
                  <div className="absolute -left-10 top-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/50 to-purple-600/50 flex items-center justify-center shadow-lg shadow-purple-500/10 hidden sm:flex">
                     <Sparkles className="w-3 h-3 text-white/70 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <p className="text-sm font-medium text-white/80">Personedge анализирует контекст...</p>
                  </div>
                  <div className="space-y-2.5 w-full">
                    <div className="h-2 bg-white/5 rounded-full w-full animate-pulse" />
                    <div className="h-2 bg-white/5 rounded-full w-[85%] animate-pulse" />
                    <div className="h-2 bg-white/5 rounded-full w-[60%] animate-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Fixed Prompt Area */}
      <div className="absolute bottom-0 inset-x-0 p-4 md:p-6 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent pt-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          
          {/* Presets Grid (hides when typing) */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 overflow-hidden transition-all duration-300 ${prompt.length > 0 ? 'opacity-0 translate-y-2 pointer-events-none max-h-0' : 'opacity-100 translate-y-0 max-h-40'}`}>
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => setPrompt(preset.prompt)}
                className="text-[11px] font-medium text-left px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm truncate"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Selected Notes Chips */}
          {selectedNotes.size > 0 && (
            <div className="flex flex-wrap gap-2 mb-1 px-1">
              {Array.from(selectedNotes).map(noteId => {
                const note = notes.find(n => n._id === noteId);
                const title = getNoteTitle(note);
                return (
                  <div key={noteId} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 backdrop-blur-md animate-in zoom-in-95 duration-200">
                    <Paperclip className="w-3 h-3 opacity-70" />
                    <span className="truncate max-w-[150px] font-medium">{title}</span>
                    <button onClick={() => toggleNote(noteId)} className="w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Prompt Box */}
          <div className="relative flex items-end gap-2 bg-[#1C1C1E] rounded-[24px] p-2 border border-white/10 shadow-2xl shadow-black/50 focus-within:border-white/20 transition-colors z-20">
            
            {/* Attachment Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full flex-shrink-0 text-white/50 hover:text-white hover:bg-white/10">
                  <Paperclip className="w-5 h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-[calc(100vw-32px)] sm:w-[450px] p-0 bg-[#1C1C1E] border-white/10 rounded-2xl shadow-xl shadow-black/50 overflow-hidden mb-2 z-50">
                <div className="p-3 border-b border-white/5 bg-[#121212] flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-white/90">Прикрепить контекст</h4>
                  <p className="text-xs text-white/50">Выберите голосовые заметки для анализа</p>
                </div>
                {notes.length > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-[10px] text-red-400/70 hover:text-red-400 hover:bg-red-500/10 h-7 px-2 gap-1">
                        <Trash2 className="w-3 h-3" />
                        Очистить всё
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить все голосовые заметки?</AlertDialogTitle>
                        <AlertDialogDescription className="text-white/60">Это действие нельзя отменить. Все {notes.length} заметок будут удалены.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white">Отмена</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAllNotes} className="bg-red-500/80 hover:bg-red-500 text-white">Удалить всё</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
                <ScrollArea className="h-64 p-2">
                  {notes.length === 0 ? (
                    <p className="text-xs text-center text-white/40 py-10">Нет доступных заметок</p>
                  ) : (
                    <div className="space-y-1">
                      {notes.map(note => (
                        <div
                          key={note._id}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors group/note ${
                            selectedNotes.has(note._id) ? "bg-indigo-500/10" : "hover:bg-white/5"
                          }`}
                        >
                          <Checkbox
                            checked={selectedNotes.has(note._id)}
                            onCheckedChange={() => toggleNote(note._id)}
                            className="mt-0.5 border-white/20 data-[state=checked]:bg-indigo-500 flex-shrink-0 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleNote(note._id)}>
                            <p className="text-sm font-medium text-white/85 leading-snug whitespace-normal break-words">
                              {getNoteTitle(note)}
                            </p>
                            {(note.executive_summary || note.raw_transcript) && (
                              <p className="text-xs text-white/50 leading-snug mt-0.5 line-clamp-2 whitespace-normal break-words">
                                {note.executive_summary || note.raw_transcript?.slice(0, 200)}
                              </p>
                            )}
                            <p className="text-[10px] text-white/40 mt-1">
                              {new Date(note.createdAt).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6 flex-shrink-0 opacity-0 group-hover/note:opacity-100 transition-opacity text-white/30 hover:text-red-400 hover:bg-red-500/10">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-[#1C1C1E] border-white/10 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Удалить эту заметку?</AlertDialogTitle>
                                <AlertDialogDescription className="text-white/60">Это действие нельзя отменить.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 hover:text-white">Отмена</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteNote(note._id)} className="bg-red-500/80 hover:bg-red-500 text-white">Удалить</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Text Input */}
            <Input
              placeholder="Что сделать с заметками? Например: «Составь план на неделю» или свой запрос..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleGenerate()}
              disabled={isGenerating}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-2 h-10 text-[15px] placeholder:text-white/30 text-white flex-1"
            />

            {/* Send Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || (selectedNotes.size === 0 && !prompt.trim())}
              size="icon"
              className={`w-10 h-10 rounded-full flex-shrink-0 transition-all duration-300 ${
                prompt.trim() || selectedNotes.size > 0 
                  ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-purple-500/25" 
                  : "bg-white/5 text-white/20 hover:bg-white/5 cursor-not-allowed"
              }`}
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
            </Button>
          </div>
          
        </div>
      </div>
      
    </div>
  );
}

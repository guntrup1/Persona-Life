import { useState, useEffect } from "react";
import { useStore, IDEA_CATEGORIES, type IdeaCategory, type DayNote } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lightbulb, ExternalLink, Pencil, Trash2, Filter, Calendar } from "lucide-react";

type SortMode = "newest" | "oldest" | "category";

const CATEGORY_COLORS: Record<IdeaCategory, string> = {
  gift: "bg-pink-500/20 text-pink-400",
  hobby: "bg-green-500/20 text-green-400",
  study: "bg-blue-500/20 text-blue-400",
  other: "bg-gray-500/20 text-gray-400",
};

function IdeaCard({ idea, onEdit, onDelete }: {
  idea: DayNote;
  onEdit: (idea: DayNote) => void;
  onDelete: (id: string) => void;
}) {
  const cat = IDEA_CATEGORIES.find(c => c.value === idea.ideaCategory);
  const dateLabel = new Date(idea.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Card className="p-4 border-card-border rounded-xl group hover:border-primary/30 transition-colors" data-testid={`card-idea-${idea.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {idea.ideaCategory && cat && (
              <span className={`text-[10px] font-display uppercase tracking-wider px-2 py-0.5 rounded-full ${CATEGORY_COLORS[idea.ideaCategory]}`}>
                {cat.label}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateLabel}
            </span>
            {idea.ideaDone && (
              <Badge variant="secondary" className="text-[9px] bg-green-500/20 text-green-400 border-0">Реализовано</Badge>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{idea.content}</p>
          {idea.link && (
            <a
              href={idea.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid={`link-idea-${idea.id}`}
            >
              <ExternalLink className="w-3 h-3" />
              {idea.link.length > 50 ? idea.link.slice(0, 50) + "..." : idea.link}
            </a>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(idea)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
            data-testid={`button-edit-idea-${idea.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(idea.id)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 transition-colors"
            data-testid={`button-delete-idea-${idea.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function EditIdeaDialog({ idea, open, onOpenChange, onSave }: {
  idea: DayNote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Pick<DayNote, "content" | "ideaCategory" | "link" | "ideaDone">>) => void;
}) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<IdeaCategory | "none">("none");
  const [link, setLink] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open && idea) {
      setContent(idea.content);
      setCategory(idea.ideaCategory || "none");
      setLink(idea.link || "");
      setDone(idea.ideaDone || false);
    }
  }, [open, idea]);

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  const handleSave = () => {
    if (!idea || !content.trim()) return;
    onSave(idea.id, {
      content: content.trim(),
      ideaCategory: category === "none" ? undefined : category,
      link: link.trim() || undefined,
      ideaDone: done,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Редактировать идею</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Описание идеи..."
            className="min-h-[100px] resize-none rounded-xl"
            autoFocus
            data-testid="input-edit-idea-content"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-display uppercase tracking-wider text-muted-foreground">Категория</label>
            <Select value={category} onValueChange={(v) => setCategory(v as IdeaCategory | "none")}>
              <SelectTrigger className="rounded-lg" data-testid="select-idea-category">
                <SelectValue placeholder="Выбрать категорию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без категории</SelectItem>
                {IDEA_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-display uppercase tracking-wider text-muted-foreground">Ссылка</label>
            <Input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="rounded-lg"
              data-testid="input-idea-link"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={done}
              onChange={e => setDone(e.target.checked)}
              className="accent-green-500"
              data-testid="checkbox-idea-done"
            />
            <span className="text-sm text-foreground">Реализовано</span>
          </label>
          <Button onClick={handleSave} disabled={!content.trim()} className="w-full rounded-full font-display" data-testid="button-save-idea">
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function IdeasPage() {
  const { state, actions } = useStore();
  const [filterCategory, setFilterCategory] = useState<IdeaCategory | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [editingIdea, setEditingIdea] = useState<DayNote | null>(null);
  const [showDone, setShowDone] = useState(false);

  const ideas = state.dayNotes
    .filter(n => n.noteType === "idea")
    .filter(n => filterCategory === "all" || n.ideaCategory === filterCategory)
    .filter(n => showDone || !n.ideaDone)
    .sort((a, b) => {
      if (sortMode === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (sortMode === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return (a.ideaCategory || "other").localeCompare(b.ideaCategory || "other");
    });

  const totalIdeas = state.dayNotes.filter(n => n.noteType === "idea").length;
  const doneCount = state.dayNotes.filter(n => n.noteType === "idea" && n.ideaDone).length;

  const handleSaveEdit = (id: string, updates: Partial<Pick<DayNote, "content" | "ideaCategory" | "link" | "ideaDone">>) => {
    actions.updateDayNote(id, updates);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="font-display text-xl font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Мои идеи
          </h1>
          <div className="text-xs text-muted-foreground font-mono">
            {ideas.length} {showDone ? `из ${totalIdeas}` : `активных`}
            {doneCount > 0 && ` · ${doneCount} реализовано`}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as IdeaCategory | "all")}>
              <SelectTrigger className="h-8 rounded-lg text-xs w-[150px]" data-testid="filter-idea-category">
                <SelectValue placeholder="Все категории" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все категории</SelectItem>
                {IDEA_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-[140px]" data-testid="sort-ideas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Новые первые</SelectItem>
              <SelectItem value="oldest">Старые первые</SelectItem>
              <SelectItem value="category">По категории</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
            <input
              type="checkbox"
              checked={showDone}
              onChange={e => setShowDone(e.target.checked)}
              className="accent-green-500"
              data-testid="checkbox-show-done"
            />
            <span className="text-xs text-muted-foreground">Реализованные</span>
          </label>
        </div>

        {ideas.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-border rounded-xl">
            <Lightbulb className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="font-display text-sm text-muted-foreground">Нет идей</p>
            <p className="text-xs text-muted-foreground mt-1">Создай идею через заметку на главной странице или кнопку быстрой заметки</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {ideas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onEdit={setEditingIdea}
                onDelete={actions.deleteDayNote}
              />
            ))}
          </div>
        )}
      </div>

      <EditIdeaDialog
        idea={editingIdea}
        open={!!editingIdea}
        onOpenChange={(open) => { if (!open) setEditingIdea(null); }}
        onSave={handleSaveEdit}
      />
    </div>
  );
}

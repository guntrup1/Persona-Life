import { useState } from "react";
import { useStore } from "@/lib/store";
import { Plus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mark = "plus" | "minus";

export function BiasChecklistView({ biasId, date }: { biasId: string; date: string }) {
  const { state, actions } = useStore();
  const [draft, setDraft] = useState("");

  const checklist = state.biasChecklists.find((c) => c.id === biasId);
  const dayMarks = (checklist?.marks?.[date] || {}) as Record<string, Mark>;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    actions.addBiasChecklistItem(biasId, text);
    setDraft("");
  };

  const setMark = (itemId: string, status: Mark) => {
    actions.setBiasChecklistMark(biasId, itemId, date, status);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Check className="w-3.5 h-3.5 text-primary" />
        Чек-лист
      </div>

      {checklist?.items?.length ? (
        <ul className="space-y-1">
          {checklist.items.map((item) => {
            const status = dayMarks[item.id];
            return (
              <li key={item.id} className="group flex items-center gap-2">
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMark(item.id, "plus")}
                    aria-label="Соблюдал условие"
                    className={`flex h-5 w-5 items-center justify-center rounded border text-[13px] font-bold leading-none transition-colors ${status === "plus" ? "bg-green-500 border-green-500 text-white" : "border-green-500/50 text-green-500 hover:bg-green-500/10"}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setMark(item.id, "minus")}
                    aria-label="Не соблюдал условие"
                    className={`flex h-5 w-5 items-center justify-center rounded border text-[13px] font-bold leading-none transition-colors ${status === "minus" ? "bg-red-500 border-red-500 text-white" : "border-red-500/50 text-red-500 hover:bg-red-500/10"}`}
                  >
                    −
                  </button>
                </div>
                <span className={`flex-1 text-sm ${status === "minus" ? "line-through text-muted-foreground" : ""} ${status === "plus" ? "text-green-400" : ""}`}>
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={() => actions.removeBiasChecklistItem(biasId, item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  aria-label="Удалить пункт"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Пока нет пунктов. Добавьте первый.</p>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Добавить пункт…"
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={submit}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

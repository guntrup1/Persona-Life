import { useState } from "react";
import { useStore } from "@/lib/store";
import { Check, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function BiasChecklistView({ biasId, date }: { biasId: string; date: string }) {
  const { state, actions } = useStore();
  const [draft, setDraft] = useState("");

  const checklist = state.biasChecklists.find((c) => c.id === biasId);
  const doneArr = checklist?.done?.[date] ?? [];

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    actions.addBiasChecklistItem(biasId, text);
    setDraft("");
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
            const done = doneArr.includes(item.id);
            return (
              <li key={item.id} className="group flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => actions.toggleBiasChecklistItem(biasId, item.id, date)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                  aria-label={done ? "Отметить не выполненным" : "Отметить выполненным"}
                >
                  {done && <Check className="w-3 h-3" />}
                </button>
                <span className={`flex-1 text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
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

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MotionItem, MotionList } from "@/components/motion";

export interface ChecklistItemData {
  id: string;
  text: string;
}

export function EditableChecklist({
  items,
  onChange,
}: {
  items: ChecklistItemData[];
  onChange: (items: ChecklistItemData[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: crypto.randomUUID(), text }]);
    setDraft("");
  };

  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));

  return (
    <div className="space-y-2">
      <MotionList className="space-y-1">
        {items.map((item) => (
          <MotionItem key={item.id}>
            <div className="group flex items-center gap-2 rounded-md px-1 py-1">
              <span className="flex-1 text-sm text-foreground">{item.text}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Удалить пункт"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          </MotionItem>
        ))}
      </MotionList>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Пунктов пока нет — добавьте ниже.</p>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Добавить пункт…"
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

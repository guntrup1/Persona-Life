import { useEffect, useState } from "react";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function renderInline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
  );
}

export function BulletListEditor({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}) {
  const [items, setItems] = useState<string[]>(value ? value.split("\n").filter(Boolean) : []);
  useEffect(() => {
    setItems(value ? value.split("\n").filter(Boolean) : []);
  }, [value]);

  const update = (next: string[]) => {
    setItems(next);
    onChange(next.join("\n"));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    update(n);
  };

  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-sm select-none">•</span>
          <Input
            value={it}
            onChange={(e) => {
              const n = [...items];
              n[i] = e.target.value;
              update(n);
            }}
            className="h-8 text-sm"
            placeholder={i === 0 ? placeholder : ""}
            data-testid={i === 0 ? testId : undefined}
          />
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
            onClick={() => move(i, -1)} disabled={i === 0}>
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
            onClick={() => move(i, 1)} disabled={i === items.length - 1}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8"
            onClick={() => update(items.filter((_, idx) => idx !== i))}>
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => update([...items, ""])}>
        <Plus className="h-3.5 w-3.5" />Добавить пункт
      </Button>
    </div>
  );
}

export function BulletText({ text, className }: { text?: string; className?: string }) {
  const items = (text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className={className || "space-y-0.5"}>
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span className="text-muted-foreground/70 mt-0.5">•</span>
          <span className="flex-1">{renderInline(it)}</span>
        </li>
      ))}
    </ul>
  );
}

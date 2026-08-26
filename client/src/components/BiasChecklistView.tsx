import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { Check, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export function BiasChecklistView({ biasId, date }: { biasId: string; date: string }) {
  const { state, actions } = useStore();
  const checklist = state.biasChecklists.find((c) => c.id === biasId);
  const dayMarks = checklist?.marks?.[date] || {};
  const isEmpty = !checklist || checklist.items.length === 0;

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const bias = state.dailyBiases.find((b) => b.id === biasId);
    if (!bias?.systemId) return;
    const cl = state.biasChecklists.find((c) => c.id === biasId);
    if (cl && cl.items.length) return;
    const sys = state.tradingSystems.find((t) => t.id === bias.systemId);
    if (!sys?.checklistItems?.length) return;
    seededRef.current = true;
    sys.checklistItems.forEach((it) => actions.addBiasChecklistItem(biasId, it.text));
  }, [biasId, state.dailyBiases, state.biasChecklists, state.tradingSystems, actions]);

  return (
    <div className="mt-2 rounded-md border border-border bg-card/50 p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <Check className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Чек-лист выполнения</span>
      </div>
      {isEmpty ? (
        <p className="px-1 text-xs text-muted-foreground">
          Чек-лист пуст. Добавьте пункты в торговой системе актива.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {checklist!.items.map((item) => {
            const status = dayMarks[item.id];
            return (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">{item.text}</span>
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onClick={() => actions.setBiasChecklistMark(biasId, item.id, date, "plus")}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                      status === "plus"
                        ? "border-green-500/60 bg-green-500/20 text-green-400"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    aria-label="Соблюдал"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.8 }}
                    onClick={() => actions.setBiasChecklistMark(biasId, item.id, date, "minus")}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                      status === "minus"
                        ? "border-red-500/60 bg-red-500/20 text-red-400"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    aria-label="Нарушал"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </motion.button>
                  {status === "plus" && <Badge className="bg-green-500/20 text-green-400">+</Badge>}
                  {status === "minus" && <Badge className="bg-red-500/20 text-red-400">−</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

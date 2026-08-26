import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { Check, Plus, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MotionList, MotionItem } from "@/components/motion";

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
    actions.setBiasChecklistItems(
      biasId,
      sys.checklistItems.map((i) => ({ id: i.id, text: i.text }))
    );
  }, [biasId, state.dailyBiases, state.biasChecklists, state.tradingSystems, actions]);

  const mark = (itemId: string, status: "plus" | "minus") =>
    actions.setBiasChecklistMark(biasId, itemId, date, status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="mt-2 rounded-md border border-border bg-card/50 p-2"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Check className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Чек-лист выполнения</span>
      </div>
      {isEmpty ? (
        <p className="px-1 text-xs text-muted-foreground">
          Чек-лист пуст. Привяжите торговую систему к биасу, чтобы подставить пункты.
        </p>
      ) : (
        <MotionList className="space-y-1.5">
          {checklist!.items.map((item) => {
            const status = dayMarks[item.id];
            const plus = status === "plus";
            const minus = status === "minus";
            return (
              <MotionItem key={item.id}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm transition-colors ${
                      plus ? "font-medium text-green-300" : minus ? "font-medium text-red-300" : "text-foreground"
                    }`}
                  >
                    {item.text}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => mark(item.id, "plus")}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all active:scale-90 ${
                        plus
                          ? "border-green-400 bg-green-500/30 text-green-200 shadow-[0_0_12px_rgba(34,197,94,0.65)]"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                      aria-label="Соблюдал"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(item.id, "minus")}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all active:scale-90 ${
                        minus
                          ? "border-red-400 bg-red-500/30 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.65)]"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                      aria-label="Нарушал"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    {plus && <Badge className="bg-green-500/20 text-green-300">+</Badge>}
                    {minus && <Badge className="bg-red-500/20 text-red-300">−</Badge>}
                  </div>
                </div>
              </MotionItem>
            );
          })}
        </MotionList>
      )}
    </motion.div>
  );
}

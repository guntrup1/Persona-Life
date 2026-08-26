import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, Plus } from "lucide-react";
import { TradeAsset, TradingSystem } from "@/lib/store";

export function TradingSystemMissingDialog({
  open,
  asset,
  systems,
  onOpenChange,
  onLink,
  onCreate,
}: {
  open: boolean;
  asset: TradeAsset | null;
  systems: TradingSystem[];
  onOpenChange: (open: boolean) => void;
  onLink: (systemId: string) => void;
  onCreate: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Торговая система
          </DialogTitle>
          <DialogDescription>
            {systems.length > 0
              ? `Для актива ${asset} уже есть системы. Выберите одну, чтобы привязать к биасу, или создайте новую.`
              : `Для актива ${asset} ещё нет торговой системы. Создадим её в общей книжке?`}
          </DialogDescription>
        </DialogHeader>

        {systems.length > 0 && (
          <div className="space-y-1.5">
            {systems.map((sys) => (
              <button
                key={sys.id}
                type="button"
                onClick={() => onLink(sys.id)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="font-medium text-foreground">
                  {sys.name || (sys.type === "intraday" ? "Внутридневная" : "Свинг")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {sys.checklistItems?.length || 0} пунктов
                </span>
              </button>
            ))}
          </div>
        )}

        <DialogFooter className="mt-4 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Позже</Button>
          <Button type="button" onClick={onCreate}>
            {systems.length > 0 ? (
              <>
                <Plus className="h-3.5 w-3.5" />Создать новую
              </>
            ) : (
              <>
                Создать систему<ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

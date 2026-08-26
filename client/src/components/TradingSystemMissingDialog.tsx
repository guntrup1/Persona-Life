import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight } from "lucide-react";
import { TradeAsset } from "@/lib/store";

export function TradingSystemMissingDialog({
  open,
  asset,
  onOpenChange,
  onGoToSystems,
}: {
  open: boolean;
  asset: TradeAsset | null;
  onOpenChange: (open: boolean) => void;
  onGoToSystems: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Нет торговой системы
          </DialogTitle>
          <DialogDescription>
            У вас ещё нет торговой системы для актива <span className="font-semibold text-foreground">{asset}</span>.
            Создадим её в общей книжке систем, а затем привяжем к биасам этого актива?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Позже</Button>
          <Button type="button" onClick={onGoToSystems}>
            Перейти в книгу систем
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

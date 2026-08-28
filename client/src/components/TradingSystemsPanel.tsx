import { useState } from "react";
import { Plus, BookOpen, Trash2, Share2, FileDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MotionDialogContent } from "@/components/motion";
import { useStore, ASSETS, TradeAsset, TradingSystem } from "@/lib/store";
import { TradingSystemShareCard } from "@/components/ShareSystemCard";
import { useToast } from "@/hooks/use-toast";

export function TradingSystemsPanel({
  open,
  onOpenChange,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (e: { systemId?: string; asset?: TradeAsset }) => void;
}) {
  const { state, actions } = useStore();
  const { toast } = useToast();
  const systems = state.tradingSystems;
  const [pdfSystem, setPdfSystem] = useState<TradingSystem | null>(null);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl">
      <MotionDialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />Торговые системы
          </DialogTitle>
          <DialogDescription>
            Отдельная «книжка» стратегии для каждого актива. Её чек-лист подставляется в ежедневные биасы.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {systems.length === 0 && (
            <p className="text-sm text-muted-foreground">Систем пока нет. Добавьте для нужного актива.</p>
          )}
          {systems.map((sys) => (
            <div key={sys.id}
              className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{sys.asset}</Badge>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{sys.name || (sys.type === "intraday" ? "Внутридневная" : "Свинг")}</span>
                  <span className="text-xs text-muted-foreground">
                    {sys.checklistItems.length} пунктов · {sys.sessions.length} сессий
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => onEdit({ systemId: sys.id })}>Открыть</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  title="Поделиться ссылкой"
                  onClick={async () => {
                    const code = await actions.createSharedSystem(sys);
                    if (!code) { toast({ title: "Не удалось создать ссылку" }); return; }
                    try { await navigator.clipboard.writeText(`${window.location.origin}/?s=${code}`); } catch {}
                    toast({ title: "Короткая ссылка скопирована" });
                  }}>
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  title="Скачать PDF / импортировать"
                  onClick={() => setPdfSystem(sys)}>
                  <FileDown className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8"
                  onClick={() => actions.deleteTradingSystem(sys.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Добавить для актива:</span>
          <div className="flex flex-wrap gap-1">
            {ASSETS.map((a) => (
              <Button key={a} size="sm" variant="ghost" className="h-7 text-xs"
                onClick={() => onEdit({ asset: a })}>
                <Plus className="h-3 w-3" />{a}
              </Button>
            ))}
          </div>
        </div>
      </MotionDialogContent>
      </DialogContent>
    </Dialog>

    <Dialog open={!!pdfSystem} onOpenChange={(o) => { if (!o) setPdfSystem(null); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <MotionDialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {pdfSystem?.asset} · {pdfSystem?.name || "Система"}
            </DialogTitle>
            <DialogDescription>Поделиться ссылкой, скачать PDF или импортировать себе.</DialogDescription>
          </DialogHeader>
          {pdfSystem && <TradingSystemShareCard system={pdfSystem} />}
        </MotionDialogContent>
      </DialogContent>
    </Dialog>
    </>
  );
}

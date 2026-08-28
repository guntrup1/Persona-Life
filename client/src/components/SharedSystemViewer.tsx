import { decodeSystem } from "./ShareSystemCard";
import { TradingSystemShareCard } from "./ShareSystemCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function SharedSystemViewer({ code }: { code: string }) {
  const { toast } = useToast();
  const system = decodeSystem(code);
  if (!system) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">Ссылка повреждена или устарела.</p>
          <a href="/"><Button variant="outline">На главную</Button></a>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-muted-foreground">Persona Life · Торговая система (общий доступ)</span>
          <a href="/"><Button variant="outline" size="sm">Открыть приложение</Button></a>
        </div>
        <TradingSystemShareCard system={system} />
        <p className="text-center text-xs text-muted-foreground">
          Просмотр без регистрации. Чтобы сохранить систему себе — войдите и нажмите «Импортировать себе».
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { decodeSystem, TradingSystemShareCard } from "./ShareSystemCard";
import { Button } from "@/components/ui/button";
import { TradingSystem } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const LEFT_QUOTE = "Оставь надежду всяк сюда входящий, здесь лишь упорство, вера и труды";
const RIGHT_QUOTE = "и лишь познав искусство дисциплины, ты сможешь пожинать свои плоды";

export function SharedSystemViewer({ code, shared }: { code?: string; shared?: string }) {
  const { toast } = useToast();
  const [system, setSystem] = useState<TradingSystem | null>(shared ? decodeSystem(shared) : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!code && !shared);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/shared-system/${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        if (d?.system) setSystem(d.system as TradingSystem);
        else setError("Ссылка повреждена или устарела.");
      })
      .catch(() => {
        if (!cancelled) setError("Ссылка повреждена или устарела.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <p className="text-muted-foreground">Загрузка системы…</p>
      </div>
    );
  }

  if (error || !system) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">Ссылка повреждена или устарела.</p>
          <a href="/"><Button variant="outline">На главную</Button></a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Left quote — desktop only */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:items-end lg:pt-28">
          <div className="border-r border-primary/30 pr-4 text-right">
            <Quote className="mb-3 ml-auto h-5 w-5 text-primary/40" />
            <p className="text-sm italic leading-relaxed text-muted-foreground">{LEFT_QUOTE}</p>
          </div>
        </aside>

        {/* Center content */}
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/60" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Trade Persona · System
              </span>
            </div>
            <a href="/"><Button variant="outline" size="sm">Открыть приложение</Button></a>
          </div>

          <TradingSystemShareCard system={system} />

          <p className="text-center text-xs text-muted-foreground">
            Просмотр без регистрации. Чтобы сохранить систему себе — войдите и нажмите «Импортировать себе».
          </p>

          {/* Quotes — phones / tablets (combined at the end) */}
          <div className="space-y-4 lg:hidden">
            <div className="border-t border-border pt-4 text-center">
              <Quote className="mx-auto mb-2 h-4 w-4 text-primary/40" />
              <p className="text-sm italic leading-relaxed text-muted-foreground">{LEFT_QUOTE}</p>
            </div>
            <div className="text-center">
              <p className="text-sm italic leading-relaxed text-zinc-500">{RIGHT_QUOTE}</p>
            </div>
          </div>
        </div>

        {/* Right quote — desktop only */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-col lg:pt-28">
          <div className="border-l border-primary/30 pl-4">
            <Quote className="mb-3 h-5 w-5 text-primary/40" />
            <p className="text-sm italic leading-relaxed text-zinc-500">{RIGHT_QUOTE}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

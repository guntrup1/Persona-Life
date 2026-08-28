import { useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Share2, FileDown, Download, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemView } from "./TradingSystemDialog";
import { useStore, TradingSystem } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function encodeSystem(system: TradingSystem): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(system))));
}

export function decodeSystem(code: string): TradingSystem | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(code)))) as TradingSystem;
  } catch {
    return null;
  }
}

export function shareUrl(system: TradingSystem): string {
  return `${window.location.origin}/?shared=${encodeSystem(system)}`;
}

export async function copyShareLink(system: TradingSystem) {
  const url = shareUrl(system);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function TradingSystemShareCard({ system }: { system: TradingSystem }) {
  const ref = useRef<HTMLDivElement>(null);
  const { actions } = useStore();
  const { user } = useAuth();
  const { toast } = useToast();

  const downloadPdf = async () => {
    const node = ref.current;
    if (!node) return;
    try {
      const canvas = await html2canvas(node, { backgroundColor: "#0b0b0f", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      doc.addImage(img, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        doc.addPage();
        doc.addImage(img, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      doc.save(`${system.asset}_${system.name || system.type}.pdf`);
    } catch (e) {
      toast({ title: "Не удалось сформировать PDF", description: String(e) });
    }
  };

  const onShare = async () => {
    await copyShareLink(system);
    toast({ title: "Ссылка скопирована", description: "Отправьте её любому человеку — открыть можно без регистрации." });
  };

  const onImport = () => {
    actions.addTradingSystem({ ...system, id: crypto.randomUUID() } as any);
    toast({ title: "Система импортирована", description: `${system.asset} добавлена в ваши системы.` });
  };

  return (
    <div className="space-y-3">
      <div ref={ref} className="rounded-lg">
        <SystemView system={system} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onShare}>
          <Share2 className="h-3.5 w-3.5" />Поделиться ссылкой
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadPdf}>
          <FileDown className="h-3.5 w-3.5" />Скачать PDF
        </Button>
        {user ? (
          <Button type="button" size="sm" variant="outline" onClick={onImport}>
            <Download className="h-3.5 w-3.5" />Импортировать себе
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <LogIn className="h-3 w-3" />Войдите, чтобы импортировать
          </span>
        )}
      </div>
    </div>
  );
}

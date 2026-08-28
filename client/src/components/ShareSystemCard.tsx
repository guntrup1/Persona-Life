import { useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Share2, FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemView } from "./TradingSystemDialog";
import { useStore, TradingSystem } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function decodeSystem(code: string): TradingSystem | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(code)))) as TradingSystem;
  } catch {
    return null;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
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
    const code = await actions.createSharedSystem(system);
    if (!code) {
      toast({ title: "Не удалось создать ссылку", description: "Попробуйте ещё раз." });
      return;
    }
    await copyText(`${window.location.origin}/?s=${code}`);
    toast({ title: "Короткая ссылка скопирована", description: "Отправьте её любому человеку — открыть можно без регистрации." });
  };

  const onImport = () => {
    actions.addTradingSystem({ ...system, id: crypto.randomUUID() } as any);
    toast({ title: "Система импортирована", description: `${system.asset} добавлена в ваши системы.` });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5">
        <Button type="button" size="icon" variant="ghost" onClick={onShare} title="Поделиться ссылкой" aria-label="Поделиться ссылкой">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={downloadPdf} title="Скачать PDF" aria-label="Скачать PDF">
          <FileDown className="h-4 w-4" />
        </Button>
        {user ? (
          <Button type="button" size="icon" variant="ghost" onClick={onImport} title="Импортировать себе" aria-label="Импортировать себе">
            <Download className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Войдите, чтобы импортировать</span>
        )}
      </div>
      <div ref={ref} className="rounded-lg">
        <SystemView system={system} />
      </div>
    </div>
  );
}

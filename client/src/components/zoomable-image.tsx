import { useEffect, useRef, useState } from "react";
import { ImageOff, Link2, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const LENS_SIZE = 200;
const LENS_ZOOM = 2.5;

type ZoomableImageProps = {
  src: string;
  alt?: string;
};

export function ZoomableImage({ src, alt = "" }: ZoomableImageProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [lens, setLens] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setZoom(1);
    setLens(null);
  }, [src]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const img = imgRef.current;
    if (!img || zoom > 1) return;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setLens(null);
      return;
    }
    setLens({ x, y, vx: e.clientX, vy: e.clientY });
  };

  if (error) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full flex flex-col items-center justify-center gap-1.5 p-6 rounded-md bg-white/[0.03] text-center hover:bg-white/[0.06] transition-colors"
      >
        <ImageOff className="w-6 h-6 text-muted-foreground/60" />
        <span className="text-xs text-muted-foreground">{t.notes.imageLoadFailed}</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-primary">
          <Link2 className="w-3.5 h-3.5" />
          {t.notes.openLink}
        </span>
      </a>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setLens(null)}
      onDoubleClick={() => setZoom(z => (z > 1 ? 1 : 2))}
      className="relative w-full max-h-[80vh] min-h-[40vh] overflow-auto bg-black/40 select-none"
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          width: `${zoom * 100}%`,
          transition: "width 0.2s ease, opacity 0.3s ease",
        }}
        className={`block ${loaded ? "opacity-100" : "opacity-0"} ${zoom === 1 ? "cursor-zoom-in" : "cursor-zoom-out"}`}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />
      )}
      <div className="sticky top-3 right-3 ml-auto flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 p-1 w-fit mr-3">
        <button
          onClick={() => setZoom(z => Math.min(4, +(z + 0.5).toFixed(1)))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="+"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[10px] text-white/60 font-mono min-w-[2ch] text-center">{zoom.toFixed(1)}x</span>
        <button
          onClick={() => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))}
          className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="-"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>
      {loaded && zoom === 1 && lens && (
        <div
          className="pointer-events-none fixed rounded-full border-2 border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          style={{
            width: LENS_SIZE,
            height: LENS_SIZE,
            left: Math.min(Math.max(0, lens.vx - LENS_SIZE / 2), window.innerWidth - LENS_SIZE),
            top: Math.min(Math.max(0, lens.vy - LENS_SIZE / 2), window.innerHeight - LENS_SIZE),
            backgroundImage: `url(${src})`,
            backgroundSize: `${imgRef.current ? imgRef.current.clientWidth * LENS_ZOOM : 0}px ${imgRef.current ? imgRef.current.clientHeight * LENS_ZOOM : 0}px`,
            backgroundPosition: `${-(lens.x * LENS_ZOOM - LENS_SIZE / 2)}px ${-(lens.y * LENS_ZOOM - LENS_SIZE / 2)}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { ImageOff, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isSafeImageUrl } from "@/lib/url-safety";

type RemoteImageProps = {
  src?: string;
  alt?: string;
  variant?: "thumb" | "auto";
  bordered?: boolean;
  onClick?: () => void;
};

export function RemoteImage({ src, alt = "", variant = "thumb", bordered = false, onClick }: RemoteImageProps) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  if (!src) return null;

  const box = variant === "thumb" ? "aspect-video w-full" : "w-full min-h-24";
  const borderClass = bordered ? "border border-border" : "";
  const imgClass = variant === "thumb" ? "w-full h-full object-cover" : "w-full h-auto";

  if (error) {
    // Only unsafe-but-present URLs get a plain fallback; safe https URLs
    // become a clickable "open link" target.
    const safeLink = isSafeImageUrl(src);
    return (
      <div className={`${box} ${borderClass} flex flex-col items-center justify-center gap-1.5 p-3 rounded-md bg-white/[0.03] text-center ${safeLink ? "hover:bg-white/[0.06] transition-colors" : ""}`}>
        <ImageOff className="w-5 h-5 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground">{t.notes.imageLoadFailed}</span>
        {safeLink && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary"
          >
            <Link2 className="w-3 h-3" />
            {t.notes.openLink}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${box} ${borderClass} rounded-md overflow-hidden bg-white/[0.03]`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onClick={onClick}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`${imgClass} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${onClick ? "cursor-pointer" : ""}`}
      />
      {!loaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
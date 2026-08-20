import { useEffect, useState } from "react";
import { ImageOff, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  const imgClass = variant === "thumb" ? "object-cover w-full h-full" : "w-full h-auto object-cover";
  const borderClass = bordered ? "border border-border" : "";

  if (error) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className={`${box} ${borderClass} flex flex-col items-center justify-center gap-1.5 p-3 rounded-md bg-white/[0.03] text-center hover:bg-white/[0.06] transition-colors`}
      >
        <ImageOff className="w-5 h-5 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground">{t.notes.imageLoadFailed}</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
          <Link2 className="w-3 h-3" />
          {t.notes.openLink}
        </span>
      </a>
    );
  }

  if (!loaded) {
    return (
      <div className={`${box} ${borderClass} rounded-md bg-white/5 animate-pulse`} />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={`${imgClass} ${borderClass} rounded-md`}
    />
  );
}
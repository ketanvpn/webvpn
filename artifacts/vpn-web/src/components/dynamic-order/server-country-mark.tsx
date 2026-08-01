import { Globe2 } from "lucide-react";
import { useState } from "react";
import { parseServerLocation, type ParsedLocation } from "@/lib/server-country";

type ServerCountryMarkProps = {
  readonly location: string | null | undefined;
  readonly size?: "sm" | "md";
  readonly showLabel?: boolean;
};

function FlagImage({ 
  src,
  alt,
  onImageError 
}: { 
  src: string;
  alt: string;
  onImageError: () => void;
}) {
  return (
    <img
      src={src}
      width={48}
      height={32}
      alt={alt}
      className="h-full w-full object-contain"
      onError={onImageError}
    />
  );
}

function GlobeFallback({ label }: { label: string }) {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      role="img"
      aria-label={label}
    >
      <Globe2 className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}

function CountryLabel({ 
  parsed, 
  rawLocation 
}: { 
  parsed: ParsedLocation | null; 
  rawLocation: string | null | undefined;
}) {
  const displayText = parsed ? parsed.countryName : (rawLocation?.trim() || "Lokasi global");
  
  return (
    <span className="text-[10px] text-muted-foreground font-medium text-center break-words leading-tight max-w-full">
      {displayText}
    </span>
  );
}

export function ServerCountryMark({ 
  location, 
  size = "md",
  showLabel = false 
}: ServerCountryMarkProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const parsed = parseServerLocation(location);
  
  const sizeClasses = size === "sm" 
    ? "w-10 h-10 rounded-lg" 
    : "w-12 h-12 rounded-xl";
  
  const currentUrl = parsed 
    ? `https://flagcdn.com/${parsed.countryCode.toLowerCase()}.svg` 
    : null;
  
  const imageFailed = currentUrl !== null && failedUrl === currentUrl;
  
  const handleImageError = () => {
    if (currentUrl) {
      setFailedUrl(currentUrl);
    }
  };
  
  const fallbackLabel = parsed ? parsed.countryName : "Lokasi tidak dikenal";
  
  return (
    <div className="flex flex-col items-center gap-0.5 max-w-16">
      <div 
        className={`${sizeClasses} bg-white/90 flex items-center justify-center shadow-lg border border-white/20 overflow-hidden`}
      >
        {parsed && currentUrl && !imageFailed ? (
          <FlagImage 
            src={currentUrl}
            alt={`Bendera ${parsed.countryName}`}
            onImageError={handleImageError}
          />
        ) : (
          <GlobeFallback label={fallbackLabel} />
        )}
      </div>
      {showLabel ? (
        <CountryLabel parsed={parsed} rawLocation={location} />
      ) : null}
    </div>
  );
}

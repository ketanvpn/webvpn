import { Server, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DynamicServer } from "./types";
import {
  dynamicDurationOptionLabel,
  getDynamicSellPrice,
  isDynamicDurationType,
} from "@/lib/dynamic-duration";
import { getServerSelectability } from "@/lib/dynamic-order-policy";
import { ServerCountryMark } from "./server-country-mark";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type ServerCardProps = {
  readonly server: DynamicServer;
  readonly onSelect: () => void;
};

export function ServerCard({ server, onSelect }: ServerCardProps) {
  const supportedTypes = server.supportedTypes.filter(isDynamicDurationType);
  const selectability = getServerSelectability(server);

  const isCloudfront = Boolean(server.isCloudfrontCapable);
  const isPremium = Boolean(server.isPremium);
  const borderClass = isPremium
    ? "border-amber-500/30 hover:border-amber-400/50"
    : isCloudfront
      ? "border-violet-500/20 hover:border-violet-400/40"
      : "border-white/5 hover:border-primary/30";
  return (
    <div className={`relative flex min-w-0 w-full flex-col rounded-xl overflow-hidden transition-all duration-300 border glass-card ${borderClass}`}>
      <button
        type="button"
        onClick={onSelect}
        disabled={!selectability.isSelectable}
        className="p-3 sm:p-4 text-left w-full min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Pilih server ${server.displayName}${!selectability.isSelectable ? " (Tidak tersedia)" : ""}`}
      >
        <div className="flex w-full min-w-0 gap-2 sm:gap-3">
          <div className="flex flex-col items-center gap-1.5 w-14 sm:w-16 shrink-0">
            <ServerCountryMark location={server.location} showLabel />
            {selectability.isSelectable ? (
              <span className="text-[8px] sm:text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded w-full text-center border border-primary/20 flex items-center justify-center gap-0.5">
                <Zap className="w-2 h-2" /> READY
              </span>
            ) : (
              <span className="text-[8px] sm:text-[9px] font-bold bg-destructive/10 text-destructive px-1 py-0.5 rounded w-full text-center border border-destructive/20">
                Penuh
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-start gap-1.5">
              <h3 className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-foreground sm:text-base">
                {server.displayName}
              </h3>
              {isPremium && (
                <Badge className="shrink-0 bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[8px] sm:text-[9px] px-1.5 py-0 font-bold tracking-wide">
                  PREMIUM
                </Badge>
              )}
              {isCloudfront && (
                <Badge className="shrink-0 bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[8px] sm:text-[9px] px-1.5 py-0 font-bold tracking-wide">
                  CLOUDFRONT
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1.5 min-w-0">
              {server.provider === "local_panel" ? (
                <Badge variant="outline" className="border-white/10 bg-white/5 text-[9px]">
                  {server.maxConnections > 0 ? `MAX ${server.maxConnections} IP` : "UNLIMITED IP"}
                </Badge>
              ) : null}
              {server.enabledProtocols.slice(0, 4).map((protocol) => (
                <span
                  key={protocol}
                  className="text-[9px] sm:text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/5 uppercase"
                >
                  {protocol}
                </span>
              ))}
              <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Server className="w-2.5 h-2.5" /> {server.capacityUsed}/{server.capacityLimit ?? "∞"}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`mt-3 min-h-10 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 ${
            selectability.isSelectable
              ? "bg-primary/90 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {selectability.isSelectable ? "Pilih Server" : "Tidak tersedia"}
        </div>
      </button>

      {!selectability.isSelectable && selectability.message && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 border border-white/5">
            {selectability.message}
          </p>
        </div>
      )}

      <div
        className={`grid gap-3 p-3 bg-black/20 border-t border-white/5 ${
          supportedTypes.length >= 3
            ? "grid-cols-3"
            : supportedTypes.length === 2
              ? "grid-cols-2"
              : "grid-cols-1"
        }`}
      >
        {supportedTypes.map((type) => (
          <div key={type} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
            <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
              {dynamicDurationOptionLabel(type)}
            </p>
            <p className="text-xs font-bold text-foreground mt-0.5">
              {formatRupiah(getDynamicSellPrice(server, type))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

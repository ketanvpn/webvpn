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
  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 border glass-card ${isCloudfront ? "border-violet-500/30 hover:border-violet-400/50" : "border-white/5 hover:border-primary/30"}`}>
      {isCloudfront && (
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-violet-600 text-white text-[9px] px-1.5 py-0.5">CLOUDFRONT</Badge>
        </div>
      )}
      <button
        type="button"
        onClick={onSelect}
        disabled={!selectability.isSelectable}
        className="p-4 text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={`Pilih server ${server.displayName}${!selectability.isSelectable ? " (Tidak tersedia)" : ""}`}
      >
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
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

          <div className="flex-1 min-w-0">
            <h3 className="break-words text-sm font-semibold leading-snug text-foreground sm:text-base">
              {server.displayName}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
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

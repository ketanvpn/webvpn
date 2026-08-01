import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getOrderStatusMetadata, type OrderStatus } from "@/lib/dynamic-order-policy";
import { Clock, RefreshCw, CheckCircle2, XCircle, Ban } from "lucide-react";

const statusIconMap: Record<OrderStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  processing: RefreshCw,
  paid: CheckCircle2,
  failed: XCircle,
  expired: Ban,
};

const statusColorMap: Record<OrderStatus, string> = {
  pending: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  processing: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
  paid: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  failed: "border-red-500/30 text-red-400 bg-red-500/10",
  expired: "border-gray-500/30 text-gray-400 bg-gray-500/10",
};

type DynamicOrderStatusBadgeProps = {
  status: OrderStatus;
  showIcon?: boolean;
  className?: string;
};

export function DynamicOrderStatusBadge({ status, showIcon = true, className }: DynamicOrderStatusBadgeProps) {
  const metadata = getOrderStatusMetadata(status);
  const Icon = statusIconMap[status];
  const colorClasses = statusColorMap[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 uppercase", colorClasses, className)}
      role="status"
      aria-label={`Status order: ${metadata.label}`}
    >
      {showIcon && (
        <Icon
          className={cn("h-3.5 w-3.5", status === "processing" && "animate-spin")}
          aria-hidden="true"
        />
      )}
      {metadata.label}
    </Badge>
  );
}

type DynamicOrderStatusPanelProps = {
  status: OrderStatus;
  vpnAccountId?: number | null;
  className?: string;
};

export function DynamicOrderStatusPanel({ status, vpnAccountId, className }: DynamicOrderStatusPanelProps) {
  const metadata = getOrderStatusMetadata(status);

  return (
    <div
      className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-4", className)}
      role="region"
      aria-label="Informasi status order"
    >
      <div className="flex items-start gap-3">
        <DynamicOrderStatusBadge status={status} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{metadata.description}</p>
      {metadata.nextAction && (
        <p className="mt-1 text-xs text-muted-foreground">{metadata.nextAction}</p>
      )}
      {status === "paid" && vpnAccountId && (
        <p className="mt-2 text-xs text-primary">
          Akun VPN sudah aktif. Lihat detail di halaman akun.
        </p>
      )}
      {status === "expired" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Order sudah kedaluwarsa. Silakan buat order baru.
        </p>
      )}
    </div>
  );
}

export type { OrderStatus };

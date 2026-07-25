import { Badge } from "@/components/ui/badge";

type OrderStatus = "paid" | "pending" | "processing" | "failed" | "expired" | "active" | "inactive" | "suspended" | string;

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Lunas", variant: "default" },
  active: { label: "Aktif", variant: "default" },
  pending: { label: "Menunggu", variant: "secondary" },
  processing: { label: "Diproses", variant: "secondary" },
  failed: { label: "Gagal", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  inactive: { label: "Nonaktif", variant: "destructive" },
  suspended: { label: "Ditangguhkan", variant: "destructive" },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
  size?: "sm" | "default";
}

export function StatusBadge({ status, className = "", size = "default" }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase();
  const config = STATUS_CONFIG[normalized] ?? { label: status, variant: "outline" as const };

  const sizeClasses = size === "sm" ? "text-[10px] h-4 px-1.5" : "";

  return (
    <Badge variant={config.variant} className={`${sizeClasses} ${className}`}>
      {config.label}
    </Badge>
  );
}

/**
 * Utility functions for cases where you need just the label or variant
 */
export function getStatusLabel(status: string): string {
  const normalized = (status || "").toLowerCase();
  return STATUS_CONFIG[normalized]?.label ?? status;
}

export function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = (status || "").toLowerCase();
  return STATUS_CONFIG[normalized]?.variant ?? "outline";
}

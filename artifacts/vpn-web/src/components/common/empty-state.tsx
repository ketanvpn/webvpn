import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — placeholder terpadu untuk daftar kosong / hasil filter nihil / halaman belum siap.
 *
 * Menggantikan pola lama yang bervariasi:
 *   <div className="text-center py-16 rounded-xl glass-panel ...">...</div>
 *   <p className="text-sm text-muted-foreground text-center py-4">Belum ada order.</p>
 *
 * Contoh:
 *   <EmptyState icon={PackageX} title="Belum ada produk untuk kategori ini." />
 *
 *   <EmptyState
 *     icon={ShoppingCart}
 *     title="Belum ada order"
 *     description="Order pertama akan muncul di sini setelah checkout."
 *     action={<Button asChild><Link href="/order-vpn">Buat Order</Link></Button>}
 *   />
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Kompak = padding kecil untuk kasus "no data" di dalam kartu list. Default false = padding besar. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-panel flex flex-col items-center justify-center gap-3 rounded-xl border-white/5 text-center",
        compact ? "px-4 py-6" : "px-6 py-16",
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn("text-muted-foreground/50", compact ? "h-8 w-8" : "h-10 w-10")}
          aria-hidden
        />
      ) : null}
      <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

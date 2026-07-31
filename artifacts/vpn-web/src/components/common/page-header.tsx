import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — hierarki halaman terpadu.
 *
 * Satu-satunya cara sah untuk merender <h1> di dalam halaman.
 * Ganti pola lama `<div><h1 className="text-3xl font-bold ...">...</h1><p>...</p></div>`
 * yang tersebar di 25+ halaman dengan skala/warna/spasi tidak seragam.
 *
 * Contoh:
 *   <PageHeader title="Orders" description="Kelola pembelian user." />
 *
 *   <PageHeader
 *     title="Produk"
 *     description="Kelola paket VPN."
 *     icon={Package}
 *     actions={<Button>Tambah</Button>}
 *   />
 */
export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Ikon opsional di kiri judul (Lucide). */
  icon?: LucideIcon;
  /** Slot kanan: tombol, search, filter. Auto-stack di mobile. */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {Icon ? <Icon className="h-6 w-6 shrink-0 text-primary md:h-7 md:w-7" /> : null}
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

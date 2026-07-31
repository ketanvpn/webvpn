import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageContainer — lebar konten terpadu.
 *
 * `Layout` wrapper default sudah menerapkan `max-w-6xl` untuk seluruh app.
 * Ini terlalu sempit untuk table/monitoring admin, dan terlalu lebar untuk
 * form auth/setting. Gunakan PageContainer hanya bila halaman perlu OVERRIDE:
 *
 *   - `content` (default 6xl / 1152px): daftar produk, dashboard umum.
 *     Dalam praktiknya jarang perlu — biarkan tanpa PageContainer.
 *   - `wide`    (7xl / 1280px): tabel besar admin (orders, users, servers).
 *   - `narrow`  (2xl /  672px): form panjang, setting, halaman detail.
 *
 * Halaman TIDAK wajib memakai PageContainer — hanya bila perlu override lebar.
 *
 * ponytail: variant "full" (max-w-none) belum ditambahkan; add when
 *   ada halaman monitoring yang perlu edge-to-edge (misal grafik real-time).
 */
export type PageContainerVariant = "content" | "wide" | "narrow";

const VARIANT_CLASS: Record<PageContainerVariant, string> = {
  content: "max-w-6xl",
  wide: "max-w-7xl",
  narrow: "max-w-2xl",
};

export interface PageContainerProps {
  variant?: PageContainerVariant;
  className?: string;
  children: React.ReactNode;
}

export function PageContainer({
  variant = "content",
  className,
  children,
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full", VARIANT_CLASS[variant], className)}>
      {children}
    </div>
  );
}

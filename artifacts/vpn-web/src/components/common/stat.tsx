import * as React from "react";
import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Stat — kartu statistik terpadu untuk dashboard admin & user.
 *
 * Menggantikan pola lama yang mencampur `glass-panel`/`glass-card`, radius arbitrary,
 * dan shadow hex hard-coded (mis. `shadow-[0_0_15px_rgba(16,185,129,0.2)]`).
 *
 * Aturan:
 *   - Panel besar (containers) tetap pakai `glass-panel`.
 *   - Stat adalah *kartu* → selalu `glass-card` (sesuai UI-GUIDE).
 *   - Warna emphasis lewat `tone`, bukan class hex custom.
 *   - Bila punya `href`, seluruh kartu jadi interaktif dengan hover state konsisten.
 *
 * Contoh:
 *   <Stat label="Total Pendapatan" value={formatRupiah(x)} icon={Wallet} tone="primary" />
 *   <Stat label="Order Tertunda" value={n} icon={ShoppingCart} tone="warning" href="/admin/orders" />
 *
 * ponytail: `trend` (delta % + arrow) belum diimplement; add when
 *   dashboard butuh comparison antar-periode.
 */
export type StatTone = "default" | "primary" | "warning" | "danger" | "success";

const TONE_CLASS: Record<StatTone, { card: string; icon: string; value: string; delta: string }> = {
  default: {
    card: "border-white/5",
    icon: "text-muted-foreground",
    value: "text-foreground",
    delta: "text-muted-foreground",
  },
  primary: {
    card: "border-primary/30 glow-border-primary",
    icon: "text-primary",
    value: "text-primary",
    delta: "text-primary/80",
  },
  warning: {
    card: "border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.15)]",
    icon: "text-yellow-500",
    value: "text-yellow-500",
    delta: "text-yellow-500/80",
  },
  danger: {
    card: "border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
    icon: "text-red-500",
    value: "text-red-500",
    delta: "text-red-500/80",
  },
  success: {
    card: "border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    icon: "text-emerald-500",
    value: "text-emerald-500",
    delta: "text-emerald-500/80",
  },
};

export interface StatProps {
  label: string;
  /** Value siap tampil (string terformat / angka). Wrapper handle tipografi. */
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Baris kecil di bawah value: "+12% bulan ini", "5 baru hari ini", dst. */
  delta?: React.ReactNode;
  tone?: StatTone;
  /** Bila diisi, seluruh kartu menjadi link interaktif dengan hover state. */
  href?: string;
  /** Loading skeleton menggantikan value + delta. */
  isLoading?: boolean;
  className?: string;
}

export function Stat({
  label,
  value,
  icon: Icon,
  delta,
  tone = "default",
  href,
  isLoading = false,
  className,
}: StatProps) {
  const toneClass = TONE_CLASS[tone];
  const interactive = Boolean(href);

  const card = (
    <Card
      className={cn(
        "glass-card transition-all",
        toneClass.card,
        interactive && tone === "default"
          ? "cursor-pointer hover:border-primary/50 hover:glow-border-primary"
          : "",
        interactive && tone !== "default" ? "cursor-pointer" : "",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className={cn("h-4 w-4", toneClass.icon)} /> : null}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ) : (
          <>
            <div className={cn("text-2xl font-bold tracking-tight", toneClass.value)}>{value}</div>
            {delta ? <p className={cn("mt-1 text-xs", toneClass.delta)}>{delta}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );

  return interactive ? <Link href={href!}>{card}</Link> : card;
}

import { Card } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import type { ResellerStatus } from "@/lib/types/profile";
import { Crown, RefreshCw, Target, Trophy, Flame, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  status: ResellerStatus;
  onRefresh?: () => void;
  loading?: boolean;
};

export function ResellerStatusCard({ status, onRefresh, loading }: Props) {
  const progress = status.progressPercent ?? 0;
  const targetMet = progress >= 100;
  const daysRemaining = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(0, lastDay.getDate() - now.getDate());
  })();

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background shadow-sm">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 left-1/4 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none" />

      <div className="relative px-5 py-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Crown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-base flex items-center gap-2">
                Status Reseller
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  AKTIF
                </span>
              </p>
              <p className="text-xs text-muted-foreground">Bulan {status.currentMonth}</p>
            </div>
          </div>
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading} className="h-9 w-9" aria-label="Refresh status reseller">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-4">
          <span className="text-sm text-muted-foreground">Diskon harga reseller</span>
          <span className="font-bold text-emerald-700 dark:text-emerald-300 text-xl">{status.discountPercent}%</span>
        </div>

        {status.targetEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Penjualan Bulan Ini</span>
              <span className="font-bold">{formatRupiah(status.currentMonthSales)}</span>
            </div>

            <div className="relative h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-cyan-400"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
              {targetMet && <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-pulse" />}
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-muted-foreground">Target: {formatRupiah(status.monthlyTarget)}</span>
              </div>
              {targetMet ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <Trophy className="h-3 w-3" />
                  Tercapai!
                </span>
              ) : (
                <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Evaluasi: tanggal 1</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Flame className={`h-3 w-3 ${daysRemaining <= 7 ? "text-orange-400" : "text-muted-foreground"}`} />
                <span className={daysRemaining <= 7 ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}>
                  {daysRemaining} hari tersisa
                </span>
              </div>
            </div>

            {!targetMet && status.monthlyTarget - status.currentMonthSales > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <p className="text-[11px] text-orange-700 dark:text-orange-300">
                  Kurang <span className="font-bold">{formatRupiah(status.monthlyTarget - status.currentMonthSales)}</span> untuk mencapai target
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">Status reseller permanen — tanpa target bulanan</p>
          </div>
        )}
      </div>
    </div>
  );
}

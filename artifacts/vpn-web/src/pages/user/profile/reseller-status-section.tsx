import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, RefreshCw, CheckCircle } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import type { ResellerStatus } from "./types";

interface ResellerStatusSectionProps {
  resellerStatus: ResellerStatus;
  resellerLoading: boolean;
  onRefresh: () => void;
}

export function ResellerStatusSection({
  resellerStatus,
  resellerLoading,
  onRefresh,
}: ResellerStatusSectionProps) {
  return (
    <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-blue-50/80 via-transparent to-transparent dark:from-blue-950/20">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">Status Reseller</p>
              <p className="text-xs text-muted-foreground">Bulan {resellerStatus.currentMonth}</p>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={resellerLoading}
            className="text-muted-foreground hover:text-blue-600 disabled:opacity-40 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${resellerLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Discount badge */}
        <div className="flex items-center justify-between rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 mb-4">
          <span className="text-sm text-muted-foreground">Diskon harga reseller</span>
          <span className="font-bold text-green-600 text-xl">
            {resellerStatus.discountPercent}%
          </span>
        </div>

        {/* Progress */}
        {resellerStatus.targetEnabled ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Penjualan bulan ini</p>
                <p className="text-lg font-bold">
                  {formatRupiah(resellerStatus.currentMonthSales)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                Target: {formatRupiah(resellerStatus.monthlyTarget)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Progress value={resellerStatus.progressPercent ?? 0} className="h-2.5" />
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-semibold ${
                    (resellerStatus.progressPercent ?? 0) >= 100
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {resellerStatus.progressPercent ?? 0}%
                </span>
                {(resellerStatus.progressPercent ?? 0) >= 100 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Target tercapai!
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Kurang{" "}
                    {formatRupiah(
                      resellerStatus.monthlyTarget - resellerStatus.currentMonthSales
                    )}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Status dievaluasi setiap tanggal 1.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Target bulanan tidak diaktifkan. Status reseller kamu permanen.
          </p>
        )}
      </div>
    </Card>
  );
}

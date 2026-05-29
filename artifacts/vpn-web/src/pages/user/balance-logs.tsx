import { useListBalanceLogs, getListBalanceLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Settings2, History } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { formatRupiah } from "@/lib/format";
import { useState } from "react";

const LIMIT = 30;

function typeLabel(type: string, description = "") {
  const lower = description.toLowerCase();
  if (type === "topup") return { label: "Topup", color: "bg-green-500/10 text-green-700 border-green-200" };
  if (type === "order" && lower.includes("renew")) return { label: "Renew", color: "bg-amber-500/10 text-amber-700 border-amber-200" };
  if (type === "order") return { label: "Pembelian", color: "bg-red-500/10 text-red-700 border-red-200" };
  if (type === "adjustment") return { label: "Penyesuaian", color: "bg-blue-500/10 text-blue-700 border-blue-200" };
  if (type === "refund") return { label: "Refund", color: "bg-purple-500/10 text-purple-700 border-purple-200" };
  return { label: type, color: "bg-gray-500/10 text-gray-700 border-gray-200" };
}

function TypeIcon({ type }: { type: string }) {
  if (type === "topup" || type === "refund") return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
  if (type === "order") return <ArrowUpRight className="h-4 w-4 text-red-600" />;
  return <Settings2 className="h-4 w-4 text-blue-600" />;
}

export default function BalanceLogs() {
  const [offset, setOffset] = useState(0);

  const { data, isLoading } = useListBalanceLogs(
    { limit: LIMIT, offset },
    { query: { queryKey: getListBalanceLogsQueryKey({ limit: LIMIT, offset }), staleTime: 30000 } }
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasNext = offset + LIMIT < total;
  const hasPrev = offset > 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6 text-primary" /> Riwayat Saldo
        </h1>
        <p className="text-muted-foreground mt-1">
          Semua perubahan saldo akun kamu — topup, pembelian, dan penyesuaian admin.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">Log Transaksi Saldo</CardTitle>
          <CardDescription>Total {total} transaksi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Belum ada riwayat perubahan saldo</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const { label, color } = typeLabel(log.type, log.description);
                const isPositive = log.amount >= 0;
                return (
                  <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-accent/20 transition-colors">
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <TypeIcon type={log.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.description}</span>
                        <Badge className={`text-[10px] ${color}`} variant="outline">{label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                        <span>{format(new Date(log.createdAt), "d MMM yyyy, HH:mm", { locale: idLocale })}</span>
                        <span className="text-muted-foreground/60">
                          Saldo: {formatRupiah(log.balanceBefore)} → {formatRupiah(log.balanceAfter)}
                        </span>
                      </div>
                    </div>
                    <div className={`font-bold text-sm flex-shrink-0 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                      {isPositive ? "+" : ""}{formatRupiah(log.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
          >
            ← Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + LIMIT, total)} dari {total}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => setOffset(offset + LIMIT)}
          >
            Berikutnya →
          </Button>
        </div>
      )}
    </div>
  );
}

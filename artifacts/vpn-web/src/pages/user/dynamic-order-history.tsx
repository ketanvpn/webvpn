import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Activity, RefreshCw, Server, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { dynamicDurationUnit } from "@/lib/dynamic-duration";
import { DynamicOrderStatusBadge, type OrderStatus } from "@/components/dynamic-order-status-badge";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";

type DynamicOrder = {
  id: number;
  provider: string;
  serverDisplayName: string;
  protocol: string;
  durationType: string;
  duration: number;
  username: string;
  amount: number;
  status: OrderStatus;
  paymentMethod: string;
  vpnAccountId: number | null;
  createdAt: string;
};

function providerLabel(provider: string) {
  return provider === "local_panel" ? "Server Saya" : "Dynamic";
}

export default function DynamicOrderHistory() {
  const ordersQuery = useQuery<{ orders: DynamicOrder[] }>({
    queryKey: ["user-dynamic-vpn-orders"],
    queryFn: () => apiClient.get<{ orders: DynamicOrder[] }>("/api/dynamic-vpn/orders"),
  });

  const orders = ordersQuery.data?.orders ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6 text-primary" /> Riwayat Order Dynamic
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Riwayat order dari menu Order VPN, termasuk Server Saya dan dynamic.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => ordersQuery.refetch()} disabled={ordersQuery.isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button asChild>
            <Link href="/order-vpn">Order VPN</Link>
          </Button>
        </div>
      </div>

      <Card className="glass-panel border-white/5">
        <CardHeader>
          <CardTitle>Daftar Order Dynamic</CardTitle>
          <CardDescription>{orders.length} order terbaru.</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Memuat order...</p>
          ) : ordersQuery.isError ? (
            <p className="py-10 text-center text-sm text-destructive">{ordersQuery.error.message}</p>
          ) : orders.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              <Server className="mx-auto mb-3 h-8 w-8 opacity-40" />
              Belum ada order dynamic.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/order-vpn/history/${order.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-white/[0.06] cursor-pointer"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">#{order.id}</Badge>
                        <Badge variant="outline">{providerLabel(order.provider)}</Badge>
                        <DynamicOrderStatusBadge status={order.status} />
                        <Badge variant="secondary" className="uppercase">{order.protocol}</Badge>
                      </div>
                      <div>
                        <h3 className="break-words font-bold">{order.serverDisplayName}</h3>
                        <p className="break-words text-sm text-muted-foreground">
                          Akun VPN: <span className="font-mono text-foreground">{order.username}</span> - {order.duration} {dynamicDurationUnit(order.durationType)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Dibuat: {format(new Date(order.createdAt), "d MMM yyyy, HH:mm")}</span>
                        <span>Bayar: {order.paymentMethod === "balance" ? "Saldo" : order.paymentMethod}</span>
                        {order.vpnAccountId && (
                          <span className="text-primary">Akun VPN aktif</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-right text-sm sm:min-w-40">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="font-bold text-primary">{formatRupiah(order.amount)}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

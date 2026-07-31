import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Activity, CheckCircle2, Clock, RefreshCw, Server, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { dynamicDurationUnit } from "@/lib/dynamic-duration";

type DynamicOrder = {
  id: number;
  provider: string;
  serverDisplayName: string;
  protocol: string;
  durationType: string;
  duration: number;
  username: string;
  amount: number;
  status: string;
  paymentMethod: string;
  vpnAccountId: number | null;
  createdAt: string;
};

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusBadge(status: string) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (status === "processing") return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
  if (status === "pending") return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  return "bg-red-500/10 text-red-300 border-red-500/30";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "paid") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "processing") return <RefreshCw className="h-4 w-4 animate-spin" />;
  if (status === "pending") return <Clock className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

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
                <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-white/[0.06]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">#{order.id}</Badge>
                        <Badge variant="outline">{providerLabel(order.provider)}</Badge>
                        <Badge className={`${statusBadge(order.status)} gap-1 uppercase`}><StatusIcon status={order.status} /> {order.status}</Badge>
                        <Badge variant="secondary" className="uppercase">{order.protocol}</Badge>
                      </div>
                      <div>
                        <h3 className="break-words font-bold">{order.serverDisplayName}</h3>
                        <p className="break-words text-sm text-muted-foreground">
                          Akun VPN: <span className="font-mono text-foreground">{order.username}</span> • {order.duration} {dynamicDurationUnit(order.durationType)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Dibuat: {formatDate(order.createdAt)}</span>
                        <span>Bayar: {order.paymentMethod === "balance" ? "Saldo" : order.paymentMethod}</span>
                        {order.vpnAccountId && (
                          <Link href={`/accounts/${order.vpnAccountId}`} className="text-primary hover:underline">
                            Lihat akun
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-right text-sm sm:min-w-40">
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="font-bold text-primary">{rupiah(order.amount)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useParams } from "wouter";
import { dynamicDurationUnit } from "@/lib/dynamic-duration";
import { DynamicOrderStatusBadge, DynamicOrderStatusPanel, type OrderStatus } from "@/components/dynamic-order-status-badge";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

type DynamicOrder = {
  id: number;
  provider: string;
  serverDisplayName: string;
  protocol: string;
  durationType: string;
  duration: number;
  username: string;
  amount: number;
  discountAmount: number;
  status: OrderStatus;
  paymentMethod: string;
  vpnAccountId: number | null;
  createdAt: string;
};

function providerLabel(provider: string) {
  return provider === "local_panel" ? "Server Saya" : "Dynamic";
}

export default function DynamicOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isRefetching, setIsRefetching] = useState(false);

  const orderQuery = useQuery<{ order: DynamicOrder }>({
    queryKey: ["dynamic-vpn-order", orderId],
    queryFn: () => apiClient.get<{ order: DynamicOrder }>(`/api/dynamic-vpn/orders/${orderId}`),
    enabled: Number.isInteger(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.order?.status;
      return status === "processing" ? 3000 : false;
    },
  });

  const order = orderQuery.data?.order;

  useEffect(() => {
    if (orderQuery.isFetching && order?.status === "processing") {
      setIsRefetching(true);
    } else {
      setIsRefetching(false);
    }
  }, [orderQuery.isFetching, order?.status]);

  const payMutation = useMutation({
    mutationFn: () => apiClient.post<{ order: DynamicOrder }>(`/api/dynamic-vpn/orders/${orderId}/pay`),
    onSuccess: (data) => {
      queryClient.setQueryData(["dynamic-vpn-order", orderId], data);
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-vpn-orders"] });
      queryClient.invalidateQueries({ queryKey: ["user-balance"] });
      toast({
        title: "Pembayaran berhasil",
        description: "Order berhasil diproses dan akun VPN sudah dibuat.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Pembayaran gagal",
        description: error.message || "Terjadi kesalahan. Silakan coba lagi.",
        variant: "destructive",
      });
    },
  });

  if (!Number.isInteger(orderId)) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="glass-panel border-white/5">
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">ID order tidak valid.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/order-vpn/history">
                <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Riwayat
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="glass-panel border-white/5">
          <CardContent className="py-10 text-center">
            <RefreshCw className="mx-auto h-8 w-8 text-muted-foreground animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Memuat detail order...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="glass-panel border-white/5">
          <CardContent className="py-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">Order tidak ditemukan atau terjadi kesalahan.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/order-vpn/history">
                <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Riwayat
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isRetryable = order.status === "pending" || order.status === "failed";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/order-vpn/history">
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detail Order #{order.id}</h1>
          <p className="text-sm text-muted-foreground">
            Dibuat: {format(new Date(order.createdAt), "d MMM yyyy, HH:mm")}
          </p>
        </div>
      </div>

      {isRefetching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Memperbarui status...
        </div>
      )}

      <Card className="glass-panel border-white/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informasi Order</CardTitle>
            <DynamicOrderStatusBadge status={order.status} />
          </div>
          <CardDescription>Order dari {providerLabel(order.provider)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DynamicOrderStatusPanel status={order.status} vpnAccountId={order.vpnAccountId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Server</p>
              <p className="font-semibold">{order.serverDisplayName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Protocol</p>
              <Badge variant="secondary" className="uppercase">{order.protocol}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Username VPN</p>
              <p className="font-mono">{order.username}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Durasi</p>
              <p>{order.duration} {dynamicDurationUnit(order.durationType)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Metode Pembayaran</p>
              <p>{order.paymentMethod === "balance" ? "Saldo" : order.paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="font-bold text-primary">{formatRupiah(order.amount)}</p>
            </div>
          </div>

          {order.discountAmount > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-400">Diskon diterapkan: {formatRupiah(order.discountAmount)}</p>
            </div>
          )}

          {isRetryable && (
            <div className="pt-4 border-t border-white/10">
              <Button
                onClick={() => payMutation.mutate()}
                disabled={payMutation.isPending}
                className="w-full gap-2"
              >
                {payMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Coba Bayar Lagi
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Saldo akan otomatis dikurangi jika pembayaran berhasil.
              </p>
            </div>
          )}

          {order.status === "paid" && order.vpnAccountId && (
            <div className="pt-4 border-t border-white/10">
              <Button asChild className="w-full gap-2">
                <Link href={`/accounts/${order.vpnAccountId}`}>
                  <ExternalLink className="h-4 w-4" /> Lihat Akun VPN
                </Link>
              </Button>
            </div>
          )}

          {order.status === "expired" && (
            <div className="pt-4 border-t border-white/10">
              <Button asChild className="w-full gap-2">
                <Link href="/order-vpn">
                  Buat Order Baru
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

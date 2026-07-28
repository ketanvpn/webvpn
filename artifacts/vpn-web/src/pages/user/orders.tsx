import { useListOrders } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";
import { ChevronRight, ShoppingBag } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10",
  processing: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  paid: "border-green-500/30 text-green-400 bg-green-500/10",
  failed: "border-red-500/30 text-red-400 bg-red-500/10",
  expired: "border-gray-500/30 text-gray-400 bg-gray-500/10",
};

const statusLabel: Record<string, string> = {
  pending: "Menunggu",
  processing: "Diproses",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Expired",
};

const paymentLabel: Record<string, string> = {
  balance: "Saldo",
  qris: "QRIS",
};

export default function Orders() {
  const { data, isLoading } = useListOrders();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Riwayat Order</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Riwayat pembelian paket VPN kamu.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : data?.orders && data.orders.length > 0 ? (
        <div className="glass-panel rounded-xl overflow-hidden divide-y divide-white/5">
          {data.orders.map((order) => {
            const isDynamic = Boolean((order as typeof order & { isDynamic?: boolean }).isDynamic);
            const content = (
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer">
                {/* Kiri: ID + Produk + Waktu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">#{order.id}</span>
                    {isDynamic && <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-primary/30 text-primary">Dynamic</Badge>}
                    {order.product && (
                      <span className="text-xs text-muted-foreground truncate">
                        · {order.product.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(order.createdAt), "d MMM yyyy, HH:mm")}
                    </span>
                    {order.paymentMethod && (
                      <span className="text-[10px] text-muted-foreground">
                        · {paymentLabel[order.paymentMethod] ?? order.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>

                {/* Kanan: Nominal + Status + Arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatRupiah(order.payableAmount ?? order.amount)}</div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 px-1.5 mt-0.5 ${statusColors[order.status] ?? ""}`}
                    >
                      {statusLabel[order.status] ?? order.status}
                    </Badge>
                  </div>
                  {!isDynamic && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            );
            return isDynamic ? <div key={`dynamic-${order.id}`}>{content}</div> : <Link key={`static-${order.id}`} href={`/orders/${order.id}`}>{content}</Link>;
          })}
        </div>
      ) : (
        <div className="text-center py-16 rounded-xl border border-dashed border-white/20 glass-card">
          <ShoppingBag className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Belum ada order.</p>
          <Link href="/order-vpn" className="text-primary hover:underline text-sm mt-1.5 inline-block">
            Order VPN sekarang →
          </Link>
        </div>
      )}
    </div>
  );
}

import { useListOrders } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";
import { ChevronRight, ShoppingBag } from "lucide-react";
import type { OrderStatus } from "@workspace/api-client-react";

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const statusLabel: Record<OrderStatus, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export default function Orders() {
  const { data, isLoading } = useListOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Riwayat Order</h1>
        <p className="text-muted-foreground mt-1">Lihat dan kelola riwayat pembelian kamu.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : data?.orders && data.orders.length > 0 ? (
        <div className="space-y-4">
          {data.orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer group">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="space-y-1">
                      <div className="font-semibold text-lg">Order #{order.id}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "d MMM yyyy, HH:mm")}
                      </div>
                    </div>
                    {order.product && (
                      <div className="hidden sm:block border-l pl-6 space-y-1">
                        <div className="font-medium">{order.product.name}</div>
                        <div className="text-sm text-muted-foreground uppercase">{order.product.protocol}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right space-y-1">
                      <div className="font-bold text-lg">{formatRupiah(order.amount)}</div>
                      <Badge variant="outline" className={statusColors[order.status]}>
                        {statusLabel[order.status]}
                      </Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border rounded-xl bg-card border-dashed">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Belum ada order.</p>
          <Link href="/products" className="text-primary hover:underline font-medium mt-2 inline-block">
            Lihat produk →
          </Link>
        </div>
      )}
    </div>
  );
}

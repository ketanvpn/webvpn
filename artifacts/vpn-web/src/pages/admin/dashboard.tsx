import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShoppingCart, Wallet, Server, Activity, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const statusLabel: Record<string, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard({
    query: { refetchInterval: 30_000 },
  });

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Ringkasan Admin</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Ringkasan Admin</h1>
        <p className="text-muted-foreground mt-1">Statistik platform dan aktivitas terbaru.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Total Pendapatan</CardTitle>
            <Wallet className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalRevenue)}</div>
            <p className="text-xs mt-1 text-primary-foreground/80">
              +{formatRupiah(summary.revenueThisMonth || 0)} bulan ini
            </p>
          </CardContent>
        </Card>

        <Link href="/admin/users">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pengguna</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers}</div>
              <p className="text-xs mt-1 text-muted-foreground">Klik untuk kelola pengguna</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/accounts">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">VPN Aktif</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeAccounts}</div>
              <p className="text-xs mt-1 text-muted-foreground flex gap-2 flex-wrap">
                {summary.ordersByProtocol?.map(p => (
                  <span key={p.protocol} className="uppercase">{p.protocol}:{p.count}</span>
                ))}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/topups">
          <Card className={`cursor-pointer hover:shadow-md transition-all ${summary.pendingTopups > 0 ? "border-yellow-500/50 bg-yellow-500/5 hover:border-yellow-500" : "hover:border-primary/50"}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Topup Tertunda</CardTitle>
              <Activity className={`h-4 w-4 ${summary.pendingTopups > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.pendingTopups > 0 ? "text-yellow-600" : ""}`}>
                {summary.pendingTopups}
              </div>
              {summary.pendingTopups > 0 ? (
                <p className="text-xs mt-1 text-yellow-600/80 font-medium">Klik untuk proses →</p>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">Semua sudah diproses</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders?status=pending">
          <Card className={`cursor-pointer hover:shadow-md transition-all ${summary.pendingOrders > 0 ? "border-orange-500/50 bg-orange-500/5 hover:border-orange-500" : "hover:border-primary/50"}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Order Tertunda</CardTitle>
              <ShoppingCart className={`h-4 w-4 ${summary.pendingOrders > 0 ? "text-orange-600" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.pendingOrders > 0 ? "text-orange-600" : ""}`}>
                {summary.pendingOrders}
              </div>
              {summary.pendingOrders > 0 ? (
                <p className="text-xs mt-1 text-orange-600/80 font-medium">Klik untuk konfirmasi →</p>
              ) : (
                <p className="text-xs mt-1 text-muted-foreground">Semua sudah diproses</p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Order Terbaru</CardTitle>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.recentOrders && summary.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {summary.recentOrders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">
                        {order.user?.username} <span className="text-muted-foreground font-normal">beli</span> {order.product?.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(order.createdAt), "d MMM, HH:mm")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatRupiah(order.amount)}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {statusLabel[order.status] ?? order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada order.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Topup Terbaru</CardTitle>
            <Link href="/admin/topups" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.recentTopups && summary.recentTopups.length > 0 ? (
              <div className="space-y-4">
                {summary.recentTopups.map((topup) => (
                  <div key={topup.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{topup.username}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(topup.createdAt), "d MMM, HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-primary">+{formatRupiah(topup.amount)}</div>
                      <Badge
                        variant={topup.status === "confirmed" ? "default" : topup.status === "pending" ? "secondary" : "destructive"}
                        className="mt-1 text-[10px]"
                      >
                        {topup.status === "confirmed" ? "Dikonfirmasi" : topup.status === "pending" ? "Menunggu" : "Ditolak"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada topup.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

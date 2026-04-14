import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Wallet, Server, ShoppingCart, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Ringkasan status akun dan aktivitas terbaru.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/balance">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all bg-primary text-primary-foreground">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary-foreground/80">Saldo</CardTitle>
              <Wallet className="h-4 w-4 opacity-80" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatRupiah(summary.balance)}</div>
              {summary.pendingTopup !== undefined && summary.pendingTopup > 0 && (
                <p className="text-xs mt-1 text-primary-foreground/70">
                  + {formatRupiah(summary.pendingTopup)} pending
                </p>
              )}
              {(!summary.pendingTopup || summary.pendingTopup === 0) && (
                <p className="text-xs mt-1 text-primary-foreground/70">Klik untuk topup →</p>
              )}
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounts">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Akun Aktif</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeAccounts}</div>
              <p className="text-xs mt-1 text-muted-foreground">Klik untuk kelola →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/orders">
          <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Order</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders}</div>
              <p className="text-xs mt-1 text-muted-foreground">Klik untuk riwayat →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accounts">
          <Card className={`cursor-pointer hover:shadow-md transition-all ${(summary.expiringAccounts?.length ?? 0) > 0 ? "border-destructive/50 bg-destructive/5 hover:border-destructive" : "hover:border-primary/50"}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${(summary.expiringAccounts?.length ?? 0) > 0 ? "text-destructive" : ""}`}>
                Segera Expired
              </CardTitle>
              <AlertCircle className={`h-4 w-4 ${(summary.expiringAccounts?.length ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(summary.expiringAccounts?.length ?? 0) > 0 ? "text-destructive" : ""}`}>
                {summary.expiringAccounts?.length || 0}
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                {(summary.expiringAccounts?.length ?? 0) > 0 ? "Segera perpanjang →" : "Semua aman"}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Order Terbaru</CardTitle>
            <Link href="/orders" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.recentOrders && summary.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {summary.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">Order #{order.id}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(order.createdAt), "d MMM yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-sm">{formatRupiah(order.amount)}</div>
                      <Badge variant={
                        order.status === "paid" ? "default" :
                        order.status === "pending" ? "secondary" : "destructive"
                      } className="text-[10px]">
                        {order.status === "paid" ? "Lunas" : order.status === "pending" ? "Menunggu" : order.status === "failed" ? "Gagal" : "Kedaluwarsa"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada order.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Akun Segera Expired</CardTitle>
            <Link href="/accounts" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.expiringAccounts && summary.expiringAccounts.length > 0 ? (
              <div className="space-y-4">
                {summary.expiringAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm font-mono">{account.username}</div>
                      <div className="text-xs text-muted-foreground uppercase mt-0.5">{account.protocol}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-destructive font-medium">
                        {format(new Date(account.expiresAt), "d MMM")}
                      </div>
                      <Link href={`/accounts/${account.id}`} className="text-xs text-primary hover:underline">
                        Kelola →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada akun yang akan expired.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

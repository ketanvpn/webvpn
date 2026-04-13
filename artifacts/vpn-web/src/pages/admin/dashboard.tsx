import { useGetAdminDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShoppingCart, Wallet, Server, Activity, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard();

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Platform statistics and recent activities.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary-foreground/80">Total Revenue</CardTitle>
            <Wallet className="h-4 w-4 opacity-80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalRevenue)}</div>
            <p className="text-xs mt-1 text-primary-foreground/80">
              +{formatRupiah(summary.revenueThisMonth || 0)} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active VPNs</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeAccounts}</div>
            <p className="text-xs mt-1 text-muted-foreground flex gap-2">
              {summary.ordersByProtocol?.map(p => (
                <span key={p.protocol} className="uppercase">{p.protocol}:{p.count}</span>
              ))}
            </p>
          </CardContent>
        </Card>

        <Card className={summary.pendingTopups > 0 ? "border-yellow-500/50 bg-yellow-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Topups</CardTitle>
            <Activity className={`h-4 w-4 ${summary.pendingTopups > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.pendingTopups > 0 ? "text-yellow-600" : ""}`}>
              {summary.pendingTopups}
            </div>
            {summary.pendingTopups > 0 && (
              <p className="text-xs mt-1 text-yellow-600/80 font-medium">Requires action</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentOrders?.map((order) => (
                <div key={order.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-sm">
                      {order.user?.username} <span className="text-muted-foreground font-normal">bought</span> {order.product?.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(order.createdAt), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{formatRupiah(order.amount)}</div>
                    <Badge variant="outline" className="mt-1 text-[10px] capitalize">
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Topups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.recentTopups?.map((topup) => (
                <div key={topup.id} className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-full">
                      <ArrowUpRight className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{topup.username}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(topup.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-primary">+{formatRupiah(topup.amount)}</div>
                    <Badge variant={topup.status === 'confirmed' ? "default" : topup.status === 'pending' ? "secondary" : "destructive"} className="mt-1 text-[10px] capitalize">
                      {topup.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

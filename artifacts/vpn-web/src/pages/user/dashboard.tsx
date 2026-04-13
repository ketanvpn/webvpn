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
        <p className="text-muted-foreground mt-1">Overview of your account status and recent activity.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatRupiah(summary.balance)}</div>
            {summary.pendingTopup !== undefined && summary.pendingTopup > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                + {formatRupiah(summary.pendingTopup)} pending
              </p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeAccounts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">Expiring Soon</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {summary.expiringAccounts?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Accounts expiring in 3 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recentOrders && summary.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {summary.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">Order #{order.id}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-medium">{formatRupiah(order.amount)}</div>
                      <Badge variant={
                        order.status === "paid" ? "default" :
                        order.status === "pending" ? "secondary" : "destructive"
                      }>
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent orders found.</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Expiring Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.expiringAccounts && summary.expiringAccounts.length > 0 ? (
              <div className="space-y-4">
                {summary.expiringAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium">{account.username}</div>
                      <div className="text-sm text-muted-foreground uppercase">{account.protocol}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-destructive font-medium">
                        Expires {format(new Date(account.expiresAt), "MMM d")}
                      </div>
                      <Link href={`/accounts/${account.id}`} className="text-xs text-primary hover:underline">
                        Manage
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No accounts expiring soon.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ShoppingCart, Wallet, Server, Activity, ArrowUpRight, TrendingUp, BarChart2, Inbox } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { apiClient } from "@/lib/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, Stat, EmptyState } from "@/components/common";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

interface ChartDay {
  date: string;
  revenue: number;
  orders: number;
}

const statusLabel: Record<string, string> = {
  pending: "Menunggu",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return format(d, "d MMM", { locale: idLocale });
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const primary = payload[0]?.value ?? 0;
  const secondary = payload[1]?.value;
  return (
    <div className="glass-panel rounded-lg border border-white/10 p-3 text-sm space-y-1 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="font-bold text-primary">
        {formatValue ? formatValue(primary) : primary}
      </p>
      {secondary !== undefined ? (
        <p className="text-muted-foreground">{secondary} order</p>
      ) : null}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), refetchInterval: 30_000 },
  });

  const [chartDays, setChartDays] = useState(14);

  const { data: chartData, isLoading: chartLoading } = useQuery<ChartDay[]>({
    queryKey: ["admin-revenue-chart", chartDays],
    queryFn: () => apiClient.get<ChartDay[]>(`/api/admin/stats/revenue-chart?days=${chartDays}`),
    refetchInterval: 60_000,
  });

  if (isLoading || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ringkasan Admin" description="Statistik platform dan aktivitas terbaru." />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Stat key={i} label="" value="" isLoading />
          ))}
        </div>
      </div>
    );
  }

  const totalChartRevenue = chartData?.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const formattedChart = chartData?.map((d) => ({
    ...d,
    label: formatShortDate(d.date),
  })) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Ringkasan Admin" description="Statistik platform dan aktivitas terbaru." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Total Pendapatan"
          value={formatRupiah(summary.totalRevenue)}
          icon={Wallet}
          tone="primary"
          delta={`+${formatRupiah(summary.revenueThisMonth || 0)} bulan ini`}
        />
        <Stat
          label="Total Pengguna"
          value={summary.totalUsers}
          icon={Users}
          href="/admin/users"
          delta="Klik untuk kelola pengguna"
        />
        <Stat
          label="VPN Aktif"
          value={summary.activeAccounts}
          icon={Server}
          href="/admin/accounts"
          delta={
            summary.ordersByProtocol?.length ? (
              <span className="flex flex-wrap gap-2">
                {summary.ordersByProtocol.map((p) => (
                  <span key={p.protocol} className="uppercase">{p.protocol}:{p.count}</span>
                ))}
              </span>
            ) : null
          }
        />
        <Stat
          label="Topup Tertunda"
          value={summary.pendingTopups}
          icon={Activity}
          href="/admin/topups"
          tone={summary.pendingTopups > 0 ? "warning" : "default"}
          delta={summary.pendingTopups > 0 ? "Klik untuk proses →" : "Semua sudah diproses"}
        />
        <Stat
          label="Order Tertunda"
          value={summary.pendingOrders}
          icon={ShoppingCart}
          href="/admin/orders?status=pending"
          tone={summary.pendingOrders > 0 ? "warning" : "default"}
          delta={summary.pendingOrders > 0 ? "Klik untuk konfirmasi →" : "Semua sudah diproses"}
        />
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Statistik Pendapatan
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Total {formatRupiah(totalChartRevenue)} dalam {chartDays} hari terakhir
            </p>
          </div>
          <div className="flex gap-1.5">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  chartDays === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {d}H
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Revenue area chart */}
          <Card className="glass-panel border-white/5 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue Harian
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={formattedChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={chartDays <= 7 ? 0 : Math.floor(chartDays / 7) - 1}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}jt`;
                        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
                        return String(v);
                      }}
                      width={36}
                    />
                    <Tooltip content={<ChartTooltip formatValue={formatRupiah} />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#revenueGradient)"
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Orders bar chart */}
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                Order per Hari
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={formattedChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      interval={chartDays <= 7 ? 0 : Math.floor(chartDays / 7) - 1}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={24}
                    />
                    <Tooltip content={<ChartTooltip formatValue={(v) => `${v} order`} />} />
                    <Bar
                      dataKey="orders"
                      fill="hsl(var(--primary))"
                      radius={[3, 3, 0, 0]}
                      name="Order"
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-panel border-white/5">
          <CardHeader className="flex items-center justify-between border-b border-white/5 pb-4">
            <CardTitle>Order Terbaru</CardTitle>
            <Link href="/admin/orders" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.recentOrders && summary.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {summary.recentOrders.map((order: any) => {
                  const isDynamic = order.isDynamic || order.serverDisplayName;
                  return (
                    <div key={`${isDynamic ? 'dynamic' : 'static'}-${order.id}`} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {order.user?.username || `User #${order.userId}`}
                          <span className="text-muted-foreground font-normal">beli</span>
                          {isDynamic ? (
                            <span>
                              {order.serverDisplayName || 'Dynamic VPN'}
                              <span className="text-muted-foreground"> • {order.protocol?.toUpperCase()}</span>
                            </span>
                          ) : (
                            order.product?.name
                          )}
                          {isDynamic && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Dynamic</Badge>
                          )}
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
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Inbox} title="Belum ada order." compact />
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5">
          <CardHeader className="flex items-center justify-between border-b border-white/5 pb-4">
            <CardTitle>Topup Terbaru</CardTitle>
            <Link href="/admin/topups" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {summary.recentTopups && summary.recentTopups.length > 0 ? (
              <div className="space-y-4">
                {summary.recentTopups.map((topup) => (
                  <div key={topup.id} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-black/20 border border-white/5 rounded-full">
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
              <EmptyState icon={Inbox} title="Belum ada topup." compact />
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/5">
          <CardHeader className="flex items-center justify-between border-b border-white/5 pb-4">
            <CardTitle>Riwayat Aksi Admin Terbaru</CardTitle>
            <Link href="/admin/audit-logs" className="text-xs text-primary hover:underline">Lihat semua →</Link>
          </CardHeader>
          <CardContent>
            {(summary as any)?.recentAuditLogs && (summary as any).recentAuditLogs.length > 0 ? (
              <div className="space-y-4">
                {(summary as any).recentAuditLogs.map((log: any) => (
                  <div key={log.id} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">
                        {log.adminUsername || `Admin #${log.adminUserId}`} <span className="text-muted-foreground font-normal">melakukan</span> {log.action}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(log.createdAt), "d MMM, HH:mm")}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <Badge variant="outline">{log.targetType} {log.targetId ? `#${log.targetId}` : ''}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Inbox} title="Belum ada aksi admin." compact />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

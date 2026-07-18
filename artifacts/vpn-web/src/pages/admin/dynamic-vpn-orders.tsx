import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, CreditCard, RefreshCw, Search, Tag, UserRound, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dynamicDurationUnit } from "@/lib/dynamic-duration";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

type DynamicOrder = {
  id: number;
  userId: number;
  provider: string;
  providerServerId: string;
  serverDisplayName: string;
  protocol: string;
  durationType: string;
  duration: number;
  username: string;
  amount: number;
  discountAmount: number;
  status: string;
  paymentMethod: string;
  vpnAccountId: number | null;
  providerAccountId: string | null;
  voucherCode: string | null;
  buyer?: { username?: string | null; email?: string | null };
  createdAt: string;
  updatedAt: string;
};

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
  if (!res.ok) throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

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
  return provider === "local_panel" ? "Server Saya" : "NadiaVPN";
}

function providerBadge(provider: string) {
  return provider === "local_panel"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
}

export default function AdminDynamicVpnOrders() {
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [search, setSearch] = useState("");

  const ordersQuery = useQuery<{ orders: DynamicOrder[] }>({
    queryKey: ["admin-dynamic-vpn-orders", status, provider],
    queryFn: () => apiFetch(`/admin/dynamic-vpn/orders?status=${encodeURIComponent(status)}&provider=${encodeURIComponent(provider)}&limit=100`),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const filtered = orders.filter((order) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      order.id,
      order.username,
      order.serverDisplayName,
      order.protocol,
      order.providerAccountId,
      order.buyer?.username,
      order.buyer?.email,
      order.voucherCode,
    ].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

  const stats = {
    total: orders.length,
    paid: orders.filter((order) => order.status === "paid").length,
    pending: orders.filter((order) => order.status === "pending" || order.status === "processing").length,
    local: orders.filter((order) => order.provider === "local_panel").length,
    nadia: orders.filter((order) => order.provider === "nadiavpn").length,
    localRevenue: orders.filter((order) => order.status === "paid" && order.provider === "local_panel").reduce((sum, order) => sum + order.amount, 0),
    nadiaRevenue: orders.filter((order) => order.status === "paid" && order.provider === "nadiavpn").reduce((sum, order) => sum + order.amount, 0),
    revenue: orders.filter((order) => order.status === "paid").reduce((sum, order) => sum + order.amount, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight"><Activity className="text-primary" /> Riwayat Order VPN</h1>
          <p className="mt-1 text-muted-foreground">Pantau order dynamic VPN, status provisioning, voucher, dan akun provider.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari username, server, voucher..." />
          </div>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua provider</SelectItem>
              <SelectItem value="local_panel">Server Saya</SelectItem>
              <SelectItem value="nadiavpn">NadiaVPN</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => ordersQuery.refetch()} disabled={ordersQuery.isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-panel border-white/5"><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Total Order</p><p className="mt-1 text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="glass-panel border-emerald-500/20"><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Server Saya</p><p className="mt-1 text-2xl font-bold text-emerald-300">{stats.local}</p><p className="mt-1 text-xs text-muted-foreground">{rupiah(stats.localRevenue)}</p></CardContent></Card>
        <Card className="glass-panel border-cyan-500/20"><CardContent className="pt-5"><p className="text-xs text-muted-foreground">NadiaVPN</p><p className="mt-1 text-2xl font-bold text-cyan-300">{stats.nadia}</p><p className="mt-1 text-xs text-muted-foreground">{rupiah(stats.nadiaRevenue)}</p></CardContent></Card>
        <Card className="glass-panel border-primary/20"><CardContent className="pt-5"><p className="text-xs text-muted-foreground">Omzet Paid</p><p className="mt-1 text-2xl font-bold text-primary">{rupiah(stats.revenue)}</p><p className="mt-1 text-xs text-muted-foreground">Paid: {stats.paid} • Proses: {stats.pending}</p></CardContent></Card>
      </div>

      <Card className="glass-panel border-white/5">
        <CardHeader>
          <CardTitle>Daftar Order</CardTitle>
          <CardDescription>{filtered.length} order ditampilkan dari {orders.length} data terbaru.</CardDescription>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Memuat order...</p>
          ) : ordersQuery.isError ? (
            <p className="py-10 text-center text-sm text-destructive">{ordersQuery.error.message}</p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada order dynamic VPN.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((order) => (
                <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-white/[0.06]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">#{order.id}</Badge>
                        <Badge variant="outline" className={providerBadge(order.provider)}>{providerLabel(order.provider)}</Badge>
                        <Badge className={`${statusBadge(order.status)} gap-1 uppercase`}><StatusIcon status={order.status} /> {order.status}</Badge>
                        <Badge variant="secondary" className="uppercase">{order.protocol}</Badge>
                        {order.voucherCode && <Badge className="gap-1 bg-green-500/10 text-green-300 border-green-500/30"><Tag className="h-3 w-3" /> {order.voucherCode}</Badge>}
                      </div>
                      <div>
                        <h3 className="break-words font-bold text-white">{order.serverDisplayName}</h3>
                        <p className="break-words text-sm text-muted-foreground">Akun VPN: <span className="font-mono text-foreground">{order.username}</span> • {order.duration} {dynamicDurationUnit(order.durationType)}</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> Pembeli: {order.buyer?.username ?? `User #${order.userId}`}</span>
                        <span>Dibuat: {formatDate(order.createdAt)}</span>
                        {order.providerAccountId && <span>Provider ID: <span className="font-mono text-foreground">{order.providerAccountId}</span></span>}
                        {order.vpnAccountId && <span>VPN Account ID: <span className="font-mono text-foreground">{order.vpnAccountId}</span></span>}
                      </div>
                    </div>
                    <div className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm lg:w-44 lg:min-w-44">
                      <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total</span><span className="font-bold text-primary">{rupiah(order.amount)}</span></div>
                      {order.discountAmount > 0 && <div className="mt-1 flex justify-between gap-4 text-green-400"><span>Diskon</span><span>- {rupiah(order.discountAmount)}</span></div>}
                      <div className="mt-1 flex justify-between gap-4"><span className="text-muted-foreground">Bayar</span><span className="capitalize">{order.paymentMethod}</span></div>
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

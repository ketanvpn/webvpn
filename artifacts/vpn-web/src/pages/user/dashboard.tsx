import { useGetDashboardSummary } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Wallet, Server, ShoppingCart, AlertCircle, ChevronRight, Sparkles, X } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL ?? "";
const PROMO_DISMISSED_KEY = "reseller_promo_dismissed";

type PromoData = {
  promoEnabled: boolean;
  promoTitle: string;
  promoText: string;
  requestEnabled: boolean;
  discountPercent: number;
};

function ReselerPromoBanner({ onRequest }: { onRequest: () => void }) {
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(PROMO_DISMISSED_KEY));
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/reseller/promo`, { credentials: "include" })
      .then((r) => r.json())
      .then(setPromo)
      .catch(() => {});
  }, []);

  if (!promo?.promoEnabled || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(PROMO_DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const handleRequest = async () => {
    setRequesting(true);
    try {
      const r = await fetch(`${API}/api/reseller/request`, { method: "POST", credentials: "include" });
      const data = await r.json();
      if (r.ok) {
        setRequested(true);
        onRequest();
      } else {
        alert(data.error ?? "Gagal mengirim permintaan.");
      }
    } catch {
      alert("Gagal mengirim permintaan. Coba lagi nanti.");
    } finally {
      setRequesting(false);
    }
  };

  const displayText = promo.promoText.replace("{discount}", String(promo.discountPercent));

  return (
    <div className="relative rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 overflow-hidden">
      {/* Dekorasi lingkaran latar */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 blur-xl" />
      <div className="absolute right-8 bottom-0 h-12 w-12 rounded-full bg-primary/5" />

      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Tutup"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex gap-3 items-start relative">
        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-sm">{promo.promoTitle}</p>
            <span className="text-[10px] bg-primary text-primary-foreground font-bold px-2 py-0.5 rounded-full">
              Hemat {promo.discountPercent}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{displayText}</p>

          {requested ? (
            <p className="text-xs text-green-600 font-semibold">
              ✓ Permintaan terkirim! Admin akan segera menghubungi kamu.
            </p>
          ) : promo.requestEnabled ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRequest}
                disabled={requesting}
                className="text-xs bg-primary text-primary-foreground font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {requesting ? "Mengirim..." : "Ajukan Jadi Reseller →"}
              </button>
              <span className="text-[10px] text-muted-foreground">Gratis, langsung ke admin</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Hubungi admin untuk bergabung.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const { user } = useAuth();
  const [promoRequested, setPromoRequested] = useState(false);

  if (isLoading || !summary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  const hasExpiring = (summary.expiringAccounts?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Ringkasan akun dan aktivitas kamu.</p>
      </div>

      {/* Banner promosi reseller — hanya untuk user biasa */}
      {user?.role === "user" && !promoRequested && (
        <ReselerPromoBanner onRequest={() => setPromoRequested(true)} />
      )}

      {/* Stat Cards — 2 kolom di mobile, 4 di desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/balance">
          <div className="rounded-xl border-2 border-primary bg-primary text-primary-foreground p-3 cursor-pointer hover:opacity-90 transition-opacity">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary-foreground/70">Saldo</span>
              <Wallet className="h-3.5 w-3.5 opacity-70" />
            </div>
            <div className="text-lg font-bold leading-tight">{formatRupiah(summary.balance)}</div>
            <div className="text-[10px] mt-0.5 text-primary-foreground/60">
              {summary.pendingTopup && summary.pendingTopup > 0
                ? `+${formatRupiah(summary.pendingTopup)} pending`
                : "Tap untuk topup"}
            </div>
          </div>
        </Link>

        <Link href="/accounts">
          <div className="rounded-xl border-2 bg-card p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Akun Aktif</span>
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.activeAccounts}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk kelola</div>
          </div>
        </Link>

        <Link href="/orders">
          <div className="rounded-xl border-2 bg-card p-3 cursor-pointer hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Total Order</span>
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.totalOrders}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk riwayat</div>
          </div>
        </Link>

        <Link href="/accounts">
          <div className={`rounded-xl border-2 p-3 cursor-pointer transition-colors ${
            hasExpiring
              ? "border-destructive/40 bg-destructive/5 hover:border-destructive/60"
              : "bg-card hover:border-primary/50"
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${hasExpiring ? "text-destructive" : "text-muted-foreground"}`}>
                Hampir Habis
              </span>
              <AlertCircle className={`h-3.5 w-3.5 ${hasExpiring ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
            <div className={`text-lg font-bold ${hasExpiring ? "text-destructive" : ""}`}>
              {summary.expiringAccounts?.length || 0}
            </div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">
              {hasExpiring ? "Segera perpanjang →" : "Semua aman"}
            </div>
          </div>
        </Link>
      </div>

      {/* Grid bawah */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Order Terbaru */}
        <div className="rounded-xl border-2 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <span className="font-semibold text-sm">Order Terbaru</span>
            <Link href="/orders" className="text-[11px] text-primary hover:underline">Lihat semua →</Link>
          </div>
          {summary.recentOrders && summary.recentOrders.length > 0 ? (
            <div className="divide-y">
              {summary.recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <div>
                      <div className="text-sm font-medium">Order #{order.id}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(order.createdAt), "d MMM yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold">{formatRupiah(order.amount)}</div>
                      <Badge variant={
                        order.status === "paid" ? "default" :
                        order.status === "pending" || (order.status as string) === "processing" ? "secondary" : "destructive"
                      } className="text-[10px] h-4 px-1.5">
                        {order.status === "paid" ? "Lunas" :
                         order.status === "pending" ? "Menunggu" :
                         (order.status as string) === "processing" ? "Diproses" :
                         order.status === "failed" ? "Gagal" : "Expired"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">Belum ada order.</p>
          )}
        </div>

        {/* Segera Expired */}
        <div className="rounded-xl border-2 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <span className="font-semibold text-sm">Akun Hampir Habis</span>
            <Link href="/accounts" className="text-[11px] text-primary hover:underline">Lihat semua →</Link>
          </div>
          {summary.expiringAccounts && summary.expiringAccounts.length > 0 ? (
            <div className="divide-y">
              {summary.expiringAccounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <div>
                      <div className="text-sm font-medium font-mono">{account.username}</div>
                      <div className="text-[11px] text-muted-foreground uppercase">{account.protocol}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-destructive font-medium">
                        {format(new Date(account.expiresAt), "d MMM")}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">Tidak ada akun yang akan expired.</p>
          )}
        </div>
      </div>
    </div>
  );
}

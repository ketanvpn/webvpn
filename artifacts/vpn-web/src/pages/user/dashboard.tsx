import { useGetDashboardSummary } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Wallet, Server, ShoppingCart, AlertCircle, ChevronRight, Sparkles, X, Zap, CheckCircle2, Info, Megaphone, AlertTriangle, ShieldPlus, Package } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

const API = import.meta.env.VITE_API_URL ?? "";
const DASHBOARD_API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";
const PROMO_DISMISSED_KEY = "reseller_promo_dismissed";

type PromoData = {
  promoEnabled: boolean;
  promoTitle: string;
  promoText: string;
  requestEnabled: boolean;
  discountPercent: number;
  autoUpgradeEnabled: boolean;
  autoUpgradeMinTopup: number;
  targetEnabled: boolean;
  monthlyTarget: number;
};

type Announcement = { id: number; title: string; content: string; type: string };

const ANNOUNCE_DISMISSED_KEY = "dismissed_announcements_v1";

const ANNOUNCE_STYLE: Record<string, { icon: React.ElementType; bg: string; border: string; iconColor: string }> = {
  info: { icon: Info, bg: "bg-blue-500/10", border: "border-blue-500/30", iconColor: "text-blue-400" },
  warning: { icon: AlertTriangle, bg: "bg-yellow-500/10", border: "border-yellow-500/30", iconColor: "text-yellow-400" },
  success: { icon: CheckCircle2, bg: "bg-green-500/10", border: "border-green-500/30", iconColor: "text-green-400" },
  error: { icon: AlertCircle, bg: "bg-red-500/10", border: "border-red-500/30", iconColor: "text-red-400" },
};

function AnnouncementBanners() {
  const [dismissed, setDismissed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(ANNOUNCE_DISMISSED_KEY) ?? "[]"); } catch { return []; }
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["active-announcements"],
    queryFn: () => fetch(`${DASHBOARD_API}/announcements/active`, { credentials: "include" }).then((r) => r.json()),
    staleTime: 60_000,
  });

  const dismiss = (id: number) => {
    const next = [...dismissed, id];
    localStorage.setItem(ANNOUNCE_DISMISSED_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  const visible = announcements.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const style = ANNOUNCE_STYLE[a.type] ?? ANNOUNCE_STYLE.info;
        const Icon = style.icon;
        return (
          <div key={a.id} className={`relative flex items-start gap-3 rounded-xl border p-4 ${style.bg} ${style.border}`}>
            <Icon size={18} className={`${style.iconColor} mt-0.5 shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{a.title}</p>
              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{a.content}</p>
            </div>
            <button onClick={() => dismiss(a.id)} className="shrink-0 text-muted-foreground hover:text-white transition-colors"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

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

  const isAutoUpgrade = promo.autoUpgradeEnabled;
  const accentGreen = isAutoUpgrade;

  const benefits = [
    `Harga beli VPN lebih murah — diskon ${promo.discountPercent}% dari harga normal`,
    "Bebas jual ke siapa saja dengan harga markup sendiri",
    "Keuntungan 100% masuk ke kantong kamu",
  ];

  return (
    <div className={`relative rounded-xl overflow-hidden glass-panel ${
      accentGreen
        ? "border-green-500/20"
        : "border-primary/20"
    }`}>
      {/* Dekorasi latar */}
      <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-60 ${accentGreen ? "bg-green-200" : "bg-primary/15"}`} />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
            accentGreen ? "bg-green-900/50" : "bg-primary/20"
          }`}>
            {accentGreen
              ? <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
              : <Sparkles className="h-4 w-4 text-primary" />
            }
          </div>
          <p className="font-bold text-sm">{promo.promoTitle}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            accentGreen ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
          }`}>
            Hemat {promo.discountPercent}%
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors ml-2 shrink-0"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3 relative">
        {/* Keuntungan */}
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${
            accentGreen ? "text-green-400" : "text-primary"
          }`}>Yang kamu dapat</p>
          <ul className="space-y-1">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${accentGreen ? "text-green-500" : "text-primary/70"}`} />
                <span className="text-xs text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Syarat */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400 mb-1.5">Syarat</p>
          <ul className="space-y-1">
            {/* Syarat masuk */}
            <li className="flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
              {isAutoUpgrade ? (
                <span className="text-xs text-muted-foreground">
                  Topup minimal{" "}
                  <span className="font-semibold text-foreground">{formatRupiah(promo.autoUpgradeMinTopup)}</span>
                  {" "}— langsung otomatis aktif sebagai reseller
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Ajukan permintaan ke admin untuk diaktifkan</span>
              )}
            </li>
            {/* Syarat bulanan — hanya tampil kalau target aktif */}
            {promo.targetEnabled && (
              <li className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                <span className="text-xs text-muted-foreground">
                  Wajib jual minimal{" "}
                  <span className="font-semibold text-foreground">{formatRupiah(promo.monthlyTarget)}</span>
                  {" "}per bulan untuk tetap aktif sebagai reseller
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* CTA */}
        {isAutoUpgrade ? (
          <Link href="/balance">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer ${
              accentGreen
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}>
              <Zap className="h-3.5 w-3.5" /> Topup Sekarang →
            </span>
          </Link>
        ) : requested ? (
          <p className="text-xs text-green-600 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Permintaan terkirim! Admin akan segera menghubungi kamu.
          </p>
        ) : promo.requestEnabled ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="text-xs bg-primary text-primary-foreground font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {requesting ? "Mengirim..." : "Ajukan Jadi Reseller →"}
            </button>
            <span className="text-[10px] text-muted-foreground">Gratis, admin langsung dihubungi</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Hubungi admin untuk bergabung.</p>
        )}
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

      {/* Pengumuman dari admin */}
      <AnnouncementBanners />

      {/* Banner promosi reseller — hanya untuk user biasa */}
      {user?.role === "user" && !promoRequested && (
        <ReselerPromoBanner onRequest={() => setPromoRequested(true)} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/order-vpn" className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-[0_0_18px_rgba(16,185,129,0.12)] transition hover:border-primary/60">
          <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="rounded-xl bg-primary/20 p-2 text-primary"><ShieldPlus className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Order VPN</p>
              <p className="text-[11px] text-muted-foreground">Server dynamic</p>
            </div>
          </div>
        </Link>
        <Link href="/products" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/5 p-2 text-muted-foreground"><Package className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Produk VPN</p>
              <p className="text-[11px] text-muted-foreground">Paket lama</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Stat Cards — 2 kolom di mobile, 4 di desktop */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/balance">
          <div className="glass-card rounded-xl border border-primary/40 bg-primary/10 p-3 cursor-pointer hover:glow-border-primary transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary">Saldo</span>
              <Wallet className="h-3.5 w-3.5 text-primary opacity-80" />
            </div>
            <div className="text-lg font-bold leading-tight text-primary">{formatRupiah(summary.balance)}</div>
            <div className="text-[10px] mt-0.5 text-primary/70">
              {summary.pendingTopup && summary.pendingTopup > 0
                ? `+${formatRupiah(summary.pendingTopup)} pending`
                : "Tap untuk topup"}
            </div>
          </div>
        </Link>

        <Link href="/accounts">
          <div className="glass-card rounded-xl border border-white/5 p-3 cursor-pointer hover:glow-border-primary hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Akun Aktif</span>
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.activeAccounts}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk kelola</div>
          </div>
        </Link>

        <Link href="/orders">
          <div className="glass-card rounded-xl border border-white/5 p-3 cursor-pointer hover:glow-border-primary hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Total Order</span>
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.totalOrders}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk riwayat</div>
          </div>
        </Link>

        <Link href="/accounts">
          <div className={`glass-card rounded-xl border p-3 cursor-pointer transition-all duration-300 ${
            hasExpiring
              ? "border-destructive/40 bg-destructive/10 hover:border-destructive hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              : "border-white/5 hover:border-primary/50 hover:glow-border-primary"
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
        <div className="glass-panel rounded-xl overflow-hidden">
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
        <div className="glass-panel rounded-xl overflow-hidden">
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

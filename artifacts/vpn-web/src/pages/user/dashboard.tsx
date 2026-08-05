import { useGetDashboardSummary } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Wallet, Server, ShoppingCart, AlertCircle, ChevronRight, Sparkles, X, Zap, CheckCircle2, Info, Megaphone, AlertTriangle, ShieldPlus, Crown, TrendingUp, Target, Calendar, RefreshCw, Trophy, Flame } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ANNOUNCE_STYLE, getOrderStatusLabel, getOrderStatusVariant, type AnnouncementType } from "@/lib/constants";
import { PageHeader } from "@/components/common";
import { apiClient } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { getApiError } from "@/lib/utils";
import type { PromoData, ResellerStatus } from "@/lib/types/profile";

const PROMO_DISMISSED_KEY = "reseller_promo_dismissed";
const INJECT_GUIDE_DISMISSED_KEY = "dashboard_inject_guide_dismissed_v1";

type Announcement = { id: number; title: string; content: string; type: string };

type ResellerStatusData = ResellerStatus;

const ANNOUNCE_DISMISSED_KEY = "dismissed_announcements_v1";

// Icon mapping untuk announcement types
const ANNOUNCE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

function AnnouncementBanners() {
  const [dismissed, setDismissed] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem(ANNOUNCE_DISMISSED_KEY) ?? "[]"); } catch { return []; }
  });

  const { data: announcements = [] } = useQuery<Announcement[]>({
    queryKey: ["active-announcements"],
    queryFn: () => apiClient.get<Announcement[]>("/api/announcements/active"),
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
        const Icon = ANNOUNCE_ICONS[a.type] ?? Info;
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

function ResellerPromoBanner({ onRequest }: { onRequest: () => void }) {
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(PROMO_DISMISSED_KEY));
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    apiClient.get<PromoData>("/api/reseller/promo")
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
      await apiClient.post("/api/reseller/request");
      setRequested(true);
      onRequest();
    } catch (err) {
      toast({
        title: "Gagal mengirim permintaan",
        description: getApiError(err, "Coba lagi nanti."),
        variant: "destructive",
      });
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

function ResellerWidget() {
  const [status, setStatus] = useState<ResellerStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ResellerStatusData>("/api/reseller/status")
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-panel rounded-xl p-4 animate-pulse">
        <div className="h-20 bg-white/5 rounded-lg" />
      </div>
    );
  }

  if (!status) return null;

  const progress = status.progressPercent ?? 0;
  const daysRemaining = (() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate();
  })();
  const targetMet = progress >= 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-4 shadow-lg">
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-8 left-1/4 h-24 w-24 rounded-full bg-cyan-500/10 blur-2xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Crown className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-sm text-white flex items-center gap-2">
                Status Reseller
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  AKTIF
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">Bulan {status.currentMonth}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Diskon</p>
            <p className="text-xl font-black text-emerald-400">{status.discountPercent}%</p>
          </div>
        </div>

        {status.targetEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Penjualan Bulan Ini</span>
              <span className="font-bold text-white">{formatRupiah(status.currentMonthSales)}</span>
            </div>

            <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-cyan-400"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
              {targetMet && (
                <div className="absolute inset-0 rounded-full bg-emerald-500/50 animate-pulse" />
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Target className="h-3 w-3 text-emerald-400" />
                <span className="text-muted-foreground">Target: {formatRupiah(status.monthlyTarget)}</span>
              </div>
              {targetMet ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <Trophy className="h-3 w-3" />
                  Tercapai!
                </span>
              ) : (
                <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Evaluasi: tanggal 1</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Flame className={`h-3 w-3 ${daysRemaining <= 7 ? "text-orange-400" : "text-muted-foreground"}`} />
                <span className={daysRemaining <= 7 ? "text-orange-400 font-medium" : "text-muted-foreground"}>
                  {daysRemaining} hari tersisa
                </span>
              </div>
            </div>

            {!targetMet && status.monthlyTarget - status.currentMonthSales > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <p className="text-[11px] text-orange-300">
                  Kurang <span className="font-bold">{formatRupiah(status.monthlyTarget - status.currentMonthSales)}</span> untuk mencapai target
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300">Status reseller permanen — tanpa target bulanan</p>
          </div>
        )}
      </div>
    </div>
  );
}

function InjectBeginnerWidget({ activeAccounts }: { activeAccounts: number }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(INJECT_GUIDE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try { localStorage.setItem(INJECT_GUIDE_DISMISSED_KEY, "1"); } catch {}
    setDismissed(true);
  };
  const undismiss = () => {
    try { localStorage.removeItem(INJECT_GUIDE_DISMISSED_KEY); } catch {}
    setDismissed(false);
  };

  if (dismissed) {
    return (
      <div className="flex w-full min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur px-3 py-2">
        <span className="text-xs text-muted-foreground break-words min-w-0 flex-1">Baru pertama kali inject?</span>
        <button
          onClick={undismiss}
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 transition-colors"
        >
          Tampilkan panduan
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-w-0 overflow-hidden glass-panel rounded-xl border border-primary/20 p-3 sm:p-4">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <button
        onClick={dismiss}
        aria-label="Tutup panduan"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors rounded-md p-1.5 hover:bg-white/10 shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="relative min-w-0 w-full overflow-hidden pr-6">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-sm font-bold break-words min-w-0">Baru pertama kali inject paket?</p>
          {activeAccounts < 2 && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/30 text-primary shrink-0">Beginner</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-snug break-words min-w-0 max-w-full sm:max-w-[90%]">
          Pilih paket GameMax atau Ilmupedia dulu, beli paketnya di MyTelkomsel, lalu buat akun SSH.
        </p>
        <div className="mt-3 flex w-full min-w-0 flex-col sm:flex-row sm:flex-wrap gap-2">
          <Link href="/converter?preset=gamemax" className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-w-0">
            🎮 GameMax
          </Link>
          <Link href="/converter?preset=ilmupedia" className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 text-xs font-bold px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] hover:border-primary/40 hover:bg-white/10 text-white transition-all min-w-0">
            📚 Ilmupedia
          </Link>
          <Link href="/converter" className="inline-flex w-full sm:w-auto items-center justify-center gap-1 text-[11px] font-medium px-2.5 py-2.5 rounded-lg text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-white/10 min-w-0">
            Buka Converter →
          </Link>
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

  // Type untuk combined order
  type CombinedOrder = {
    id: number | string;
    type: "dynamic" | "regular";
    title: string;
    amount: number;
    status: string;
    createdAt: string;
    link: string;
  };

  const combinedRecentOrders: CombinedOrder[] = (summary.recentOrders || [])
    .map((o) => {
      const order = o as {
        id: number | string;
        isDynamic?: boolean;
        serverDisplayName?: string;
        dynamicProvider?: string;
        product?: { name?: string };
        protocol?: string;
        amount?: number;
        payableAmount?: number;
        status: string;
        createdAt: string;
      };
      const isDynamic = Boolean(order.isDynamic || order.serverDisplayName || order.dynamicProvider);
      return {
        id: order.id,
        type: isDynamic ? "dynamic" as const : "regular" as const,
        title: isDynamic
          ? `${order.serverDisplayName || order.product?.name?.replace("Order VPN Dynamic - ", "") || "Dynamic"}${order.protocol ? ` • ${order.protocol}` : ""}`
          : `Order #${order.id}`,
        amount: order.amount ?? order.payableAmount ?? 0,
        status: order.status,
        createdAt: order.createdAt,
        link: isDynamic ? `/order-vpn/history` : `/orders/${order.id}`,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const hasExpiring = (summary.expiringAccounts?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" description="Ringkasan akun dan aktivitas kamu." />

      {/* Pengumuman dari admin */}
      <AnnouncementBanners />

      {/* Banner promosi reseller — hanya untuk user biasa */}
      {user?.role === "user" && !promoRequested && (
        <ResellerPromoBanner onRequest={() => setPromoRequested(true)} />
      )}

      {/* Widget Reseller — hanya untuk reseller */}
      {user?.role === "reseller" && <ResellerWidget />}

      <InjectBeginnerWidget activeAccounts={summary.activeAccounts ?? 0} />

      <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/70 p-4 md:p-5 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-40 w-40 sm:h-56 sm:w-56 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-40 w-40 sm:h-56 sm:w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative grid gap-4 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <Badge className="mb-2 sm:mb-3 border-emerald-400/30 bg-emerald-500/10 text-emerald-200" variant="outline">
              Dynamic VPN Ready
            </Badge>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Order VPN lebih cepat dari sini</h2>
            <p className="mt-1.5 sm:mt-2 max-w-xl text-xs sm:text-sm text-slate-300">
              Pilih server, protokol, dan durasi langsung dari halaman Order VPN. Setelah pembayaran saldo berhasil, akun siap dipakai.
            </p>
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
              <Link href="/order-vpn" className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-bold text-primary-foreground shadow-lg transition active:scale-[0.985] hover:bg-primary/90">
                <ShieldPlus className="h-4 w-4" /> Order VPN Sekarang
              </Link>
              <Link href="/accounts" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition active:scale-[0.985] hover:border-primary/40 hover:bg-white/10">
                <Server className="h-4 w-4" /> Kelola Akun
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href="/orders" className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 transition active:scale-[0.985] hover:border-primary/40">
              <ShoppingCart className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <p className="text-xs sm:text-sm font-bold text-white">Riwayat Order</p>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Cek transaksi</p>
            </Link>
            <Link href="/balance" className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 transition active:scale-[0.985] hover:border-primary/40">
              <Wallet className="mb-2 sm:mb-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <p className="text-xs sm:text-sm font-bold text-white">Topup Saldo</p>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Isi saldo akun</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Stat Cards — 2 kolom di mobile, 4 di desktop (rapi & touch friendly) */}
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
          <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-lg p-3 shadow-md cursor-pointer hover:glow-border-primary hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Akun Aktif</span>
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.activeAccounts}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk kelola</div>
          </div>
        </Link>

        <Link href="/orders">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-lg p-3 shadow-md cursor-pointer hover:glow-border-primary hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">Total Order</span>
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="text-lg font-bold">{summary.totalOrders}</div>
            <div className="text-[10px] mt-0.5 text-muted-foreground">Tap untuk riwayat</div>
          </div>
        </Link>

        <Link href="/accounts">
          <div className={`rounded-xl border p-3 cursor-pointer shadow-md backdrop-blur-lg transition-all duration-300 ${
            hasExpiring
              ? "border-destructive/40 bg-destructive/10 hover:border-destructive hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              : "border-white/10 bg-white/[0.04] hover:border-primary/50 hover:glow-border-primary"
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
        {/* Order Terbaru (gabungan regular + dynamic biar tidak terlalu banyak section) */}
        <div className="glass-panel rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <span className="font-semibold text-sm">Order Terbaru</span>
            <div className="flex items-center gap-3 text-[11px]">
              <Link href="/orders" className="text-primary hover:underline">Lihat semua →</Link>
              <Link href="/order-vpn/history" className="text-primary hover:underline">Dynamic</Link>
            </div>
          </div>
          {combinedRecentOrders.length > 0 ? (
            <div className="divide-y">
              {combinedRecentOrders.map((order) => (
                <Link key={`${order.type}-${order.id}`} href={order.link}>
                  <div className="flex items-center justify-between px-4 py-2.5 hover:bg-accent/30 transition-colors">
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {order.title}
                        {order.type === "dynamic" && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">Dynamic</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {format(new Date(order.createdAt), "d MMM yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-bold">{formatRupiah(order.amount)}</div>
                      <Badge variant={getOrderStatusVariant(order.status)} className="text-[10px] h-4 px-1.5">
                        {getOrderStatusLabel(order.status)}
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

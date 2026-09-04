import { getApiError } from "@/lib/utils";
import {
  useGetBalance,
  useTopupBalance,
  useListTopupHistory,
  getGetBalanceQueryKey,
  getListTopupHistoryQueryKey,
  type TopupTransaction,
} from "@workspace/api-client-react";
import { formatRupiah, safeFormatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Wallet, ArrowUpRight, History, Clock, XCircle, Zap, Timer, QrCode, Landmark, TrendingUp, CreditCard, Smartphone, Info, ArrowUpCircle, ChevronDown, Lightbulb, CheckCircle, AlertTriangle, Gift, PlusCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) { setSecondsLeft(null); return; }
    const target = new Date(expiresAt).getTime();
    const update = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (secondsLeft === null) return null;
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return { secondsLeft, display: `${m}:${String(s).padStart(2, "0")}`, expired: secondsLeft === 0 };
}

const topupSchema = z.object({
  amount: z.coerce.number().min(10000, "Minimum topup Rp 10.000"),
});

const presetAmounts = [10000, 25000, 50000, 100000, 200000];

const dynamicPaymentChannels = new Set([
  "ketantechpay",
  "autogopay_gopay",
  "autogopay_shopeepay",
]);

type ActiveTopup = {
  id: number;
  amount: number;
  payableAmount: number;
  uniqueCode: number;
  qrisUrl: string;
  expiresAt: string | null;
  paymentProvider: string | null;
  paymentChannel: string | null;
  gateway: string | null;
};

function getPaymentChannelName(
  channel?: string | null,
  provider?: string | null,
  gateway?: string | null,
) {
  switch (channel) {
    case "ketantechpay":
      return "QRIS dinamis (KetantechPay)";
    case "autogopay_gopay":
      return "QRIS dinamis (GoPay)";
    case "autogopay_shopeepay":
      return "QRIS (ShopeePay)";
  }

  if (provider === "ketantechpay") return "QRIS dinamis (KetantechPay)";
  if (provider === "autogopay") return "QRIS dinamis (AutoGoPay)";

  switch (gateway) {
    case "ketantechpay":
      return "QRIS dinamis (KetantechPay)";
    case "autogopay":
      return "QRIS dinamis (AutoGoPay)";
    case "qris_static":
      return "QRIS statis";
    default:
      return "QRIS";
  }
}

function isDynamicPaymentChannel(
  channel?: string | null,
  provider?: string | null,
  gateway?: string | null,
) {
  return (
    (!!channel && dynamicPaymentChannels.has(channel)) ||
    provider === "autogopay" ||
    provider === "ketantechpay" ||
    gateway === "autogopay" ||
    gateway === "ketantechpay"
  );
}

function toActiveTopup(tx: TopupTransaction): ActiveTopup {
  return {
    id: tx.id,
    amount: tx.amount,
    payableAmount: tx.payableAmount ?? tx.amount,
    uniqueCode: tx.uniqueCode ?? 0,
    qrisUrl: tx.qrisUrl ?? "",
    expiresAt: tx.expiresAt ?? null,
    paymentProvider: tx.paymentProvider ?? null,
    paymentChannel: tx.paymentChannel ?? null,
    gateway: tx.gateway ?? null,
  };
}

export default function Balance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showQris, setShowQris] = useState(false);
  const [activeTopup, setActiveTopup] = useState<ActiveTopup | null>(null);
  const [qrisImageError, setQrisImageError] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const countdown = useCountdown(showQris ? activeTopup?.expiresAt ?? null : null);

  const openQrisFromHistory = (tx: TopupTransaction) => {
    setActiveTopup(toActiveTopup(tx));
    setQrisImageError(false);
    setShowQris(true);
  };

  const { data: balanceData, isLoading: isLoadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey(), refetchInterval: showQris ? 3000 : false },
  });
  const { data: historyData, isLoading: isLoadingHistory } = useListTopupHistory(
    undefined,
    { query: { queryKey: getListTopupHistoryQueryKey(), refetchInterval: showQris ? 3000 : false } },
  );
  const topup = useTopupBalance();

  const confirmedTopupIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const transactions = historyData ?? [];
    const confirmedIds = new Set(
      transactions.filter((tx) => tx.status === "confirmed").map((tx) => tx.id),
    );
    const currentTopupConfirmed =
      showQris &&
      activeTopup !== null &&
      confirmedIds.has(activeTopup.id) &&
      !confirmedTopupIdsRef.current.has(activeTopup.id);

    confirmedTopupIdsRef.current = confirmedIds;

    if (!currentTopupConfirmed || !activeTopup) return;

    setShowQris(false);
    toast({
      title: "Pembayaran Diterima!",
      description: `Topup #${activeTopup.id} dikonfirmasi. Saldo bertambah ${formatRupiah(activeTopup.payableAmount)}.`,
    });
    queryClient.invalidateQueries({ queryKey: getListTopupHistoryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
  }, [activeTopup, historyData, queryClient, showQris, toast]);

  const form = useForm<z.infer<typeof topupSchema>>({
    resolver: zodResolver(topupSchema),
    defaultValues: { amount: 50000 },
  });

  const onSubmit = (values: z.infer<typeof topupSchema>) => {
    topup.mutate({ data: values }, {
      onSuccess: (response) => {
        setActiveTopup({
          id: response.id,
          amount: response.amount,
          payableAmount: response.payableAmount ?? response.amount,
          uniqueCode: response.uniqueCode ?? 0,
          qrisUrl: response.qrisUrl ?? "",
          expiresAt: response.expiresAt ?? null,
          paymentProvider: response.paymentProvider ?? null,
          paymentChannel: response.paymentChannel ?? null,
          gateway: response.gateway ?? null,
        });
        setQrisImageError(false);
        setShowQris(true);
        queryClient.invalidateQueries({ queryKey: getListTopupHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Gagal membuat topup",
          description: getApiError(err) || "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    });
  };

  const topupHistory = historyData ?? [];

  // Statistik dihitung dari riwayat topup yang sudah dikonfirmasi.
  // ponytail: pengeluaran diturunkan dari selisih total topup vs saldo saat ini
  // (backend belum expose balance logs bertipe "order"); ganti ke endpoint
  // riwayat pengeluaran begitu tersedia.
  const stats = useMemo(() => {
    const confirmed = topupHistory.filter((tx) => tx.status === "confirmed");
    const now = new Date();
    const monthTopup = confirmed
      .filter((tx) => {
        const d = new Date(tx.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, tx) => sum + (tx.payableAmount ?? tx.amount), 0);

    const lifetimeTopup = confirmed.reduce((sum, tx) => sum + (tx.payableAmount ?? tx.amount), 0);
    const spent = Math.max(0, lifetimeTopup - (balanceData?.balance ?? 0));
    const average = confirmed.length > 0 ? Math.round(lifetimeTopup / confirmed.length) : 0;

    return { monthTopup, spent, average, count: confirmed.length };
  }, [topupHistory, balanceData?.balance]);

  const activePaymentChannelName = getPaymentChannelName(
    activeTopup?.paymentChannel,
    activeTopup?.paymentProvider,
    activeTopup?.gateway,
  );
  const activeTopupUsesDynamicChannel = isDynamicPaymentChannel(
    activeTopup?.paymentChannel,
    activeTopup?.paymentProvider,
    activeTopup?.gateway,
  );

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saldo & Top Up</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola saldo dan lihat riwayat transaksi kamu.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Kiri: Saldo + Form */}
        <div className="space-y-4">
          {/* Kartu Saldo - Premium dengan Gradient & Glow */}
          <div className="rounded-xl bg-gradient-to-br from-primary via-primary to-teal-600 text-primary-foreground p-6 relative overflow-hidden glow-primary">
            {/* Background glow effect */}
            <div className="absolute inset-0 opacity-20 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            {/* Icon watermark */}
            <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
              <Wallet className="h-40 w-40 -mr-8 -mt-8" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-primary-foreground/80 text-sm mb-3">
                <Wallet className="h-4 w-4" /> Saldo Saat Ini
              </div>
              {isLoadingBalance ? (
                <Skeleton className="h-10 w-44 bg-primary-foreground/20 rounded" />
              ) : (
                <div>
                  <div className="text-4xl font-bold tracking-tighter animate-pulse">
                    {formatRupiah(balanceData?.balance || 0)}
                  </div>
                  {balanceData?.pendingTopup !== undefined && balanceData.pendingTopup > 0 && (
                    <div className="mt-3 text-xs bg-primary-foreground/15 backdrop-blur-sm inline-block px-3 py-1.5 rounded-full font-medium border border-primary-foreground/20">
                      + {formatRupiah(balanceData.pendingTopup)} menunggu konfirmasi
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {!isLoadingHistory && stats.count > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="p-3 min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Bulan Ini</span>
                </div>
                <div className="text-sm font-bold tabular-nums truncate" title={formatRupiah(stats.monthTopup)}>{formatRupiah(stats.monthTopup)}</div>
              </Card>
              <Card className="p-3 min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
                  <CreditCard className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Terpakai</span>
                </div>
                <div className="text-sm font-bold tabular-nums truncate" title={formatRupiah(stats.spent)}>{formatRupiah(stats.spent)}</div>
              </Card>
              <Card className="p-3 min-w-0">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mb-1">
                  <Landmark className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Rata-rata</span>
                </div>
                <div className="text-sm font-bold tabular-nums truncate" title={formatRupiah(stats.average)}>{formatRupiah(stats.average)}</div>
              </Card>
            </div>
          )}

          {/* Form Topup */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4" /> Isi Saldo
              </CardTitle>
              <CardDescription className="text-xs">Tambah saldo via QRIS. Saldo otomatis masuk setelah pembayaran.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Pilih Nominal Cepat</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {presetAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={form.watch("amount") === amt ? "default" : "outline"}
                          className="w-full text-xs h-8"
                          onClick={() => form.setValue("amount", amt, { shouldValidate: true })}
                        >
                          {formatRupiah(amt)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex items-center gap-3 py-1">
                    <div className="flex-1 border-t border-dashed" />
                    <span className="text-[11px] text-muted-foreground font-medium">atau ketik sendiri</span>
                    <div className="flex-1 border-t border-dashed" />
                  </div>

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-xs flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-primary" />
                          Masukkan Nominal Sendiri
                        </Label>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">Rp</span>
                            <Input
                              type="text"
                              inputMode="numeric"
                              placeholder="Contoh: 75.000"
                              className="pl-9 font-medium tabular-nums"
                              value={field.value ? Number(field.value).toLocaleString("id-ID") : ""}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                field.onChange(digits ? Number(digits) : 0);
                              }}
                              onBlur={field.onBlur}
                              name={field.name}
                              ref={field.ref}
                            />
                          </div>
                        </FormControl>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Bebas isi nominal berapa pun, minimal Rp 10.000. Nominal saat ini: <strong className="text-foreground tabular-nums">{formatRupiah(Number(form.watch("amount")) || 0)}</strong>
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={topup.isPending}>
                    {topup.isPending ? "Membuat QRIS..." : "Buat QRIS"}
                  </Button>

                  <Collapsible className="mt-4 border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-accent/10 transition-colors">
                      <span className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Tips Topup QRIS
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-2">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>Scan QRIS dalam <strong>15 menit</strong> untuk menghindari kedaluwarsa</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>Saldo akan otomatis bertambah <strong>3-5 menit</strong> setelah pembayaran sukses</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>Gunakan aplikasi bank yang mendukung <strong>QRIS</strong> (BCA Mobile, Mandiri, dll)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                        <span>Hindari refresh halaman saat menunggu pembayaran</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Info className="h-3 w-3 mt-0.5 text-blue-500 flex-shrink-0" />
                        <span>Minimal topup <strong>Rp 10.000</strong>, maksimal <strong>Rp 10.000.000</strong></span>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Kanan: Riwayat Topup */}
        <div className="rounded-xl border-2 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
            <History className="h-4 w-4" />
            <span className="font-semibold text-sm">Riwayat Topup</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoadingHistory ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : topupHistory.length > 0 ? (
              <div className="divide-y">
                {topupHistory.map((tx) => {
                  const isExpired = tx.expiresAt ? new Date(tx.expiresAt) < new Date() : false;
                  const canViewQris = tx.status === 'pending' && tx.qrisUrl && !isExpired;
                  return (
                    <div key={tx.id} className="px-4 py-3 hover:bg-accent/20 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-full shrink-0 ${
                            tx.status === 'confirmed' ? 'bg-green-500/10 text-green-600' :
                            tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                            'bg-red-500/10 text-red-500'
                          }`}>
                            {tx.status === 'confirmed' ? <ArrowUpRight className="h-4 w-4" /> :
                             tx.status === 'pending' ? <Clock className="h-4 w-4" /> :
                             <XCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{formatRupiah(tx.payableAmount ?? tx.amount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {getPaymentChannelName(tx.paymentChannel, tx.paymentProvider, tx.gateway)} · {safeFormatDate(tx.createdAt, "d MMM yyyy HH:mm")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canViewQris && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-[11px] px-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                              onClick={() => openQrisFromHistory(tx)}
                            >
                              <QrCode className="h-3 w-3" />
                              QRIS
                            </Button>
                          )}
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 capitalize ${
                            tx.status === 'confirmed' ? 'border-green-500 text-green-600' :
                            tx.status === 'pending' ? 'border-yellow-500 text-yellow-600' :
                            'border-red-500 text-red-600'
                          }`}>
                            {tx.status === 'confirmed' ? 'Dikonfirmasi' : tx.status === 'pending' ? 'Menunggu' : 'Ditolak'}
                          </Badge>
                        </div>
                      </div>
                      {tx.status === 'rejected' && tx.rejectionNote && (
                        <div className="mt-1.5 ml-9 text-[11px] text-red-600/80 italic bg-red-50 px-2.5 py-1 rounded border border-red-200/60">
                          Alasan: {tx.rejectionNote}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 px-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <History className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Belum ada riwayat topup</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
                  Isi saldo sekarang untuk mulai berlangganan VPN dan nikmati akses internet tanpa batas.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => document.querySelector<HTMLInputElement>('input[type="number"]')?.focus()}
                >
                  <PlusCircle className="h-4 w-4" />
                  Isi Saldo Sekarang
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog QRIS */}
      <Dialog open={showQris} onOpenChange={setShowQris}>
        <DialogContent
          className="sm:max-w-md text-center"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Scan QRIS untuk Bayar</DialogTitle>
            <DialogDescription>
              Buka aplikasi bank atau e-wallet dan scan QR berikut untuk menyelesaikan topup.
            </DialogDescription>
          </DialogHeader>

          {countdown && (
            <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold border mx-auto w-fit ${
              countdown.expired
                ? "bg-red-500/10 border-red-500/30 text-red-600"
                : countdown.secondsLeft < 60
                ? "bg-orange-500/10 border-orange-500/30 text-orange-600"
                : "bg-muted border-border text-foreground"
            }`}>
              <Timer className="h-4 w-4" />
              {countdown.expired ? "QRIS sudah kadaluarsa" : `Berlaku: ${countdown.display}`}
            </div>
          )}

          <div className="w-full rounded-lg border bg-muted/20 divide-y text-sm text-left">
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <span className="text-muted-foreground">Channel pembayaran</span>
              <span className="font-medium text-right">{activePaymentChannelName}</span>
            </div>
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <span className="text-muted-foreground">Total bayar</span>
              <span className="font-bold text-primary">{formatRupiah(activeTopup?.payableAmount ?? 0)}</span>
            </div>
            {!!activeTopup?.uniqueCode && (
              <div className="px-4 py-2.5">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Kode unik</span>
                  <span className="font-medium">+{formatRupiah(activeTopup.uniqueCode)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kode unik ini termasuk dalam total bayar dan akan dikreditkan ke saldo kamu setelah pembayaran dikonfirmasi.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center p-4 bg-white rounded-lg my-2 relative min-h-52">
            {countdown?.expired && (
              <div className="absolute inset-0 bg-white/90 rounded-lg flex flex-col items-center justify-center z-10 gap-2">
                <XCircle className="h-10 w-10 text-red-500" />
                <p className="text-sm font-semibold text-red-600">QRIS Kadaluarsa</p>
                <p className="text-xs text-muted-foreground">Buat permintaan topup baru.</p>
              </div>
            )}
            {activeTopup?.qrisUrl && !qrisImageError ? (
              <img
                src={activeTopup.qrisUrl}
                alt={`Kode QR ${activePaymentChannelName} untuk topup #${activeTopup.id}`}
                className="max-w-full h-auto max-h-64 object-contain"
                onError={() => setQrisImageError(true)}
              />
            ) : (
              <div className="w-52 min-h-48 flex flex-col items-center justify-center gap-2 text-red-600 text-center" role="alert">
                <XCircle className="h-9 w-9" />
                <p className="text-sm font-semibold">QRIS tidak dapat ditampilkan</p>
                <p className="text-xs text-muted-foreground">Tutup dialog lalu coba buka kembali dari riwayat, atau hubungi admin.</p>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Pindai QRIS dengan GoPay, OVO, ShopeePay, atau aplikasi QRIS lainnya. OVO cukup memindai QRIS yang tampil—tidak perlu memilih channel ShopeePay.
          </p>

          {activeTopupUsesDynamicChannel ? (
            <div className="bg-green-500/10 text-green-700 p-3 rounded-md text-sm border border-green-500/20 text-left flex items-start gap-2">
              <Zap className="h-4 w-4 mt-0.5 shrink-0" />
              <span><strong>Konfirmasi otomatis!</strong> Saldo dikreditkan langsung setelah pembayaran berhasil.</span>
            </div>
          ) : (
            <div className="bg-yellow-500/10 text-yellow-700 p-3 rounded-md text-sm border border-yellow-500/20 text-left">
              <strong>Catatan:</strong> Setelah bayar, admin akan mengonfirmasi topup kamu dalam beberapa saat.
            </div>
          )}

          <Button className="w-full mt-2" onClick={() => setShowQris(false)}>Tutup</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

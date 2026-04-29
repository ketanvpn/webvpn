import { getApiError } from "@/lib/utils";
import { useGetBalance, useTopupBalance, useListTopupHistory, getGetBalanceQueryKey, getListTopupHistoryQueryKey } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowUpRight, History, Clock, XCircle, Zap, Timer, QrCode } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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

export default function Balance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showQris, setShowQris] = useState(false);
  const [qrisUrl, setQrisUrl] = useState("");
  const [qrisExpiresAt, setQrisExpiresAt] = useState<string | null>(null);
  const [qrisGateway, setQrisGateway] = useState<string | null>(null);
  const countdown = useCountdown(showQris ? qrisExpiresAt : null);

  const openQrisFromHistory = (tx: { qrisUrl?: string | null; expiresAt?: string | null }) => {
    setQrisUrl(tx.qrisUrl ?? "");
    setQrisExpiresAt(tx.expiresAt ?? null);
    setQrisGateway(null);
    setShowQris(true);
  };

  const prevBalanceRef = useRef<number | null>(null);

  const { data: balanceData, isLoading: isLoadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey(), refetchInterval: showQris ? 3000 : false },
  });
  const { data: historyData, isLoading: isLoadingHistory } = useListTopupHistory(
    undefined,
    { query: { queryKey: getListTopupHistoryQueryKey(), refetchInterval: showQris ? 3000 : false } },
  );
  const topup = useTopupBalance();

  useEffect(() => {
    if (!showQris) { prevBalanceRef.current = null; return; }
    const currentBalance = balanceData?.balance ?? null;
    if (currentBalance === null) return;
    if (prevBalanceRef.current === null) { prevBalanceRef.current = currentBalance; return; }
    if (currentBalance > prevBalanceRef.current) {
      const added = currentBalance - prevBalanceRef.current;
      prevBalanceRef.current = currentBalance;
      setShowQris(false);
      toast({
        title: "Pembayaran Diterima!",
        description: `Saldo kamu bertambah ${formatRupiah(added)}. Terima kasih!`,
      });
      queryClient.invalidateQueries({ queryKey: getListTopupHistoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
    }
  }, [balanceData?.balance, showQris]);

  const form = useForm<z.infer<typeof topupSchema>>({
    resolver: zodResolver(topupSchema),
    defaultValues: { amount: 50000 },
  });

  const onSubmit = (values: z.infer<typeof topupSchema>) => {
    topup.mutate({ data: values }, {
      onSuccess: (res) => {
        setQrisUrl(res.qrisUrl ?? "");
        setQrisExpiresAt(res.expiresAt ?? null);
        setQrisGateway(res.gateway ?? null);
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

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saldo & Top Up</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola saldo dan lihat riwayat transaksi kamu.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Kiri: Saldo + Form */}
        <div className="space-y-4">
          {/* Kartu Saldo */}
          <div className="rounded-xl bg-primary text-primary-foreground p-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
              <Wallet className="h-32 w-32 -mr-6 -mt-6" />
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/70 text-sm mb-2">
              <Wallet className="h-4 w-4" /> Saldo Saat Ini
            </div>
            {isLoadingBalance ? (
              <Skeleton className="h-9 w-40 bg-primary-foreground/20" />
            ) : (
              <div>
                <div className="text-3xl font-bold tracking-tight">
                  {formatRupiah(balanceData?.balance || 0)}
                </div>
                {balanceData?.pendingTopup !== undefined && balanceData.pendingTopup > 0 && (
                  <div className="mt-2 text-xs bg-primary-foreground/10 inline-block px-2.5 py-1 rounded-full font-medium">
                    + {formatRupiah(balanceData.pendingTopup)} menunggu konfirmasi
                  </div>
                )}
              </div>
            )}
          </div>

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
                    <Label className="text-xs">Pilih Nominal</Label>
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

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="text-xs">Nominal Lain (Min. Rp 10.000)</Label>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm font-medium">Rp</span>
                            <Input type="number" className="pl-9 font-medium" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={topup.isPending}>
                    {topup.isPending ? "Membuat QRIS..." : "Buat QRIS"}
                  </Button>
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
            ) : historyData && historyData.length > 0 ? (
              <div className="divide-y">
                {historyData.map((tx) => {
                  const isExpired = (tx as any).expiresAt ? new Date((tx as any).expiresAt) < new Date() : false;
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
                            <div className="font-semibold text-sm">{formatRupiah(tx.amount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {format(new Date(tx.createdAt), "d MMM yyyy HH:mm")}
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
              <div className="py-12 text-center text-sm text-muted-foreground">
                Belum ada riwayat topup.
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

          <div className="flex justify-center p-4 bg-white rounded-lg my-2 relative">
            {countdown?.expired && (
              <div className="absolute inset-0 bg-white/90 rounded-lg flex flex-col items-center justify-center z-10 gap-2">
                <XCircle className="h-10 w-10 text-red-500" />
                <p className="text-sm font-semibold text-red-600">QRIS Kadaluarsa</p>
                <p className="text-xs text-muted-foreground">Buat permintaan topup baru.</p>
              </div>
            )}
            {qrisUrl ? (
              <img
                src={qrisUrl}
                alt="QRIS Code"
                className="max-w-full h-auto max-h-64 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=qris_mock";
                }}
              />
            ) : (
              <div className="w-48 h-48 bg-gray-200 animate-pulse flex items-center justify-center text-muted-foreground text-sm">
                QR Code
              </div>
            )}
          </div>

          {qrisGateway === "autogopay" ? (
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

import {
  useGetOrder,
  getGetOrderQueryKey,
  useGetAccount,
  getGetBalanceQueryKey,
  getGetAccountQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { formatRupiah, formatExpiryLabel, getExpiryColorClass, safeFormatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Clock, CreditCard, ShoppingBag, AlertCircle, CheckCircle2, Copy, QrCode, Shield, Loader2, ScanLine, Timer } from "lucide-react";
import { formatDistanceToNow, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect, useRef } from "react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  failed: "bg-red-500/10 text-red-400 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const statusLabel: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  processing: "Sedang Diproses",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

function getPaymentChannelName(channel?: string | null, provider?: string | null) {
  switch (channel) {
    case "ketantechpay":
      return "QRIS dinamis (KetantechPay)";
    case "autogopay_gopay":
      return "QRIS dinamis (GoPay)";
    case "autogopay_shopeepay":
      return "QRIS (ShopeePay)";
    default:
      return provider === "autogopay"
        ? "QRIS dinamis (AutoGoPay)"
        : provider === "ketantechpay"
          ? "QRIS dinamis (KetantechPay)"
          : "QRIS";
  }
}

function QrCodeImage({ data, label }: { data: string; label: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-xl border-2 border-muted shadow">
        <img src={url} alt={`QR ${label}`} width={220} height={220} className="block" />
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Scan menggunakan V2Ray, NekoBox, atau Shadowrocket.
      </p>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());

  const isQrisPending = (o?: { status: string; paymentMethod?: string | null; expiresAt?: string | null }) => {
    if (o?.status !== "pending" || o?.paymentMethod !== "qris") return false;
    if (o?.expiresAt && new Date(o.expiresAt) < new Date()) return false;
    return true;
  };

  // Poll selama pending (QRIS belum bayar) ATAU processing (sedang buat akun VPN)
  const shouldPoll = (o?: { status: string; paymentMethod?: string | null; expiresAt?: string | null }) => {
    if (!o) return false;
    if (o.status === "paid" || o.status === "failed" || o.status === "expired") return false;
    if (o.status === "processing") return true;
    return isQrisPending(o);
  };

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: {
      queryKey: getGetOrderQueryKey(orderId),
      enabled: !!orderId,
      refetchInterval: (q) => shouldPoll(q.state.data) ? 3000 : false,
    }
  });

  const qrisExpired =
    order?.status === "pending" &&
    order?.paymentMethod === "qris" &&
    !!order?.expiresAt &&
    new Date(order.expiresAt) < now;

  // Countdown tick — only while QRIS is active (not expired)
  useEffect(() => {
    if (!isQrisPending(order)) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [order?.status, order?.paymentMethod, order?.expiresAt]);

  // Toast notification when order becomes paid (dari status apapun)
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (order?.status === undefined) return;
    if (order.status === "paid" && prevStatusRef.current !== "paid" && prevStatusRef.current !== undefined) {
      toast({ title: "Pembayaran Diterima!", description: "Akun VPN kamu sudah aktif." });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
    }
    prevStatusRef.current = order.status;
  }, [order?.status]);

  const { data: vpnAccount } = useGetAccount(order?.vpnAccountId ?? 0, {
    query: { 
      queryKey: getGetAccountQueryKey(order?.vpnAccountId ?? 0),
      enabled: !!order?.vpnAccountId && order?.status === "paid" 
    }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Disalin!", description: `${label} disalin ke clipboard.` });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full max-w-2xl mx-auto" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Order tidak ditemukan.</p>
        <Link href="/orders" className="text-primary hover:underline mt-2 inline-block">
          Kembali ke riwayat order
        </Link>
      </div>
    );
  }

  const payableAmount = order.payableAmount ?? order.amount;
  const paymentChannelName = getPaymentChannelName(
    order.paymentChannel,
    order.paymentProvider,
  );
  const allLinks = vpnAccount?.allLinks as Record<string, string | null> | null | undefined;
  const hasAllLinks = allLinks && Object.values(allLinks).some((v) => !!v);
  const LINK_ORDER = ["tls", "none", "grpc", "uptls", "upntls"];
  const LINK_LABELS: Record<string, string> = {
    tls: "WS TLS", none: "WS No TLS", grpc: "gRPC TLS", uptls: "Upgrade TLS", upntls: "Upgrade No TLS",
  };
  const linkKeys = allLinks
    ? [
        ...LINK_ORDER.filter((k) => !!allLinks[k]),
        ...Object.keys(allLinks).filter((k) => !LINK_ORDER.includes(k) && !!allLinks[k]),
      ]
    : [];

  const daysLeft = vpnAccount
    ? differenceInCalendarDays(new Date(vpnAccount.expiresAt), new Date())
    : 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/orders" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Riwayat Order
          </Link>
        </Button>
      </div>

      <Card className="glass-panel border-white/5 overflow-hidden shadow-lg">
        <div className={`h-2 w-full ${order.status === 'paid' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : order.status === 'pending' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
        <CardHeader className="pb-4 border-b border-white/5">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Order #{order.id}
                {order.status === 'paid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {safeFormatDate(order.createdAt, "d MMMM yyyy, HH:mm", { locale: idLocale })}
              </div>
            </div>
            <Badge variant="outline" className={`text-base px-3 py-1 ${statusColors[order.status]}`}>
              {statusLabel[order.status]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {order.product && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detail Produk</h3>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-accent/50 border">
                <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg">{order.product.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px]">{order.product.protocol}</Badge>
                    <span>{order.product.durationDays === 0 ? "1 Jam (Trial)" : `${order.product.durationDays} Hari`}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ringkasan Pembayaran</h3>
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Metode
                </span>
                <span className="font-medium capitalize">
                  {order.paymentMethod === "balance" ? "Saldo Akun" : order.paymentMethod === "qris" ? "QRIS" : order.paymentMethod || "-"}
                </span>
              </div>
              {order.paymentMethod === "qris" && (
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Channel pembayaran</span>
                  <span className="font-medium text-right">{paymentChannelName}</span>
                </div>
              )}
              {order.notes && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nama Akun</span>
                  <span className="font-mono font-medium">{order.notes}</span>
                </div>
              )}
              {!!order.uniqueCode && (
                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                  Kode unik <strong className="text-foreground">+{formatRupiah(order.uniqueCode)}</strong> sudah termasuk dalam total. Setelah pembayaran berhasil, nilai kode unik akan dikreditkan ke saldo akun kamu.
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-3 border-t">
                <span>Total Pembayaran</span>
                <span className="text-primary">{formatRupiah(payableAmount)}</span>
              </div>
            </div>
          </div>

          {/* Struk Digital – tampil setelah dibayar */}
          {order.status === "paid" && vpnAccount && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pt-2">
                <Shield className="h-5 w-5 text-green-500" />
                <h3 className="text-base font-bold text-green-700">Akun VPN Siap Digunakan!</h3>
              </div>

              {/* Info akun */}
              <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 overflow-hidden">
                <div className="bg-green-500/10 px-4 py-3 border-b border-green-500/20 flex justify-between items-center">
                  <span className="font-mono font-bold text-lg">{vpnAccount.username}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="uppercase">{vpnAccount.protocol}</Badge>
                    <Badge variant={vpnAccount.isActive ? "default" : "destructive"}>
                      {vpnAccount.isActive ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Server</p>
                      <p className="font-medium">{vpnAccount.server?.name ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{vpnAccount.server?.location ?? ""}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Kedaluwarsa</p>
                      <p className="font-medium">{safeFormatDate(vpnAccount.expiresAt, "d MMM yyyy", { locale: idLocale })}</p>
                      <p className={`text-xs font-medium ${getExpiryColorClass(daysLeft, vpnAccount?.isActive ?? true)}`}>
                        {formatExpiryLabel(daysLeft, vpnAccount?.isActive ?? true)}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Kuota</p>
                      <p className="font-medium">{vpnAccount.quota ? `${vpnAccount.quota} GB` : "Unlimited"}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Host</p>
                      <p className="font-mono text-xs">{vpnAccount.server?.host ?? "-"}</p>
                    </div>
                  </div>

                  {vpnAccount.uuid && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground uppercase font-semibold">UUID / Password</Label>
                      <div className="flex gap-2">
                        <Input value={vpnAccount.uuid} readOnly className="font-mono text-xs bg-muted/50 h-8" />
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(vpnAccount.uuid!, "UUID")} className="h-8 px-2 shrink-0">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Config / Import Links */}
              {(hasAllLinks || vpnAccount.configLink) && (
                <div className="rounded-xl border bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    Link Import Config
                  </p>
                  {hasAllLinks ? (
                    <div className="space-y-3">
                      {linkKeys.map((key) => {
                        const link = allLinks![key];
                        if (!link) return null;
                        const label = LINK_LABELS[key] ?? key.toUpperCase();
                        return (
                          <div key={key} className="space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
                            <div className="flex gap-2">
                              <Input value={link} readOnly className="font-mono text-xs bg-background h-8" />
                              <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={() => copyToClipboard(link, label)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                                    <QrCode className="h-3.5 w-3.5" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-sm flex flex-col items-center p-8 gap-4">
                                  <DialogHeader><DialogTitle className="text-center">QR — {label}</DialogTitle></DialogHeader>
                                  <QrCodeImage data={link} label={label} />
                                  <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(link, label)}>
                                    <Copy className="h-3.5 w-3.5" /> Salin Link
                                  </Button>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : vpnAccount.configLink ? (
                    <div className="flex gap-2">
                      <Input value={vpnAccount.configLink} readOnly className="font-mono text-xs bg-background h-8" />
                      <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={() => copyToClipboard(vpnAccount.configLink!, "Config Link")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 px-2 shrink-0">
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm flex flex-col items-center p-8 gap-4">
                          <DialogHeader><DialogTitle className="text-center">QR Code Config</DialogTitle></DialogHeader>
                          <QrCodeImage data={vpnAccount.configLink} label="Config" />
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => copyToClipboard(vpnAccount.configLink!, "Config Link")}>
                            <Copy className="h-3.5 w-3.5" /> Salin Link
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : null}
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" asChild>
                <Link href={`/accounts/${order.vpnAccountId}`}>
                  Lihat Detail Lengkap Akun →
                </Link>
              </Button>
            </div>
          )}

          {order.status === "paid" && order.vpnAccountId && !vpnAccount && (
            <div className="bg-green-500/10 p-5 rounded-lg border border-green-500/20 flex flex-col items-center justify-center text-center space-y-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div className="font-semibold text-green-700">Akun VPN kamu sudah siap!</div>
              <Button asChild className="gap-2">
                <Link href={`/accounts/${order.vpnAccountId}`}>Lihat Detail Akun</Link>
              </Button>
            </div>
          )}

          {/* Status Processing — tampil animasi loading + info */}
          {order.status === "processing" && (
            <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-6 flex flex-col items-center gap-3 text-center">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <div>
                <p className="font-semibold text-blue-700">Pembayaran diterima!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Akun VPN kamu sedang dibuat. Tunggu sebentar, halaman akan otomatis terupdate...
                </p>
              </div>
            </div>
          )}

          {order.status === "pending" && order.paymentMethod === "qris" && (
            <div className={`rounded-xl border-2 overflow-hidden ${qrisExpired ? "border-red-500/30 bg-red-500/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${qrisExpired ? "bg-red-500/15 border-red-500/20" : "bg-yellow-500/15 border-yellow-500/20"}`}>
                <div className={`flex items-center gap-2 font-semibold ${qrisExpired ? "text-red-800" : "text-yellow-800"}`}>
                  <ScanLine className="h-4 w-4" />
                  Bayar via QRIS
                </div>
                <div className={`flex items-center gap-1.5 text-sm ${qrisExpired ? "text-red-700" : "text-yellow-700"}`}>
                  {qrisExpired ? (
                    <>
                      <AlertCircle className="h-3.5 w-3.5" />
                      QRIS Kedaluwarsa
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menunggu pembayaran...
                    </>
                  )}
                </div>
              </div>

              <div className="p-6 flex flex-col items-center gap-4">
                {qrisExpired ? (
                  <div className="text-center py-4 space-y-3">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                    <div>
                      <p className="font-semibold text-red-700">QRIS sudah tidak berlaku</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                        Batas waktu pembayaran telah lewat. Silakan buat order baru atau hubungi admin jika sudah terlanjur membayar.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/order-vpn">Order VPN Baru</Link>
                    </Button>
                  </div>
                ) : order.qrisUrl ? (
                  <>
                    <div className="bg-white p-3 rounded-xl border-2 border-yellow-500/30 shadow">
                      <img
                        src={order.qrisUrl}
                        alt="QRIS Payment"
                        width={220}
                        height={220}
                        className="block"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    <p className="text-sm text-center text-muted-foreground max-w-sm">
                      Pindai QRIS dengan GoPay, OVO, ShopeePay, atau aplikasi QRIS lainnya. OVO cukup memindai QRIS yang tampil—tidak perlu memilih channel ShopeePay.
                    </p>
                  </>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-4">
                    <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    QRIS tidak tersedia. Hubungi admin.
                  </div>
                )}

                {!qrisExpired && (
                  <div className="w-full rounded-lg border bg-background divide-y text-sm">
                    <div className="flex justify-between gap-4 px-4 py-2.5">
                      <span className="text-muted-foreground">Channel pembayaran</span>
                      <span className="font-medium text-right">{paymentChannelName}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2.5">
                      <span className="text-muted-foreground">Total Bayar</span>
                      <span className="font-bold text-primary">{formatRupiah(payableAmount)}</span>
                    </div>
                    {!!order.uniqueCode && (
                      <div className="px-4 py-2.5 text-left">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">Kode unik</span>
                          <span className="font-medium">+{formatRupiah(order.uniqueCode)}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Kode unik termasuk dalam total bayar dan akan dikreditkan ke saldo akun setelah pembayaran berhasil.
                        </p>
                      </div>
                    )}
                    {order.expiresAt && (
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5" />
                          Berlaku hingga
                        </span>
                        <span className={`font-medium text-right ${new Date(order.expiresAt).getTime() - now.getTime() < 5 * 60 * 1000 ? "text-destructive" : ""}`}>
                          {safeFormatDate(order.expiresAt, "HH:mm:ss", { locale: idLocale })}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({formatDistanceToNow(new Date(order.expiresAt), { locale: idLocale, addSuffix: true })})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {!qrisExpired && (
                  <p className="text-xs text-muted-foreground text-center">
                    Halaman ini otomatis terupdate setelah pembayaran berhasil.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {order.status === "pending" && order.paymentMethod === "balance" && (
          <CardFooter className="border-t border-white/5 pt-6">
            <div className="w-full rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
              <div>
                <p className="font-semibold text-amber-700">Order Tidak Dapat Diselesaikan</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Sistem pembayaran untuk order ini sudah tidak aktif. Order ini hanya tersimpan sebagai riwayat.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href="/order-vpn">Buat Order Baru</Link>
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

import { useGetAccount, useListProducts, useGetBalance, useRenewAccount, getGetAccountQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, QrCode, Clock, Activity, ShieldCheck, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, RotateCcw, Tag } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { useState } from "react";
import { getApiError } from "@/lib/utils";

const LINK_ORDER = ["tls", "none", "grpc", "uptls", "upntls"];

const LINK_LABELS: Record<string, string> = {
  tls: "WS TLS",
  none: "WS No TLS",
  grpc: "gRPC TLS",
  uptls: "Upgrade TLS",
  upntls: "Upgrade No TLS",
};

function QrCodeImage({ data, label }: { data: string; label: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(data)}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="bg-white p-4 rounded-xl border-2 border-muted shadow">
        <img
          src={url}
          alt={`QR Code ${label}`}
          width={220}
          height={220}
          className="block"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Scan menggunakan aplikasi VPN seperti V2Ray, NekoBox, atau Shadowrocket.
      </p>
    </div>
  );
}

function RenewDialog({ accountId, protocol, serverName, serverFlag, serverLocation, isExpired }: {
  accountId: number;
  protocol: string;
  serverName: string;
  serverFlag: string;
  serverLocation: string;
  isExpired: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [renewed, setRenewed] = useState(false);

  const { data: products, isLoading: loadingProducts } = useListProducts({
    query: { enabled: open },
  });
  const { data: balanceData, isLoading: loadingBalance } = useGetBalance({
    query: { enabled: open },
  });

  const renewMutation = useRenewAccount();

  const matchingProducts = products?.filter(
    (p) => p.isActive && p.protocol === protocol
  ) ?? [];

  const selectedProduct = matchingProducts.find((p) => p.id === selectedProductId);
  const balance = balanceData?.balance ?? 0;
  const canAfford = selectedProduct ? balance >= selectedProduct.price : false;

  const handleRenew = () => {
    if (!selectedProductId) return;
    renewMutation.mutate(
      { id: accountId, data: { productId: selectedProductId } },
      {
        onSuccess: () => {
          setRenewed(true);
          queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
          toast({
            title: isExpired ? "Pemulihan berhasil!" : "Renew berhasil!",
            description: `Akun berhasil ${isExpired ? "dipulihkan" : "diperpanjang"}. ${selectedProduct ? formatRupiah(selectedProduct.price) + " telah dipotong dari saldo." : ""}`,
          });
        },
        onError: (err) => {
          toast({
            title: isExpired ? "Pemulihan gagal" : "Renew gagal",
            description: getApiError(err),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setSelectedProductId(null);
      setRenewed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isExpired ? (
          <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
            <RotateCcw className="h-4 w-4" />
            Pulihkan Akun
          </Button>
        ) : (
          <Button className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Renew Akun
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isExpired ? "Pulihkan Akun VPN" : "Perpanjang Akun VPN"}</DialogTitle>
          <DialogDescription>
            {isExpired
              ? "Akun ini sudah kedaluwarsa. Pilih paket untuk mengaktifkan kembali. Konfigurasi dan server tidak berubah."
              : "Pilih durasi perpanjangan. Server dan akun tetap sama, hanya masa aktif yang ditambah."}
          </DialogDescription>
        </DialogHeader>

        {/* Info server — tidak berubah */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 text-sm">
          <span className="text-2xl leading-none">{serverFlag}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{serverName}</div>
            <div className="text-xs text-muted-foreground">{serverLocation} &bull; {protocol.toUpperCase()}</div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">Server tetap sama</Badge>
        </div>

        {renewed ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">{isExpired ? "Pemulihan Berhasil!" : "Renew Berhasil!"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isExpired ? "Akun kamu sudah aktif kembali." : "Akun kamu sudah diperpanjang."}
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">Tutup</Button>
          </div>
        ) : (
          <>
            {/* Saldo user */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-lg border text-sm">
              <span className="text-muted-foreground">Saldo kamu</span>
              {loadingBalance ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="font-bold text-base">{formatRupiah(balance)}</span>
              )}
            </div>

            {/* Pilih produk */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pilih Durasi Perpanjangan</Label>
              {loadingProducts ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : matchingProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  Tidak ada paket tersedia untuk protokol {protocol.toUpperCase()}.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {matchingProducts.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    const affordable = balance >= p.price;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        disabled={!affordable}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : affordable
                            ? "border-muted hover:border-primary/40 bg-card"
                            : "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-base">{p.durationDays} hari</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{p.name}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-sm ${isSelected ? "text-primary" : ""}`}>
                              {formatRupiah(p.price)}
                            </div>
                            {!affordable && (
                              <div className="text-xs text-destructive mt-0.5">Saldo kurang</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info produk terpilih */}
            {selectedProduct && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${canAfford ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800"}`}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {canAfford ? (
                    <>
                      Saldo kamu akan berkurang <strong>{formatRupiah(selectedProduct.price)}</strong>.
                      Sisa saldo: <strong>{formatRupiah(balance - selectedProduct.price)}</strong>.
                    </>
                  ) : (
                    <>
                      Saldo tidak cukup. Kamu perlu tambah saldo minimal{" "}
                      <strong>{formatRupiah(selectedProduct.price - balance)}</strong>.
                    </>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Batal
              </Button>
              <Button
                onClick={handleRenew}
                disabled={!selectedProductId || !canAfford || renewMutation.isPending}
                className={`gap-2 ${isExpired ? "bg-amber-600 hover:bg-amber-700" : ""}`}
              >
                {renewMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : isExpired ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Pulihkan Akun
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Konfirmasi Renew
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0", 10);
  const { toast } = useToast();

  const { data: account, isLoading } = useGetAccount(accountId, {
    query: { enabled: !!accountId }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Disalin!",
      description: `${label} disalin ke clipboard.`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Akun tidak ditemukan.</p>
        <Link href="/accounts" className="text-primary hover:underline mt-2 inline-block">
          Kembali ke akun
        </Link>
      </div>
    );
  }

  const allLinks = account.allLinks as Record<string, string | null> | null | undefined;
  const hasAllLinks = allLinks && Object.values(allLinks).some(v => !!v);

  const daysLeft = differenceInCalendarDays(new Date(account.expiresAt), new Date());

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Akun
          </Link>
        </Button>
        <Badge
          variant={account.isActive ? "default" : "destructive"}
          className="text-sm px-3 py-1"
        >
          {account.isActive ? "Aktif" : "Kedaluwarsa"}
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          {/* Info Akun */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-muted/20 border-b pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-mono">{account.username}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2 text-sm">
                    <span className="text-xl leading-none">{account.server.flag}</span>
                    <span>{account.server.name} &bull; {account.server.location}</span>
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="uppercase text-lg py-1">{account.protocol}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className={`grid gap-4 p-4 bg-accent/30 rounded-lg border ${account.productName ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Tanggal Kedaluwarsa</div>
                  <div className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {format(new Date(account.expiresAt), "d MMM yyyy", { locale: idLocale })}
                  </div>
                  {account.isActive && (
                    <div className={`text-xs font-medium ${daysLeft <= 3 ? "text-destructive" : daysLeft <= 7 ? "text-yellow-600" : "text-green-600"}`}>
                      {daysLeft > 0 ? `${daysLeft} hari lagi` : "Kedaluwarsa hari ini"}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Kuota</div>
                  <div className="font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    {account.quota ? `${account.quota} GB` : "Tidak Terbatas"}
                  </div>
                </div>
                {account.productName && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Paket</div>
                    <div className="font-medium flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      {account.productName}
                    </div>
                  </div>
                )}
              </div>

              {/* Detail Koneksi */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Detail Koneksi</h3>

                <div className="space-y-4">
                  {account.uuid && (
                    <div className="space-y-1.5">
                      <Label>UUID / Password</Label>
                      <div className="flex gap-2">
                        <Input value={account.uuid} readOnly className="font-mono bg-muted/50" />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(account.uuid!, "UUID")}
                          title="Salin UUID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {account.protocol === "ssh" && account.password && (
                    <div className="space-y-1.5">
                      <Label>Password SSH</Label>
                      <div className="flex gap-2">
                        <Input value={account.password} readOnly className="font-mono bg-muted/50" />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(account.password!, "Password")}
                          title="Salin Password"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Host / IP</Label>
                      <div className="flex gap-2">
                        <Input value={account.server.host ?? ""} readOnly className="font-mono bg-muted/50 text-sm" />
                        {account.server.host && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(account.server.host!, "Host")}
                            title="Salin Host"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Port TLS / Non TLS</Label>
                      <Input
                        value={account.protocol === "ssh" ? "22 / 443" : "443 / 80"}
                        readOnly
                        className="font-mono bg-muted/50 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Config Links / QR Code */}
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Link Import Cepat
              </CardTitle>
              <CardDescription>Salin atau scan QR untuk import ke aplikasi VPN (V2Ray, Clash, NekoBox, dll)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasAllLinks ? (
                <div className="space-y-4">
                  {[
                    ...LINK_ORDER.filter(k => !!allLinks![k]),
                    ...Object.keys(allLinks!).filter(k => !LINK_ORDER.includes(k) && !!allLinks![k]),
                  ].map((key) => {
                    const link = allLinks![key];
                    if (!link) return null;
                    const label = LINK_LABELS[key] ?? key.toUpperCase();
                    return (
                      <div key={key} className="space-y-2 p-3 rounded-lg bg-background border">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                        <div className="flex gap-2">
                          <Input value={link} readOnly className="font-mono text-xs bg-muted/50" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1"
                            onClick={() => copyToClipboard(link, label)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Salin
                          </Button>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Tampilkan QR Code
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center p-8 gap-4">
                            <DialogHeader>
                              <DialogTitle className="text-center">QR Code — {label}</DialogTitle>
                            </DialogHeader>
                            <QrCodeImage data={link} label={label} />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => copyToClipboard(link, label)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Salin Link
                            </Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                    );
                  })}
                </div>
              ) : account.configLink ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-background border space-y-2">
                    <div className="flex gap-2">
                      <Input value={account.configLink} readOnly className="font-mono text-xs bg-muted/50" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 shrink-0"
                        onClick={() => copyToClipboard(account.configLink!, "Config Link")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Salin
                      </Button>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2">
                        <QrCode className="h-4 w-4" />
                        Tampilkan QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center p-8 gap-4">
                      <DialogHeader>
                        <DialogTitle className="text-center">Scan dengan Aplikasi VPN</DialogTitle>
                      </DialogHeader>
                      <QrCodeImage data={account.configLink} label="Config" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => copyToClipboard(account.configLink!, "Config Link")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Salin Link
                      </Button>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Config link belum tersedia. Silakan hubungi admin.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar kanan */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RenewDialog
                accountId={accountId}
                protocol={account.protocol}
                serverName={account.server.name}
                serverFlag={account.server.flag}
                serverLocation={account.server.location}
                isExpired={!account.isActive || new Date(account.expiresAt) < new Date()}
              />
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/orders/${account.orderId}`}>Lihat Order Asli</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Aplikasi VPN Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground text-xs">Rekomendasi aplikasi untuk protokol {account.protocol.toUpperCase()}:</p>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://github.com/2dust/v2rayN/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    v2rayN (Windows)
                  </a>
                </li>
                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.v2ray.ang"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    v2rayNG (Android)
                  </a>
                </li>
                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.github.kr328.clash"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    NekoBox (Android)
                  </a>
                </li>
                <li>
                  <a
                    href="https://apps.apple.com/us/app/shadowrocket/id932747118"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Shadowrocket (iOS)
                  </a>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

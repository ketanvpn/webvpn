import { useGetAccount, useListProducts, useGetBalance, useRenewAccount, getGetAccountQueryKey, getListProductsQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
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
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { formatRupiah } from "@/lib/format";
import { useState } from "react";
import { getApiError } from "@/lib/utils";
import {
  dynamicDurationOptionLabel,
  isDynamicDurationType,
  type DynamicDurationType,
} from "@/lib/dynamic-duration";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

const LINK_ORDER = ["tls", "none", "grpc", "uptls", "upntls"];

function pickDisplayHost(allLinks: Record<string, string | null> | null | undefined, fallback: string) {
  const values = [
    allLinks?.domain,
    allLinks?.cloudfront,
    allLinks?.host,
    allLinks?.server,
    allLinks?.sni,
    allLinks?.servername,
    allLinks?.hostname,
    fallback,
  ];
  return values.find((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized && !["no", "none", "null", "undefined", "-"].includes(normalized);
  }) ?? "";
}

const SSH_WS_PAYLOADS = [
  {
    title: "CDN",
    payload: "GET / HTTP/1.1[crlf]Host: [host_port][crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
  },
  {
    title: "WITHPATH",
    payload: "GET /worryfree/ssh HTTP/1.1[crlf]Host: BUG[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
  },
];

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

function RenewDialog({ accountId, serverId, protocol, serverName, serverFlag, serverLocation, serverIsActive }: {
  accountId: number;
  serverId: number;
  protocol: string;
  serverName: string;
  serverFlag: string;
  serverLocation: string;
  serverIsActive: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [renewed, setRenewed] = useState(false);

  const { data: products, isLoading: loadingProducts } = useListProducts(
    undefined,
    { query: { queryKey: getListProductsQueryKey(), enabled: open } },
  );
  const { data: balanceData, isLoading: loadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey(), enabled: open },
  });

  const renewMutation = useRenewAccount();

  const effectivePrice = (p: { price: number; resellerPrice?: number | null }) =>
    p.resellerPrice ?? p.price;

  const matchingProducts = products?.filter(
    (p) =>
      p.isActive &&
      p.protocol === protocol &&
      (!p.serverId || p.serverId === serverId)
  ) ?? [];

  const selectedProduct = matchingProducts.find((p) => p.id === selectedProductId);
  const balance = balanceData?.balance ?? 0;
  const canAfford = selectedProduct ? balance >= effectivePrice(selectedProduct) : false;

  const handleRenew = () => {
    if (!selectedProductId) return;
    renewMutation.mutate(
      { id: accountId, data: { productId: selectedProductId } },
      {
        onSuccess: () => {
          setRenewed(true);
          queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
          toast({
            title: "Renew berhasil!",
            description: `Akun berhasil diperpanjang. ${selectedProduct ? formatRupiah(effectivePrice(selectedProduct)) + " telah dipotong dari saldo." : ""}`,
          });
        },
        onError: (err) => {
          toast({
            title: "Renew gagal",
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
        <Button className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Renew Akun
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perpanjang Akun VPN</DialogTitle>
          <DialogDescription>
            Pilih durasi perpanjangan. Server dan akun tetap sama, hanya masa aktif yang ditambah.
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
              <p className="font-semibold text-lg">Renew Berhasil!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Akun kamu sudah diperpanjang.
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
              ) : !serverIsActive ? (
                <div className="text-center py-8 px-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="font-semibold">Server Offline / Maintenance</p>
                  <p>Server <b>{serverName}</b> sedang tidak aktif. Kamu tidak dapat melakukan perpanjangan akun saat ini.</p>
                </div>
              ) : matchingProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  Tidak ada paket tersedia untuk protokol {protocol.toUpperCase()}.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {matchingProducts.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    const eprice = effectivePrice(p);
                    const affordable = balance >= eprice;
                    const hasDiscount = p.resellerPrice != null && p.resellerPrice < p.price;
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
                            <div className="font-bold text-base">{p.durationDays === 0 ? "1 Jam (Trial)" : `${p.durationDays} hari`}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{p.name}</div>
                          </div>
                          <div className="text-right">
                            {hasDiscount && (
                              <div className="text-xs text-muted-foreground line-through">{formatRupiah(p.price)}</div>
                            )}
                            <div className={`font-bold text-sm ${hasDiscount ? "text-green-600" : ""} ${isSelected ? "text-primary" : ""}`}>
                              {formatRupiah(eprice)}
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
                      Saldo kamu akan berkurang <strong>{formatRupiah(effectivePrice(selectedProduct))}</strong>.
                      Sisa saldo: <strong>{formatRupiah(balance - effectivePrice(selectedProduct))}</strong>.
                    </>
                  ) : (
                    <>
                      Saldo tidak cukup. Kamu perlu tambah saldo minimal{" "}
                      <strong>{formatRupiah(effectivePrice(selectedProduct) - balance)}</strong>.
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
                disabled={!selectedProductId || !canAfford || renewMutation.isPending || !serverIsActive}
                className="gap-2"
              >
                {renewMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
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

function DynamicRenewDialog({ accountId, protocol, serverName, serverFlag, serverLocation, supportedTypes }: {
  accountId: number;
  protocol: string;
  serverName: string;
  serverFlag: string;
  serverLocation: string;
  supportedTypes: DynamicDurationType[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const defaultDurationType: DynamicDurationType = supportedTypes.includes("month")
    ? "month"
    : supportedTypes.includes("week")
      ? "week"
      : "day";
  const [durationType, setDurationType] = useState<DynamicDurationType>(defaultDurationType);
  const [duration, setDuration] = useState("1");
  const [renewedAmount, setRenewedAmount] = useState<number | null>(null);

  const renewMutation = useMutation({
    mutationFn: async () => {
      const parsedDuration = parseInt(duration, 10);
      const res = await fetch(`${API}/accounts/${accountId}/renew-dynamic`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationType, duration: parsedDuration }),
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal renew dynamic");
      return body as { amount?: number; discountAmount?: number };
    },
    onSuccess: (body) => {
      setRenewedAmount(body.amount ?? null);
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({
        title: "Renew dynamic berhasil!",
        description: body.amount != null ? `${formatRupiah(body.amount)} telah dipotong dari saldo.` : "Akun berhasil diperpanjang dari NadiaVPN.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Renew dynamic gagal",
        description: err instanceof Error ? err.message : "Gagal renew dynamic",
        variant: "destructive",
      });
    },
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const parsedDuration = parseInt(duration, 10);
      const res = await fetch(`${API}/accounts/${accountId}/renew-dynamic/quote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationType, duration: parsedDuration }),
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal menghitung harga renew");
      return body as { amount: number; baseAmount: number; resellerDiscountAmount: number; unitPrice: number; durationLabel: string };
    },
  });

  const parsedDuration = parseInt(duration, 10);
  const isValidDuration = Number.isInteger(parsedDuration) && parsedDuration > 0;
  const quote = quoteMutation.data;
  const quoteError = quoteMutation.error instanceof Error ? quoteMutation.error.message : null;

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      quoteMutation.mutate();
      return;
    }
    setDurationType(defaultDurationType);
    setDuration("1");
    setRenewedAmount(null);
    renewMutation.reset();
    quoteMutation.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Renew Akun
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perpanjang Akun Dynamic</DialogTitle>
          <DialogDescription>
            Pilih durasi perpanjangan akun. Pastikan nominal pembayaran sudah sesuai sebelum konfirmasi renew.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 text-sm">
          <span className="text-2xl leading-none">{serverFlag}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{serverName}</div>
            <div className="text-xs text-muted-foreground">{serverLocation} &bull; {protocol.toUpperCase()} &bull; NadiaVPN</div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">Dynamic</Badge>
        </div>

        {renewedAmount != null ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Renew Berhasil!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Saldo terpotong {formatRupiah(renewedAmount)} dan detail akun sudah disinkronkan ulang.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">Tutup</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe Durasi</Label>
                <select
                  value={durationType}
                  onChange={(e) => {
                    if (!isDynamicDurationType(e.target.value)) return;
                    setDurationType(e.target.value);
                    if (e.target.value === "week") setDuration("1");
                    quoteMutation.reset();
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {supportedTypes.map((type) => (
                    <option key={type} value={type}>{dynamicDurationOptionLabel(type)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  disabled={durationType === "week"}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    quoteMutation.reset();
                  }}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Detail Pembayaran</div>
                  <div className="text-xs text-muted-foreground">Cek nominal sebelum konfirmasi renew.</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quoteMutation.mutate()}
                  disabled={!isValidDuration || quoteMutation.isPending || renewMutation.isPending}
                  className="shrink-0 gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${quoteMutation.isPending ? "animate-spin" : ""}`} />
                  Cek Harga
                </Button>
              </div>

              {quoteMutation.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : quote ? (
                <div className="space-y-2 rounded-md border bg-background/60 p-3">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Durasi</span>
                    <span className="font-medium">{quote.durationLabel}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Harga satuan</span>
                    <span className="font-medium">{formatRupiah(quote.unitPrice)}</span>
                  </div>
                  {quote.resellerDiscountAmount > 0 && (
                    <div className="flex justify-between gap-3 text-green-500">
                      <span>Diskon reseller</span>
                      <span>-{formatRupiah(quote.resellerDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between gap-3 text-base font-bold">
                    <span>Total bayar</span>
                    <span className="text-primary">{formatRupiah(quote.amount)}</span>
                  </div>
                </div>
              ) : quoteError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Klik Cek Harga untuk melihat total bayar.</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>Batal</Button>
              <Button onClick={() => renewMutation.mutate()} disabled={!isValidDuration || !quote || quoteMutation.isPending || renewMutation.isPending} className="gap-2">
                {renewMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
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
    query: { queryKey: getGetAccountQueryKey(accountId), enabled: !!accountId }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Disalin!",
      description: `${label} disalin ke clipboard.`,
    });
  };

  const queryClient = useQueryClient();
  const syncProviderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/accounts/${accountId}/sync-provider`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal sync detail provider");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
      toast({ title: "Detail provider diperbarui", description: "Data akun berhasil disinkronkan dari NadiaVPN." });
    },
    onError: (err: unknown) => {
      toast({ title: "Sync gagal", description: err instanceof Error ? err.message : "Gagal sync detail provider", variant: "destructive" });
    },
  });

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
  const dynamicOrder = (account as typeof account & {
    dynamicOrder?: {
      provider?: string | null;
      renewEnabled?: boolean;
      supportedTypes?: string[];
      sellPricePerDay?: number;
      sellPricePerWeek?: number;
      sellPricePerMonth?: number;
    } | null;
  }).dynamicOrder;
  const isDynamicAccount = dynamicOrder?.provider === "nadiavpn" || dynamicOrder?.provider === "local_panel";
  const dynamicRenewTypes = (dynamicOrder?.supportedTypes ?? []).filter(isDynamicDurationType);
  const isSsh = account.protocol === "ssh";
  const accountHost = pickDisplayHost(allLinks, account.server.host ?? "");
  const hasAllLinks = !isSsh && allLinks && Object.entries(allLinks).some(([key, value]) => !["hostname", "servername", "host", "domain", "server", "cloudfront", "sni"].includes(key) && !!value);
  const sshHost = accountHost;
  const sshPortText = [allLinks?.port_tls, allLinks?.port_none].filter(Boolean).join(" / ") || "22 / 443";
  const sshDetails = [
    { label: "Server Name / SNI", value: allLinks?.servername },
    { label: "Port TLS", value: allLinks?.port_tls },
    { label: "Port Non TLS", value: allLinks?.port_none },
    { label: "Port Any", value: allLinks?.port_any },
    { label: "SlowDNS", value: allLinks?.slowdns },
    { label: "UDP Custom", value: allLinks?.udp_custom },
    { label: "UDPGW", value: allLinks?.udpgw },
    { label: "Squid", value: allLinks?.squid },
    { label: "Public Key", value: allLinks?.pubkey },
  ].filter((item) => !!item.value);

  const daysLeft = differenceInCalendarDays(new Date(account.expiresAt), new Date());

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 overflow-hidden">
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

      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <div className="min-w-0 space-y-6 md:col-span-2">

          {/* Info Akun */}
          <Card className="glass-panel overflow-hidden border-white/5 shadow-lg">
            <CardHeader className="border-b border-white/5 pb-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="break-all text-xl font-mono sm:text-2xl">{account.username}</CardTitle>
                  <CardDescription className="mt-1 flex min-w-0 items-center gap-2 text-sm">
                    <span className="text-xl leading-none">{account.server.flag}</span>
                    <span className="min-w-0 truncate">{account.server.name} &bull; {account.server.location}</span>
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="w-fit uppercase text-sm py-1 sm:text-lg">{account.protocol}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className={`grid gap-4 p-4 glass-card border-white/5 rounded-lg ${account.productName ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                    <div>
                      <div className="text-sm font-semibold text-emerald-300">Data Akun {account.protocol.toUpperCase()}</div>
                      <p className="text-xs text-muted-foreground">Salin data utama ini ke aplikasi VPN kamu agar tidak tertukar.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 min-w-0">
                        <Label>Host / IP</Label>
                        <div className="flex min-w-0 gap-2">
                          <Input value={accountHost} readOnly className="min-w-0 font-mono bg-muted/50 text-sm" />
                          {accountHost && (
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(accountHost, "Host")} title="Salin Host">
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <Label>Username</Label>
                        <div className="flex min-w-0 gap-2">
                          <Input value={account.username} readOnly className="min-w-0 font-mono bg-muted/50 text-sm" />
                          <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(account.username, "Username")} title="Salin Username">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {account.password && (
                        <div className="space-y-1.5 min-w-0">
                          <Label>Password</Label>
                          <div className="flex min-w-0 gap-2">
                            <Input value={account.password} readOnly className="min-w-0 font-mono bg-muted/50 text-sm" />
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(account.password!, "Password")} title="Salin Password">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {!isSsh && account.uuid && (
                        <div className="space-y-1.5 min-w-0">
                          <Label>UUID</Label>
                          <div className="flex min-w-0 gap-2">
                            <Input value={account.uuid} readOnly className="min-w-0 font-mono bg-muted/50 text-sm" />
                            <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(account.uuid!, "UUID")} title="Salin UUID">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5 min-w-0">
                        <Label>Port TLS / Non TLS</Label>
                        <Input value={isSsh ? sshPortText : "443 / 80"} readOnly className="min-w-0 font-mono bg-muted/50 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {!isSsh ? (
            <Card className="glass-panel overflow-hidden border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <CardHeader className="border-b border-white/5 pb-4">
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
                      ...Object.keys(allLinks!).filter(k => !LINK_ORDER.includes(k) && !["hostname", "servername", "host", "domain", "server", "cloudfront", "sni"].includes(k) && !!allLinks![k]),
                    ].map((key) => {
                      const link = allLinks![key];
                      if (!link) return null;
                      const label = LINK_LABELS[key] ?? key.toUpperCase();
                      return (
                        <div key={key} className="space-y-2 p-3 rounded-lg bg-background border">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                          <div className="flex min-w-0 gap-2">
                            <Input value={link} readOnly className="min-w-0 font-mono text-xs bg-muted/50" />
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 px-2 sm:px-3 gap-1"
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
                      <div className="flex min-w-0 gap-2">
                        <Input value={account.configLink} readOnly className="min-w-0 font-mono text-xs bg-muted/50" />
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 px-2 sm:px-3 gap-1"
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
          ) : sshDetails.length > 0 && (
            <Card className="glass-panel overflow-hidden border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Detail SSH Tambahan
                </CardTitle>
                <CardDescription>Informasi host, port, SlowDNS, dan public key untuk konfigurasi SSH.</CardDescription>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                {sshDetails.map((item) => (
                  <div key={item.label} className="space-y-1.5 p-3 rounded-lg bg-background border">
                    <Label className="text-xs text-muted-foreground">{item.label}</Label>
                    <div className="flex min-w-0 gap-2">
                      <Input value={item.value ?? ""} readOnly className="min-w-0 font-mono text-xs bg-muted/50" />
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(item.value ?? "", item.label)}
                        title={`Salin ${item.label}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {isSsh && (
            <Card className="glass-panel overflow-hidden border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  PAYLOAD WEBSOCKET
                </CardTitle>
                <CardDescription>Payload umum untuk konfigurasi SSH WebSocket.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {SSH_WS_PAYLOADS.map((item) => (
                  <div key={item.title} className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-cyan-300">{item.title}</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => copyToClipboard(item.payload, `Payload ${item.title}`)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Salin
                      </Button>
                    </div>
                    <pre className="min-w-0 whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                      {item.payload}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar kanan */}
        <div className="min-w-0 space-y-6">
          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base">Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {account.isActive && new Date(account.expiresAt) > new Date() && (
                isDynamicAccount ? (
                  dynamicOrder?.renewEnabled !== false && dynamicRenewTypes.length > 0 ? (
                    <DynamicRenewDialog
                      accountId={accountId}
                      protocol={account.protocol}
                      serverName={account.server.name}
                      serverFlag={account.server.flag}
                      serverLocation={account.server.location}
                      supportedTypes={dynamicRenewTypes}
                    />
                  ) : null
                ) : (
                  <RenewDialog
                    accountId={accountId}
                    serverId={account.serverId!}
                    protocol={account.protocol}
                    serverName={account.server.name}
                    serverFlag={account.server.flag}
                    serverLocation={account.server.location}
                    serverIsActive={account.server.isActive}
                  />
                )
              )}
              {dynamicOrder?.provider === "nadiavpn" && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => syncProviderMutation.mutate()}
                  disabled={syncProviderMutation.isPending}
                >
                  <RefreshCw className={`h-4 w-4 ${syncProviderMutation.isPending ? "animate-spin" : ""}`} />
                  {syncProviderMutation.isPending ? "Sync Detail..." : "Sync Detail Provider"}
                </Button>
              )}
              {account.orderId && (
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/orders/${account.orderId}`}>Lihat Order Asli</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel bg-black/20 border-white/5">
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

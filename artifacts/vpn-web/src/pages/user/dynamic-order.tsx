import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CreditCard, PackageX, RefreshCw, Server, Tag, UserRound, Wallet, X, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

type DynamicServer = {
  id: number;
  provider: string;
  displayName: string;
  location: string | null;
  enabledProtocols: string[];
  supportedTypes: string[];
  sellPricePerDay: number;
  sellPricePerMonth: number;
  minDays: number;
  maxDays: number;
  minMonths: number;
  maxMonths: number;
  capacityLimit: string | null;
  capacityUsed: number;
  capacityIsFull: boolean;
  maxConnections: number;
};

type Quote = {
  unitPrice: number;
  baseAmount: number;
  amount: number;
  durationLabel: string;
  resellerDiscountAmount: number;
  voucherDiscountAmount: number;
  discountAmount: number;
  voucherCode: string | null;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
  if (!res.ok) throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

function countryFlag(location?: string | null) {
  const loc = (location ?? "").toUpperCase();
  if (loc === "SG" || loc.includes("SINGAPORE") || loc.includes("SG-")) return "🇸🇬";
  if (loc === "ID" || loc.includes("INDONESIA") || loc.includes("ID-")) return "🇮🇩";
  return "🌐";
}

function ServerCard({ server, onSelect }: { server: DynamicServer; onSelect: () => void }) {
  return (
    <div className="relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 border border-white/5 hover:border-primary/30 glass-card">
      <button type="button" onClick={onSelect} className="p-4 flex gap-3 text-left w-full">
        <div className="flex flex-col items-center gap-1.5 w-16 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center text-3xl shadow-lg border border-white/20">
            {countryFlag(server.location)}
          </div>
          <span className="text-[8px] sm:text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded w-full text-center border border-primary/20 flex items-center justify-center gap-0.5">
            <Zap className="w-2 h-2" /> READY
          </span>
        </div>

        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="font-semibold text-sm sm:text-base leading-snug text-foreground truncate mb-1.5">{server.displayName}</h3>
          <div className="flex flex-wrap gap-1.5">
            {server.enabledProtocols.slice(0, 4).map((protocol) => (
              <span key={protocol} className="text-[9px] sm:text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/5 uppercase">
                {protocol}
              </span>
            ))}
            <span className="text-[9px] sm:text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <Server className="w-2.5 h-2.5" /> {server.capacityUsed}/{server.capacityLimit ?? "∞"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end justify-between shrink-0 py-0.5">
          {server.provider === "local_panel" ? (
            <Badge variant="outline" className="text-[9px] border-white/10 bg-white/5">
              {server.maxConnections > 0 ? `MAX ${server.maxConnections} IP` : "UNLIMITED IP"}
            </Badge>
          ) : <span />}
          <span className="mt-4 h-8 px-3 rounded-md text-xs font-semibold inline-flex items-center justify-center bg-primary/90 text-primary-foreground">
            <CreditCard className="h-3.5 w-3.5 mr-1" /> Order
          </span>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3 p-3 bg-black/20 border-t border-white/5">
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Harian</p>
          <p className="text-xs font-bold text-foreground mt-0.5">{rupiah(server.sellPricePerDay)}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Bulanan</p>
          <p className="text-xs font-bold text-foreground mt-0.5">{rupiah(server.sellPricePerMonth)}</p>
        </div>
      </div>
    </div>
  );
}

export default function DynamicOrderPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedServer, setSelectedServer] = useState<DynamicServer | null>(null);
  const [protocol, setProtocol] = useState("");
  const [durationType, setDurationType] = useState("month");
  const [duration, setDuration] = useState("1");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isUsernameValid = (val: string) => {
    if (val.length < 5) return false;
    const hasLetter = /[a-zA-Z]/.test(val);
    const digitCount = (val.match(/[0-9]/g) || []).length;
    return hasLetter && digitCount >= 2;
  };
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherError, setVoucherError] = useState("");
  const [paidOrderId, setPaidOrderId] = useState<number | null>(null);

  const serversQuery = useQuery<{ servers: DynamicServer[] }>({ queryKey: ["dynamic-vpn-servers"], queryFn: () => apiFetch("/dynamic-vpn/servers") });
  const servers = serversQuery.data?.servers ?? [];
  const durationNum = parseInt(duration || "0", 10);

  const localQuote = useMemo<Quote | null>(() => {
    if (!selectedServer || !durationNum || durationNum < 1) return null;
    const unitPrice = durationType === "day" ? selectedServer.sellPricePerDay : selectedServer.sellPricePerMonth;
    const baseAmount = unitPrice * durationNum;
    return {
      unitPrice,
      baseAmount,
      amount: baseAmount,
      durationLabel: `${durationNum} ${durationType === "day" ? "Hari" : "Bulan"}`,
      resellerDiscountAmount: 0,
      voucherDiscountAmount: 0,
      discountAmount: 0,
      voucherCode: null,
    };
  }, [selectedServer, durationType, durationNum]);

  const quoteQuery = useQuery<Quote>({
    queryKey: ["dynamic-vpn-quote", selectedServer?.id, protocol, durationType, durationNum, appliedVoucher],
    enabled: !!selectedServer && !!protocol && !!durationNum && durationNum > 0,
    queryFn: () => apiFetch("/dynamic-vpn/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverId: selectedServer!.id,
        protocol,
        durationType,
        duration: durationNum,
        voucherCode: appliedVoucher || undefined,
      }),
    }),
    retry: false,
  });
  const quote = quoteQuery.data ?? localQuote;

  useEffect(() => {
    if (appliedVoucher) {
      setAppliedVoucher("");
      setVoucherError("");
    }
  }, [selectedServer?.id, durationType, duration]);

  useEffect(() => {
    if (quoteQuery.error && appliedVoucher) {
      setVoucherError(quoteQuery.error instanceof Error ? quoteQuery.error.message : "Voucher tidak valid");
      setAppliedVoucher("");
    }
  }, [quoteQuery.error, appliedVoucher]);

  const orderMut = useMutation({
    mutationFn: async () => {
      if (!selectedServer) throw new Error("Pilih server terlebih dahulu");
      const created = await apiFetch<{ order: { id: number } }>("/dynamic-vpn/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverId: selectedServer.id,
          protocol,
          durationType,
          duration: durationNum,
          username,
          password: protocol === "ssh" ? password : undefined,
          voucherCode: appliedVoucher || undefined,
          paymentMethod: "balance",
        }),
      });
      return apiFetch<{ order: { id: number; vpnAccountId: number | null } }>(`/dynamic-vpn/orders/${created.order.id}/pay`, { method: "POST" });
    },
    onSuccess: (data) => {
      setPaidOrderId(data.order.id);
      setSelectedServer(null);
      setAppliedVoucher("");
      setVoucherInput("");
      serversQuery.refetch();
      toast({ title: "Order berhasil", description: "Akun VPN sudah dibuat. Membuka detail akun..." });
      if (data.order.vpnAccountId) {
        setLocation(`/accounts/${data.order.vpnAccountId}`);
      }
    },
    onError: (err: unknown) => toast({ title: "Order gagal", description: err instanceof Error ? err.message : "Gagal membuat order", variant: "destructive" }),
  });

  const openOrder = (server: DynamicServer) => {
    setSelectedServer(server);
    setProtocol(server.enabledProtocols?.[0] ?? "");
    setDurationType(server.supportedTypes.includes("month") ? "month" : server.supportedTypes[0] ?? "day");
    setDuration("1");
    setUsername("");
    setPassword("");
    setVoucherInput("");
    setAppliedVoucher("");
    setVoucherError("");
    setPaidOrderId(null);
  };

  const applyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setVoucherError("");
    setAppliedVoucher(code);
  };

  const removeVoucher = () => {
    setVoucherInput("");
    setAppliedVoucher("");
    setVoucherError("");
  };

  const durationHelp = selectedServer
    ? durationType === "day"
      ? `Batas ${selectedServer.minDays}-${selectedServer.maxDays} hari`
      : `Batas ${selectedServer.minMonths}-${selectedServer.maxMonths} bulan`
    : "Pilih server dahulu";

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order VPN</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pilih server premium, lalu atur protocol dan durasi sesuai kebutuhanmu.</p>
      </div>

      {paidOrderId && (
        <Card className="glass-panel border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="py-4 flex items-center gap-3 text-emerald-200 text-sm"><CheckCircle2 /> Order #{paidOrderId} berhasil. Silakan buka menu Akun VPN untuk melihat config.</CardContent>
        </Card>
      )}

      {serversQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 rounded-xl glass-panel border-white/5 flex flex-col items-center justify-center gap-3">
          <PackageX className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada server aktif. Hubungi admin.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} onSelect={() => openOrder(server)} />
          ))}
        </div>
      )}

      <Dialog open={!!selectedServer} onOpenChange={(open) => !open && setSelectedServer(null)}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0">
          {selectedServer && (
            <>
              <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/70 p-5">
                <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
                <DialogHeader className="relative text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center text-3xl shadow-lg">{countryFlag(selectedServer.location)}</div>
                    <div>
                      <DialogTitle className="text-xl text-white">{selectedServer.displayName}</DialogTitle>
                      <DialogDescription>Atur detail akun VPN kamu.</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Protocol</Label>
                    <Select value={protocol} onValueChange={setProtocol}>
                      <SelectTrigger><SelectValue placeholder="Pilih protocol" /></SelectTrigger>
                      <SelectContent>{selectedServer.enabledProtocols.map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipe Durasi</Label>
                    <Select value={durationType} onValueChange={setDurationType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {selectedServer.supportedTypes.includes("day") && <SelectItem value="day">Harian</SelectItem>}
                        {selectedServer.supportedTypes.includes("month") && <SelectItem value="month">Bulanan</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Jumlah</Label>
                    <Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
                    <p className="text-xs text-muted-foreground">{durationHelp}</p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Username VPN</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                      className={`pl-9 ${username && !isUsernameValid(username) ? "border-destructive focus-visible:ring-destructive" : ""}`} 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} 
                      placeholder="contoh: ketan123" 
                    />
                    </div>
                    <p className={`text-xs ${username && !isUsernameValid(username) ? "text-destructive" : "text-muted-foreground"}`}>
                      Minimal 5 karakter dan minimal 2 angka.
                    </p>
                  </div>
                </div>

                {protocol === "ssh" && (
                  <div className="grid gap-2">
                    <Label>Password SSH</Label>
                    <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />
                    <p className="text-xs text-muted-foreground">Wajib untuk akun SSH. Password akan disimpan agar user bisa melihatnya di Akun VPN.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5 text-primary" /> Kode Voucher / Promo</Label>
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="font-mono font-semibold text-green-600">{appliedVoucher}</span>
                        {quote?.voucherDiscountAmount ? <span className="text-muted-foreground">— hemat {rupiah(quote.voucherDiscountAmount)}</span> : null}
                      </div>
                      <button onClick={removeVoucher} className="text-muted-foreground hover:text-destructive transition-colors ml-2" aria-label="Hapus voucher">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Masukkan kode voucher"
                        value={voucherInput}
                        onChange={(e) => {
                          setVoucherInput(e.target.value.toUpperCase());
                          setVoucherError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && applyVoucher()}
                        className="font-mono uppercase"
                      />
                      <Button variant="outline" onClick={applyVoucher} disabled={!voucherInput.trim() || quoteQuery.isFetching} className="shrink-0">
                        {quoteQuery.isFetching ? "..." : "Terapkan"}
                      </Button>
                    </div>
                  )}
                  {voucherError && <p className="text-xs text-destructive">{voucherError}</p>}
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">{protocol ? protocol.toUpperCase() : "-"} • {quote?.durationLabel ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">Harga satuan: {quote ? rupiah(quote.unitPrice) : "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="text-2xl font-black text-primary">{quote ? rupiah(quote.amount) : "Rp 0"}</p>
                    </div>
                  </div>
                  {quote && (
                    <div className="rounded-lg bg-background/60 border border-white/10 p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Harga dasar</span><span>{rupiah(quote.baseAmount)}</span></div>
                      {quote.resellerDiscountAmount > 0 && <div className="flex justify-between text-green-600"><span>Diskon reseller</span><span>- {rupiah(quote.resellerDiscountAmount)}</span></div>}
                      {quote.voucherDiscountAmount > 0 && <div className="flex justify-between text-green-600"><span>Diskon voucher</span><span>- {rupiah(quote.voucherDiscountAmount)}</span></div>}
                      <div className="flex justify-between pt-2 border-t font-semibold"><span>Total bayar</span><span>{rupiah(quote.amount)}</span></div>
                    </div>
                  )}
                </div>

                <Button className="w-full gap-2" disabled={!protocol || !quote || !isUsernameValid(username) || (protocol === "ssh" && password.length < 6) || orderMut.isPending} onClick={() => orderMut.mutate()}>
                  {orderMut.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</> : <><Wallet className="h-4 w-4" /> Bayar Pakai Saldo</>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

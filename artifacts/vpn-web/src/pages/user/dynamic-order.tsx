import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, HardDrive, PackageX, RefreshCw, Server, Shield, UserRound, Wallet, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

type DynamicServer = {
  id: number;
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
};

type Quote = { unitPrice: number; amount: number; durationLabel: string };

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
  if (loc.includes("SG")) return "🇸🇬";
  if (loc.includes("ID")) return "🇮🇩";
  return "🌐";
}

function ServerCard({ server, active, onSelect }: { server: DynamicServer; active: boolean; onSelect: () => void }) {
  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 border ${active ? "border-primary/60 shadow-[0_0_18px_rgba(16,185,129,0.18)]" : "border-white/5 hover:border-primary/30"} glass-card`}>
      <div className="p-4 flex gap-3">
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
          <Badge variant="outline" className="text-[9px] border-white/10 bg-white/5">MAX 3 IP</Badge>
          <Button size="sm" className="h-8 px-3 text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)]" onClick={onSelect}>
            <CreditCard className="h-3.5 w-3.5 mr-1" /> Order
          </Button>
        </div>
      </div>

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
  const [serverId, setServerId] = useState("");
  const [protocol, setProtocol] = useState("");
  const [durationType, setDurationType] = useState("month");
  const [duration, setDuration] = useState("1");
  const [username, setUsername] = useState("");
  const [paidOrderId, setPaidOrderId] = useState<number | null>(null);

  const serversQuery = useQuery<{ servers: DynamicServer[] }>({ queryKey: ["dynamic-vpn-servers"], queryFn: () => apiFetch("/dynamic-vpn/servers") });
  const servers = serversQuery.data?.servers ?? [];
  const selectedServer = servers.find((s) => String(s.id) === serverId);
  const durationNum = parseInt(duration || "0", 10);

  const quote = useMemo<Quote | null>(() => {
    if (!selectedServer || !durationNum || durationNum < 1) return null;
    if (durationType === "day") {
      return { unitPrice: selectedServer.sellPricePerDay, amount: selectedServer.sellPricePerDay * durationNum, durationLabel: `${durationNum} Hari` };
    }
    return { unitPrice: selectedServer.sellPricePerMonth, amount: selectedServer.sellPricePerMonth * durationNum, durationLabel: `${durationNum} Bulan` };
  }, [selectedServer, durationType, durationNum]);

  const orderMut = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<{ order: { id: number } }>("/dynamic-vpn/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: Number(serverId), protocol, durationType, duration: durationNum, username, paymentMethod: "balance" }),
      });
      return apiFetch<{ order: { id: number; vpnAccountId: number | null } }>(`/dynamic-vpn/orders/${created.order.id}/pay`, { method: "POST" });
    },
    onSuccess: (data) => {
      setPaidOrderId(data.order.id);
      toast({ title: "Order berhasil", description: "Akun VPN sudah dibuat dan masuk ke menu Akun VPN." });
    },
    onError: (err: unknown) => toast({ title: "Order gagal", description: err instanceof Error ? err.message : "Gagal membuat order", variant: "destructive" }),
  });

  const selectServer = (server: DynamicServer) => {
    setServerId(String(server.id));
    setProtocol(server.enabledProtocols?.[0] ?? "");
    if (!server.supportedTypes.includes(durationType)) setDurationType(server.supportedTypes[0] ?? "month");
    setPaidOrderId(null);
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-16 rounded-xl glass-panel border-white/5 flex flex-col items-center justify-center gap-3">
          <PackageX className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada server aktif. Hubungi admin.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} active={serverId === String(server.id)} onSelect={() => selectServer(server)} />
          ))}
        </div>
      )}

      {selectedServer && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="glass-panel border-white/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Konfigurasi Order</CardTitle>
              <CardDescription>{selectedServer.displayName}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <Input className="pl-9" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="contoh: ketan123" />
                  </div>
                  <p className="text-xs text-muted-foreground">Minimal 5 karakter dan minimal 2 angka.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel border-primary/20 h-fit">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Ringkasan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Protocol</span><span className="font-medium uppercase">{protocol || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Durasi</span><span className="font-medium">{quote?.durationLabel ?? "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Harga satuan</span><span className="font-medium">{quote ? rupiah(quote.unitPrice) : "-"}</span></div>
              </div>
              <div className="rounded-xl bg-primary/10 p-4"><p className="text-xs text-muted-foreground">Total Bayar</p><p className="text-2xl font-black text-primary">{quote ? rupiah(quote.amount) : "Rp 0"}</p></div>
              <Button className="w-full gap-2" disabled={!serverId || !protocol || !quote || username.length < 5 || orderMut.isPending} onClick={() => orderMut.mutate()}>
                {orderMut.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</> : <><CreditCard className="h-4 w-4" /> Bayar Pakai Saldo</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

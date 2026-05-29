import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, RefreshCw, Server, Shield, UserRound, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const durationHelp = selectedServer
    ? durationType === "day"
      ? `Batas ${selectedServer.minDays}-${selectedServer.maxDays} hari`
      : `Batas ${selectedServer.minMonths}-${selectedServer.maxMonths} bulan`
    : "Pilih server dahulu";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/70 p-6 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative">
          <Badge className="mb-3 bg-cyan-500/10 text-cyan-200 border-cyan-400/40">KETANTECH Premium</Badge>
          <h1 className="text-3xl font-black text-white flex items-center gap-3"><Shield className="text-cyan-300" /> Order VPN</h1>
          <p className="mt-2 text-sm text-slate-300">Pilih server, protocol, dan durasi sesuai kebutuhan. Akun dibuat otomatis setelah pembayaran saldo.</p>
        </div>
      </div>

      {paidOrderId && (
        <Card className="glass-panel border-emerald-500/30 bg-emerald-500/10">
          <CardContent className="py-4 flex items-center gap-3 text-emerald-200"><CheckCircle2 /> Order #{paidOrderId} berhasil. Silakan buka menu Akun VPN untuk melihat config.</CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="glass-panel border-white/5">
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> Detail Order</CardTitle><CardDescription>Semua harga akan dihitung otomatis.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2"><Label>Server</Label><Select value={serverId} onValueChange={(v) => { setServerId(v); const s = servers.find((srv) => String(srv.id) === v); setProtocol(s?.enabledProtocols?.[0] ?? ""); }}><SelectTrigger><SelectValue placeholder="Pilih server" /></SelectTrigger><SelectContent>{servers.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.displayName} {s.location ? `(${s.location})` : ""}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Protocol</Label><Select value={protocol} onValueChange={setProtocol} disabled={!selectedServer}><SelectTrigger><SelectValue placeholder="Pilih protocol" /></SelectTrigger><SelectContent>{(selectedServer?.enabledProtocols ?? []).map((p) => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Tipe Durasi</Label><Select value={durationType} onValueChange={setDurationType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{selectedServer?.supportedTypes.includes("day") && <SelectItem value="day">Harian</SelectItem>}{selectedServer?.supportedTypes.includes("month") && <SelectItem value="month">Bulanan</SelectItem>}</SelectContent></Select></div><div className="grid gap-2"><Label>Jumlah</Label><Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} /><p className="text-xs text-muted-foreground">{durationHelp}</p></div></div>
            <div className="grid gap-2"><Label>Username VPN</Label><div className="relative"><UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="contoh: ketan123" /></div><p className="text-xs text-muted-foreground">Minimal 5 karakter, huruf kecil/angka, dan minimal 2 angka.</p></div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-primary/20 h-fit sticky top-6">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Ringkasan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Server</span><span className="font-medium text-right">{selectedServer?.displayName ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Protocol</span><span className="font-medium uppercase">{protocol || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Durasi</span><span className="font-medium">{quote?.durationLabel ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Harga satuan</span><span className="font-medium">{quote ? rupiah(quote.unitPrice) : "-"}</span></div>
            </div>
            <div className="rounded-2xl bg-primary/10 p-4"><p className="text-xs text-muted-foreground">Total Bayar</p><p className="text-3xl font-black text-primary">{quote ? rupiah(quote.amount) : "Rp 0"}</p></div>
            <Button className="w-full gap-2" disabled={!serverId || !protocol || !quote || username.length < 5 || orderMut.isPending} onClick={() => orderMut.mutate()}><CreditCard className="h-4 w-4" />{orderMut.isPending ? <><RefreshCw className="h-4 w-4 animate-spin" /> Memproses...</> : "Bayar Pakai Saldo"}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

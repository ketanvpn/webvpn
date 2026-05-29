import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw, Save, Server, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";
const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];

type DynamicServer = {
  id: number;
  providerName: string;
  displayName: string;
  location: string | null;
  supportedProtocols: string[];
  enabledProtocols: string[];
  supportedTypes: string[];
  isActive: boolean;
  costPerDay: number;
  costPerMonth: number;
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

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
  if (!res.ok) throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value || 0);
}

export default function AdminDynamicVpn() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, Partial<DynamicServer>>>({});

  const serversQuery = useQuery<{ servers: DynamicServer[] }>({
    queryKey: ["admin-dynamic-vpn-servers"],
    queryFn: () => apiFetch("/admin/dynamic-vpn/servers"),
  });

  const syncMut = useMutation({
    mutationFn: () => apiFetch<{ total: number }>("/admin/dynamic-vpn/servers/sync/nadiavpn", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "Sync selesai", description: `${data.total} server provider disinkronkan.` });
      qc.invalidateQueries({ queryKey: ["admin-dynamic-vpn-servers"] });
    },
    onError: (err: unknown) => toast({ title: "Sync gagal", description: err instanceof Error ? err.message : "Gagal sync", variant: "destructive" }),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DynamicServer> }) => apiFetch(`/admin/dynamic-vpn/servers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: (_data, vars) => {
      toast({ title: "Server disimpan" });
      setDrafts((prev) => ({ ...prev, [vars.id]: {} }));
      qc.invalidateQueries({ queryKey: ["admin-dynamic-vpn-servers"] });
    },
    onError: (err: unknown) => toast({ title: "Gagal simpan", description: err instanceof Error ? err.message : "Gagal simpan", variant: "destructive" }),
  });

  const servers = serversQuery.data?.servers ?? [];
  const setDraft = (id: number, patch: Partial<DynamicServer>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const merged = (server: DynamicServer) => ({ ...server, ...(drafts[server.id] ?? {}) });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><SlidersHorizontal className="text-primary" /> Dynamic VPN</h1>
          <p className="text-muted-foreground mt-1">Atur server, protocol, harga, dan durasi untuk halaman Order VPN user.</p>
        </div>
        <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sync Server NadiaVPN
        </Button>
      </div>

      {serversQuery.isLoading ? <p className="text-muted-foreground">Memuat server...</p> : servers.length === 0 ? (
        <Card className="glass-panel"><CardContent className="py-12 text-center text-muted-foreground">Belum ada server. Klik Sync Server NadiaVPN.</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {servers.map((server) => {
            const s = merged(server);
            const dirty = Object.keys(drafts[server.id] ?? {}).length > 0;
            return (
              <Card key={server.id} className="glass-panel border-white/5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5" /> {server.providerName}</CardTitle>
                      <CardDescription>{server.location ?? "-"} • Kapasitas {server.capacityUsed}/{server.capacityLimit ?? "-"}</CardDescription>
                    </div>
                    <Badge className={server.capacityIsFull ? "bg-red-500/10 text-red-300 border-red-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}>{server.capacityIsFull ? "Penuh" : "Tersedia"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 p-3">
                    <div><Label>Aktif tampil ke user</Label><p className="text-xs text-muted-foreground">Matikan jika tidak ingin dijual.</p></div>
                    <Switch checked={!!s.isActive} onCheckedChange={(v) => setDraft(server.id, { isActive: v })} />
                  </div>

                  <div className="grid gap-2"><Label>Nama tampil ke user</Label><Input value={s.displayName} onChange={(e) => setDraft(server.id, { displayName: e.target.value })} /></div>

                  <div className="grid gap-2">
                    <Label>Protocol dijual</Label>
                    <div className="grid grid-cols-4 gap-2 rounded-xl border border-white/10 p-3">
                      {PROTOCOLS.map((proto) => {
                        const supported = server.supportedProtocols.includes(proto);
                        return <label key={proto} className={`flex items-center gap-2 text-sm uppercase ${supported ? "" : "opacity-40"}`}>
                          <Checkbox disabled={!supported} checked={s.enabledProtocols?.includes(proto)} onCheckedChange={(checked) => {
                            const next = checked ? [...(s.enabledProtocols ?? []), proto] : (s.enabledProtocols ?? []).filter((p) => p !== proto);
                            setDraft(server.id, { enabledProtocols: Array.from(new Set(next)) });
                          }} /> {proto}
                        </label>;
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Harga jual / hari</Label><Input type="number" value={s.sellPricePerDay} onChange={(e) => setDraft(server.id, { sellPricePerDay: Number(e.target.value) })} /><p className="text-xs text-muted-foreground">Modal: {rupiah(server.costPerDay)}</p></div>
                    <div className="grid gap-2"><Label>Harga jual / bulan</Label><Input type="number" value={s.sellPricePerMonth} onChange={(e) => setDraft(server.id, { sellPricePerMonth: Number(e.target.value) })} /><p className="text-xs text-muted-foreground">Modal: {rupiah(server.costPerMonth)}</p></div>
                    <div className="grid grid-cols-2 gap-2"><div><Label>Min hari</Label><Input type="number" value={s.minDays} onChange={(e) => setDraft(server.id, { minDays: Number(e.target.value) })} /></div><div><Label>Max hari</Label><Input type="number" value={s.maxDays} onChange={(e) => setDraft(server.id, { maxDays: Number(e.target.value) })} /></div></div>
                    <div className="grid grid-cols-2 gap-2"><div><Label>Min bulan</Label><Input type="number" value={s.minMonths} onChange={(e) => setDraft(server.id, { minMonths: Number(e.target.value) })} /></div><div><Label>Max bulan</Label><Input type="number" value={s.maxMonths} onChange={(e) => setDraft(server.id, { maxMonths: Number(e.target.value) })} /></div></div>
                  </div>

                  <Button disabled={!dirty || saveMut.isPending} onClick={() => saveMut.mutate({ id: server.id, data: drafts[server.id] })} className="gap-2"><Save className="h-4 w-4" /> Simpan Server</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

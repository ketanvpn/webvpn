import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Percent, RefreshCw, Save, Server, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { dynamicDurationOptionLabel, isDynamicDurationType, type DynamicDurationType } from "@/lib/dynamic-duration";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";
const PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];

type DynamicServer = {
  id: number;
  provider: string;
  providerName: string;
  displayName: string;
  location: string | null;
  supportedProtocols: string[];
  enabledProtocols: string[];
  supportedTypes: DynamicDurationType[];
  isActive: boolean;
  renewEnabled: boolean;
  costPerDay: number;
  costPerWeek: number;
  costPerMonth: number;
  sellPricePerDay: number;
  sellPricePerWeek: number;
  sellPricePerMonth: number;
  pricingMode: string;
  markupPercent: number;
  minDays: number;
  maxDays: number;
  minMonths: number;
  maxMonths: number;
  capacityLimit: string | null;
  capacityUsed: number;
  capacityIsFull: boolean;
  maxConnections: number;
};

type DynamicVpnSettings = {
  dynamicDefaultMarkupPercent: number;
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

function providerLabel(provider: string) {
  return provider === "local_panel" ? "Server Saya" : "NadiaVPN";
}

function calcMarkupPrice(cost: number, markupPercent: number) {
  return Math.ceil(cost * (1 + markupPercent / 100));
}

export default function AdminDynamicVpn() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<number, Partial<DynamicServer>>>({});

  const serversQuery = useQuery<{ servers: DynamicServer[] }>({
    queryKey: ["admin-dynamic-vpn-servers"],
    queryFn: () => apiFetch("/admin/dynamic-vpn/servers"),
  });

  const settingsQuery = useQuery<DynamicVpnSettings>({
    queryKey: ["admin-dynamic-vpn-settings"],
    queryFn: () => apiFetch("/admin/settings/dynamic-vpn"),
  });

  const saveSettingsMut = useMutation({
    mutationFn: (data: Partial<DynamicVpnSettings>) => apiFetch("/admin/settings/dynamic-vpn", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Default markup disimpan" });
      qc.invalidateQueries({ queryKey: ["admin-dynamic-vpn-settings"] });
    },
    onError: (err: unknown) => toast({ title: "Gagal simpan", description: err instanceof Error ? err.message : "Gagal", variant: "destructive" }),
  });

  const syncMut = useMutation({
    mutationFn: () => apiFetch<{ total: number }>("/admin/dynamic-vpn/servers/sync/nadiavpn", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "Sync selesai", description: `${data.total} server NadiaVPN disinkronkan.` });
      qc.invalidateQueries({ queryKey: ["admin-dynamic-vpn-servers"] });
    },
    onError: (err: unknown) => toast({ title: "Sync gagal", description: err instanceof Error ? err.message : "Gagal sync", variant: "destructive" }),
  });

  const syncLocalMut = useMutation({
    mutationFn: () => apiFetch<{ total: number }>("/admin/dynamic-vpn/servers/sync/local-panel", { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "Sync server saya selesai", description: `${data.total} server lokal disinkronkan.` });
      qc.invalidateQueries({ queryKey: ["admin-dynamic-vpn-servers"] });
    },
    onError: (err: unknown) => toast({ title: "Sync server saya gagal", description: err instanceof Error ? err.message : "Gagal sync", variant: "destructive" }),
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
  const defaultMarkup = settingsQuery.data?.dynamicDefaultMarkupPercent ?? 30;
  const [defaultMarkupDraft, setDefaultMarkupDraft] = useState<number | null>(null);
  const setDraft = (id: number, patch: Partial<DynamicServer>) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  const merged = (server: DynamicServer) => ({ ...server, ...(drafts[server.id] ?? {}) });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><SlidersHorizontal className="text-primary" /> Pengaturan Order VPN</h1>
          <p className="text-muted-foreground mt-1">Atur server, protocol, harga, dan durasi yang tampil di halaman Order VPN user.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={() => syncLocalMut.mutate()} disabled={syncLocalMut.isPending} variant="secondary" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncLocalMut.isPending ? "animate-spin" : ""}`} /> Sync Server Saya
          </Button>
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sync NadiaVPN
          </Button>
        </div>
      </div>

      {/* Default Markup Setting */}
      <Card className="glass-panel border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5 text-primary" /> Default Markup NadiaVPN</CardTitle>
          <CardDescription>Markup default yang dipakai saat server NadiaVPN baru pertama kali disinkronkan. Bisa diubah per-server setelahnya.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="grid gap-2">
              <Label>Markup Default (%)</Label>
              <Input
                type="number"
                min={0}
                max={1000}
                className="w-32"
                value={defaultMarkupDraft ?? defaultMarkup}
                onChange={(e) => setDefaultMarkupDraft(Number(e.target.value))}
              />
            </div>
            <Button
              disabled={defaultMarkupDraft === null || defaultMarkupDraft === defaultMarkup || saveSettingsMut.isPending}
              onClick={() => {
                if (defaultMarkupDraft !== null) saveSettingsMut.mutate({ dynamicDefaultMarkupPercent: defaultMarkupDraft });
              }}
              className="gap-2"
            >
              <Save className="h-4 w-4" /> Simpan
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Contoh: markup 30% → modal Rp 10.000 → jual Rp 13.000</p>
        </CardContent>
      </Card>

      {serversQuery.isLoading ? <p className="text-muted-foreground">Memuat server...</p> : servers.length === 0 ? (
        <Card className="glass-panel"><CardContent className="py-12 text-center text-muted-foreground">Belum ada server. Klik Sync Server Saya atau Sync NadiaVPN.</CardContent></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {servers.map((server) => {
            const s = merged(server);
            const dirty = Object.keys(drafts[server.id] ?? {}).length > 0;
            const isAutoMarkup = (s.pricingMode ?? "manual") === "auto_markup";
            const isNadia = server.provider !== "local_panel";
            const previewDay = isAutoMarkup ? calcMarkupPrice(server.costPerDay, s.markupPercent ?? 30) : s.sellPricePerDay;
            const previewWeek = isAutoMarkup ? calcMarkupPrice(server.costPerWeek, s.markupPercent ?? 30) : s.sellPricePerWeek;
            const previewMonth = isAutoMarkup ? calcMarkupPrice(server.costPerMonth, s.markupPercent ?? 30) : s.sellPricePerMonth;
            const supportedTypes = server.supportedTypes.filter(isDynamicDurationType);
            return (
              <Card key={server.id} className="glass-panel border-white/5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <Server className="h-5 w-5" /> {server.providerName}
                        <Badge variant="outline" className={server.provider === "local_panel" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"}>
                          {providerLabel(server.provider)}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{server.location ?? "-"} • Kapasitas {server.capacityUsed}/{server.capacityLimit ?? "-"}</CardDescription>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {supportedTypes.map((type) => <Badge key={type} variant="secondary">{dynamicDurationOptionLabel(type)}</Badge>)}
                        {isNadia && <Badge variant="outline" className={server.renewEnabled ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}>{server.renewEnabled ? "Bisa renew" : "Tidak bisa renew"}</Badge>}
                      </div>
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

                  {/* Pricing Mode — hanya untuk NadiaVPN */}
                  {isNadia && (
                    <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div>
                        <Label>Harga Otomatis (Auto Markup)</Label>
                        <p className="text-xs text-muted-foreground">Harga jual dihitung otomatis dari modal + markup % saat sync.</p>
                      </div>
                      <Switch
                        checked={isAutoMarkup}
                        onCheckedChange={(v) => setDraft(server.id, { pricingMode: v ? "auto_markup" : "manual" } as any)}
                      />
                    </div>
                  )}

                  {/* Markup % input — hanya tampil saat auto_markup */}
                  {isNadia && isAutoMarkup && (
                    <div className="grid gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <Label>Markup (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        value={s.markupPercent ?? 30}
                        onChange={(e) => setDraft(server.id, { markupPercent: Number(e.target.value) } as any)}
                      />
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {server.supportedTypes.includes("day") && <p>Modal/hari: {rupiah(server.costPerDay)} → Jual: <span className="font-semibold text-emerald-400">{rupiah(previewDay)}</span></p>}
                        {server.supportedTypes.includes("week") && <p>Modal/minggu: {rupiah(server.costPerWeek)} → Jual: <span className="font-semibold text-emerald-400">{rupiah(previewWeek)}</span></p>}
                        {server.supportedTypes.includes("month") && <p>Modal/bulan: {rupiah(server.costPerMonth)} → Jual: <span className="font-semibold text-emerald-400">{rupiah(previewMonth)}</span></p>}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {server.supportedTypes.includes("day") && <div className="grid gap-2">
                      <Label>Harga jual / hari</Label>
                      <Input
                        type="number"
                        value={isAutoMarkup ? previewDay : s.sellPricePerDay}
                        onChange={(e) => setDraft(server.id, { sellPricePerDay: Number(e.target.value) })}
                        disabled={isNadia && isAutoMarkup}
                        className={isNadia && isAutoMarkup ? "opacity-60" : ""}
                      />
                      <p className="text-xs text-muted-foreground">Modal: {rupiah(server.costPerDay)}</p>
                    </div>}
                    {server.supportedTypes.includes("week") && <div className="grid gap-2">
                      <Label>Harga jual / minggu</Label>
                      <Input
                        type="number"
                        value={isAutoMarkup ? previewWeek : s.sellPricePerWeek}
                        onChange={(e) => setDraft(server.id, { sellPricePerWeek: Number(e.target.value) })}
                        disabled={isNadia && isAutoMarkup}
                        className={isNadia && isAutoMarkup ? "opacity-60" : ""}
                      />
                      <p className="text-xs text-muted-foreground">Modal: {rupiah(server.costPerWeek)} • Paket tepat 1 minggu</p>
                    </div>}
                    {server.supportedTypes.includes("month") && <div className="grid gap-2">
                      <Label>Harga jual / bulan</Label>
                      <Input
                        type="number"
                        value={isAutoMarkup ? previewMonth : s.sellPricePerMonth}
                        onChange={(e) => setDraft(server.id, { sellPricePerMonth: Number(e.target.value) })}
                        disabled={isNadia && isAutoMarkup}
                        className={isNadia && isAutoMarkup ? "opacity-60" : ""}
                      />
                      <p className="text-xs text-muted-foreground">Modal: {rupiah(server.costPerMonth)}</p>
                    </div>}
                    {server.supportedTypes.includes("day") && <div className="grid grid-cols-2 gap-2"><div><Label>Min hari</Label><Input type="number" value={s.minDays} onChange={(e) => setDraft(server.id, { minDays: Number(e.target.value) })} /></div><div><Label>Max hari</Label><Input type="number" value={s.maxDays} onChange={(e) => setDraft(server.id, { maxDays: Number(e.target.value) })} /></div></div>}
                    {server.supportedTypes.includes("month") && <div className="grid grid-cols-2 gap-2"><div><Label>Min bulan</Label><Input type="number" value={s.minMonths} onChange={(e) => setDraft(server.id, { minMonths: Number(e.target.value) })} /></div><div><Label>Max bulan</Label><Input type="number" value={s.maxMonths} onChange={(e) => setDraft(server.id, { maxMonths: Number(e.target.value) })} /></div></div>}
                    {server.provider === "local_panel" && (
                      <div className="grid gap-2 sm:col-span-2">
                        <Label>Limit IP</Label>
                        <Input type="number" min={0} value={s.maxConnections ?? 0} onChange={(e) => setDraft(server.id, { maxConnections: Math.max(0, Number(e.target.value) || 0) })} />
                        <p className="text-xs text-muted-foreground">0 = unlimited. Berlaku untuk akun baru dari Server Saya.</p>
                      </div>
                    )}
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

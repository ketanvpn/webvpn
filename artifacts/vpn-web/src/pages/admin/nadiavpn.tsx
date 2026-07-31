import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Cloud, Database, Play, RefreshCw, Server, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";

type NadiaBalanceResponse = {
  status: boolean;
  code: number;
  message: string;
  data?: {
    username?: string;
    email?: string;
    balance?: number;
    api_trx_count?: number;
    monthly_stats?: Record<string, number | string>;
  };
};

type NadiaServer = {
  server_id: string;
  name: string;
  location: string;
  supported_protocols: string[];
  supported_types: string[];
  trial_enabled: boolean;
  trial_duration?: string;
  renew_enabled: boolean;
  pricing?: { per_day?: number; per_week?: number; per_month?: number };
  capacity?: { limit: number | string; used: number; is_full: boolean };
};

type NadiaServersResponse = {
  status: boolean;
  code: number;
  message: string;
  data?: {
    total_servers: number;
    servers: NadiaServer[];
  };
};

type NadiaAccountsResponse = {
  status?: boolean;
  code?: number;
  message?: string;
  data?: unknown;
};

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getCapacityPercent(server: NadiaServer) {
  const limit = server.capacity?.limit;
  if (!limit || limit === "Unlimited") return 0;
  return Math.min(100, Math.round((server.capacity?.used ?? 0) / Number(limit) * 100));
}

function getAccountsCount(accounts?: NadiaAccountsResponse) {
  const data = accounts?.data as any;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.accounts)) return data.accounts.length;
  if (Array.isArray(data?.vpn_accounts)) return data.vpn_accounts.length;
  return 0;
}

export default function AdminNadiaVpn() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [trialServerId, setTrialServerId] = useState("");
  const [trialProtocol, setTrialProtocol] = useState("vless");
  const [trialResult, setTrialResult] = useState<unknown>(null);

  const balanceQuery = useQuery<NadiaBalanceResponse>({
    queryKey: ["admin-nadiavpn-balance"],
    queryFn: () => apiClient.get<NadiaBalanceResponse>("/api/admin/nadiavpn/balance"),
    staleTime: 30_000,
  });

  const serversQuery = useQuery<NadiaServersResponse>({
    queryKey: ["admin-nadiavpn-servers"],
    queryFn: () => apiClient.get<NadiaServersResponse>("/api/admin/nadiavpn/servers"),
    staleTime: 60_000,
  });

  const accountsQuery = useQuery<NadiaAccountsResponse>({
    queryKey: ["admin-nadiavpn-accounts"],
    queryFn: () => apiClient.get<NadiaAccountsResponse>("/api/admin/nadiavpn/accounts"),
    staleTime: 30_000,
  });

  const servers = serversQuery.data?.data?.servers ?? [];
  const selectedServer = servers.find((server) => server.server_id === trialServerId);
  const availableTrialProtocols = selectedServer?.supported_protocols?.filter((protocol) => protocol !== "zivpn") ?? [];
  const totalCapacity = servers.reduce((sum, server) => sum + (server.capacity?.used ?? 0), 0);
  const almostFull = servers.filter((server) => getCapacityPercent(server) >= 90 || server.capacity?.is_full).length;

  const safeServers = useMemo(
    () => servers.filter((server) => !server.capacity?.is_full && server.trial_enabled),
    [servers],
  );

  const createTrialMut = useMutation({
    mutationFn: () => apiClient.post("/api/admin/nadiavpn/trial", { server_id: trialServerId, protocol: trialProtocol }),
    onSuccess: (data) => {
      setTrialResult(data);
      toast({ title: "Trial berhasil dibuat", description: "Response NadiaVPN sudah ditampilkan di halaman." });
      qc.invalidateQueries({ queryKey: ["admin-nadiavpn-accounts"] });
      qc.invalidateQueries({ queryKey: ["admin-nadiavpn-balance"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal membuat trial";
      toast({ title: "Trial gagal", description: msg, variant: "destructive" });
    },
  });

  const refreshAll = () => {
    balanceQuery.refetch();
    serversQuery.refetch();
    accountsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/70 p-6 shadow-2xl">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="mb-3 border-cyan-400/40 bg-cyan-500/10 text-cyan-200">Provider Reseller</Badge>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
              <Cloud className="h-8 w-8 text-cyan-300" /> NadiaVPN Control
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Pantau saldo, server, akun, dan buat trial NadiaVPN langsung dari dashboard admin KETANTECH.
            </p>
          </div>
          <Button onClick={refreshAll} variant="secondary" className="gap-2 bg-white/10 text-white hover:bg-white/20">
            <RefreshCw className={`h-4 w-4 ${balanceQuery.isFetching || serversQuery.isFetching || accountsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh Semua
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="glass-panel border-cyan-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Saldo NadiaVPN</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">{formatCurrency(balanceQuery.data?.data?.balance)}</p>
              </div>
              <Wallet className="h-9 w-9 text-cyan-300/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-emerald-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Server</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{servers.length}</p>
              </div>
              <Server className="h-9 w-9 text-emerald-300/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-violet-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Akun Reseller</p>
                <p className="mt-1 text-2xl font-bold text-violet-300">{getAccountsCount(accountsQuery.data)}</p>
              </div>
              <Database className="h-9 w-9 text-violet-300/70" />
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-amber-500/20">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Server Hampir Penuh</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">{almostFull}</p>
              </div>
              <AlertTriangle className="h-9 w-9 text-amber-300/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass-panel border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Profil Reseller</CardTitle>
            <CardDescription>Data saldo dan statistik dari NadiaVPN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {balanceQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat profil...</p>
            ) : balanceQuery.isError ? (
              <p className="text-sm text-destructive">{balanceQuery.error.message}</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="font-semibold text-white">{balanceQuery.data?.data?.username ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-semibold text-white">{balanceQuery.data?.data?.email ?? "-"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Transaksi API</p>
                    <p className="font-semibold text-white">{balanceQuery.data?.data?.api_trx_count ?? 0}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4">
                    <p className="text-xs text-muted-foreground">Periode Statistik</p>
                    <p className="font-semibold text-white">{String(balanceQuery.data?.data?.monthly_stats?.period ?? "-")}</p>
                  </div>
                </div>
                <pre className="max-h-56 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-slate-300">
                  {JSON.stringify(balanceQuery.data?.data?.monthly_stats ?? {}, null, 2)}
                </pre>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-cyan-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-cyan-300" /> Buat Trial Manual</CardTitle>
            <CardDescription>Trial tidak memotong saldo. Zivpn tidak didukung oleh NadiaVPN.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Server</Label>
              <Select value={trialServerId} onValueChange={(value) => { setTrialServerId(value); setTrialProtocol(servers.find((s) => s.server_id === value)?.supported_protocols?.[0] ?? "vless"); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih server NadiaVPN" />
                </SelectTrigger>
                <SelectContent>
                  {safeServers.map((server) => (
                    <SelectItem key={server.server_id} value={server.server_id}>{server.name} ({server.location})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={trialProtocol} onValueChange={setTrialProtocol} disabled={!selectedServer}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(availableTrialProtocols.length ? availableTrialProtocols : ["vless", "vmess", "trojan", "ssh"]).map((protocol) => (
                    <SelectItem key={protocol} value={protocol}>{protocol.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedServer && (
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                Trial: {selectedServer.trial_duration ?? "-"} • Tipe: {selectedServer.supported_types.map((type) => type === "day" ? "harian" : type === "week" ? "mingguan" : type === "month" ? "bulanan" : type).join(", ")}
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full gap-2" disabled={!trialServerId || createTrialMut.isPending}>
                  {createTrialMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {createTrialMut.isPending ? "Membuat Trial..." : "Buat Trial"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-panel">
                <AlertDialogHeader>
                  <AlertDialogTitle>Buat Trial NadiaVPN?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ini akan membuat akun trial di server {selectedServer?.name}. Pastikan server mendukung trial.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={() => createTrialMut.mutate()} disabled={createTrialMut.isPending}>
                    {createTrialMut.isPending ? "Memproses..." : "Ya, Buat Trial"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Textarea readOnly value={trialResult ? JSON.stringify(trialResult, null, 2) : "Hasil trial akan tampil di sini."} className="min-h-44 font-mono text-xs" />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> Daftar Server NadiaVPN</CardTitle>
          <CardDescription>{serversQuery.data?.data?.total_servers ?? 0} server tersedia dari provider.</CardDescription>
        </CardHeader>
        <CardContent>
          {serversQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat server...</p>
          ) : serversQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">{serversQuery.error.message}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {servers.map((server) => {
                const percent = getCapacityPercent(server);
                return (
                  <div key={server.server_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/40 hover:bg-white/[0.06]">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-white">{server.name}</h3>
                        <p className="text-xs text-muted-foreground">{server.location} • {server.server_id}</p>
                      </div>
                      <Badge className={server.capacity?.is_full ? "bg-red-500/10 text-red-300 border-red-500/30" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"}>
                        {server.capacity?.is_full ? "Penuh" : "Aktif"}
                      </Badge>
                    </div>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {server.supported_protocols.map((protocol) => <Badge key={protocol} variant="outline" className="text-[10px] uppercase">{protocol}</Badge>)}
                      {server.supported_types.map((type) => <Badge key={type} variant="secondary" className="text-[10px] uppercase">{type === "day" ? "Harian" : type === "week" ? "Mingguan" : type === "month" ? "Bulanan" : type}</Badge>)}
                    </div>
                    <div className="space-y-2 text-xs">
                      {server.supported_types.includes("day") && <div className="flex justify-between"><span className="text-muted-foreground">Harga / hari</span><span>{formatCurrency(server.pricing?.per_day)}</span></div>}
                      {server.supported_types.includes("week") && <div className="flex justify-between"><span className="text-muted-foreground">Harga / minggu</span><span>{formatCurrency(server.pricing?.per_week)}</span></div>}
                      {server.supported_types.includes("month") && <div className="flex justify-between"><span className="text-muted-foreground">Harga / bulan</span><span>{formatCurrency(server.pricing?.per_month)}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Renew</span><span className={server.renew_enabled ? "text-emerald-400" : "text-amber-400"}>{server.renew_enabled ? "Aktif" : "Nonaktif"}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Trial</span><span>{server.trial_enabled ? server.trial_duration : "Nonaktif"}</span></div>
                      <div>
                        <div className="mb-1 flex justify-between"><span className="text-muted-foreground">Kapasitas</span><span>{server.capacity?.used ?? 0} / {server.capacity?.limit ?? "-"}</span></div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Akun NadiaVPN</CardTitle>
          <CardDescription>Response akun dari endpoint reseller NadiaVPN.</CardDescription>
        </CardHeader>
        <CardContent>
          {accountsQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Memuat akun...</p>
          ) : accountsQuery.isError ? (
            <p className="py-8 text-center text-sm text-destructive">{accountsQuery.error.message}</p>
          ) : getAccountsCount(accountsQuery.data) === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              Belum ada akun NadiaVPN yang terdeteksi.
            </div>
          ) : (
            <pre className="max-h-96 overflow-auto rounded-2xl bg-black/30 p-4 text-xs text-slate-300">
              {JSON.stringify(accountsQuery.data?.data, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

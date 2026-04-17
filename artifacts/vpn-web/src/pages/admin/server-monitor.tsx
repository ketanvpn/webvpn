import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Server, Cpu, HardDrive, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

type ServerHealth = {
  id: number;
  name: string;
  flag: string;
  host: string;
  location: string;
  isActive: boolean;
  activeAccounts: number;
  maxAccounts: number;
  health: {
    online: boolean;
    latencyMs: number | null;
    cpu?: number;
    ram?: number;
    disk?: number;
  } | null;
};

function UsageBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${value > 85 ? "text-red-400" : value > 65 ? "text-yellow-400" : "text-green-400"}`}>{Math.round(value)}%</span>
      </div>
      <Progress value={value} className={`h-1.5 ${color}`} />
    </div>
  );
}

export default function AdminServerMonitor() {
  const { data: servers = [], isLoading, refetch, isFetching } = useQuery<ServerHealth[]>({
    queryKey: ["server-health"],
    queryFn: () => apiFetch("/admin/servers/health"),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const online = servers.filter((s) => s.health?.online).length;
  const offline = servers.filter((s) => !s.health?.online && s.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="text-primary" /> Live Server Monitor
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Status real-time semua server VPN (refresh otomatis tiap 30 detik)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-panel">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground text-xs mb-1">Total Server</p>
            <p className="text-2xl font-bold text-white">{servers.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-green-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground text-xs mb-1">Online</p>
            <p className="text-2xl font-bold text-green-400">{online}</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-red-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-muted-foreground text-xs mb-1">Offline</p>
            <p className="text-2xl font-bold text-red-400">{offline}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Memuat status server...</p>
      ) : servers.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Server className="mx-auto mb-3 opacity-30" size={40} />
            <p>Belum ada server terdaftar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {servers.map((srv) => {
            const isOnline = srv.health?.online ?? false;
            const fillPct = srv.maxAccounts > 0 ? (srv.activeAccounts / srv.maxAccounts) * 100 : 0;
            return (
              <Card key={srv.id} className={`glass-panel border ${isOnline ? "border-green-500/20" : srv.isActive ? "border-red-500/20" : "border-white/5"}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{srv.flag}</span>
                      <div>
                        <p className="font-semibold text-sm text-white">{srv.name}</p>
                        <p className="text-xs text-muted-foreground">{srv.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Badge className="bg-green-500/10 text-green-400 border-green-500/30 text-xs gap-1">
                          <Wifi size={10} /> Online
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-xs gap-1">
                          <WifiOff size={10} /> {srv.isActive ? "Offline" : "Disabled"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Capacity */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Kapasitas Akun</span>
                      <span className={`font-semibold ${fillPct > 90 ? "text-red-400" : fillPct > 70 ? "text-yellow-400" : "text-green-400"}`}>
                        {srv.activeAccounts} / {srv.maxAccounts}
                      </span>
                    </div>
                    <Progress value={Math.min(fillPct, 100)} className="h-1.5" />
                  </div>

                  {isOnline && srv.health ? (
                    <>
                      {srv.health.cpu !== undefined && (
                        <UsageBar value={srv.health.cpu} label="CPU" color="" />
                      )}
                      {srv.health.ram !== undefined && (
                        <UsageBar value={srv.health.ram} label="RAM" color="" />
                      )}
                      {srv.health.disk !== undefined && (
                        <UsageBar value={srv.health.disk} label="Disk" color="" />
                      )}
                      {srv.health.latencyMs !== null && (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <span className="text-muted-foreground">Latency API</span>
                          <span className={`font-mono ${(srv.health.latencyMs ?? 0) < 300 ? "text-green-400" : "text-yellow-400"}`}>
                            {srv.health.latencyMs}ms
                          </span>
                        </div>
                      )}
                    </>
                  ) : !isOnline && srv.isActive ? (
                    <div className="text-xs text-red-400/80 bg-red-500/10 rounded-lg px-3 py-2">
                      Server tidak dapat dijangkau. Periksa koneksi atau konfigurasi panel.
                    </div>
                  ) : null}

                  <div className="text-xs text-muted-foreground/60 font-mono truncate pt-1">{srv.host}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

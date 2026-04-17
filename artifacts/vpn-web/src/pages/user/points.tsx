import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, TrendingDown, Gift, ShoppingBag, Wallet, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type PointSettings = { enabled: boolean; pointsPerOrder: number; pointsPerTopup: number; redeemRate: number; minRedeem: number };
type PointLog = { id: number; type: string; amount: number; pointsBefore: number; pointsAfter: number; description: string; createdAt: string };

const TYPE_ICON: Record<string, React.ElementType> = {
  order: ShoppingBag,
  topup: Wallet,
  redeem: Gift,
};

export default function UserPoints() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [redeemAmount, setRedeemAmount] = useState("");

  const { data: pointData, isLoading } = useQuery<{ points: number; settings: PointSettings }>({
    queryKey: ["user-points"],
    queryFn: () => apiFetch("/points"),
  });

  const { data: logs = [] } = useQuery<PointLog[]>({
    queryKey: ["point-logs"],
    queryFn: () => apiFetch("/points/logs"),
  });

  const redeem = useMutation({
    mutationFn: () => apiFetch("/points/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseInt(redeemAmount) }),
    }),
    onSuccess: (data) => {
      toast({ title: data.message });
      setRedeemAmount("");
      qc.invalidateQueries({ queryKey: ["user-points"] });
      qc.invalidateQueries({ queryKey: ["point-logs"] });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const points = pointData?.points ?? 0;
  const settings = pointData?.settings;

  if (!isLoading && settings && !settings.enabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Star className="text-yellow-400" /> Program Poin</h1>
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
          <Info size={16} className="text-yellow-400" />
          <AlertDescription className="text-yellow-300">Program poin belum diaktifkan oleh admin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const balanceValue = settings ? points * settings.redeemRate : 0;
  const redeemAmt = parseInt(redeemAmount) || 0;
  const redeemValue = settings ? redeemAmt * settings.redeemRate : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Star className="text-yellow-400" /> Program Poin
      </h1>

      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="glass-panel border-yellow-500/20">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-yellow-500/20 p-3">
                    <Star className="text-yellow-400" size={24} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Poin Kamu</p>
                    <p className="text-3xl font-bold text-white">{points.toLocaleString("id-ID")}</p>
                    <p className="text-xs text-yellow-400 mt-0.5">≈ Rp {balanceValue.toLocaleString("id-ID")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Cara Mendapat Poin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><ShoppingBag size={14} /> Per pembelian VPN</div>
                  <span className="text-yellow-400 font-medium">+{settings?.pointsPerOrder ?? 0} poin</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Wallet size={14} /> Per topup dikonfirmasi</div>
                  <span className="text-yellow-400 font-medium">+{settings?.pointsPerTopup ?? 0} poin</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Gift size={16} /> Tukar Poin ke Saldo</CardTitle>
              <CardDescription>1 poin = Rp {settings?.redeemRate?.toLocaleString("id-ID") ?? 0} • Minimum {settings?.minRedeem ?? 0} poin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Jumlah Poin yang Ditukar</Label>
                  <Input
                    type="number"
                    placeholder={`Min. ${settings?.minRedeem ?? 100} poin`}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    min={settings?.minRedeem ?? 100}
                    max={points}
                  />
                </div>
                {redeemAmt > 0 && (
                  <div className="pb-1 text-sm text-yellow-400 font-medium whitespace-nowrap">
                    = Rp {redeemValue.toLocaleString("id-ID")}
                  </div>
                )}
              </div>
              <Button
                className="mt-3 gap-2"
                onClick={() => redeem.mutate()}
                disabled={redeem.isPending || !redeemAmt || redeemAmt < (settings?.minRedeem ?? 100) || redeemAmt > points}
              >
                <Gift size={16} /> {redeem.isPending ? "Menukar..." : "Tukar Sekarang"}
              </Button>
            </CardContent>
          </Card>

          {logs.length > 0 && (
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-base">Riwayat Poin</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {logs.map((log) => {
                    const Icon = TYPE_ICON[log.type] ?? Star;
                    const isPositive = log.amount > 0;
                    return (
                      <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                        <div className={`rounded-lg p-2 ${isPositive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{log.description}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold text-sm ${isPositive ? "text-green-400" : "text-red-400"}`}>
                            {isPositive ? "+" : ""}{log.amount} poin
                          </p>
                          <p className="text-xs text-muted-foreground">Sisa: {log.pointsAfter}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Star, Save, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type Settings = { enabled: boolean; pointsPerOrder: number; pointsPerTopup: number; redeemRate: number; minRedeem: number };

export default function AdminPointsSettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<Settings>({ enabled: false, pointsPerOrder: 10, pointsPerTopup: 5, redeemRate: 100, minRedeem: 100 });

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ["points-settings-admin"],
    queryFn: () => apiFetch("/admin/settings/points"),
  });

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => apiFetch("/admin/settings/points", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }),
    onSuccess: () => toast({ title: "Pengaturan poin disimpan" }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const setNum = (key: keyof Settings, v: string) => setForm((f) => ({ ...f, [key]: parseInt(v) || 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star className="text-primary" /> Sistem Poin & Reward
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Atur poin loyalitas yang diberikan ke pengguna</p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/10">
        <Info size={16} className="text-blue-400" />
        <AlertDescription className="text-blue-300 text-sm">
          Pengguna mendapat poin setiap melakukan order atau topup. Poin bisa ditukar menjadi saldo. Contoh: redeemRate 100 artinya 100 poin = Rp 100.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : (
        <div className="space-y-4 max-w-lg">
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Status Sistem Poin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} id="pts-enabled" />
                <Label htmlFor="pts-enabled" className="cursor-pointer">{form.enabled ? "Aktif" : "Nonaktif"}</Label>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Poin yang Diberikan</CardTitle>
              <CardDescription>Berapa poin diberikan per transaksi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Poin per Order Berhasil</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" value={form.pointsPerOrder} onChange={(e) => setNum("pointsPerOrder", e.target.value)} className="max-w-[140px]" />
                  <span className="text-muted-foreground text-sm">poin</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Poin per Topup Dikonfirmasi</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" value={form.pointsPerTopup} onChange={(e) => setNum("pointsPerTopup", e.target.value)} className="max-w-[140px]" />
                  <span className="text-muted-foreground text-sm">poin</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Penukaran Poin</CardTitle>
              <CardDescription>Atur nilai tukar dan minimum penukaran</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nilai Tukar (1 poin = Rp ...)</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" value={form.redeemRate} onChange={(e) => setNum("redeemRate", e.target.value)} className="max-w-[140px]" />
                  <span className="text-muted-foreground text-sm">rupiah</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Minimum Penukaran</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" value={form.minRedeem} onChange={(e) => setNum("minRedeem", e.target.value)} className="max-w-[140px]" />
                  <span className="text-muted-foreground text-sm">poin</span>
                </div>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm text-primary">
                Contoh saat ini: {form.minRedeem} poin = Rp {(form.minRedeem * form.redeemRate).toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            <Save size={16} /> {save.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>
      )}
    </div>
  );
}

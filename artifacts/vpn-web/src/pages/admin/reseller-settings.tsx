import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Users, Info, Target } from "lucide-react";
import { useState, useEffect } from "react";
import { formatRupiah } from "@/lib/format";

interface ResellerSettings {
  resellerEnabled: boolean;
  resellerDiscountPercent: number;
  resellerTargetEnabled: boolean;
  resellerMonthlyTarget: number;
}

export default function AdminResellerSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ResellerSettings>({
    resellerEnabled: false,
    resellerDiscountPercent: 20,
    resellerTargetEnabled: false,
    resellerMonthlyTarget: 500000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/reseller", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          resellerEnabled: data.resellerEnabled ?? false,
          resellerDiscountPercent: data.resellerDiscountPercent ?? 20,
          resellerTargetEnabled: data.resellerTargetEnabled ?? false,
          resellerMonthlyTarget: data.resellerMonthlyTarget ?? 500000,
        });
      })
      .catch(() => toast({ title: "Gagal memuat pengaturan", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch("/api/admin/settings/reseller", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error("Gagal menyimpan");
      toast({ title: "Pengaturan reseller disimpan" });
    } catch {
      toast({ title: "Gagal menyimpan pengaturan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Reseller</h1>
        <p className="text-muted-foreground mt-1">Kelola program reseller dan target penjualan bulanan.</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Harga Khusus Reseller
          </CardTitle>
          <CardDescription>
            Reseller mendapatkan harga lebih murah secara otomatis. Assign role "Reseller" ke user di halaman detail pengguna.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aktifkan Harga Reseller</Label>
              <p className="text-xs text-muted-foreground">
                Jika dimatikan, reseller membayar harga normal seperti user biasa.
              </p>
            </div>
            <Switch
              checked={settings.resellerEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, resellerEnabled: v }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="discount" className="text-sm font-medium">
              Persentase Diskon Reseller
            </Label>
            <p className="text-xs text-muted-foreground">
              Diskon yang diberikan dari harga normal. Contoh: isi 30 artinya reseller bayar 70% dari harga normal.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative max-w-xs flex items-center gap-2">
                <Input
                  id="discount"
                  type="number"
                  min={1}
                  max={99}
                  className="max-w-[100px]"
                  value={settings.resellerDiscountPercent}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      resellerDiscountPercent: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  disabled={!settings.resellerEnabled}
                />
                <span className="text-sm font-medium">%</span>
              </div>
              <span className="text-xs text-muted-foreground">
                Contoh produk Rp 100.000 → reseller bayar{" "}
                <strong>{formatRupiah(Math.floor(100000 * (1 - settings.resellerDiscountPercent / 100)))}</strong>
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-medium">Cara kerja harga reseller:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Set role user menjadi "Reseller" di halaman detail pengguna.</li>
                <li>Aktifkan fitur ini dan set persentase diskon.</li>
                <li>Reseller otomatis melihat dan membayar harga yang sudah didiskon.</li>
                <li>Harga reseller tampil di halaman produk saat mereka login.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Target Penjualan Bulanan
          </CardTitle>
          <CardDescription>
            Reseller yang tidak capai target di akhir bulan akan otomatis didowngrade ke user biasa dan mendapat notifikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aktifkan Sistem Target</Label>
              <p className="text-xs text-muted-foreground">
                Cek otomatis tiap tanggal 1 pukul 07.00 WIB. Reseller yang tidak capai target akan didowngrade.
              </p>
            </div>
            <Switch
              checked={settings.resellerTargetEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, resellerTargetEnabled: v }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="target" className="text-sm font-medium">
              Target Penjualan Minimum per Bulan (Rp)
            </Label>
            <p className="text-xs text-muted-foreground">
              Total nilai order lunas reseller dalam satu bulan harus mencapai angka ini.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Rp</span>
                <Input
                  id="target"
                  type="number"
                  min={0}
                  step={50000}
                  className="pl-10"
                  value={settings.resellerMonthlyTarget}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      resellerMonthlyTarget: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  disabled={!settings.resellerTargetEnabled}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                = {formatRupiah(settings.resellerMonthlyTarget)}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 flex gap-2">
            <Info className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700 space-y-1">
              <p className="font-medium">Yang terjadi saat reseller tidak capai target:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Role otomatis berubah dari Reseller → User Biasa.</li>
                <li>Reseller mendapat notifikasi via WhatsApp dan Telegram.</li>
                <li>Harga yang mereka bayar kembali ke harga normal.</li>
                <li>Admin bisa assign ulang role Reseller kapan saja secara manual.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? "Menyimpan..." : "Simpan Semua Pengaturan"}
      </Button>
    </div>
  );
}

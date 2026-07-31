import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Gift, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { formatRupiah } from "@/lib/format";

interface ReferralSettings {
  referralEnabled: boolean;
  referralBonusAmount: number;
}

export default function AdminReferralSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReferralSettings>({
    referralEnabled: true,
    referralBonusAmount: 5000,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<ReferralSettings>("/api/admin/settings/referral")
      .then((data) => {
        setSettings({
          referralEnabled: data.referralEnabled ?? true,
          referralBonusAmount: data.referralBonusAmount ?? 5000,
        });
      })
      .catch(() => toast({ title: "Gagal memuat pengaturan", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await apiClient.put("/api/admin/settings/referral", {
        referralEnabled: settings.referralEnabled,
        referralBonusAmount: settings.referralBonusAmount,
      });
      toast({ title: "Pengaturan referral disimpan" });
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
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Referral</h1>
        <p className="text-muted-foreground mt-1">Atur bonus referral untuk program ajak teman.</p>
      </div>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="h-4 w-4" /> Konfigurasi Program Referral
          </CardTitle>
          <CardDescription>
            Pengguna mendapat kode referral unik. Ketika temannya mendaftar dengan kode itu
            dan melakukan pembelian pertama, kamu akan memberikan bonus saldo ke referrer secara otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aktifkan Program Referral</Label>
              <p className="text-xs text-muted-foreground">
                Matikan untuk menonaktifkan semua bonus referral sementara.
              </p>
            </div>
            <Switch
              checked={settings.referralEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, referralEnabled: v }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="bonusAmount" className="text-sm font-medium">
              Nominal Bonus Referral (Rp)
            </Label>
            <p className="text-xs text-muted-foreground">
              Bonus yang diterima referrer saat temannya melakukan pembelian pertama kali.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">Rp</span>
                <Input
                  id="bonusAmount"
                  type="number"
                  min={0}
                  step={1000}
                  className="pl-10"
                  value={settings.referralBonusAmount}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      referralBonusAmount: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  disabled={!settings.referralEnabled}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                = {formatRupiah(settings.referralBonusAmount)}
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2 mt-4">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-medium">Cara kerja sistem referral:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Setiap pengguna punya kode referral unik di halaman Profil mereka.</li>
                <li>Teman mendaftar dengan memasukkan kode saat registrasi.</li>
                <li>Saat teman melakukan pembelian pertama, bonus masuk ke saldo referrer.</li>
                <li>Bonus hanya diberikan sekali per referral (bukan per pembelian).</li>
              </ol>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

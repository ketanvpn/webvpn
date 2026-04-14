import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Clock, Info, MessageCircle, Send } from "lucide-react";
import { useState, useEffect } from "react";

interface ExpiryNotifSettings {
  expiryNotifEnabled: boolean;
  expiryNotif3DaysEnabled: boolean;
  expiryNotif1DayEnabled: boolean;
  expiryNotifSendHour: number;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, "0")}:00 WIB`,
}));

export default function AdminExpiryNotifSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ExpiryNotifSettings>({
    expiryNotifEnabled: true,
    expiryNotif3DaysEnabled: true,
    expiryNotif1DayEnabled: true,
    expiryNotifSendHour: 8,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings/expiry-notif", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          expiryNotifEnabled: data.expiryNotifEnabled ?? true,
          expiryNotif3DaysEnabled: data.expiryNotif3DaysEnabled ?? true,
          expiryNotif1DayEnabled: data.expiryNotif1DayEnabled ?? true,
          expiryNotifSendHour: data.expiryNotifSendHour ?? 8,
        });
      })
      .catch(() => toast({ title: "Gagal memuat pengaturan", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch("/api/admin/settings/expiry-notif", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!resp.ok) throw new Error("Gagal menyimpan");
      toast({ title: "Pengaturan notifikasi disimpan" });
    } catch {
      toast({ title: "Gagal menyimpan pengaturan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const setToggle = (key: keyof ExpiryNotifSettings) => (val: boolean) =>
    setSettings((s) => ({ ...s, [key]: val }));

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
        <h1 className="text-3xl font-bold tracking-tight">Notifikasi Kedaluwarsa</h1>
        <p className="text-muted-foreground mt-1">
          Atur pengiriman pesan otomatis ke pengguna sebelum akun VPN habis.
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Pengaturan Notifikasi Otomatis
          </CardTitle>
          <CardDescription>
            Sistem mengecek setiap jam dan mengirim notifikasi sesuai jam yang kamu atur di bawah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator />

          {/* Master switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Aktifkan Notifikasi Kedaluwarsa</Label>
              <p className="text-xs text-muted-foreground">
                Matikan untuk menghentikan semua notifikasi kedaluwarsa sementara.
              </p>
            </div>
            <Switch
              checked={settings.expiryNotifEnabled}
              onCheckedChange={setToggle("expiryNotifEnabled")}
            />
          </div>

          <Separator />

          {/* Jam pengiriman */}
          <div className={`space-y-2 transition-opacity ${!settings.expiryNotifEnabled ? "opacity-40 pointer-events-none" : ""}`}>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" /> Jam Pengiriman Notifikasi
            </Label>
            <p className="text-xs text-muted-foreground">
              Notifikasi dikirim sekali sehari pada jam ini (WIB). Pilih jam yang tidak mengganggu pengguna.
            </p>
            <Select
              value={String(settings.expiryNotifSendHour)}
              onValueChange={(v) => setSettings((s) => ({ ...s, expiryNotifSendHour: parseInt(v, 10) }))}
              disabled={!settings.expiryNotifEnabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pilih jam" />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-blue-600 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 inline-block">
              Saat ini terpilih: kirim pukul{" "}
              <b>{String(settings.expiryNotifSendHour).padStart(2, "0")}:00 WIB</b>
            </p>
          </div>

          <Separator />

          {/* H-3 */}
          <div className={`flex items-center justify-between transition-opacity ${!settings.expiryNotifEnabled ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-700 text-xs font-bold">H-3</span>
                Notifikasi 3 Hari Sebelum
              </Label>
              <p className="text-xs text-muted-foreground">
                Kirim pesan peringatan 3 hari sebelum akun VPN kedaluwarsa.
              </p>
            </div>
            <Switch
              checked={settings.expiryNotif3DaysEnabled}
              onCheckedChange={setToggle("expiryNotif3DaysEnabled")}
              disabled={!settings.expiryNotifEnabled}
            />
          </div>

          {/* H-1 */}
          <div className={`flex items-center justify-between transition-opacity ${!settings.expiryNotifEnabled ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/15 text-red-700 text-xs font-bold">H-1</span>
                Notifikasi 1 Hari Sebelum
              </Label>
              <p className="text-xs text-muted-foreground">
                Kirim pesan peringatan mendesak 1 hari sebelum akun VPN kedaluwarsa.
              </p>
            </div>
            <Switch
              checked={settings.expiryNotif1DayEnabled}
              onCheckedChange={setToggle("expiryNotif1DayEnabled")}
              disabled={!settings.expiryNotifEnabled}
            />
          </div>

          <Separator />

          {/* Info box */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex gap-2">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1.5">
              <p className="font-medium">Cara kerja sistem notifikasi:</p>
              <ul className="space-y-0.5">
                <li className="flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Sistem cek setiap jam. Notifikasi dikirim hanya pada jam yang dipilih di atas.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Pesan dikirim ke <b>WhatsApp</b> pengguna (via Fonnte) jika nomor WA terdaftar.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Send className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Pesan juga dikirim ke <b>Telegram</b> jika pengguna sudah menghubungkan akun Telegram.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Jika user punya <b>lebih dari 1 akun</b> yang akan habis, setiap akun mendapat notif masing-masing.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Setiap akun hanya dinotifikasi <b>sekali</b> per periode (tidak akan double kirim).</span>
                </li>
              </ul>
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

import { getApiError } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Smartphone, MessageCircle, Info, ExternalLink, TestTube } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type WaForm = {
  fonnteToken: string;
  fonnteWhatsappNumber: string;
  whatsappOtpEnabled: boolean;
};

export default function AdminWhatsappSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const form = useForm<WaForm>({
    defaultValues: {
      fonnteToken: "",
      fonnteWhatsappNumber: "",
      whatsappOtpEnabled: true,
    },
  });

  useEffect(() => {
    apiClient.get<WaForm>("/api/admin/settings/whatsapp")
      .then((data) => {
        form.reset({
          fonnteToken: data.fonnteToken ?? "",
          fonnteWhatsappNumber: data.fonnteWhatsappNumber ?? "",
          whatsappOtpEnabled: data.whatsappOtpEnabled ?? true,
        });
      })
      .catch(() => toast({ title: "Gagal memuat pengaturan", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, []);

  const onSave = async (values: WaForm) => {
    setIsSaving(true);
    try {
      await apiClient.put("/api/admin/settings/whatsapp", {
        fonnteToken: values.fonnteToken || null,
        fonnteWhatsappNumber: values.fonnteWhatsappNumber || null,
        whatsappOtpEnabled: values.whatsappOtpEnabled,
      });
      toast({ title: "Pengaturan WhatsApp disimpan" });
    } catch {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone) {
      toast({ title: "Masukkan nomor HP dulu", variant: "destructive" });
      return;
    }
    setIsTesting(true);
    try {
      const data = await apiClient.post<{ simulateMode?: boolean; otp?: string }>("/api/admin/settings/whatsapp/test", { whatsapp: testPhone });
      if (data.simulateMode) {
        toast({
          title: "Mode Simulasi",
          description: `OTP: ${data.otp} (Fonnte belum dikonfigurasi, OTP ditampilkan di sini)`,
        });
      } else {
        toast({ title: "OTP berhasil dikirim!", description: `Cek WhatsApp ${testPhone}` });
      }
    } catch (err) {
      toast({ title: "Test gagal", description: getApiError(err, "Tidak dapat terhubung ke server"), variant: "destructive" });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-8 text-center">Memuat pengaturan...</div>;
  }

  const tokenValue = form.watch("fonnteToken");
  const isConfigured = !!tokenValue;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifikasi WhatsApp</h1>
        <p className="text-muted-foreground mt-1">
          Konfigurasi OTP WhatsApp via Fonnte untuk verifikasi pendaftaran.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={isConfigured ? "default" : "secondary"} className="gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-green-400" : "bg-gray-400"}`} />
          {isConfigured ? "Fonnte Terkonfigurasi" : "Belum Dikonfigurasi (Mode Simulasi)"}
        </Badge>
      </div>

      {!isConfigured && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Token Fonnte belum diisi.</strong> OTP tetap berfungsi dalam mode simulasi — kode akan tampil langsung di form pendaftaran. Cocok untuk testing. Isi token Fonnte untuk kirim OTP via WhatsApp sungguhan.
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <MessageCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Cara mendapatkan Token Fonnte:</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Daftar di <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">fonnte.com <ExternalLink className="h-3 w-3" /></a></li>
            <li>Hubungkan nomor WhatsApp kamu ke akun Fonnte</li>
            <li>Salin token API dari dashboard Fonnte</li>
            <li>Tempel di form di bawah dan klik Simpan</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4" /> Konfigurasi Fonnte
          </CardTitle>
          <CardDescription>Token API dari dashboard Fonnte</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
              <FormField
                control={form.control}
                name="fonnteToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Token API Fonnte</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Masukkan token Fonnte kamu"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Kosongkan untuk menggunakan mode simulasi (kode OTP muncul langsung di layar)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="fonnteWhatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor WhatsApp Fonnte</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: 6281234567890"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Nomor WA yang terhubung ke Fonnte (format: 628xxx). Nomor ini akan ditampilkan di link wa.me saat user register.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Webhook Fonnte:</strong> Set URL webhook di dashboard Fonnte ke:
                  <code className="block mt-1 text-xs bg-muted px-2 py-1 rounded break-all">
                    https://domain-kamu.com/api/webhooks/fonnte
                  </code>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Ini agar server bisa menerima pesan masuk dari user saat registrasi.
                  </span>
                </AlertDescription>
              </Alert>

              <Separator />

              <FormField
                control={form.control}
                name="whatsappOtpEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" /> Wajib Verifikasi WhatsApp
                      </FormLabel>
                      <FormDescription className="text-xs mt-0.5">
                        User harus verifikasi nomor WhatsApp saat daftar
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <TestTube className="h-4 w-4" /> Test Kirim OTP
          </CardTitle>
          <CardDescription>Kirim OTP percobaan ke nomor WhatsApp tertentu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Contoh: 08123456789"
              type="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <Button variant="outline" onClick={handleTest} disabled={isTesting} className="shrink-0 gap-2">
              <MessageCircle className="h-4 w-4" />
              {isTesting ? "Mengirim..." : "Kirim Test"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isConfigured
              ? "OTP akan dikirim ke nomor WhatsApp yang dimasukkan."
              : "Mode simulasi: kode OTP akan muncul di notifikasi (toast), tidak dikirim ke WhatsApp."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

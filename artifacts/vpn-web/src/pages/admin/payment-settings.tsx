import { getApiError } from "@/lib/utils";
import {
  useAdminGetPaymentSettings,
  useAdminUpdatePaymentSettings,
  getAdminGetPaymentSettingsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { QrCode, Zap, AlertCircle, Eye, EyeOff, Copy, CheckCircle2, Info, Timer } from "lucide-react";
import { useState, useEffect } from "react";

const EXPIRY_OPTIONS = [5, 10, 15, 30, 60] as const;

const schema = z.object({
  activeGateway: z.enum(["qris_static", "autogopay"]),
  qrisEnabled: z.boolean(),
  qrisStaticUrl: z.string().optional().nullable(),
  qrisExpiryMinutes: z.number().int().min(1),
  autoGopayEnabled: z.boolean(),
  autoGopayApiUrl: z.string().optional().nullable(),
  autoGopaySecretKey: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function CopyableCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="flex items-center gap-2 bg-background border rounded px-2 py-1.5">
      <code className="text-[11px] flex-1 break-all select-all font-mono">{value}</code>
      <button type="button" onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground">
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function AdminPaymentSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useAdminGetPaymentSettings();
  const updateSettings = useAdminUpdatePaymentSettings();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      activeGateway: "qris_static",
      qrisEnabled: true,
      qrisStaticUrl: "",
      qrisExpiryMinutes: 15,
      autoGopayEnabled: false,
      autoGopayApiUrl: "https://api-gopay.sawargipay.cloud",
      autoGopaySecretKey: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        activeGateway: (settings.activeGateway as "qris_static" | "autogopay") ?? "qris_static",
        qrisEnabled: settings.qrisEnabled ?? true,
        qrisStaticUrl: settings.qrisStaticUrl ?? "",
        qrisExpiryMinutes: settings.qrisExpiryMinutes ?? 15,
        autoGopayEnabled: settings.autoGopayEnabled ?? false,
        autoGopayApiUrl: settings.autoGopayApiUrl ?? "https://api-gopay.sawargipay.cloud",
        autoGopaySecretKey: settings.autoGopaySecretKey ?? "",
      });
    }
  }, [settings]);

  const onSubmit = (values: FormValues) => {
    updateSettings.mutate(
      {
        data: {
          activeGateway: values.activeGateway,
          qrisEnabled: values.qrisEnabled,
          qrisStaticUrl: values.qrisStaticUrl || null,
          qrisExpiryMinutes: values.qrisExpiryMinutes,
          autoGopayEnabled: values.autoGopayEnabled,
          autoGopayApiUrl: values.autoGopayApiUrl || null,
          autoGopaySecretKey: values.autoGopaySecretKey || null,
          autoGopayMerchantId: null,
          autoGopayCallbackToken: null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Pengaturan payment berhasil disimpan" });
          queryClient.invalidateQueries({ queryKey: getAdminGetPaymentSettingsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal menyimpan", description: getApiError(err), variant: "destructive" }),
      },
    );
  };

  const activeGateway = form.watch("activeGateway");
  const qrisStaticUrl = form.watch("qrisStaticUrl");

  const webhookUrl = `${window.location.origin.replace(/:(\d+)$/, "")}/api/webhooks/autogopay`;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Pengaturan Payment</h1>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Payment Gateway</h1>
        <p className="text-muted-foreground mt-1">
          Konfigurasi metode pembayaran untuk topup saldo user.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Pilih Gateway Aktif ──────────────────────── */}
          <Card className="glass-panel border-white/5">
            <CardHeader className="pb-4 border-b border-white/5">
              <CardTitle className="text-base">Gateway Aktif</CardTitle>
              <CardDescription>
                Pilih metode pembayaran yang digunakan saat user melakukan topup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="activeGateway"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    {/* QRIS Statis */}
                    <button
                      type="button"
                      onClick={() => field.onChange("qris_static")}
                      className={`rounded-xl border border-white/10 p-4 text-left transition-all ${
                        field.value === "qris_static"
                          ? "border-primary/50 bg-primary/10"
                          : "hover:border-primary/40 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <QrCode className={`h-5 w-5 ${field.value === "qris_static" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-semibold text-sm">QRIS Statis</span>
                        {field.value === "qris_static" && (
                          <Badge className="ml-auto text-[10px] h-5">Aktif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gambar QRIS tetap, konfirmasi manual oleh admin.
                      </p>
                    </button>

                    {/* AutoGoPay */}
                    <button
                      type="button"
                      onClick={() => field.onChange("autogopay")}
                      className={`rounded-xl border border-white/10 p-4 text-left transition-all ${
                        field.value === "autogopay"
                          ? "border-primary/50 bg-primary/10"
                          : "hover:border-primary/40 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className={`h-5 w-5 ${field.value === "autogopay" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-semibold text-sm">AutoGoPay</span>
                        {field.value === "autogopay" && (
                          <Badge className="ml-auto text-[10px] h-5">Aktif</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        QRIS dinamis, konfirmasi otomatis via webhook.
                      </p>
                    </button>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* ── QRIS Statis ──────────────────────────────── */}
          <Card className={`glass-panel transition-opacity ${activeGateway === "qris_static" ? "border-primary/50 glow-border-primary" : "border-white/5 opacity-50"}`}>
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  <CardTitle className="text-base">QRIS Statis</CardTitle>
                </div>
                <FormField
                  control={form.control}
                  name="qrisEnabled"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="qris-enabled" className="text-xs text-muted-foreground">Aktifkan</Label>
                      <Switch id="qris-enabled" checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>
              <CardDescription>
                Masukkan URL gambar QRIS kamu. URL ini ditampilkan ke user saat topup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="qrisStaticUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Gambar QRIS</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://contoh.com/qris.png"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Bisa pakai URL dari Google Drive, S3, Imgbb, atau hosting gambar lainnya.
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qrisExpiryMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Timer className="h-4 w-4" /> Durasi QRIS Berlaku
                    </FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {EXPIRY_OPTIONS.map((min) => (
                          <button
                            key={min}
                            type="button"
                            onClick={() => field.onChange(min)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              field.value === min
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50 bg-background"
                            }`}
                          >
                            {min} menit
                          </button>
                        ))}
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Berapa lama QRIS valid sejak dibuat. Direkomendasikan 10–15 menit.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {qrisStaticUrl && (
                <div className="rounded-xl glass-panel border-white/5 p-4 mt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Preview QRIS:</p>
                  <div className="flex justify-center bg-white rounded-lg p-4">
                    <img
                      src={qrisStaticUrl}
                      alt="QRIS Preview"
                      className="max-h-48 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const sibling = (e.target as HTMLImageElement).nextElementSibling;
                        if (sibling) sibling.classList.remove("hidden");
                      }}
                    />
                    <div className="hidden text-center text-sm text-muted-foreground py-4">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                      URL gambar tidak valid atau tidak bisa dimuat
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── AutoGoPay ───────────────────────────────── */}
          <Card className={`glass-panel transition-opacity ${activeGateway === "autogopay" ? "border-primary/50 glow-border-primary" : "border-white/5 opacity-50"}`}>
            <CardHeader className="pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-base">AutoGoPay</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">QRIS Dinamis</Badge>
                </div>
                <FormField
                  control={form.control}
                  name="autoGopayEnabled"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ag-enabled" className="text-xs text-muted-foreground">Aktifkan</Label>
                      <Switch id="ag-enabled" checked={field.value} onCheckedChange={field.onChange} />
                    </div>
                  )}
                />
              </div>
              <CardDescription>
                Generate QRIS dinamis per transaksi. Saldo otomatis dikreditkan saat user bayar via webhook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <FormField
                control={form.control}
                name="autoGopayApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL API</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://api-gopay.sawargipay.cloud"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Default: <code className="bg-muted px-1 rounded text-[10px]">https://api-gopay.sawargipay.cloud</code>
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoGopaySecretKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key</FormLabel>
                    <FormControl>
                      <SecretInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="agp_02cbafec..."
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      API Key dari dashboard AutoGoPay. Digunakan untuk autentikasi request dan verifikasi webhook.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Webhook info */}
              <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 space-y-2">
                <p className="text-xs font-semibold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Info className="h-3.5 w-3.5" /> Setup Webhook AutoGoPay
                </p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Buka dashboard AutoGoPay → Settings → Webhook</li>
                  <li>Masukkan URL di bawah ini sebagai Webhook URL</li>
                  <li>Klik Verify — sistem akan kirim challenge dan auto-pass</li>
                </ol>
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1">Webhook URL kamu:</p>
                  <CopyableCode value={webhookUrl} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Setelah webhook aktif, saldo user otomatis dikreditkan saat pembayaran berhasil.
                </p>
              </div>

            </CardContent>
          </Card>

          <Button type="submit" disabled={updateSettings.isPending} className="w-full sm:w-auto">
            {updateSettings.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

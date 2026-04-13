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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { QrCode, Zap, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";

const schema = z.object({
  activeGateway: z.enum(["qris_static", "autogopay"]),
  qrisEnabled: z.boolean(),
  qrisStaticUrl: z.string().optional().nullable(),
  autoGopayEnabled: z.boolean(),
  autoGopayApiUrl: z.string().optional().nullable(),
  autoGopayMerchantId: z.string().optional().nullable(),
  autoGopaySecretKey: z.string().optional().nullable(),
  autoGopayCallbackToken: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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
      autoGopayEnabled: false,
      autoGopayApiUrl: "",
      autoGopayMerchantId: "",
      autoGopaySecretKey: "",
      autoGopayCallbackToken: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        activeGateway: (settings.activeGateway as "qris_static" | "autogopay") ?? "qris_static",
        qrisEnabled: settings.qrisEnabled ?? true,
        qrisStaticUrl: settings.qrisStaticUrl ?? "",
        autoGopayEnabled: settings.autoGopayEnabled ?? false,
        autoGopayApiUrl: settings.autoGopayApiUrl ?? "",
        autoGopayMerchantId: settings.autoGopayMerchantId ?? "",
        autoGopaySecretKey: settings.autoGopaySecretKey ?? "",
        autoGopayCallbackToken: settings.autoGopayCallbackToken ?? "",
      });
    }
  }, [settings]);

  const onSubmit = (values: FormValues) => {
    updateSettings.mutate(
      {
        data: {
          ...values,
          qrisStaticUrl: values.qrisStaticUrl || null,
          autoGopayApiUrl: values.autoGopayApiUrl || null,
          autoGopayMerchantId: values.autoGopayMerchantId || null,
          autoGopaySecretKey: values.autoGopaySecretKey || null,
          autoGopayCallbackToken: values.autoGopayCallbackToken || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Pengaturan payment berhasil disimpan" });
          queryClient.invalidateQueries({ queryKey: getAdminGetPaymentSettingsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal menyimpan", description: (err as any).error, variant: "destructive" }),
      }
    );
  };

  const activeGateway = form.watch("activeGateway");
  const qrisStaticUrl = form.watch("qrisStaticUrl");

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

          {/* ── Pilih Gateway Aktif ────────────────────────────────────── */}
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Gateway Aktif</CardTitle>
              <CardDescription>Pilih metode pembayaran yang akan digunakan saat user melakukan topup.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="activeGateway"
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => field.onChange("qris_static")}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        field.value === "qris_static"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
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
                        Upload gambar QRIS sekali, user scan manual lalu admin konfirmasi.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => field.onChange("autogopay")}
                      className={`rounded-xl border-2 p-4 text-left transition-all ${
                        field.value === "autogopay"
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
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
                        QRIS dinamis via API AutoGoPay. Konfirmasi otomatis via webhook.
                      </p>
                    </button>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* ── QRIS Statis ───────────────────────────────────────────── */}
          <Card className={`border-2 ${activeGateway === "qris_static" ? "border-primary/30" : "opacity-60"}`}>
            <CardHeader className="pb-3">
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
                      <Switch
                        id="qris-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
              <CardDescription>
                Masukkan URL gambar QRIS statis kamu. URL ini akan ditampilkan ke user saat topup.
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
                      Bisa pakai URL langsung dari Google Drive, S3, atau hosting gambar lainnya.
                    </p>
                  </FormItem>
                )}
              />

              {qrisStaticUrl && (
                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Preview QRIS:</p>
                  <div className="flex justify-center bg-white rounded-lg p-4">
                    <img
                      src={qrisStaticUrl}
                      alt="QRIS Preview"
                      className="max-h-48 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
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

          {/* ── AutoGoPay ────────────────────────────────────────────── */}
          <Card className={`border-2 ${activeGateway === "autogopay" ? "border-primary/30" : "opacity-60"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  <CardTitle className="text-base">AutoGoPay</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">API</Badge>
                </div>
                <FormField
                  control={form.control}
                  name="autoGopayEnabled"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="ag-enabled" className="text-xs text-muted-foreground">Aktifkan</Label>
                      <Switch
                        id="ag-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )}
                />
              </div>
              <CardDescription>
                Integrasi dengan AutoGoPay untuk QRIS dinamis dan konfirmasi otomatis. Sama seperti yang dipakai bot Telegram.
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
                        placeholder="https://autogopay.example.com/api"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoGopayMerchantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Merchant ID</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Masukkan Merchant ID"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoGopaySecretKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secret Key</FormLabel>
                    <FormControl>
                      <SecretInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Masukkan Secret Key"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Separator />
              <FormField
                control={form.control}
                name="autoGopayCallbackToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Callback / Webhook Token</FormLabel>
                    <FormControl>
                      <SecretInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Token untuk verifikasi webhook"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Token ini digunakan untuk memverifikasi notifikasi pembayaran yang masuk dari AutoGoPay.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg bg-muted/50 border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> Webhook URL kamu:
                </p>
                <code className="bg-background border rounded px-2 py-1 text-[11px] block select-all">
                  {window.location.origin.replace(window.location.pathname, "")}/api/webhooks/autogopay
                </code>
                <p>Daftarkan URL ini di dashboard AutoGoPay untuk konfirmasi otomatis.</p>
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

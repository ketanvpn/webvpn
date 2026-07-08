import { getApiError } from "@/lib/utils";
import {
  useAdminGetPaymentSettings,
  useAdminUpdatePaymentSettings,
  getAdminGetPaymentSettingsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Zap,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Info,
  ShieldCheck,
  Timer,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";

const schema = z.object({
  activeGateway: z.enum(["autogopay", "ketantechpay"]),
  paymentExpiryMinutes: z.number().int().min(1),
  autoGopayEnabled: z.boolean(),
  autoGopayApiUrl: z.string().optional().nullable(),
  autoGopaySecretKey: z.string().optional().nullable(),
  ketantechPayBaseUrl: z.string().optional().nullable(),
  ketantechPayClientKey: z.string().optional().nullable(),
  ketantechPayWebhookSecret: z.string().optional().nullable(),
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
        aria-label={show ? "Sembunyikan" : "Tampilkan"}
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
    <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
      <code className="flex-1 select-all break-all font-mono text-[11px]">{value}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Salin"
      >
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

type GatewayId = "autogopay" | "ketantechpay";

const GATEWAY_META: Record<GatewayId, {
  name: string;
  tagline: string;
  hint: string;
}> = {
  ketantechpay: {
    name: "KetantechPay",
    tagline: "Gateway pusat KetantechPay",
    hint: "QRIS dinamis + webhook. Saldo user otomatis dikreditkan saat pembayaran berhasil.",
  },
  autogopay: {
    name: "AutoGoPay",
    tagline: "QRIS dinamis pihak ketiga",
    hint: "Generate QRIS per transaksi. Konfirmasi otomatis via webhook AutoGoPay.",
  },
};

function GatewayPickerCard({
  id,
  active,
  configured,
  onSelect,
}: {
  id: GatewayId;
  active: boolean;
  configured: boolean;
  onSelect: () => void;
}) {
  const meta = GATEWAY_META[id];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
        active
          ? "border-primary/60 bg-primary/10 shadow-sm"
          : "border-white/10 hover:border-primary/40 hover:bg-white/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{meta.name}</span>
            {active && <Badge className="h-5 text-[10px]">Aktif</Badge>}
            {!active && configured && (
              <Badge variant="secondary" className="h-5 text-[10px]">Siap</Badge>
            )}
            {!active && !configured && (
              <Badge variant="outline" className="h-5 text-[10px] text-muted-foreground">
                Belum diatur
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{meta.tagline}</p>
          <p className="mt-2 text-xs text-muted-foreground/90 leading-relaxed">
            {meta.hint}
          </p>
        </div>
      </div>
    </button>
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
      activeGateway: "ketantechpay",
      paymentExpiryMinutes: 15,
      autoGopayEnabled: false,
      autoGopayApiUrl: "https://v1-gateway.autogopay.site",
      autoGopaySecretKey: "",
      ketantechPayBaseUrl: "https://pay.ketantech.my.id",
      ketantechPayClientKey: "",
      ketantechPayWebhookSecret: "",
    },
  });

  useEffect(() => {
    if (settings) {
      const rawGateway = (settings.activeGateway as string | undefined) ?? "ketantechpay";
      const normalizedGateway: GatewayId =
        rawGateway === "autogopay" ? "autogopay" : "ketantechpay";

      form.reset({
        activeGateway: normalizedGateway,
        paymentExpiryMinutes: settings.qrisExpiryMinutes ?? 15,
        autoGopayEnabled: settings.autoGopayEnabled ?? false,
        autoGopayApiUrl: settings.autoGopayApiUrl ?? "https://v1-gateway.autogopay.site",
        autoGopaySecretKey: settings.autoGopaySecretKey ?? "",
        ketantechPayBaseUrl: (settings as any).ketantechPayBaseUrl ?? "https://pay.ketantech.my.id",
        ketantechPayClientKey: (settings as any).ketantechPayClientKey ?? "",
        ketantechPayWebhookSecret: (settings as any).ketantechPayWebhookSecret ?? "",
      });
    }
  }, [settings]);

  const onSubmit = (values: FormValues) => {
    updateSettings.mutate(
      {
        data: {
          activeGateway: values.activeGateway,
          // Field lama masih dikirim biar tidak butuh regen API.
          // qrisStaticUrl/qrisEnabled sudah tidak dipakai lagi, dikirim null/true default.
          qrisEnabled: true,
          qrisStaticUrl: null,
          qrisExpiryMinutes: values.paymentExpiryMinutes,
          autoGopayEnabled: values.autoGopayEnabled,
          autoGopayApiUrl: values.autoGopayApiUrl || null,
          autoGopaySecretKey: values.autoGopaySecretKey || null,
          autoGopayMerchantId: null,
          autoGopayCallbackToken: null,
          ketantechPayBaseUrl: values.ketantechPayBaseUrl || null,
          ketantechPayClientKey: values.ketantechPayClientKey || null,
          ketantechPayWebhookSecret: values.ketantechPayWebhookSecret || null,
        },
      } as any,
      {
        onSuccess: () => {
          toast({ title: "Pengaturan payment berhasil disimpan" });
          queryClient.invalidateQueries({ queryKey: getAdminGetPaymentSettingsQueryKey() });
        },
        onError: (err) =>
          toast({
            title: "Gagal menyimpan",
            description: getApiError(err),
            variant: "destructive",
          }),
      },
    );
  };

  const activeGateway = form.watch("activeGateway");
  const ketantechBaseUrl = form.watch("ketantechPayBaseUrl");
  const ketantechWebhookSecret = form.watch("ketantechPayWebhookSecret");
  const autoGopayApiUrl = form.watch("autoGopayApiUrl");
  const autoGopaySecretKey = form.watch("autoGopaySecretKey");

  const ketantechConfigured = Boolean(ketantechBaseUrl && ketantechWebhookSecret);
  const autogopayConfigured = Boolean(autoGopayApiUrl && autoGopaySecretKey);

  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/:(\d+)$/, "") : "";
  const webhookUrls = {
    ketantechpay: `${origin}/api/webhooks/ketantechpay`,
    autogopay: `${origin}/api/webhooks/autogopay`,
  } as const;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <h1 className="text-3xl font-bold">Pengaturan Payment</h1>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan Payment Gateway</h1>
        <p className="mt-1 text-muted-foreground">
          Pilih gateway yang aktif dan lengkapi konfigurasinya. Semua gateway di sini otomatis
          mengkonfirmasi topup lewat webhook.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ── Ringkasan Status ────────────────────── */}
          <Card className="glass-panel border-white/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Gateway aktif: {GATEWAY_META[activeGateway].name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeGateway === "ketantechpay" && !ketantechConfigured
                      ? "Isi Base URL dan Webhook Secret KetantechPay untuk mengaktifkan."
                      : activeGateway === "autogopay" && !autogopayConfigured
                      ? "Isi API URL dan API Key AutoGoPay untuk mengaktifkan."
                      : "Konfigurasi sudah lengkap. Topup akan dikonfirmasi otomatis via webhook."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    (activeGateway === "ketantechpay" && ketantechConfigured) ||
                    (activeGateway === "autogopay" && autogopayConfigured)
                      ? "border-green-500/40 bg-green-500/10 text-green-500"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  }`}
                >
                  {(activeGateway === "ketantechpay" && ketantechConfigured) ||
                  (activeGateway === "autogopay" && autogopayConfigured)
                    ? "Siap digunakan"
                    : "Butuh konfigurasi"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ── Pemilih Gateway ────────────────────── */}
          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base">Pilih Gateway</CardTitle>
              <CardDescription>
                Klik salah satu untuk menjadikannya gateway aktif. Konfigurasinya akan muncul di
                bawah.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <FormField
                control={form.control}
                name="activeGateway"
                render={({ field }) => (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <GatewayPickerCard
                      id="ketantechpay"
                      active={field.value === "ketantechpay"}
                      configured={ketantechConfigured}
                      onSelect={() => field.onChange("ketantechpay")}
                    />
                    <GatewayPickerCard
                      id="autogopay"
                      active={field.value === "autogopay"}
                      configured={autogopayConfigured}
                      onSelect={() => field.onChange("autogopay")}
                    />
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Umum ────────────────────── */}
          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Umum</CardTitle>
              </div>
              <CardDescription>
                Pengaturan yang berlaku untuk semua gateway pembayaran.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <FormField
                control={form.control}
                name="paymentExpiryMinutes"
                render={({ field }) => (
                  <FormItem className="max-w-xs">
                    <FormLabel>Batas waktu pembayaran (menit)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      QRIS yang tidak dibayar dalam waktu ini akan otomatis expired.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ── Konfigurasi Gateway Aktif ────────────────────── */}
          {activeGateway === "ketantechpay" && (
            <Card className="glass-panel border-primary/40">
              <CardHeader className="border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Konfigurasi KetantechPay</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">Gateway Pusat</Badge>
                </div>
                <CardDescription>
                  Isi Base URL, Client Key, dan Webhook Secret dari dashboard KetantechPay.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="ketantechPayBaseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://pay.ketantech.my.id"
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
                  name="ketantechPayClientKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client API Key (opsional)</FormLabel>
                      <FormControl>
                        <SecretInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="ktp_client_..."
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ketantechPayWebhookSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook Secret (wajib)</FormLabel>
                      <FormControl>
                        <SecretInput
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="secret_webvpn_..."
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <Info className="h-3.5 w-3.5" /> Webhook URL
                  </p>
                  <CopyableCode value={webhookUrls.ketantechpay} />
                  <p className="text-[11px] text-muted-foreground">
                    Masukkan URL ini di dashboard KetantechPay → Settings → Webhook.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeGateway === "autogopay" && (
            <Card className="glass-panel border-primary/40">
              <CardHeader className="border-b border-white/5 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <CardTitle className="text-base">Konfigurasi AutoGoPay</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">QRIS Dinamis</Badge>
                  </div>
                  <FormField
                    control={form.control}
                    name="autoGopayEnabled"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Aktifkan</span>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </div>
                    )}
                  />
                </div>
                <CardDescription>
                  Isi Base URL API dan API Key AutoGoPay untuk mengaktifkan QRIS dinamis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="autoGopayApiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base URL API</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://v1-gateway.autogopay.site"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Default: <code className="rounded bg-muted px-1 text-[10px]">https://v1-gateway.autogopay.site</code>
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
                      <p className="mt-1 text-xs text-muted-foreground">
                        API Key dari dashboard AutoGoPay. Digunakan untuk autentikasi request dan verifikasi webhook.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <Info className="h-3.5 w-3.5" /> Setup Webhook AutoGoPay
                  </p>
                  <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                    <li>Buka dashboard AutoGoPay → Settings → Webhook</li>
                    <li>Masukkan URL di bawah sebagai Webhook URL</li>
                    <li>Klik Verify — sistem akan kirim challenge dan auto-pass</li>
                  </ol>
                  <CopyableCode value={webhookUrls.autogopay} />
                  <p className="text-[11px] text-muted-foreground">
                    Setelah webhook aktif, saldo user otomatis dikreditkan saat pembayaran berhasil.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="w-full sm:w-auto"
            >
              {updateSettings.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

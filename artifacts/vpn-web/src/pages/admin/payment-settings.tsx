import { getApiError } from "@/lib/utils";
import {
  useAdminGetPaymentSettings,
  useAdminUpdatePaymentSettings,
  getAdminGetPaymentSettingsQueryKey,
} from "@workspace/api-client-react";
import type { PaymentSettings } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  Sparkles,
  Timer,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

const PAYMENT_CHANNELS = [
  "ketantechpay",
  "autogopay_gopay",
  "autogopay_shopeepay",
] as const;
const DEFAULT_PAYMENT_CHANNEL_ORDER = [...PAYMENT_CHANNELS];
const PAYMENT_EXPIRY_MINUTES_MAX = 1440;

type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
type ChannelEnableField =
  | "ketantechPayEnabled"
  | "autoGopayGopayEnabled"
  | "autoGopayShopeePayEnabled";

const optionalHttpsUrl = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^https:\/\/[^\s]+$/i.test(value),
    "Gunakan URL HTTPS yang valid",
  )
  .optional()
  .nullable();

const schema = z
  .object({
    paymentFallbackEnabled: z.boolean(),
    paymentChannelOrder: z
      .array(z.enum(PAYMENT_CHANNELS))
      .length(PAYMENT_CHANNELS.length)
      .refine(
        (order) => new Set(order).size === order.length,
        "Urutan channel tidak boleh duplikat",
      ),
    ketantechPayEnabled: z.boolean(),
    autoGopayGopayEnabled: z.boolean(),
    autoGopayShopeePayEnabled: z.boolean(),
    paymentExpiryMinutes: z
      .number()
      .int()
      .min(1)
      .max(PAYMENT_EXPIRY_MINUTES_MAX),
    autoGopayApiUrl: optionalHttpsUrl,
    autoGopaySecretKey: z.string().optional().nullable(),
    autoGopayShopeePayQrisStatic: z.string().optional().nullable(),
    ketantechPayBaseUrl: optionalHttpsUrl,
    ketantechPayClientKey: z.string().optional().nullable(),
    ketantechPayWebhookSecret: z.string().optional().nullable(),
  })
  .superRefine((values, context) => {
    if (
      !values.ketantechPayEnabled &&
      !values.autoGopayGopayEnabled &&
      !values.autoGopayShopeePayEnabled
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentChannelOrder"],
        message: "Aktifkan minimal satu channel pembayaran",
      });
    }
    if (values.ketantechPayEnabled && !values.ketantechPayBaseUrl?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ketantechPayBaseUrl"],
        message: "Base URL KetantechPay wajib diisi",
      });
    }
    if (
      (values.autoGopayGopayEnabled || values.autoGopayShopeePayEnabled) &&
      !values.autoGopayApiUrl?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoGopayApiUrl"],
        message: "Base URL AutoGoPay wajib diisi",
      });
    }
    if (
      (values.autoGopayGopayEnabled || values.autoGopayShopeePayEnabled) &&
      !values.autoGopaySecretKey?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoGopaySecretKey"],
        message: "API Key AutoGoPay wajib diisi",
      });
    }
    if (
      values.autoGopayShopeePayEnabled &&
      !values.autoGopayShopeePayQrisStatic?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["autoGopayShopeePayQrisStatic"],
        message: "Payload QRIS statis ShopeePay wajib diisi",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const CHANNEL_META: Record<
  PaymentChannel,
  {
    name: string;
    provider: string;
    description: string;
    enableField: ChannelEnableField;
  }
> = {
  ketantechpay: {
    name: "KetantechPay",
    provider: "Gateway pusat",
    description:
      "QRIS dinamis dengan konfirmasi otomatis melalui webhook KetantechPay.",
    enableField: "ketantechPayEnabled",
  },
  autogopay_gopay: {
    name: "GoPay",
    provider: "AutoGoPay",
    description:
      "Channel GoPay yang memakai Base URL dan API Key AutoGoPay bersama.",
    enableField: "autoGopayGopayEnabled",
  },
  autogopay_shopeepay: {
    name: "ShopeePay",
    provider: "AutoGoPay",
    description:
      "Channel ShopeePay dengan payload QRIS statis yang disimpan di bawah.",
    enableField: "autoGopayShopeePayEnabled",
  },
};

function isPaymentChannel(value: unknown): value is PaymentChannel {
  return (
    typeof value === "string" &&
    (PAYMENT_CHANNELS as readonly string[]).includes(value)
  );
}

function normalizePaymentChannelOrder(value: unknown): PaymentChannel[] {
  const submitted = Array.isArray(value) ? value.filter(isPaymentChannel) : [];
  const uniqueChannels = submitted.filter(
    (channel, index, channels) => channels.indexOf(channel) === index,
  );
  return [
    ...uniqueChannels,
    ...DEFAULT_PAYMENT_CHANNEL_ORDER.filter(
      (channel) => !uniqueChannels.includes(channel),
    ),
  ];
}

function getLegacyGateway(order: PaymentChannel[], values: FormValues) {
  const firstEnabledChannel = order.find(
    (channel) => values[CHANNEL_META[channel].enableField],
  );
  return firstEnabledChannel === "ketantechpay"
    ? "ketantechpay"
    : firstEnabledChannel
      ? "autogopay"
      : "qris_static";
}

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
      />
      <button
        type="button"
        onClick={() => setShow((current) => !current)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <code className="flex-1 select-all break-all font-mono text-[11px]">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Salin"
      >
        {copied ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
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
      paymentFallbackEnabled: false,
      paymentChannelOrder: DEFAULT_PAYMENT_CHANNEL_ORDER,
      ketantechPayEnabled: true,
      autoGopayGopayEnabled: false,
      autoGopayShopeePayEnabled: false,
      paymentExpiryMinutes: 15,
      autoGopayApiUrl: "https://v1-gateway.autogopay.site",
      autoGopaySecretKey: "",
      autoGopayShopeePayQrisStatic: "",
      ketantechPayBaseUrl: "https://pay.ketantech.my.id",
      ketantechPayClientKey: "",
      ketantechPayWebhookSecret: "",
    },
  });

  useEffect(() => {
    if (!settings) return;

    const activeGateway = settings.activeGateway ?? "ketantechpay";
    const hasNewAutoGopayFlags =
      settings.autoGopayGopayEnabled !== undefined ||
      settings.autoGopayShopeePayEnabled !== undefined;

    form.reset({
      paymentFallbackEnabled: settings.paymentFallbackEnabled ?? false,
      paymentChannelOrder: normalizePaymentChannelOrder(
        settings.paymentChannelOrder,
      ),
      ketantechPayEnabled:
        settings.ketantechPayEnabled ?? activeGateway === "ketantechpay",
      autoGopayGopayEnabled:
        settings.autoGopayGopayEnabled ??
        (!hasNewAutoGopayFlags &&
          ((settings.autoGopayEnabled ?? false) ||
            activeGateway === "autogopay")),
      autoGopayShopeePayEnabled:
        settings.autoGopayShopeePayEnabled ?? false,
      paymentExpiryMinutes: settings.qrisExpiryMinutes ?? 15,
      autoGopayApiUrl:
        settings.autoGopayApiUrl ?? "https://v1-gateway.autogopay.site",
      autoGopaySecretKey: settings.autoGopaySecretKey ?? "",
      autoGopayShopeePayQrisStatic:
        settings.autoGopayShopeePayQrisStatic ?? "",
      ketantechPayBaseUrl:
        settings.ketantechPayBaseUrl ?? "https://pay.ketantech.my.id",
      ketantechPayClientKey: settings.ketantechPayClientKey ?? "",
      ketantechPayWebhookSecret: settings.ketantechPayWebhookSecret ?? "",
    });
  }, [form, settings]);

  const onSubmit = (values: FormValues) => {
    const activeGateway = getLegacyGateway(values.paymentChannelOrder, values);
    const autoGopayEnabled =
      values.autoGopayGopayEnabled || values.autoGopayShopeePayEnabled;
    const data = {
      paymentFallbackEnabled: values.paymentFallbackEnabled,
      paymentChannelOrder: values.paymentChannelOrder,
      ketantechPayEnabled: values.ketantechPayEnabled,
      autoGopayGopayEnabled: values.autoGopayGopayEnabled,
      autoGopayShopeePayEnabled: values.autoGopayShopeePayEnabled,
      autoGopayShopeePayQrisStatic:
        values.autoGopayShopeePayQrisStatic?.trim() || null,
      activeGateway,
      autoGopayEnabled,
      qrisExpiryMinutes: values.paymentExpiryMinutes,
      autoGopayApiUrl: values.autoGopayApiUrl?.trim() || null,
      autoGopaySecretKey: values.autoGopaySecretKey?.trim() || null,
      ketantechPayBaseUrl: values.ketantechPayBaseUrl?.trim() || null,
      ketantechPayClientKey: values.ketantechPayClientKey?.trim() || null,
      ketantechPayWebhookSecret:
        values.ketantechPayWebhookSecret?.trim() || null,
    } satisfies PaymentSettings;

    updateSettings.mutate(
      { data },
      {
        onSuccess: () => {
          toast({ title: "Pengaturan payment berhasil disimpan" });
          queryClient.invalidateQueries({
            queryKey: getAdminGetPaymentSettingsQueryKey(),
          });
        },
        onError: (error) =>
          toast({
            title: "Gagal menyimpan",
            description: getApiError(error),
            variant: "destructive",
          }),
      },
    );
  };

  const channelOrder = form.watch("paymentChannelOrder");
  const ketantechPayEnabled = form.watch("ketantechPayEnabled");
  const autoGopayGopayEnabled = form.watch("autoGopayGopayEnabled");
  const autoGopayShopeePayEnabled = form.watch("autoGopayShopeePayEnabled");
  const ketantechBaseUrl = form.watch("ketantechPayBaseUrl");
  const ketantechWebhookSecret = form.watch("ketantechPayWebhookSecret");
  const autoGopayApiUrl = form.watch("autoGopayApiUrl");
  const autoGopaySecretKey = form.watch("autoGopaySecretKey");
  const enabledChannelCount = [
    ketantechPayEnabled,
    autoGopayGopayEnabled,
    autoGopayShopeePayEnabled,
  ].filter(Boolean).length;
  const orderedEnabledChannels = channelOrder.filter((channel) =>
    form.getValues(CHANNEL_META[channel].enableField),
  );

  const moveChannel = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= channelOrder.length) return;
    const nextOrder = [...channelOrder];
    [nextOrder[index], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[index],
    ];
    form.setValue("paymentChannelOrder", nextOrder, { shouldDirty: true });
  };

  const origin =
    typeof window !== "undefined"
      ? window.location.origin.replace(/:(\d+)$/, "")
      : "";
  const webhookUrls = {
    ketantechpay: `${origin}/api/webhooks/ketantechpay`,
    autogopay: `${origin}/api/webhooks/autogopay`,
  } as const;

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold">Pengaturan Payment</h1>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Pengaturan Payment Gateway
        </h1>
        <p className="mt-1 text-muted-foreground">
          Atur urutan prioritas, channel yang tersedia, dan fallback pembayaran
          tanpa mengubah konfigurasi webhook yang sudah berjalan.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="glass-panel border-white/5">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {enabledChannelCount} channel pembayaran aktif
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {orderedEnabledChannels.length
                      ? `Prioritas pertama: ${CHANNEL_META[orderedEnabledChannels[0]].name}`
                      : "Aktifkan minimal satu channel agar pembayaran dapat diproses."}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  enabledChannelCount
                    ? "border-green-500/40 bg-green-500/10 text-green-500"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                }
              >
                {enabledChannelCount
                  ? "Siap digunakan"
                  : "Tidak ada channel aktif"}
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">
                  Urutan Channel Pembayaran
                </CardTitle>
              </div>
              <CardDescription>
                Channel paling atas dicoba lebih dulu. Gunakan tombol naik/turun
                untuk mengubah prioritas dan switch untuk mengaktifkan setiap
                channel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <FormField
                control={form.control}
                name="paymentChannelOrder"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-3">
                      {field.value.map((channel, index) => {
                        const meta = CHANNEL_META[channel];
                        return (
                          <div
                            key={channel}
                            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-background/40 p-3 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                                {index + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold">
                                    {meta.name}
                                  </p>
                                  <Badge
                                    variant="secondary"
                                    className="h-5 text-[10px]"
                                  >
                                    {meta.provider}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {meta.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => moveChannel(index, -1)}
                                  disabled={index === 0}
                                  aria-label={`Naikkan prioritas ${meta.name}`}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10"
                                  onClick={() => moveChannel(index, 1)}
                                  disabled={index === field.value.length - 1}
                                  aria-label={`Turunkan prioritas ${meta.name}`}
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                              </div>
                              <FormField
                                control={form.control}
                                name={meta.enableField}
                                render={({ field: enabledField }) => (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {enabledField.value
                                        ? "Aktif"
                                        : "Nonaktif"}
                                    </span>
                                    <Switch
                                      checked={enabledField.value}
                                      onCheckedChange={enabledField.onChange}
                                      aria-label={`Aktifkan ${meta.name}`}
                                    />
                                  </div>
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentFallbackEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div>
                      <FormLabel className="text-sm">
                        Fallback otomatis
                      </FormLabel>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Jika channel pertama gagal, sistem mencoba channel aktif
                        berikutnya sesuai urutan di atas.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Aktifkan fallback otomatis"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Umum</CardTitle>
              </div>
              <CardDescription>
                Pengaturan yang berlaku untuk semua channel pembayaran.
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
                        max={PAYMENT_EXPIRY_MINUTES_MAX}
                        value={field.value}
                        onChange={(event) =>
                          field.onChange(
                            Number.parseInt(event.target.value, 10) || 1,
                          )
                        }
                      />
                    </FormControl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nilai valid 1-{PAYMENT_EXPIRY_MINUTES_MAX} menit.
                      Pembayaran yang melewati batas waktu akan expired.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card
            className={`glass-panel ${
              ketantechPayEnabled ? "border-primary/40" : "border-white/5"
            }`}
          >
            <CardHeader className="border-b border-white/5 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    Konfigurasi KetantechPay
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    Gateway Pusat
                  </Badge>
                </div>
                <Badge
                  variant="outline"
                  className={
                    ketantechBaseUrl && ketantechWebhookSecret
                      ? "border-green-500/40 bg-green-500/10 text-green-500"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  }
                >
                  {ketantechBaseUrl && ketantechWebhookSecret
                    ? "Terkonfigurasi"
                    : "Belum lengkap"}
                </Badge>
              </div>
              <CardDescription>
                Isi Base URL, Client Key, dan Webhook Secret dari dashboard
                KetantechPay.
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
              <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Info className="h-3.5 w-3.5" /> Webhook URL
                </p>
                <CopyableCode value={webhookUrls.ketantechpay} />
                <p className="text-[11px] text-muted-foreground">
                  Masukkan URL ini di dashboard KetantechPay → Settings →
                  Webhook.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`glass-panel ${
              autoGopayGopayEnabled || autoGopayShopeePayEnabled
                ? "border-primary/40"
                : "border-white/5"
            }`}
          >
            <CardHeader className="border-b border-white/5 pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">
                    Konfigurasi AutoGoPay
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    Dipakai Bersama
                  </Badge>
                </div>
                <Badge
                  variant="outline"
                  className={
                    autoGopayApiUrl && autoGopaySecretKey
                      ? "border-green-500/40 bg-green-500/10 text-green-500"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-500"
                  }
                >
                  {autoGopayApiUrl && autoGopaySecretKey
                    ? "Terkonfigurasi"
                    : "Belum lengkap"}
                </Badge>
              </div>
              <CardDescription>
                GoPay dan ShopeePay menggunakan Base URL API serta API Key
                AutoGoPay yang sama.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="autoGopayApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL API bersama</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://v1-gateway.autogopay.site"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dipakai oleh channel GoPay dan ShopeePay yang diaktifkan.
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
                    <FormLabel>API Key bersama</FormLabel>
                    <FormControl>
                      <SecretInput
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Masukkan API Key AutoGoPay"
                      />
                    </FormControl>
                    <p className="mt-1 text-xs text-muted-foreground">
                      API Key dari dashboard AutoGoPay untuk request dan
                      verifikasi webhook.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoGopayShopeePayQrisStatic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>String QRIS statis ShopeePay</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="000201010211..."
                        className="font-mono text-xs"
                      />
                    </FormControl>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Tempel payload QRIS mentah ShopeePay, bukan URL gambar.
                      Kosongkan jika channel ShopeePay tidak memakai QRIS
                      statis.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Info className="h-3.5 w-3.5" /> OVO tetap lewat QRIS
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  OVO bukan channel terpisah di daftar prioritas. Pengguna OVO
                  cukup memindai QRIS yang ditampilkan menggunakan aplikasi OVO,
                  sama seperti aplikasi pembayaran QRIS lainnya.
                </p>
              </div>
              <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <Info className="h-3.5 w-3.5" /> Setup Webhook AutoGoPay
                </p>
                <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                  <li>Buka dashboard AutoGoPay → Settings → Webhook</li>
                  <li>Masukkan URL di bawah sebagai Webhook URL</li>
                  <li>
                    Klik Verify — sistem akan mengirim challenge dan auto-pass
                  </li>
                </ol>
                <CopyableCode value={webhookUrls.autogopay} />
              </div>
            </CardContent>
          </Card>

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

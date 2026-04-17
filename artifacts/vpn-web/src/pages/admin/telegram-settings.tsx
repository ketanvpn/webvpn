import { getApiError } from "@/lib/utils";
import { useEffect } from "react";
import { useAdminGetTelegramSettings, useAdminUpdateTelegramSettings, useAdminRegisterTelegramWebhook } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useForm, Controller } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Bell, Bot, Link, Webhook, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type TelegramForm = {
  telegramBotToken: string;
  telegramAdminChatId: string;
  telegramEnabled: boolean;
};

export default function AdminTelegramSettings() {
  const { toast } = useToast();
  const { data, isLoading } = useAdminGetTelegramSettings();
  const updateSettings = useAdminUpdateTelegramSettings();
  const registerWebhook = useAdminRegisterTelegramWebhook();

  const form = useForm<TelegramForm>({
    defaultValues: {
      telegramBotToken: "",
      telegramAdminChatId: "",
      telegramEnabled: false,
    },
  });

  useEffect(() => {
    if (data) {
      form.reset({
        telegramBotToken: data.telegramBotToken ?? "",
        telegramAdminChatId: data.telegramAdminChatId ?? "",
        telegramEnabled: data.telegramEnabled ?? false,
      });
    }
  }, [data, form]);

  const onSave = (values: TelegramForm) => {
    updateSettings.mutate(
      {
        data: {
          telegramBotToken: values.telegramBotToken || null,
          telegramAdminChatId: values.telegramAdminChatId || null,
          telegramEnabled: values.telegramEnabled,
        },
      },
      {
        onSuccess: () => toast({ title: "Pengaturan Telegram disimpan" }),
        onError: (err) =>
          toast({ title: "Gagal menyimpan", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const handleRegisterWebhook = () => {
    const webhookUrl = `${window.location.origin}/api/telegram/webhook`;
    registerWebhook.mutate(
      { data: { url: webhookUrl } },
      {
        onSuccess: () =>
          toast({ title: "Webhook berhasil didaftarkan", description: webhookUrl }),
        onError: (err) =>
          toast({ title: "Gagal mendaftar webhook", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return <div className="text-muted-foreground p-8 text-center">Memuat pengaturan...</div>;
  }

  const isConfigured = !!(data?.telegramBotToken && data?.telegramAdminChatId);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifikasi Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Konfigurasi bot Telegram untuk notifikasi admin dan user.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={isConfigured ? "default" : "secondary"} className="gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-green-400" : "bg-gray-400"}`} />
          {isConfigured ? "Terkonfigurasi" : "Belum Dikonfigurasi"}
        </Badge>
        {data?.telegramBotUsername && (
          <span className="text-sm text-muted-foreground">@{data.telegramBotUsername}</span>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Cara Setup:</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-1">
            <li>Buat bot baru di <strong>@BotFather</strong> dan copy token-nya</li>
            <li>Kirim pesan ke bot kamu, lalu buka <strong>https://api.telegram.org/bot{'{TOKEN}'}/getUpdates</strong> untuk mendapatkan Chat ID kamu</li>
            <li>Isi form di bawah dan klik Simpan</li>
            <li>Klik "Daftar Webhook" agar bot menerima tombol konfirmasi topup</li>
          </ol>
        </AlertDescription>
      </Alert>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> Konfigurasi Bot
          </CardTitle>
          <CardDescription>Token bot dan ID chat admin</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-5">
              <FormField
                control={form.control}
                name="telegramBotToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="1234567890:ABCdef..."
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Token dari @BotFather</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegramAdminChatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Chat ID</FormLabel>
                    <FormControl>
                      <Input placeholder="123456789" {...field} />
                    </FormControl>
                    <FormDescription>
                      Chat ID Telegram admin. Dapatkan via @userinfobot atau getUpdates.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <FormField
                control={form.control}
                name="telegramEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel className="text-sm font-medium flex items-center gap-2">
                        <Bell className="h-4 w-4" /> Aktifkan Notifikasi
                      </FormLabel>
                      <FormDescription className="text-xs mt-0.5">
                        Kirim notifikasi saat ada topup/order baru
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateSettings.isPending}>
                {updateSettings.isPending ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4" /> Webhook Bot
          </CardTitle>
          <CardDescription>
            Daftarkan webhook agar bot bisa merespons tombol konfirmasi/tolak topup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground bg-muted rounded px-3 py-2 font-mono break-all">
              {window.location.origin}/api/telegram/webhook
            </div>
            <Button
              variant="outline"
              onClick={handleRegisterWebhook}
              disabled={registerWebhook.isPending || !isConfigured}
              className="gap-2"
            >
              <Link className="h-4 w-4" />
              {registerWebhook.isPending ? "Mendaftarkan..." : "Daftar Webhook"}
            </Button>
            {!isConfigured && (
              <p className="text-xs text-muted-foreground">
                Simpan konfigurasi bot terlebih dahulu sebelum mendaftar webhook.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notifikasi yang Dikirim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <span className="text-green-500">✅</span>
              <span><strong>Admin:</strong> Topup baru masuk (dengan tombol Konfirmasi/Tolak)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <span className="text-green-500">✅</span>
              <span><strong>Admin:</strong> Order baru dibuat</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <span className="text-blue-500">📱</span>
              <span><strong>User:</strong> Topup dikonfirmasi (jika Telegram terhubung)</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
              <span className="text-red-500">❌</span>
              <span><strong>User:</strong> Topup ditolak (jika Telegram terhubung)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

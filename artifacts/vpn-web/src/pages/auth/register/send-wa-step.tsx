import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MessageCircle, CheckCircle2, ArrowLeft, Send, RefreshCw } from "lucide-react";
import type { WaStatus } from "./schemas";

interface SendWaStepProps {
  waNumber: string | null;
  waStatus: WaStatus;
  onBack: () => void;
}

export function SendWaStep({ waNumber, waStatus, onBack }: SendWaStepProps) {
  const whatsappLink = waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}` : null;

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <MessageCircle className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Chat Admin Dulu</h1>
        <p className="text-sm text-muted-foreground">
          Klik tombol di bawah untuk chat admin di WhatsApp. Setelah chat, tunggu sebentar dan OTP akan dikirim otomatis.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/40">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Status Chat</p>
              <p className="text-xs text-muted-foreground">
                {waStatus === "waiting" && "Menunggu kamu chat admin..."}
                {waStatus === "received" && "Pesan diterima! Sedang memproses..."}
                {waStatus === "otp_sent" && "OTP sudah dikirim ke WhatsApp kamu"}
              </p>
            </div>
          </div>
          <div>
            {waStatus === "waiting" && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Menunggu
              </Badge>
            )}
            {waStatus === "received" && (
              <Badge variant="default" className="gap-1 bg-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin" /> Memproses
              </Badge>
            )}
            {waStatus === "otp_sent" && (
              <Badge variant="default" className="gap-1 bg-green-600">
                <CheckCircle2 className="h-3 w-3" /> Terkirim
              </Badge>
            )}
          </div>
        </div>

        {whatsappLink && (
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="block">
            <Button size="lg" className="w-full gap-2">
              <Send className="h-5 w-5" />
              Chat Admin WhatsApp
            </Button>
          </a>
        )}

        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Cara kerja:
          </p>
          <ol className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
            <li>Klik tombol "Chat Admin WhatsApp" di atas</li>
            <li>Kirim pesan apa saja ke admin (contoh: "Halo")</li>
            <li>Tunggu beberapa detik, sistem akan mendeteksi chat kamu</li>
            <li>OTP akan dikirim otomatis ke nomor WhatsApp kamu</li>
          </ol>
        </div>
      </div>

      <Button variant="ghost" onClick={onBack} className="w-full gap-2">
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Button>
    </div>
  );
}

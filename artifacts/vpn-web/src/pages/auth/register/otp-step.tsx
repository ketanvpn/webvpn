import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowLeft, RefreshCw, Loader2, Gift } from "lucide-react";
import { OtpInput } from "./otp-input";

interface OtpStepProps {
  whatsapp: string;
  otpInputs: string[];
  simulateOtp: string | null;
  resendCooldown: number;
  isVerifyingOtp: boolean;
  isSendingOtp: boolean;
  useFallback: boolean;
  onOtpInput: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent) => void;
  onOtpPaste: (e: React.ClipboardEvent) => void;
  onVerifyOtp: () => void;
  onResendOtp: () => void;
  onBack: () => void;
}

export function OtpStep({
  whatsapp,
  otpInputs,
  simulateOtp,
  resendCooldown,
  isVerifyingOtp,
  isSendingOtp,
  useFallback,
  onOtpInput,
  onOtpKeyDown,
  onOtpPaste,
  onVerifyOtp,
  onResendOtp,
  onBack,
}: OtpStepProps) {
  const otp = otpInputs.join("");

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold">Verifikasi OTP</h1>
        <p className="text-sm text-muted-foreground">
          Kode OTP telah dikirim ke <strong>{whatsapp}</strong> via WhatsApp
        </p>
      </div>

      <div className="space-y-4">
        <OtpInput
          otpInputs={otpInputs}
          onOtpInput={onOtpInput}
          onOtpKeyDown={onOtpKeyDown}
          onOtpPaste={onOtpPaste}
        />

        {simulateOtp && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">
              MODE SIMULASI AKTIF
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Kode OTP: <span className="font-mono font-bold text-lg">{simulateOtp}</span>
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              (Tidak ada WA Gateway, gunakan kode ini untuk testing)
            </p>
          </div>
        )}

        <Button
          size="lg"
          className="w-full"
          disabled={otp.length < 6 || isVerifyingOtp}
          onClick={onVerifyOtp}
        >
          {isVerifyingOtp ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Memverifikasi...
            </>
          ) : (
            "Verifikasi OTP"
          )}
        </Button>

        {useFallback && (
          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Kirim ulang OTP dalam <Badge variant="secondary">{resendCooldown}s</Badge>
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResendOtp}
                disabled={isSendingOtp}
                className="gap-2"
              >
                {isSendingOtp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Kirim Ulang OTP
              </Button>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" onClick={onBack} className="w-full gap-2">
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Button>
    </div>
  );
}

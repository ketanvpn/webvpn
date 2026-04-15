import { getApiError } from "@/lib/utils";
import { useForgotPasswordSendOtp, useForgotPasswordReset } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Shield, MessageCircle, KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";

type Step = "whatsapp" | "otp" | "password" | "done";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("whatsapp");
  const [whatsapp, setWhatsapp] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [simulateOtp, setSimulateOtp] = useState<string | null>(null);

  const otpInputRef = useRef<HTMLInputElement>(null);

  const sendOtp = useForgotPasswordSendOtp();
  const resetPassword = useForgotPasswordReset();

  // Langkah 1: Kirim OTP ke WhatsApp
  const handleSendOtp = () => {
    const cleaned = whatsapp.trim();
    if (!cleaned) {
      toast({ title: "Nomor WhatsApp wajib diisi", variant: "destructive" });
      return;
    }
    sendOtp.mutate(
      { data: { whatsapp: cleaned } },
      {
        onSuccess: (res) => {
          if (res.simulateMode && res.otp) {
            setSimulateOtp(res.otp);
            toast({
              title: "Mode simulasi aktif",
              description: `OTP kamu: ${res.otp} (Fonnte belum dikonfigurasi)`,
            });
          } else {
            toast({
              title: "OTP terkirim!",
              description: "Cek WhatsApp kamu dan masukkan kode 6 digit.",
            });
          }
          setStep("otp");
          setTimeout(() => otpInputRef.current?.focus(), 100);
        },
        onError: (err) => {
          toast({
            title: "Gagal mengirim OTP",
            description: getApiError(err) || "Terjadi kesalahan",
            variant: "destructive",
          });
        },
      }
    );
  };

  // Langkah 2: Verifikasi OTP → lanjut ke set password
  const handleVerifyOtp = () => {
    if (otpCode.length !== 6) {
      toast({ title: "Masukkan 6 digit kode OTP", variant: "destructive" });
      return;
    }
    setStep("password");
  };

  // Langkah 3: Reset password
  const handleResetPassword = () => {
    if (newPassword.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Konfirmasi password tidak cocok", variant: "destructive" });
      return;
    }
    resetPassword.mutate(
      { data: { whatsapp: whatsapp.trim(), otpCode, newPassword } },
      {
        onSuccess: () => {
          setStep("done");
        },
        onError: (err) => {
          const msg = getApiError(err);
          toast({
            title: "Gagal reset password",
            description: msg || "Kode OTP mungkin sudah kedaluwarsa.",
            variant: "destructive",
          });
          // Jika OTP salah/expired, kembali ke step OTP
          if (msg?.toLowerCase().includes("otp")) {
            setStep("otp");
          }
        },
      }
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-2xl">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              {step === "done" ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : step === "password" ? (
                <KeyRound className="h-6 w-6 text-primary" />
              ) : (
                <Shield className="h-6 w-6 text-primary" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">KETANTECH</h1>
          <p className="text-sm font-medium text-foreground">
            {step === "whatsapp" && "Lupa Password"}
            {step === "otp" && "Masukkan Kode OTP"}
            {step === "password" && "Buat Password Baru"}
            {step === "done" && "Password Berhasil Direset!"}
          </p>
          <p className="text-xs text-muted-foreground">
            {step === "whatsapp" && "Masukkan nomor WhatsApp yang terdaftar di akunmu."}
            {step === "otp" && `Kode 6 digit telah dikirim ke WhatsApp kamu.`}
            {step === "password" && "Buat password baru yang kuat dan mudah diingat."}
            {step === "done" && "Kamu sudah bisa login dengan password baru."}
          </p>
        </div>

        {/* Step Indicator */}
        {step !== "done" && (
          <div className="flex items-center gap-1 justify-center">
            {["whatsapp", "otp", "password"].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`h-2 w-2 rounded-full transition-colors ${
                  step === s ? "bg-primary" :
                  ["whatsapp", "otp", "password"].indexOf(step) > i ? "bg-primary/40" :
                  "bg-muted"
                }`} />
                {i < 2 && <div className="h-px w-6 bg-muted" />}
              </div>
            ))}
          </div>
        )}

        {/* ─── Step 1: WhatsApp ─── */}
        {step === "whatsapp" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5" /> Nomor WhatsApp
              </Label>
              <Input
                type="tel"
                placeholder="Contoh: 08123456789"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Masukkan nomor yang dipakai saat daftar. OTP akan dikirim ke nomor ini.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleSendOtp}
              disabled={sendOtp.isPending}
            >
              {sendOtp.isPending ? "Mengirim OTP..." : "Kirim Kode OTP"}
            </Button>
          </div>
        )}

        {/* ─── Step 2: OTP ─── */}
        {step === "otp" && (
          <div className="space-y-4">
            {simulateOtp && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-700 font-medium">Mode Simulasi (Fonnte belum aktif)</p>
                <p className="text-2xl font-mono font-bold text-amber-800 mt-1 tracking-widest">{simulateOtp}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Kode OTP (6 digit)</Label>
              <Input
                ref={otpInputRef}
                type="number"
                inputMode="numeric"
                placeholder="Contoh: 123456"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                className="text-center text-xl font-mono tracking-widest"
              />
              <p className="text-xs text-muted-foreground text-center">
                Kode berlaku 5 menit. Belum dapat?{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setStep("whatsapp")}
                >
                  Kirim ulang
                </button>
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleVerifyOtp}
              disabled={otpCode.length !== 6}
            >
              Verifikasi Kode
            </Button>
          </div>
        )}

        {/* ─── Step 3: Password Baru ─── */}
        {step === "password" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 6 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Konfirmasi Password Baru</Label>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Ulangi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Password tidak cocok</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleResetPassword}
              disabled={resetPassword.isPending || newPassword.length < 6 || newPassword !== confirmPassword}
            >
              {resetPassword.isPending ? "Menyimpan..." : "Simpan Password Baru"}
            </Button>
          </div>
        )}

        {/* ─── Step 4: Done ─── */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">Password kamu berhasil direset!</p>
              <p className="text-xs text-green-700 mt-1">Silakan login dengan password baru.</p>
            </div>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Login Sekarang
            </Button>
          </div>
        )}

        {/* Link kembali ke Login */}
        {step !== "done" && (
          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-3 w-3" /> Kembali ke halaman login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

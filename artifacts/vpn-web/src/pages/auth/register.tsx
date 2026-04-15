import { getApiError } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Smartphone, MessageCircle, CheckCircle2, ArrowLeft, RefreshCw, Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const waSchema = z.object({
  whatsapp: z
    .string()
    .min(9, "Nomor terlalu pendek")
    .max(15, "Nomor terlalu panjang")
    .regex(/^[0-9+\-\s]+$/, "Format nomor tidak valid"),
});

const otpSchema = z.object({
  otp: z.string().length(6, "Kode OTP harus 6 digit"),
});

const accountSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter").regex(/^[a-zA-Z0-9_]+$/, "Hanya huruf, angka, dan underscore"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  fullName: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
});

type Step = "whatsapp" | "otp" | "account";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const register = useRegister();

  const [step, setStep] = useState<Step>("whatsapp");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [simulateOtp, setSimulateOtp] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  const waForm = useForm<z.infer<typeof waSchema>>({
    resolver: zodResolver(waSchema),
    defaultValues: { whatsapp: "" },
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: "", password: "", fullName: "", email: "", referralCode: "" },
  });

  const otp = otpInputs.join("");

  async function sendOtp(phone: string) {
    setIsSendingOtp(true);
    setSimulateOtp(null);
    try {
      const resp = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: phone }),
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Gagal mengirim OTP", description: data.error ?? "Coba lagi", variant: "destructive" });
        return false;
      }
      if (data.simulateMode && data.otp) {
        setSimulateOtp(data.otp);
      }
      setResendCooldown(60);
      return true;
    } catch {
      toast({ title: "Gagal", description: "Tidak dapat terhubung ke server", variant: "destructive" });
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function onSubmitWa(values: z.infer<typeof waSchema>) {
    const ok = await sendOtp(values.whatsapp);
    if (ok) {
      setWhatsapp(values.whatsapp);
      setOtpInputs(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }

  function handleOtpInput(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const next = [...otpInputs];
    next[index] = value.slice(-1);
    setOtpInputs(next);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otpInputs[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtpInputs(text.split(""));
      e.preventDefault();
    }
  }

  function onVerifyOtp() {
    if (otp.length < 6) {
      toast({ title: "Masukkan 6 digit OTP", variant: "destructive" });
      return;
    }
    setStep("account");
  }

  function onSubmitAccount(values: z.infer<typeof accountSchema>) {
    register.mutate(
      {
        data: {
          username: values.username,
          password: values.password,
          fullName: values.fullName || undefined,
          email: values.email || undefined,
        } as any,
        ...(({ whatsapp, otpCode: otp } as any)),
      },
      {
        onSuccess: () => {
          toast({ title: "Registrasi berhasil!", description: "Selamat datang di KETANTECH VPN" });
          setLocation("/dashboard");
          window.location.reload();
        },
        onError: (error) => {
          toast({
            title: "Registrasi gagal",
            description: getApiError(error) || "Coba lagi",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleAccountSubmit(values: z.infer<typeof accountSchema>) {
    const payload: any = {
      username: values.username,
      password: values.password,
      fullName: values.fullName || undefined,
      email: values.email || undefined,
      whatsapp,
      otpCode: otp,
      ...(values.referralCode ? { referralCode: values.referralCode.trim().toUpperCase() } : {}),
    };

    import("@workspace/api-client-react").then(({ usersApi }) => {}).catch(() => {});

    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
      .then(async (resp) => {
        const data = await resp.json();
        if (!resp.ok) {
          toast({ title: "Registrasi gagal", description: data.error ?? "Coba lagi", variant: "destructive" });
          return;
        }
        toast({ title: "Registrasi berhasil!", description: "Selamat datang di KETANTECH VPN" });
        setLocation("/dashboard");
        window.location.reload();
      })
      .catch(() => {
        toast({ title: "Registrasi gagal", description: "Tidak dapat terhubung ke server", variant: "destructive" });
      });
  }

  const steps = ["whatsapp", "otp", "account"] as const;
  const stepIndex = steps.indexOf(step);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">KETANTECH</h1>
          <p className="mt-1 text-sm text-muted-foreground">Buat akun baru</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < stepIndex
                    ? "bg-primary text-primary-foreground"
                    : i === stepIndex
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < 2 && <div className={`h-0.5 w-6 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === "whatsapp" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="font-semibold">Masukkan Nomor WhatsApp</p>
              <p className="text-xs text-muted-foreground">Kode verifikasi akan dikirim via WhatsApp</p>
            </div>
            <Form {...waForm}>
              <form onSubmit={waForm.handleSubmit(onSubmitWa)} className="space-y-4">
                <FormField
                  control={waForm.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor WhatsApp</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">+62</span>
                          <Input
                            placeholder="8xxxxxxxxxx"
                            type="tel"
                            autoComplete="tel"
                            className="pl-12"
                            inputMode="numeric"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11" disabled={isSendingOtp}>
                  {isSendingOtp ? "Mengirim OTP..." : "Kirim Kode OTP"}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="font-semibold">Masukkan Kode OTP</p>
              <p className="text-xs text-muted-foreground">
                Kode dikirim ke WhatsApp <span className="font-medium text-foreground">{whatsapp}</span>
              </p>
            </div>

            {simulateOtp && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-700 font-medium">Mode Testing (Fonnte belum dikonfigurasi)</p>
                <p className="text-sm font-bold text-yellow-800 mt-1">Kode OTP: {simulateOtp}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2 text-center">Kode OTP 6 digit</p>
              <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                {otpInputs.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-10 h-12 text-center text-xl font-bold border-2 rounded-lg bg-background focus:border-primary focus:outline-none transition-colors"
                  />
                ))}
              </div>
            </div>

            <Button
              className="w-full h-11"
              onClick={onVerifyOtp}
              disabled={otp.length < 6}
            >
              Verifikasi OTP
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setStep("whatsapp")}
              >
                <ArrowLeft className="h-3 w-3" /> Ganti nomor
              </button>
              <button
                className={`flex items-center gap-1 ${resendCooldown > 0 ? "text-muted-foreground" : "text-primary hover:underline"}`}
                disabled={resendCooldown > 0 || isSendingOtp}
                onClick={async () => {
                  const ok = await sendOtp(whatsapp);
                  if (ok) {
                    setOtpInputs(["", "", "", "", "", ""]);
                    toast({ title: "OTP baru dikirim" });
                  }
                }}
              >
                <RefreshCw className="h-3 w-3" />
                {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : "Kirim ulang"}
              </button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="font-semibold">Lengkapi Data Akun</p>
              <p className="text-xs text-muted-foreground">WhatsApp {whatsapp} sudah terverifikasi</p>
            </div>
            <Form {...accountForm}>
              <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)} className="space-y-4">
                <FormField
                  control={accountForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Pilih username unik" autoComplete="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap <span className="text-muted-foreground text-xs">(Opsional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Nama kamu" autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-muted-foreground text-xs">(Opsional)</span></FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@contoh.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 6 karakter" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={accountForm.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Gift className="h-3.5 w-3.5 text-primary" />
                        Kode Referral <span className="text-muted-foreground text-xs">(Opsional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Masukkan kode referral jika punya"
                          autoComplete="off"
                          className="uppercase tracking-widest font-mono"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11 text-base">
                  Buat Akun
                </Button>
              </form>
            </Form>
            <button
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              onClick={() => setStep("otp")}
            >
              <ArrowLeft className="h-3 w-3" /> Kembali
            </button>
          </div>
        )}

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Sudah punya akun? </span>
          <Link href="/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

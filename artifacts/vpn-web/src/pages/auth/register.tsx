import { getApiError } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { checkUsername } from "@workspace/api-client-react";
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
import { useState, useRef, useEffect, useCallback } from "react";
import { Smartphone, MessageCircle, CheckCircle2, ArrowLeft, RefreshCw, Gift, Check, X, Loader2, ExternalLink, Send } from "lucide-react";
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

type Step = "whatsapp" | "send-wa" | "otp" | "account";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("whatsapp");
  const [whatsapp, setWhatsapp] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [simulateOtp, setSimulateOtp] = useState<string | null>(null);
  const [otpInputs, setOtpInputs] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // User Chat Duluan state
  const [waToken, setWaToken] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<"waiting" | "received" | "otp_sent">("waiting");
  const [isInitiating, setIsInitiating] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  type UsernameStatus = null | "checking" | { available: boolean; suggestions: string[] };
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>(null);
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const waForm = useForm<z.infer<typeof waSchema>>({
    resolver: zodResolver(waSchema),
    defaultValues: { whatsapp: "" },
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: "", password: "", fullName: "", email: "", referralCode: "" },
  });

  const otp = otpInputs.join("");

  // ─── Polling for WA message status ──────────────────────────────────────────

  const startPolling = useCallback((token: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`/api/auth/wa-register-status/${token}`, {
          credentials: "include",
        });
        const data = await resp.json();

        if (data.status === "otp_sent") {
          setWaStatus("otp_sent");
          if (data.whatsapp) setWhatsapp(data.whatsapp);
          if (pollRef.current) clearInterval(pollRef.current);
          // Auto pindah ke step OTP
          setStep("otp");
          setOtpInputs(["", "", "", "", "", ""]);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
          toast({ title: "OTP sudah dikirim!", description: "Cek WhatsApp kamu untuk kode OTP" });
        } else if (data.status === "received") {
          setWaStatus("received");
        } else if (data.status === "expired" || resp.status === 404) {
          if (pollRef.current) clearInterval(pollRef.current);
          toast({ title: "Sesi kedaluwarsa", description: "Silakan mulai ulang", variant: "destructive" });
          setStep("whatsapp");
        }
      } catch {
        // Ignore network errors, will retry on next interval
      }
    }, 3000);
  }, [toast]);

  // ─── Initiate WA register (new flow) ──────────────────────────────────────────

  async function onSubmitWa(values: z.infer<typeof waSchema>) {
    setIsInitiating(true);
    try {
      const resp = await fetch("/api/auth/initiate-wa-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: values.whatsapp }),
        credentials: "include",
      });
      const data = await resp.json();

      if (!resp.ok) {
        // Jika nomor WA admin belum diset → fallback ke flow lama
        if (data.fallback) {
          setUseFallback(true);
          await sendOtpLegacy(values.whatsapp);
          return;
        }
        toast({ title: "Gagal", description: data.error ?? "Coba lagi", variant: "destructive" });
        return;
      }

      setWhatsapp(values.whatsapp);
      setWaToken(data.token);
      setWaNumber(data.waNumber);
      setWaStatus("waiting");
      setStep("send-wa");
      startPolling(data.token);
    } catch {
      toast({ title: "Gagal", description: "Tidak dapat terhubung ke server", variant: "destructive" });
    } finally {
      setIsInitiating(false);
    }
  }

  // ─── Legacy send OTP (fallback) ──────────────────────────────────────────────

  async function sendOtpLegacy(phone: string) {
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
        if (data.cooldown && typeof data.cooldown === "number") {
          setResendCooldown(data.cooldown);
        }
        toast({ title: "Gagal mengirim OTP", description: data.error ?? "Coba lagi", variant: "destructive" });
        return false;
      }
      if (data.simulateMode && data.otp) {
        setSimulateOtp(data.otp);
      }
      setWhatsapp(phone);
      setResendCooldown(90);
      setOtpInputs(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      return true;
    } catch {
      toast({ title: "Gagal", description: "Tidak dapat terhubung ke server", variant: "destructive" });
      return false;
    } finally {
      setIsSendingOtp(false);
    }
  }

  // ─── OTP handlers ──────────────────────────────────────────────────────────────

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

  function handleUsernameChange(value: string) {
    accountForm.setValue("username", value);
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (value.length < 3) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    usernameDebounce.current = setTimeout(async () => {
      try {
        const result = await checkUsername({ username: value });
        setUsernameStatus(result);
      } catch {
        setUsernameStatus(null);
      }
    }, 600);
  }

  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  async function onVerifyOtp() {
    if (otp.length < 6) {
      toast({ title: "Masukkan 6 digit OTP", variant: "destructive" });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const resp = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, otpCode: otp }),
        credentials: "include",
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Verifikasi gagal", description: data.error ?? "Kode OTP salah", variant: "destructive" });
        setOtpInputs(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }
      setStep("account");
    } catch {
      toast({ title: "Gagal", description: "Tidak dapat terhubung ke server", variant: "destructive" });
    } finally {
      setIsVerifyingOtp(false);
    }
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

  // ─── Step indicator ──────────────────────────────────────────────────────────

  const steps = useFallback
    ? (["whatsapp", "otp", "account"] as const)
    : (["whatsapp", "send-wa", "otp", "account"] as const);
  const stepIndex = steps.indexOf(step as any);

  // ─── Build wa.me link ───────────────────────────────────────────────────────

  const waLink = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${encodeURIComponent("DAFTAR")}`
    : null;

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
              {i < steps.length - 1 && <div className={`h-0.5 w-6 ${i < stepIndex ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* ─── STEP 1: Input WhatsApp ─────────────────────────────────────── */}
        {step === "whatsapp" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Smartphone className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="font-semibold">Masukkan Nomor WhatsApp</p>
              <p className="text-xs text-muted-foreground">Verifikasi via WhatsApp untuk keamanan akunmu</p>
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
                <Button type="submit" className="w-full h-11" disabled={isInitiating || isSendingOtp}>
                  {isInitiating ? "Memproses..." : "Lanjutkan"}
                </Button>
              </form>
            </Form>
          </div>
        )}

        {/* ─── STEP 2: Kirim Pesan WA ke Kita (BARU) ──────────────────────── */}
        {step === "send-wa" && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <Send className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="font-semibold">Kirim Pesan WhatsApp</p>
              <p className="text-xs text-muted-foreground">
                Klik tombol di bawah untuk mengirim pesan verifikasi ke WhatsApp kami
              </p>
            </div>

            {/* Instruksi */}
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-green-600">1</span>
                </div>
                <p className="text-sm">Klik tombol hijau di bawah</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-green-600">2</span>
                </div>
                <p className="text-sm">WhatsApp akan terbuka dengan pesan <strong>"DAFTAR"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-green-600">3</span>
                </div>
                <p className="text-sm">Kirim pesannya, lalu kembali ke sini</p>
              </div>
            </div>

            {/* Tombol WA */}
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold text-base transition-colors shadow-lg shadow-green-500/20"
              >
                <MessageCircle className="h-5 w-5" />
                Kirim Pesan WhatsApp
                <ExternalLink className="h-4 w-4 opacity-70" />
              </a>
            )}

            {/* Status menunggu */}
            <div className="flex items-center justify-center gap-2 py-3">
              {waStatus === "waiting" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Menunggu pesan masuk...</span>
                </>
              )}
              {waStatus === "received" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                  <span className="text-sm text-green-600">Pesan diterima! Mengirim OTP...</span>
                </>
              )}
            </div>

            <button
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setStep("whatsapp");
              }}
            >
              <ArrowLeft className="h-3 w-3" /> Ganti nomor
            </button>
          </div>
        )}

        {/* ─── STEP 3: Input OTP ──────────────────────────────────────────── */}
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
              disabled={otp.length < 6 || isVerifyingOtp}
            >
              {isVerifyingOtp ? "Memverifikasi..." : "Verifikasi OTP"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setStep("whatsapp");
                }}
              >
                <ArrowLeft className="h-3 w-3" /> Ganti nomor
              </button>
              {useFallback && (
                <button
                  className={`flex items-center gap-1 ${resendCooldown > 0 ? "text-muted-foreground" : "text-primary hover:underline"}`}
                  disabled={resendCooldown > 0 || isSendingOtp}
                  onClick={async () => {
                    const ok = await sendOtpLegacy(whatsapp);
                    if (ok) {
                      setOtpInputs(["", "", "", "", "", ""]);
                      toast({ title: "OTP baru dikirim" });
                    }
                  }}
                >
                  <RefreshCw className="h-3 w-3" />
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : "Kirim ulang"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 4: Lengkapi Data Akun ─────────────────────────────────── */}
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
                        <div className="relative">
                          <Input
                            placeholder="Pilih username unik"
                            autoComplete="username"
                            {...field}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            className={
                              usernameStatus === null || usernameStatus === "checking" ? "" :
                              usernameStatus.available ? "border-green-500 pr-9" : "border-red-400 pr-9"
                            }
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {usernameStatus !== null && usernameStatus !== "checking" && usernameStatus.available === true && <Check className="h-4 w-4 text-green-500" />}
                            {usernameStatus !== null && usernameStatus !== "checking" && usernameStatus.available === false && <X className="h-4 w-4 text-red-400" />}
                          </div>
                        </div>
                      </FormControl>
                      {/* Status pesan */}
                      {usernameStatus !== null && usernameStatus !== "checking" && usernameStatus.available === true && (
                        <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Username tersedia</p>
                      )}
                      {usernameStatus !== null && usernameStatus !== "checking" && usernameStatus.available === false && (
                        <div className="space-y-1.5">
                          <p className="text-xs text-red-500 flex items-center gap-1"><X className="h-3 w-3" /> Username sudah dipakai</p>
                          {usernameStatus.suggestions.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">Coba:</span>
                              {usernameStatus.suggestions.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => {
                                    accountForm.setValue("username", s);
                                    handleUsernameChange(s);
                                  }}
                                  className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
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

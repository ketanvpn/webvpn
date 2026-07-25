import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import { waSchema, accountSchema, type Step, type UsernameStatus, type WaStatus } from "./register/schemas";
import { WhatsappStep } from "./register/whatsapp-step";
import { SendWaStep } from "./register/send-wa-step";
import { OtpStep } from "./register/otp-step";
import { AccountStep } from "./register/account-step";
import {
  sendOtpLegacy,
  initiateWaRegister,
  verifyOtp,
  registerAccount,
  checkUsernameAvailability,
  pollWaStatus,
} from "./register/api-helpers";
import { z } from "zod";

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

  const [waToken, setWaToken] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<WaStatus>("waiting");
  const [isInitiating, setIsInitiating] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>(null);
  const usernameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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

  const startPolling = useCallback(
    (token: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(() => {
        pollWaStatus(
          token,
          (whatsappNumber) => {
            setWaStatus("otp_sent");
            if (whatsappNumber) setWhatsapp(whatsappNumber);
            if (pollRef.current) clearInterval(pollRef.current);
            setStep("otp");
            setOtpInputs(["", "", "", "", "", ""]);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
            toast({ title: "OTP sudah dikirim!", description: "Cek WhatsApp kamu untuk kode OTP" });
          },
          () => setWaStatus("received"),
          () => {
            if (pollRef.current) clearInterval(pollRef.current);
            toast({ title: "Sesi kedaluwarsa", description: "Silakan mulai ulang", variant: "destructive" });
            setStep("whatsapp");
          }
        );
      }, 3000);
    },
    [toast]
  );

  async function onSubmitWa(values: z.infer<typeof waSchema>) {
    setIsInitiating(true);
    await initiateWaRegister(
      values.whatsapp,
      (data) => {
        setWhatsapp(values.whatsapp);
        setWaToken(data.token);
        setWaNumber(data.waNumber);
        setWaStatus("waiting");
        setStep("send-wa");
        startPolling(data.token);
        setIsInitiating(false);
      },
      async () => {
        setUseFallback(true);
        await handleSendOtpLegacy(values.whatsapp);
        setIsInitiating(false);
      },
      (message) => {
        toast({ title: "Gagal", description: message, variant: "destructive" });
        setIsInitiating(false);
      }
    );
  }

  async function handleSendOtpLegacy(phone: string) {
    setIsSendingOtp(true);
    setSimulateOtp(null);
    const success = await sendOtpLegacy(
      phone,
      (otp) => {
        if (otp) setSimulateOtp(otp);
        setWhatsapp(phone);
        setResendCooldown(90);
        setOtpInputs(["", "", "", "", "", ""]);
        setStep("otp");
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      },
      (cooldown) => {
        if (cooldown) setResendCooldown(cooldown);
        toast({ title: "Gagal mengirim OTP", description: "Coba lagi", variant: "destructive" });
      }
    );
    setIsSendingOtp(false);
    return success;
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

  function handleUsernameChange(value: string) {
    accountForm.setValue("username", value);
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);
    if (value.length < 3) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    usernameDebounce.current = setTimeout(async () => {
      await checkUsernameAvailability(value, setUsernameStatus);
    }, 600);
  }

  const otp = otpInputs.join("");

  async function onVerifyOtp() {
    if (otp.length < 6) {
      toast({ title: "Masukkan 6 digit OTP", variant: "destructive" });
      return;
    }
    setIsVerifyingOtp(true);
    await verifyOtp(
      whatsapp,
      otp,
      () => {
        setStep("account");
        setIsVerifyingOtp(false);
      },
      (message) => {
        toast({ title: "Verifikasi gagal", description: message, variant: "destructive" });
        setOtpInputs(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        setIsVerifyingOtp(false);
      }
    );
  }

  function handleAccountSubmit(values: z.infer<typeof accountSchema>) {
    const payload = {
      username: values.username,
      password: values.password,
      fullName: values.fullName || undefined,
      email: values.email || undefined,
      whatsapp,
      otpCode: otp,
      referralCode: values.referralCode ? values.referralCode.trim().toUpperCase() : undefined,
    };

    setIsSubmittingAccount(true);
    registerAccount(
      payload,
      () => {
        toast({ title: "Registrasi berhasil!", description: "Selamat datang di KETANTECH VPN" });
        setLocation("/dashboard");
        window.location.reload();
      },
      (message) => {
        toast({ title: "Registrasi gagal", description: message, variant: "destructive" });
        setIsSubmittingAccount(false);
      }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {step === "whatsapp" && (
        <WhatsappStep waForm={waForm} isInitiating={isInitiating} onSubmitWa={onSubmitWa} />
      )}

      {step === "send-wa" && (
        <SendWaStep
          waNumber={waNumber}
          waStatus={waStatus}
          onBack={() => {
            setStep("whatsapp");
            if (pollRef.current) clearInterval(pollRef.current);
          }}
        />
      )}

      {step === "otp" && (
        <OtpStep
          whatsapp={whatsapp}
          otpInputs={otpInputs}
          simulateOtp={simulateOtp}
          resendCooldown={resendCooldown}
          isVerifyingOtp={isVerifyingOtp}
          isSendingOtp={isSendingOtp}
          useFallback={useFallback}
          onOtpInput={handleOtpInput}
          onOtpKeyDown={handleOtpKeyDown}
          onOtpPaste={handleOtpPaste}
          onVerifyOtp={onVerifyOtp}
          onResendOtp={() => handleSendOtpLegacy(whatsapp)}
          onBack={() => setStep("whatsapp")}
        />
      )}

      {step === "account" && (
        <AccountStep
          accountForm={accountForm}
          usernameStatus={usernameStatus}
          onUsernameChange={handleUsernameChange}
          onAccountSubmit={handleAccountSubmit}
          isSubmitting={isSubmittingAccount}
        />
      )}
    </div>
  );
}

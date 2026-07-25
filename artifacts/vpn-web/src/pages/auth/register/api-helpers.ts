import { checkUsername } from "@workspace/api-client-react";
import type { UsernameStatus } from "./schemas";

export async function sendOtpLegacy(
  phone: string,
  onSuccess: (otp: string | null) => void,
  onError: (cooldown?: number) => void
): Promise<boolean> {
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
        onError(data.cooldown);
      } else {
        onError();
      }
      return false;
    }
    
    const simulateOtp = data.simulateMode && data.otp ? data.otp : null;
    onSuccess(simulateOtp);
    return true;
  } catch {
    onError();
    return false;
  }
}

export async function initiateWaRegister(
  whatsapp: string,
  onSuccess: (data: { token: string; waNumber: string }) => void,
  onFallback: () => void,
  onError: (message: string) => void
): Promise<void> {
  try {
    const resp = await fetch("/api/auth/initiate-wa-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp }),
      credentials: "include",
    });
    const data = await resp.json();

    if (!resp.ok) {
      if (data.fallback) {
        onFallback();
        return;
      }
      onError(data.error ?? "Coba lagi");
      return;
    }

    onSuccess({ token: data.token, waNumber: data.waNumber });
  } catch {
    onError("Tidak dapat terhubung ke server");
  }
}

export async function verifyOtp(
  whatsapp: string,
  otp: string,
  onSuccess: () => void,
  onError: (message: string) => void
): Promise<void> {
  try {
    const resp = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp, otpCode: otp }),
      credentials: "include",
    });
    const data = await resp.json();
    
    if (!resp.ok) {
      onError(data.error ?? "Kode OTP salah");
      return;
    }
    
    onSuccess();
  } catch {
    onError("Tidak dapat terhubung ke server");
  }
}

export async function registerAccount(
  payload: {
    username: string;
    password: string;
    fullName?: string;
    email?: string;
    whatsapp: string;
    otpCode: string;
    referralCode?: string;
  },
  onSuccess: () => void,
  onError: (message: string) => void
): Promise<void> {
  try {
    const resp = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });
    const data = await resp.json();
    
    if (!resp.ok) {
      onError(data.error ?? "Coba lagi");
      return;
    }
    
    onSuccess();
  } catch {
    onError("Tidak dapat terhubung ke server");
  }
}

export async function checkUsernameAvailability(
  username: string,
  onResult: (status: UsernameStatus) => void
): Promise<void> {
  try {
    const result = await checkUsername({ username });
    onResult(result);
  } catch {
    onResult(null);
  }
}

export async function pollWaStatus(
  token: string,
  onOtpSent: (whatsapp: string) => void,
  onReceived: () => void,
  onExpired: () => void
): Promise<void> {
  try {
    const resp = await fetch(`/api/auth/wa-register-status/${token}`, {
      credentials: "include",
    });
    const data = await resp.json();

    if (data.status === "otp_sent") {
      onOtpSent(data.whatsapp || "");
    } else if (data.status === "received") {
      onReceived();
    } else if (data.status === "expired" || resp.status === 404) {
      onExpired();
    }
  } catch {
    // Ignore network errors, will retry on next interval
  }
}

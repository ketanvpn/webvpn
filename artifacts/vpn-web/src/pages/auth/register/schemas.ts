import { z } from "zod";

export const waSchema = z.object({
  whatsapp: z
    .string()
    .min(9, "Nomor terlalu pendek")
    .max(15, "Nomor terlalu panjang")
    .regex(/^[0-9+\-\s]+$/, "Format nomor tidak valid"),
});

export const otpSchema = z.object({
  otp: z.string().length(6, "Kode OTP harus 6 digit"),
});

export const accountSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .regex(/^[a-zA-Z0-9_]+$/, "Hanya huruf, angka, dan underscore"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  fullName: z.string().optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  referralCode: z.string().optional().or(z.literal("")),
});

export type Step = "whatsapp" | "send-wa" | "otp" | "account";
export type UsernameStatus = null | "checking" | { available: boolean; suggestions: string[] };
export type WaStatus = "waiting" | "received" | "otp_sent";

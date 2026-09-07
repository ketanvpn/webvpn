import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../lib/auth";
import { sendOtp, verifyOtp, normalizeWhatsapp } from "../../lib/fonnte";
import { logger } from "../../lib/logger";
import { authRateLimitKey, userIdOrIpKey, createLimiter } from "./shared";

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const changePasswordLimiter = createLimiter({ max: 5, message: "Terlalu banyak percobaan ganti password. Coba lagi dalam 15 menit.", keyGenerator: userIdOrIpKey });
const forgotPasswordLimiter = createLimiter({ max: 3, message: "Terlalu banyak permintaan. Coba lagi dalam 15 menit." });
const forgotPasswordResetLimiter = createLimiter({ max: 5, message: "Terlalu banyak percobaan reset password. Coba lagi dalam 15 menit." });

// ─── Change Password (authenticated) ─────────────────────────────────────────

router.post("/auth/change-password", requireAuth, changePasswordLimiter, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword dan newPassword wajib diisi" });
    return;
  }
  if (String(newPassword).length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan" });
    return;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Password saat ini salah" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await db
    .update(usersTable)
    .set({ passwordHash, sessionVersion: sql`session_version + 1` })
    .where(eq(usersTable.id, userId));

  res.json({ message: "Password berhasil diubah" });
}));

// ─── Forgot Password: Send OTP ───────────────────────────────────────────────

router.post("/auth/forgot-password/send-otp", forgotPasswordLimiter, asyncHandler(async (req, res) => {
  const { whatsapp } = req.body ?? {};
  if (!whatsapp || typeof whatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }

  const normalized = normalizeWhatsapp(whatsapp);
  const [user] = await db
    .select({ id: usersTable.id, whatsapp: usersTable.whatsapp })
    .from(usersTable)
    .where(eq(usersTable.whatsapp, normalized))
    .limit(1);

  if (!user) {
    // Jangan bocorkan apakah nomor terdaftar atau tidak (keamanan)
    res.json({ message: "Jika nomor terdaftar, OTP akan dikirim ke WhatsApp kamu." });
    return;
  }

  const result = await sendOtp(whatsapp, "reset");
  if (!result.success) {
    const status = result.cooldown ? 429 : 500;
    res.status(status).json({
      error: result.error ?? "Gagal mengirim OTP",
      ...(result.cooldown ? { cooldown: result.cooldown } : {}),
    });
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  res.json({
    message: "OTP dikirim ke WhatsApp kamu",
    simulateMode: result.simulateMode,
    ...(!isProduction && result.simulateMode ? { otp: result.otp } : {}),
  });
}));

// ─── Forgot Password: Reset with OTP ─────────────────────────────────────────

router.post("/auth/forgot-password/reset", forgotPasswordResetLimiter, asyncHandler(async (req, res) => {
  const { whatsapp, otpCode, newPassword } = req.body ?? {};

  if (!whatsapp || typeof whatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }
  if (!otpCode || typeof otpCode !== "string") {
    res.status(400).json({ error: "Kode OTP wajib diisi" });
    return;
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter" });
    return;
  }

  const otpResult = await verifyOtp(whatsapp, otpCode, "reset");
  if (!otpResult.valid) {
    res.status(400).json({ error: otpResult.reason ?? "OTP tidak valid" });
    return;
  }

  const normalized = normalizeWhatsapp(whatsapp);
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.whatsapp, normalized))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "Akun tidak ditemukan" });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash: hashed, sessionVersion: sql`session_version + 1` })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password berhasil direset. Silakan login dengan password baru." });
}));

export default router;

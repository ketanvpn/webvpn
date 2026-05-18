import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { sendOtp, verifyOtp, normalizeWhatsapp } from "../lib/fonnte";
import { notifyAdminNewUser } from "../lib/telegram";
import rateLimit from "express-rate-limit";
import { getClientIp } from "../lib/request-ip";
import { verifyTurnstileToken } from "../lib/turnstile";
import { logger } from "../lib/logger";

const router = Router();

function authRateLimitKey(req: any): string {
  return getClientIp(req);
}

function loginRateLimitKey(req: any): string {
  const ip = getClientIp(req);
  const identifier = typeof req.body?.username === "string"
    ? req.body.username.trim().toLowerCase()
    : "";
  if (!identifier) return ip;
  return `${ip}:${identifier}`;
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: loginRateLimitKey,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  message: { error: "Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit." },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  message: { error: "Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit." },
});

router.post("/auth/send-otp", otpLimiter, async (req, res) => {
  const { whatsapp } = req.body ?? {};
  if (!whatsapp || typeof whatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }

  const normalized = normalizeWhatsapp(whatsapp);
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.whatsapp, normalized))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Nomor WhatsApp sudah terdaftar" });
    return;
  }

  const result = await sendOtp(whatsapp);
  if (!result.success) {
    res.status(500).json({ error: result.error ?? "Gagal mengirim OTP" });
    return;
  }

  res.json({
    message: "OTP dikirim",
    simulateMode: result.simulateMode,
    ...(result.simulateMode ? { otp: result.otp } : {}),
  });
});

router.post("/auth/register", registerLimiter, async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid" });
    return;
  }
  const { username, password, email, fullName } = parsed.data;
  const { whatsapp: rawWhatsapp, otpCode, referralCode: inputReferralCode } = req.body ?? {};

  if (!rawWhatsapp || typeof rawWhatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }
  if (!otpCode || typeof otpCode !== "string") {
    res.status(400).json({ error: "Kode OTP wajib diisi" });
    return;
  }

  const otpResult = await verifyOtp(rawWhatsapp, otpCode);
  if (!otpResult.valid) {
    res.status(400).json({ error: otpResult.reason ?? "OTP tidak valid" });
    return;
  }

  const normalized = normalizeWhatsapp(rawWhatsapp);

  const existingUsername = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existingUsername.length > 0) {
    res.status(409).json({ error: "Username sudah digunakan" });
    return;
  }

  if (email) {
    const existingEmail = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      res.status(409).json({ error: "Email sudah digunakan" });
      return;
    }
  }

  const existingWa = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.whatsapp, normalized))
    .limit(1);

  if (existingWa.length > 0) {
    res.status(409).json({ error: "Nomor WhatsApp sudah terdaftar" });
    return;
  }

  let resolvedReferredBy: string | null = null;
  if (inputReferralCode && typeof inputReferralCode === "string") {
    const code = inputReferralCode.trim().toUpperCase();
    const [referrer] = await db
      .select({ id: usersTable.id, referralCode: usersTable.referralCode })
      .from(usersTable)
      .where(eq(usersTable.referralCode, code))
      .limit(1);

    if (referrer) {
      resolvedReferredBy = code;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(4).toString("hex").toUpperCase();

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      email: email ?? null,
      passwordHash,
      fullName: fullName ?? null,
      whatsapp: normalized,
      isVerified: true,
      role: "user",
      referralCode,
      referredBy: resolvedReferredBy,
    })
    .returning();

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  // Notifikasi Telegram ke admin (fire and forget)
  notifyAdminNewUser({
    username: user.username,
    fullName: user.fullName ?? null,
    email: user.email ?? null,
    whatsapp: user.whatsapp ?? null,
    referredBy: user.referredBy ?? null,
    createdAt: user.createdAt,
  }).catch(() => {});

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(201)
    .json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        balance: Number(user.balance),
        isActive: user.isActive,
        isVerified: user.isVerified,
        whatsapp: user.whatsapp,
        referralCode: user.referralCode,
        telegramId: user.telegramId ?? null,
        createdAt: user.createdAt,
      },
      token,
    });
});

const checkUsernameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  message: { error: "Terlalu banyak pengecekan username. Coba lagi sebentar." },
});

router.get("/auth/check-username", checkUsernameLimiter, async (req, res) => {
  const username = (req.query.username as string ?? "").trim().toLowerCase();
  if (!username || username.length < 3) {
    res.status(400).json({ error: "Username terlalu pendek" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!existing) {
    res.json({ available: true, suggestions: [] });
    return;
  }

  // Generate saran username alternatif yang belum dipakai
  const candidates = [
    `${username}1`, `${username}12`, `${username}99`,
    `${username}_id`, `${username}123`, `${username}2025`,
    `${username}_vpn`, `${username}88`,
  ];

  const checks = await Promise.all(
    candidates.map(async (c) => {
      const [row] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, c)).limit(1);
      return { name: c, taken: !!row };
    })
  );
  const suggestions = checks.filter((r) => !r.taken).slice(0, 3).map((r) => r.name);

  res.json({ available: false, suggestions });
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const turnstileSecretConfigured = Boolean(process.env.TURNSTILE_SECRET_KEY);
  const turnstileToken = typeof req.body?.turnstileToken === "string"
    ? req.body.turnstileToken.trim()
    : "";

  if (turnstileSecretConfigured) {
    if (!turnstileToken) {
      res.status(400).json({ error: "Verifikasi keamanan wajib diisi" });
      return;
    }

    const verify = await verifyTurnstileToken({
      token: turnstileToken,
      remoteIp: getClientIp(req),
    });

    if (!verify.ok) {
      logger.warn({ errors: verify.errors }, "Turnstile verification failed on login");
      res.status(400).json({ error: "Verifikasi keamanan gagal. Silakan coba lagi." });
      return;
    }
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username: identifier, password } = parsed.data;

  // Coba cari sebagai username dulu
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, identifier))
    .limit(1);

  // Kalau tidak ketemu dan input mirip nomor HP → coba cari sebagai WhatsApp
  if (!user && /^[0-9+\-\s]+$/.test(identifier) && identifier.replace(/\D/g, "").length >= 9) {
    const normalized = normalizeWhatsapp(identifier);
    [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.whatsapp, normalized))
      .limit(1);
  }

  if (!user) {
    res.status(401).json({ error: "Username/nomor WA atau password salah" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Username atau password salah" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Akun kamu disuspend. Hubungi admin." });
    return;
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        balance: Number(user.balance),
        isActive: user.isActive,
        isVerified: user.isVerified,
        whatsapp: user.whatsapp,
        referralCode: user.referralCode,
        telegramId: user.telegramId ?? null,
        createdAt: user.createdAt,
      },
      token,
    });
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  await db
    .update(usersTable)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(usersTable.id, userId));

  res.clearCookie("token").json({ message: "Logged out" });
});

router.patch("/auth/profile", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { fullName, email } = req.body ?? {};

  if (fullName === undefined && email === undefined) {
    res.status(400).json({ error: "Tidak ada data yang diubah" });
    return;
  }

  if (email !== undefined && email !== null && email !== "") {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, String(email)))
      .limit(1);
    if (existing.length > 0 && existing[0].id !== userId) {
      res.status(409).json({ error: "Email sudah digunakan" });
      return;
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      ...(fullName !== undefined ? { fullName: fullName ? String(fullName) : null } : {}),
      ...(email !== undefined ? { email: email ? String(email) : null } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({
    id: updated.id,
    username: updated.username,
    email: updated.email,
    fullName: updated.fullName,
    role: updated.role,
    balance: Number(updated.balance),
    isActive: updated.isActive,
    isVerified: updated.isVerified,
    whatsapp: updated.whatsapp,
    referralCode: updated.referralCode,
    telegramId: updated.telegramId ?? null,
    createdAt: updated.createdAt,
  });
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
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
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    balance: Number(user.balance),
    isActive: user.isActive,
    isVerified: user.isVerified,
    whatsapp: user.whatsapp,
    referralCode: user.referralCode,
    telegramId: user.telegramId ?? null,
    // vpnTelegramId dipakai UI Profile untuk tampilkan status link Bot VPN
    // (terpisah dari Bot Notifikasi).
    vpnTelegramId: user.vpnTelegramId ?? null,
    createdAt: user.createdAt,
  });
});

// ─── Forgot Password: Send OTP ────────────────────────────────────────────────

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  message: { error: "Terlalu banyak permintaan. Coba lagi dalam 15 menit." },
});

const forgotPasswordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authRateLimitKey,
  message: { error: "Terlalu banyak percobaan reset password. Coba lagi dalam 15 menit." },
});

router.post("/auth/forgot-password/send-otp", forgotPasswordLimiter, async (req, res) => {
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
    res.status(500).json({ error: result.error ?? "Gagal mengirim OTP" });
    return;
  }

  res.json({
    message: "OTP dikirim ke WhatsApp kamu",
    simulateMode: result.simulateMode,
    ...(result.simulateMode ? { otp: result.otp } : {}),
  });
});

// ─── Forgot Password: Reset with OTP ──────────────────────────────────────────

router.post("/auth/forgot-password/reset", forgotPasswordResetLimiter, async (req, res) => {
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
});

export default router;

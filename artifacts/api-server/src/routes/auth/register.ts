import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import bcrypt from "bcryptjs";
import { db, type User } from "@workspace/db";
import { usersTable, waVerificationsTable } from "@workspace/db";
import { eq, sql, and, gt, inArray } from "drizzle-orm";
import { signToken } from "../../lib/auth";
import { RegisterBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { getSettingValue } from "../settings";
import { sendOtp, verifyOtp, verifyOtpOnly, normalizeWhatsapp } from "../../lib/fonnte";
import { notifyAdminNewUser } from "../../lib/telegram";
import { logger } from "../../lib/logger";
import { toUserResponse, authRateLimitKey, createLimiter } from "./shared";

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const initiateWaLimiter = createLimiter({ max: 5, message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." });
const pollStatusLimiter = createLimiter({ windowMs: 60 * 1000, max: 40, message: "Terlalu banyak permintaan. Coba lagi sebentar." });
const otpLimiter = createLimiter({ max: 3, message: "Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit." });
const registerLimiter = createLimiter({ max: 5, message: "Terlalu banyak percobaan registrasi. Coba lagi dalam 15 menit." });
const checkUsernameLimiter = createLimiter({ windowMs: 60 * 1000, max: 20, message: "Terlalu banyak pengecekan username. Coba lagi sebentar." });

// ─── User Chat Duluan: Initiate WA Register ───────────────────────────────────

router.post("/auth/initiate-wa-register", initiateWaLimiter, asyncHandler(async (req, res) => {
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

  const fonnteNumber = await getSettingValue("fonnteWhatsappNumber");
  if (!fonnteNumber) {
    res.status(503).json({ error: "Nomor WhatsApp admin belum dikonfigurasi", fallback: true });
    return;
  }

  await db.delete(waVerificationsTable).where(
    eq(waVerificationsTable.whatsapp, normalized)
  );

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(waVerificationsTable).values({
    whatsapp: normalized,
    token,
    expiresAt,
  });

  res.json({
    token,
    waNumber: fonnteNumber,
    message: `Kirim pesan "DAFTAR" ke nomor ${fonnteNumber} via WhatsApp`,
  });
}));

// ─── User Chat Duluan: Poll Status ────────────────────────────────────────────

router.get("/auth/wa-register-status/:token", pollStatusLimiter, asyncHandler(async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "Token tidak valid" });
    return;
  }

  const now = new Date();
  const [record] = await db
    .select()
    .from(waVerificationsTable)
    .where(
      and(
        eq(waVerificationsTable.token, token),
        gt(waVerificationsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!record) {
    res.status(404).json({ error: "Token tidak ditemukan atau sudah kedaluwarsa", status: "expired" });
    return;
  }

  if (record.otpSent) {
    res.json({ status: "otp_sent", whatsapp: record.whatsapp });
    return;
  }

  if (record.messageReceived) {
    res.json({ status: "received", whatsapp: record.whatsapp });
    return;
  }

  res.json({ status: "waiting" });
}));

// ─── Legacy Send OTP (fallback / simulate mode) ──────────────────────────────

router.post("/auth/send-otp", otpLimiter, asyncHandler(async (req, res) => {
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
    const status = result.cooldown ? 429 : 500;
    res.status(status).json({
      error: result.error ?? "Gagal mengirim OTP",
      ...(result.cooldown ? { cooldown: result.cooldown } : {}),
    });
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  res.json({
    message: "OTP dikirim",
    simulateMode: result.simulateMode,
    ...(!isProduction && result.simulateMode ? { otp: result.otp } : {}),
  });
}));

// ─── Verify OTP (for step-by-step registration) ───────────────────────────────

router.post("/auth/verify-otp", otpLimiter, asyncHandler(async (req, res) => {
  const { whatsapp, otpCode } = req.body ?? {};
  if (!whatsapp || typeof whatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }
  if (!otpCode || typeof otpCode !== "string") {
    res.status(400).json({ error: "Kode OTP wajib diisi" });
    return;
  }

  const otpResult = await verifyOtpOnly(whatsapp, otpCode, "register");
  if (!otpResult.valid) {
    res.status(400).json({ error: otpResult.reason ?? "Kode OTP tidak valid" });
    return;
  }

  res.json({ success: true, message: "OTP terverifikasi" });
}));

// ─── Register ─────────────────────────────────────────────────────────────────

router.post("/auth/register", registerLimiter, asyncHandler(async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid" });
    return;
  }
  const { username, password, email, fullName, whatsapp: rawWhatsapp, otpCode } = parsed.data;
  const inputReferralCode = typeof req.body?.referralCode === "string"
    ? req.body.referralCode
    : undefined;

  if (!rawWhatsapp) {
    res.status(400).json({ error: "Nomor WhatsApp wajib diisi" });
    return;
  }
  if (!otpCode) {
    res.status(400).json({ error: "Kode OTP wajib diisi" });
    return;
  }

  const otpResult = await verifyOtp(rawWhatsapp, otpCode);
  if (!otpResult.valid) {
    res.status(400).json({ error: otpResult.reason ?? "OTP tidak valid" });
    return;
  }

  const normalized = normalizeWhatsapp(rawWhatsapp);

  // Referral code resolution
  let resolvedReferredBy: string | null = null;
  if (inputReferralCode) {
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

  let referralCode: string;
  let user: User | undefined;
  const MAX_REFERRAL_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_REFERRAL_RETRIES; attempt++) {
    referralCode = randomBytes(4).toString("hex").toUpperCase();
    try {
      [user] = await db
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
      break;
    } catch (dbError: unknown) {
      const err = dbError as Record<string, unknown>;
      const pgCode = (err?.code ?? (err?.cause as Record<string, unknown> | undefined)?.code) as string | undefined;
      const detail: string = (
        (err?.detail ?? (err?.cause as Record<string, unknown> | undefined)?.detail ?? "") as string
      ).toLowerCase();

      if (pgCode === "23505") {
        if (detail.includes("username")) {
          res.status(409).json({ error: "Username sudah digunakan" });
          return;
        }
        if (detail.includes("email")) {
          res.status(409).json({ error: "Email sudah digunakan" });
          return;
        }
        if (detail.includes("whatsapp")) {
          res.status(409).json({ error: "Nomor WhatsApp sudah terdaftar" });
          return;
        }
        if (detail.includes("referral_code") || detail.includes("referralcode")) {
          if (attempt < MAX_REFERRAL_RETRIES) {
            logger.warn({ attempt, referralCode }, "referralCode collision, retrying");
            continue;
          }
          logger.error({ referralCode }, "referralCode collision exhausted retries");
        }
      }

      logger.error({ err: dbError, username, whatsapp: normalized }, "Registration DB insert failed");
      res.status(500).json({ error: "Gagal membuat akun. Silakan coba lagi." });
      return;
    }
  }

  if (!user) {
    logger.error({ username }, "Registration failed: user not created after retries");
    res.status(500).json({ error: "Gagal membuat akun. Silakan coba lagi." });
    return;
  }

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
  }).catch((err) => {
    logger.error({ err, username: user.username }, "Failed to send Telegram notification for new user");
  });

  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .status(201)
    .json({
      user: toUserResponse(user),
      token,
    });
}));

// ─── Check Username Availability ──────────────────────────────────────────────

router.get("/auth/check-username", checkUsernameLimiter, asyncHandler(async (req, res) => {
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

  // Generate saran username alternatif — single query instead of 8 parallel queries
  const candidates = [
    `${username}1`, `${username}12`, `${username}99`,
    `${username}_id`, `${username}123`, `${username}2025`,
    `${username}_vpn`, `${username}88`,
  ];

  const taken = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(inArray(usersTable.username, candidates));

  const takenSet = new Set(taken.map((r) => r.username));
  const suggestions = candidates.filter((c) => !takenSet.has(c)).slice(0, 3);

  res.json({ available: false, suggestions });
}));

export default router;

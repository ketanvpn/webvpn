import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { signToken, requireAuth } from "../../lib/auth";
import { LoginBody } from "@workspace/api-zod";
import { normalizeWhatsapp } from "../../lib/fonnte";
import { verifyTurnstileToken } from "../../lib/turnstile";
import { getClientIp } from "../../lib/request-ip";
import { logger } from "../../lib/logger";
import { toUserResponse, loginRateLimitKey, createLimiter } from "./shared";

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const loginLimiter = createLimiter({ max: 5, message: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit.", keyGenerator: loginRateLimitKey });

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/auth/login", loginLimiter, asyncHandler(async (req, res) => {
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
      user: toUserResponse(user),
      token,
    });
}));

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post("/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  await db
    .update(usersTable)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(usersTable.id, userId));

  res.clearCookie("token").json({ message: "Logged out" });
}));

// ─── Me (Current User) ───────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, asyncHandler(async (req, res) => {
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

  res.json(toUserResponse(user, { includeVpnTelegramId: true }));
}));

export default router;

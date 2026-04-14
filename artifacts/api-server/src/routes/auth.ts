import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";
import { sendOtp, verifyOtp, normalizeWhatsapp } from "../lib/fonnte";

const router = Router();

router.post("/auth/send-otp", async (req, res) => {
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

router.post("/auth/register", async (req, res) => {
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

  const token = signToken({ userId: user.id, username: user.username, role: user.role });

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

router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Username atau password salah" });
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

  const token = signToken({ userId: user.id, username: user.username, role: user.role });

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

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
});

router.patch("/auth/profile", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { fullName, email } = req.body ?? {};

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

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Password saat ini salah" });
    return;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await db
    .update(usersTable)
    .set({ passwordHash })
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
    createdAt: user.createdAt,
  });
});

export default router;

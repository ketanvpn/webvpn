import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { randomBytes } from "crypto";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, password, email, fullName } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const emailExists = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (emailExists.length > 0) {
    res.status(409).json({ error: "Email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const referralCode = randomBytes(4).toString("hex").toUpperCase();

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      email,
      passwordHash,
      fullName: fullName ?? null,
      role: "user",
      referralCode,
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
        referralCode: user.referralCode,
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
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "Account is locked" });
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
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
      token,
    });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie("token").json({ message: "Logged out" });
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
    referralCode: user.referralCode,
    createdAt: user.createdAt,
  });
});

export default router;

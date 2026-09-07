import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../../lib/auth";
import { toUserResponse, userIdOrIpKey, createLimiter } from "./shared";

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const profileLimiter = createLimiter({ max: 30, message: "Terlalu banyak percobaan edit profil. Coba lagi dalam 15 menit.", keyGenerator: userIdOrIpKey });

// ─── Update Profile ───────────────────────────────────────────────────────────

router.patch("/auth/profile", requireAuth, profileLimiter, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { fullName, email } = req.body ?? {};

  if (fullName === undefined && email === undefined) {
    res.status(400).json({ error: "Tidak ada data yang diubah" });
    return;
  }

  let normalizedFullName: string | null | undefined;
  if (fullName !== undefined) {
    if (fullName === null || String(fullName).trim() === "") {
      normalizedFullName = null;
    } else {
      const trimmed = String(fullName).trim();
      if (trimmed.length > 100) {
        res.status(400).json({ error: "Nama lengkap maksimal 100 karakter" });
        return;
      }
      normalizedFullName = trimmed;
    }
  }

  let normalizedEmail: string | null | undefined;
  if (email !== undefined) {
    if (email === null || String(email).trim() === "") {
      normalizedEmail = null;
    } else {
      const trimmed = String(email).trim().toLowerCase();
      if (trimmed.length > 254) {
        res.status(400).json({ error: "Email terlalu panjang" });
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        res.status(400).json({ error: "Format email tidak valid" });
        return;
      }
      normalizedEmail = trimmed;
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`)
        .limit(1);
      if (existing.length > 0 && existing[0].id !== userId) {
        res.status(409).json({ error: "Email sudah digunakan" });
        return;
      }
    }
  }

  const [updated] = await db
    .update(usersTable)
    .set({
      ...(normalizedFullName !== undefined ? { fullName: normalizedFullName } : {}),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json(toUserResponse(updated));
}));

export default router;

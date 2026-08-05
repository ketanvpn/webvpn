import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, balanceLogsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../lib/auth";
import { requireBotApiKey } from "../middlewares/bot-auth-key";
import { getClientIp } from "../lib/request-ip";
import { logger } from "../lib/logger";

const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_CREDIT_AMOUNT = Number(process.env.BOT_MAX_CREDIT || 10_000_000);
const MAX_DESCRIPTION_LEN = 255;
const REF_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const botApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => getClientIp(req),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Endpoint khusus untuk Bot Telegram VPN (BotVPN repo / @panelketan_bot).
 *
 * Penting: TERPISAH dari endpoint /telegram/* di routes/telegram-bot.ts yang
 * dipakai untuk Bot Notifikasi (kirim notif order/topup, tiket support).
 *
 * Beda kolom di tabel users:
 *   - telegramId / telegramLinkToken          → Bot Notifikasi (existing)
 *   - vpnTelegramId / vpnTelegramLinkToken    → Bot VPN (file ini)
 *
 * Ada 2 grup endpoint di file ini:
 *
 * GROUP A — Untuk USER WEB (auth pakai cookie session):
 *   - POST   /telegram/vpn-link        Generate token & URL t.me/<botvpn>?start=link_<token>
 *   - DELETE /telegram/vpn-link        Putus link akun web ↔ Bot VPN (manual unlink dari web)
 *
 * GROUP B — Untuk BOT VPN (auth pakai X-Bot-API-Key):
 *   - POST  /telegram/verify-link-token        Verify token + simpan vpnTelegramId
 *   - GET   /telegram/user-by-tgid/:telegramId Info user web by vpnTelegramId
 *   - GET   /telegram/balance/:telegramId      Saldo by vpnTelegramId
 *   - POST  /telegram/unlink                   Bot trigger unlink (saat user pencet
 *                                              tombol "Putuskan Koneksi" di bot)
 */
const router = Router();

// Username Bot VPN. Bisa di-override via env BOT_VPN_USERNAME, default ke
// "panelketan_bot" sesuai yang sudah running.
function getBotVpnUsername(): string {
  return (process.env.BOT_VPN_USERNAME || "panelketan_bot").trim();
}

// ============================================================================
// GROUP A: USER-FACING (auth cookie session)
// ============================================================================

// POST /telegram/vpn-link
// Body: (kosong)
// Generate token unik, simpan ke vpn_telegram_link_token, return URL Bot VPN.
// Response: { token, botUsername, url }
router.post("/telegram/vpn-link", requireAuth, async (req, res) => {
  const userId = (req as Request & { user: { userId: number } }).user!.userId;
  const token = randomBytes(24).toString("hex");

  await db
    .update(usersTable)
    .set({ vpnTelegramLinkToken: token, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const botUsername = getBotVpnUsername();
  const url = `https://t.me/${botUsername}?start=link_${token}`;

  res.json({ token, botUsername, url });
});

// DELETE /telegram/vpn-link
// Putus link akun web ke Bot VPN dari sisi web (user pencet tombol di profile).
router.delete("/telegram/vpn-link", requireAuth, async (req, res) => {
  const userId = (req as Request & { user: { userId: number } }).user!.userId;

  await db
    .update(usersTable)
    .set({
      vpnTelegramId: null,
      vpnTelegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  res.json({ ok: true });
});

// ============================================================================
// GROUP B: BOT-FACING (auth X-Bot-API-Key)
// ============================================================================

// POST /telegram/verify-link-token
// Body: { token: string, telegramId: number }
// Response: { ok: true, user: { id, username, email, balance, fullName, role } }
router.post("/telegram/verify-link-token", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tokenRaw = String(req.body?.token || "").trim();
  const telegramIdRaw = Number(req.body?.telegramId || 0);

  if (!tokenRaw || tokenRaw.length < 16) {
    res.status(400).json({ error: "Token tidak valid" });
    return;
  }
  if (!telegramIdRaw || !Number.isFinite(telegramIdRaw)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const [foundUser] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      vpnTelegramId: usersTable.vpnTelegramId,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.vpnTelegramLinkToken, tokenRaw))
    .limit(1);

  if (!foundUser) {
    res.status(404).json({ error: "Token tidak ditemukan atau sudah dipakai" });
    return;
  }
  if (!foundUser.isActive) {
    res.status(403).json({ error: "Akun web tidak aktif. Hubungi admin." });
    return;
  }

  // TTL check: token expires 30 minutes after generation
  if (foundUser.updatedAt && Date.now() - new Date(foundUser.updatedAt).getTime() > TOKEN_TTL_MS) {
    await db
      .update(usersTable)
      .set({ vpnTelegramLinkToken: null })
      .where(eq(usersTable.id, foundUser.id));
    res.status(410).json({ error: "Token kedaluwarsa (>30 menit). Buat token baru dari web." });
    return;
  }

  if (foundUser.vpnTelegramId && Number(foundUser.vpnTelegramId) !== telegramIdRaw) {
    logger.warn(
      { webUserId: foundUser.id, oldTgId: foundUser.vpnTelegramId, newTgId: telegramIdRaw },
      "verify-link-token (vpn): overwrite vpnTelegramId yang berbeda",
    );
  }

  const [conflict] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.vpnTelegramId, telegramIdRaw))
    .limit(1);

  if (conflict && conflict.id !== foundUser.id) {
    await db
      .update(usersTable)
      .set({ vpnTelegramId: null, updatedAt: new Date() })
      .where(eq(usersTable.id, conflict.id));
    logger.warn(
      { conflictUserId: conflict.id, newUserId: foundUser.id, telegramId: telegramIdRaw },
      "verify-link-token (vpn): clear vpnTelegramId dari user lama yang konflik",
    );
  }

  // Atomic update with TTL guard
  const cutoff = new Date(Date.now() - TOKEN_TTL_MS);
  const [updated] = await db
    .update(usersTable)
    .set({
      vpnTelegramId: telegramIdRaw,
      vpnTelegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usersTable.id, foundUser.id),
        eq(usersTable.vpnTelegramLinkToken, tokenRaw),
        sql`${usersTable.updatedAt} >= ${cutoff}`,
      ),
    )
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      fullName: usersTable.fullName,
      role: usersTable.role,
    });

  if (!updated) {
    res.status(409).json({ error: "Token sudah dipakai atau kedaluwarsa" });
    return;
  }

  logger.info(
    { webUserId: updated.id, vpnTelegramId: telegramIdRaw },
    "Akun web berhasil di-link ke Bot VPN",
  );

  res.json({
    ok: true,
    user: {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      balance: Number(updated.balance ?? 0),
      fullName: updated.fullName,
      role: updated.role,
    },
  });
});

// GET /telegram/user-by-tgid/:telegramId
// Cari user web by vpnTelegramId (bukan telegramId yang dipakai Bot Notifikasi).
router.get("/telegram/user-by-tgid/:telegramId", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tgId = Number(req.params.telegramId);
  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.vpnTelegramId, tgId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan untuk telegramId ini" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: Number(user.balance ?? 0),
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// GET /telegram/balance/:telegramId
// Versi ringkas: cuma balance + pendingTopup.
router.get("/telegram/balance/:telegramId", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tgId = Number(req.params.telegramId);
  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const [user] = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.vpnTelegramId, tgId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan untuk telegramId ini" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({
    balance: Number(user.balance ?? 0),
    pendingTopup: 0,
  });
});

// ============================================================================
// POST /telegram/credit
// Body: { telegramId: number, amount: number, description?: string, refId?: string }
// Tambah saldo user (untuk migrate saldo lama bot saat link, atau topup masa
// depan dari bot). Idempotent kalau refId disertakan: kalau refId sudah pernah
// dipakai sebelumnya, request akan di-skip dan respons.applied=false.
// Response: { ok: true, applied: boolean, newBalance: number }
// ============================================================================
router.post("/telegram/credit", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  const amount = Number(req.body?.amount || 0);
  const rawDesc = String(req.body?.description || "").trim();
  const description = rawDesc.replace(/\[refId:/gi, "").slice(0, MAX_DESCRIPTION_LEN) || "Credit dari Bot VPN";
  const refId = req.body?.refId ? String(req.body.refId).trim() : null;

  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount harus > 0" });
    return;
  }
  if (amount > MAX_CREDIT_AMOUNT) {
    res.status(400).json({ error: `amount melebihi batas maksimal (${MAX_CREDIT_AMOUNT})` });
    return;
  }
  if (refId && !REF_ID_REGEX.test(refId)) {
    res.status(400).json({ error: "refId tidak valid (alphanumeric, dash, underscore, 1-64 chars)" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          id: usersTable.id,
          balance: usersTable.balance,
        })
        .from(usersTable)
        .where(eq(usersTable.vpnTelegramId, tgId))
        .for("update")
        .limit(1);

      if (!user) {
        return { error: "User tidak ditemukan untuk telegramId ini", status: 404 };
      }

      if (refId) {
        const [existing] = await tx
          .select({ id: balanceLogsTable.id })
          .from(balanceLogsTable)
          .where(
            and(
              eq(balanceLogsTable.userId, user.id),
              eq(balanceLogsTable.refId, refId),
            ),
          )
          .limit(1);
        if (existing) {
          return { ok: true, applied: false, newBalance: Number(user.balance), reason: "duplicate refId" };
        }
      }

      const balanceBefore = Number(user.balance);

      await tx
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      const balanceAfter = balanceBefore + amount;

      await tx.insert(balanceLogsTable).values({
        userId: user.id,
        type: "credit_bot",
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description,
        refId: refId ?? undefined,
      });

      return { ok: true, applied: true, newBalance: balanceAfter };
    });

    if ("error" in result && result.error) {
      res.status(result.status ?? 500).json({ error: result.error });
      return;
    }
    logger.info(
      { tgId, amount, refId, applied: result.applied, newBalance: result.newBalance },
      "telegram/credit",
    );
    res.json(result);
  } catch (e: any) {
    if (e.code === "23505") {
      res.json({ ok: true, applied: false, reason: "duplicate refId (constraint)" });
      return;
    }
    logger.error({ err: e, tgId, amount }, "telegram/credit error");
    res.status(500).json({ error: "Gagal credit saldo" });
  }
});

// ============================================================================
// POST /telegram/debit
// Body: { telegramId: number, amount: number, description?: string, refId?: string }
// Kurangi saldo user (untuk pembelian akun via bot). Idempotent dengan refId.
// Tolak (400) kalau saldo kurang.
// Response: { ok: true, applied: boolean, newBalance: number }
// ============================================================================
router.post("/telegram/debit", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  const amount = Number(req.body?.amount || 0);
  const rawDesc = String(req.body?.description || "").trim();
  const description = rawDesc.replace(/\[refId:/gi, "").slice(0, MAX_DESCRIPTION_LEN) || "Debit dari Bot VPN";
  const refId = req.body?.refId ? String(req.body.refId).trim() : null;

  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount harus > 0" });
    return;
  }
  if (amount > MAX_CREDIT_AMOUNT) {
    res.status(400).json({ error: `amount melebihi batas maksimal (${MAX_CREDIT_AMOUNT})` });
    return;
  }
  if (refId && !REF_ID_REGEX.test(refId)) {
    res.status(400).json({ error: "refId tidak valid (alphanumeric, dash, underscore, 1-64 chars)" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          id: usersTable.id,
          balance: usersTable.balance,
        })
        .from(usersTable)
        .where(eq(usersTable.vpnTelegramId, tgId))
        .for("update")
        .limit(1);

      if (!user) {
        return { error: "User tidak ditemukan untuk telegramId ini", status: 404 };
      }

      if (refId) {
        const [existing] = await tx
          .select({ id: balanceLogsTable.id })
          .from(balanceLogsTable)
          .where(
            and(
              eq(balanceLogsTable.userId, user.id),
              eq(balanceLogsTable.refId, refId),
            ),
          )
          .limit(1);
        if (existing) {
          return { ok: true, applied: false, newBalance: Number(user.balance), reason: "duplicate refId" };
        }
      }

      const balanceBefore = Number(user.balance);
      if (balanceBefore < amount) {
        return { error: "Saldo tidak cukup", status: 400, newBalance: balanceBefore };
      }

      await tx
        .update(usersTable)
        .set({
          balance: sql`${usersTable.balance} - ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      const balanceAfter = balanceBefore - amount;

      await tx.insert(balanceLogsTable).values({
        userId: user.id,
        type: "debit_bot",
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description,
        refId: refId ?? undefined,
      });

      return { ok: true, applied: true, newBalance: balanceAfter };
    });

    if ("error" in result && result.error) {
      res
        .status(result.status ?? 500)
        .json({
          error: result.error,
          ...(result.newBalance !== undefined ? { newBalance: result.newBalance } : {}),
        });
      return;
    }
    logger.info(
      { tgId, amount, refId, applied: result.applied, newBalance: result.newBalance },
      "telegram/debit",
    );
    res.json(result);
  } catch (e: any) {
    if (e.code === "23505") {
      res.json({ ok: true, applied: false, reason: "duplicate refId (constraint)" });
      return;
    }
    logger.error({ err: e, tgId, amount }, "telegram/debit error");
    res.status(500).json({ error: "Gagal debit saldo" });
  }
});

// POST /telegram/unlink
// Body: { telegramId: number }
// Cuma clear vpnTelegramId — kolom telegramId (Bot Notifikasi) tidak disentuh.
router.post("/telegram/unlink", requireBotApiKey, botApiLimiter, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const updated = await db
    .update(usersTable)
    .set({
      vpnTelegramId: null,
      vpnTelegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.vpnTelegramId, tgId))
    .returning({ id: usersTable.id });

  if (!updated || updated.length === 0) {
    res.json({ ok: true, message: "Tidak ada user yang ter-link dengan telegramId ini" });
    return;
  }

  logger.info(
    { webUserId: updated[0].id, vpnTelegramId: tgId },
    "Akun web di-unlink dari Bot VPN",
  );

  res.json({ ok: true });
});

// Helper type untuk req.user (sama pattern dengan auth.ts).
type Request = import("express").Request;

export default router;

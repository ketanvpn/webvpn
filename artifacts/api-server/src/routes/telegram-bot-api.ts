import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, balanceLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import { requireAuth } from "../lib/auth";
import { requireBotApiKey } from "../middlewares/bot-auth-key";
import { logger } from "../lib/logger";

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
router.post("/telegram/verify-link-token", requireBotApiKey, async (req, res) => {
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

  // Cari user web by vpnTelegramLinkToken (token sekali pakai untuk Bot VPN).
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

  // Konflik 1: user ini sudah link ke vpnTelegramId yang BEDA.
  if (foundUser.vpnTelegramId && Number(foundUser.vpnTelegramId) !== telegramIdRaw) {
    logger.warn(
      { webUserId: foundUser.id, oldTgId: foundUser.vpnTelegramId, newTgId: telegramIdRaw },
      "verify-link-token (vpn): overwrite vpnTelegramId yang berbeda",
    );
  }

  // Konflik 2: vpnTelegramId yang dikirim bot, sudah linked ke user web LAIN.
  // Putus link lama dulu, baru link ke user baru. 1 vpnTelegramId = 1 user web.
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

  // Set vpnTelegramId, clear token (sekali pakai).
  const [updated] = await db
    .update(usersTable)
    .set({
      vpnTelegramId: telegramIdRaw,
      vpnTelegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, foundUser.id))
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      fullName: usersTable.fullName,
      role: usersTable.role,
    });

  if (!updated) {
    res.status(500).json({ error: "Gagal menyimpan link akun" });
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
router.get("/telegram/user-by-tgid/:telegramId", requireBotApiKey, async (req, res) => {
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
router.get("/telegram/balance/:telegramId", requireBotApiKey, async (req, res) => {
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
router.post("/telegram/credit", requireBotApiKey, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  const amount = Number(req.body?.amount || 0);
  const description = String(req.body?.description || "").trim() || "Credit dari Bot VPN";
  const refId = req.body?.refId ? String(req.body.refId).trim() : null;

  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount harus > 0" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Cari user by vpnTelegramId. Lock baris dengan FOR UPDATE supaya update
      // saldo aman dari race condition concurrent debit/credit.
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

      // Idempotency check: kalau refId sudah ada di balance_logs, skip.
      // (description LIKE 'refId:<refId>' dipakai sebagai marker — kita simpan
      // refId di description supaya tidak butuh kolom baru di balance_logs).
      if (refId) {
        const marker = `[refId:${refId}]`;
        const [existing] = await tx
          .select({ id: balanceLogsTable.id })
          .from(balanceLogsTable)
          .where(sql`${balanceLogsTable.userId} = ${user.id} AND ${balanceLogsTable.description} LIKE ${"%" + marker + "%"}`)
          .limit(1);
        if (existing) {
          return { ok: true, applied: false, newBalance: Number(user.balance), reason: "duplicate refId" };
        }
      }

      const balanceBefore = Number(user.balance);
      const balanceAfter = balanceBefore + amount;
      const fullDescription = refId
        ? `${description} [refId:${refId}]`
        : description;

      await tx
        .update(usersTable)
        .set({
          balance: balanceAfter.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      await tx.insert(balanceLogsTable).values({
        userId: user.id,
        type: "credit_bot",
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: fullDescription,
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
  } catch (e) {
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
router.post("/telegram/debit", requireBotApiKey, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  const amount = Number(req.body?.amount || 0);
  const description = String(req.body?.description || "").trim() || "Debit dari Bot VPN";
  const refId = req.body?.refId ? String(req.body.refId).trim() : null;

  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount harus > 0" });
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
        const marker = `[refId:${refId}]`;
        const [existing] = await tx
          .select({ id: balanceLogsTable.id })
          .from(balanceLogsTable)
          .where(sql`${balanceLogsTable.userId} = ${user.id} AND ${balanceLogsTable.description} LIKE ${"%" + marker + "%"}`)
          .limit(1);
        if (existing) {
          return { ok: true, applied: false, newBalance: Number(user.balance), reason: "duplicate refId" };
        }
      }

      const balanceBefore = Number(user.balance);
      if (balanceBefore < amount) {
        return { error: "Saldo tidak cukup", status: 400, newBalance: balanceBefore };
      }
      const balanceAfter = balanceBefore - amount;
      const fullDescription = refId
        ? `${description} [refId:${refId}]`
        : description;

      await tx
        .update(usersTable)
        .set({
          balance: balanceAfter.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, user.id));

      await tx.insert(balanceLogsTable).values({
        userId: user.id,
        type: "debit_bot",
        amount: amount.toFixed(2),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        description: fullDescription,
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
  } catch (e) {
    logger.error({ err: e, tgId, amount }, "telegram/debit error");
    res.status(500).json({ error: "Gagal debit saldo" });
  }
});

// POST /telegram/unlink
// Body: { telegramId: number }
// Cuma clear vpnTelegramId — kolom telegramId (Bot Notifikasi) tidak disentuh.
router.post("/telegram/unlink", requireBotApiKey, async (req, res) => {
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

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireBotApiKey } from "../middlewares/bot-auth-key";
import { logger } from "../lib/logger";

/**
 * Endpoint khusus Bot Telegram (BotVPN repo) untuk fitur "link akun".
 *
 * Semua endpoint di file ini diproteksi dengan `requireBotApiKey` middleware
 * (header `X-Bot-API-Key`). Bot tidak pakai cookie/JWT user, karena dia panggil
 * API ini sebagai service-to-service, bukan user-to-server.
 *
 * Endpoint:
 *   - POST /telegram/verify-link-token
 *       Verify token "link akun" yang di-generate oleh user lewat
 *       `GET /telegram/link` (di routes/telegram-bot.ts), lalu kaitkan
 *       `telegramId` ke user web. Token sekali pakai → di-clear setelah link.
 *
 *   - GET /telegram/user-by-tgid/:telegramId
 *       Ambil info user web berdasarkan telegramId. Untuk bot menampilkan
 *       saldo / username web di menu bot setelah user link.
 *
 *   - GET /telegram/balance/:telegramId
 *       Versi ringkas: cuma balance + pendingTopup (read-only).
 *
 *   - POST /telegram/unlink
 *       Putuskan link telegramId dari user web. Dipanggil saat user pencet
 *       tombol "Putuskan Koneksi" di bot.
 *
 * Catatan: schema users di lib/db/src/schema/users.ts SUDAH punya kolom
 * `telegramId` (bigint) dan `telegramLinkToken` (text), jadi tidak perlu
 * migration tambahan.
 */
const router = Router();

// ============================================================================
// POST /telegram/verify-link-token
// Body: { token: string, telegramId: number }
// Response: { ok: true, user: { id, username, email, balance, fullName, role } }
// ============================================================================
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

  // Cari user berdasarkan token. Token unik, di-set saat user klik tombol
  // "Hubungkan ke Telegram" di web (lihat /telegram/link di telegram-bot.ts).
  const [foundUser] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      email: usersTable.email,
      balance: usersTable.balance,
      fullName: usersTable.fullName,
      role: usersTable.role,
      isActive: usersTable.isActive,
      telegramId: usersTable.telegramId,
    })
    .from(usersTable)
    .where(eq(usersTable.telegramLinkToken, tokenRaw))
    .limit(1);

  if (!foundUser) {
    res.status(404).json({ error: "Token tidak ditemukan atau sudah dipakai" });
    return;
  }
  if (!foundUser.isActive) {
    res.status(403).json({ error: "Akun web tidak aktif. Hubungi admin." });
    return;
  }

  // Cek konflik: telegramId ini sudah linked ke user lain?
  if (foundUser.telegramId && Number(foundUser.telegramId) !== telegramIdRaw) {
    // user web ini sudah link ke telegramId yang BEDA → biasanya kasus user
    // ganti akun Telegram. Kita izinkan untuk overwrite, tapi log warningnya.
    logger.warn(
      { webUserId: foundUser.id, oldTgId: foundUser.telegramId, newTgId: telegramIdRaw },
      "verify-link-token: overwrite telegramId yang berbeda",
    );
  }

  // Cek konflik: telegramId yang dikirim bot, sudah linked ke user web lain?
  // Jika iya, putuskan link lama dulu, baru link ke user baru. Ini supaya
  // 1 telegramId selalu cuma terhubung ke 1 user web (UNIQUE constraint).
  const [conflict] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramIdRaw))
    .limit(1);

  if (conflict && conflict.id !== foundUser.id) {
    await db
      .update(usersTable)
      .set({ telegramId: null, updatedAt: new Date() })
      .where(eq(usersTable.id, conflict.id));
    logger.warn(
      { conflictUserId: conflict.id, newUserId: foundUser.id, telegramId: telegramIdRaw },
      "verify-link-token: clear telegramId dari user lama yang konflik",
    );
  }

  // Set telegramId, clear token (sekali pakai).
  const [updated] = await db
    .update(usersTable)
    .set({
      telegramId: telegramIdRaw,
      telegramLinkToken: null,
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
    { webUserId: updated.id, telegramId: telegramIdRaw },
    "Akun web berhasil di-link ke Telegram",
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

// ============================================================================
// GET /telegram/user-by-tgid/:telegramId
// Response: { user: { id, username, email, balance, fullName, role } }
// ============================================================================
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
    .where(eq(usersTable.telegramId, tgId))
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

// ============================================================================
// GET /telegram/balance/:telegramId
// Response: { balance: number, pendingTopup: number }
// ============================================================================
router.get("/telegram/balance/:telegramId", requireBotApiKey, async (req, res) => {
  const tgId = Number(req.params.telegramId);
  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const [user] = await db
    .select({
      balance: usersTable.balance,
    })
    .from(usersTable)
    .where(eq(usersTable.telegramId, tgId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User tidak ditemukan untuk telegramId ini" });
    return;
  }

  // Note: pendingTopup butuh query topupsTable, tapi untuk Sesi 2 cukup kembalikan 0
  // supaya endpoint ringan. Kalau butuh real pendingTopup, bisa di-extend di Sesi 3.
  res.setHeader("Cache-Control", "no-store");
  res.json({
    balance: Number(user.balance ?? 0),
    pendingTopup: 0,
  });
});

// ============================================================================
// POST /telegram/unlink
// Body: { telegramId: number }
// Response: { ok: true }
// ============================================================================
router.post("/telegram/unlink", requireBotApiKey, async (req, res) => {
  const tgId = Number(req.body?.telegramId || 0);
  if (!tgId || !Number.isFinite(tgId)) {
    res.status(400).json({ error: "telegramId tidak valid" });
    return;
  }

  const updated = await db
    .update(usersTable)
    .set({
      telegramId: null,
      telegramLinkToken: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.telegramId, tgId))
    .returning({ id: usersTable.id });

  if (!updated || updated.length === 0) {
    // user belum link, anggap idempotent → tetap balas ok
    res.json({ ok: true, message: "Tidak ada user yang ter-link dengan telegramId ini" });
    return;
  }

  logger.info(
    { webUserId: updated[0].id, telegramId: tgId },
    "Akun web di-unlink dari Telegram",
  );

  res.json({ ok: true });
});

export default router;

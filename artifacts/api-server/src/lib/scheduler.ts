import { db } from "@workspace/db";
import { vpnAccountsTable, usersTable, settingsTable, ordersTable, serversTable } from "@workspace/db";
import { eq, and, lte, gte, lt, sql, sum, ne } from "drizzle-orm";
import { logger } from "./logger";
import { sendWhatsapp } from "./fonnte";
import { sendMessage } from "./telegram";

async function getReferralBonusAmount(): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "referralBonusAmount"))
    .limit(1);
  const v = row?.value ? parseInt(row.value, 10) : 5000;
  return isNaN(v) ? 5000 : v;
}

function formatTanggal(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

async function notifyExpiring(daysBefore: 1 | 3): Promise<void> {
  const now = new Date();
  const rangeStart = new Date(now.getTime() + (daysBefore - 1) * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

  const notifiedField = daysBefore === 3 ? vpnAccountsTable.notified3Days : vpnAccountsTable.notified1Day;

  const accounts = await db
    .select({
      id: vpnAccountsTable.id,
      userId: vpnAccountsTable.userId,
      username: vpnAccountsTable.username,
      expiresAt: vpnAccountsTable.expiresAt,
      userWhatsapp: usersTable.whatsapp,
      userTelegramId: usersTable.telegramId,
      userFullName: usersTable.fullName,
    })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .where(
      and(
        eq(vpnAccountsTable.isActive, true),
        eq(notifiedField, false),
        gte(vpnAccountsTable.expiresAt, rangeStart),
        lte(vpnAccountsTable.expiresAt, rangeEnd),
      )
    );

  if (accounts.length === 0) return;
  logger.info({ count: accounts.length, daysBefore }, "Mengirim notifikasi kedaluwarsa akun VPN");

  for (const acc of accounts) {
    const namaUser = acc.userFullName ?? `User #${acc.userId}`;
    const tanggal = formatTanggal(new Date(acc.expiresAt));
    const hariText = daysBefore === 1 ? "1 hari lagi" : "3 hari lagi";

    const waMsg =
      `⚠️ *Notifikasi KETANTECH VPN*\n\n` +
      `Halo *${namaUser}*,\n\n` +
      `Akun VPN kamu dengan username *${acc.username}* akan habis masa berlakunya *${hariText}* (${tanggal}).\n\n` +
      `Segera perpanjang agar koneksi kamu tidak terputus. Login di website kami dan pilih menu _Akun VPN_ → _Perpanjang_.\n\n` +
      `Terima kasih sudah menggunakan KETANTECH VPN 🙏`;

    const tgMsg =
      `⚠️ <b>Akun VPN Hampir Habis</b>\n\n` +
      `Halo <b>${namaUser}</b>,\n\n` +
      `Akun VPN <code>${acc.username}</code> akan habis <b>${hariText}</b> (${tanggal}).\n\n` +
      `Segera perpanjang melalui website agar tidak terputus.`;

    if (acc.userWhatsapp) {
      sendWhatsapp(acc.userWhatsapp, waMsg).catch(() => {});
    }
    if (acc.userTelegramId) {
      sendMessage(acc.userTelegramId, tgMsg).catch(() => {});
    }

    const updateSet = daysBefore === 3
      ? { notified3Days: true, updatedAt: new Date() }
      : { notified1Day: true, updatedAt: new Date() };

    await db
      .update(vpnAccountsTable)
      .set(updateSet)
      .where(eq(vpnAccountsTable.id, acc.id));

    await new Promise((r) => setTimeout(r, 200));
  }
}

async function getExpiryNotifSettings(): Promise<{
  enabled: boolean;
  notif3Days: boolean;
  notif1Day: boolean;
  sendHour: number;
}> {
  const allRows = await db.select().from(settingsTable);
  const map = Object.fromEntries(allRows.map((r) => [r.key, r.value]));
  const parse = (v: string | null | undefined, def = true) =>
    v === undefined || v === null ? def : v === "true";
  const rawHour = parseInt(map["expiryNotifSendHour"] ?? "8", 10);

  return {
    enabled: parse(map["expiryNotifEnabled"], true),
    notif3Days: parse(map["expiryNotif3DaysEnabled"], true),
    notif1Day: parse(map["expiryNotif1DayEnabled"], true),
    sendHour: isNaN(rawHour) ? 8 : Math.min(23, Math.max(0, rawHour)),
  };
}

export async function checkExpiringAccounts(): Promise<void> {
  try {
    const cfg = await getExpiryNotifSettings();
    if (!cfg.enabled) {
      return;
    }

    // Cek jam sekarang dalam zona WIB (UTC+7)
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const currentHourWIB = nowWIB.getUTCHours();

    if (currentHourWIB !== cfg.sendHour) {
      return; // Belum waktunya kirim
    }

    logger.info({ sendHour: cfg.sendHour }, "Waktunya kirim notifikasi kedaluwarsa");
    if (cfg.notif3Days) await notifyExpiring(3);
    if (cfg.notif1Day) await notifyExpiring(1);
  } catch (err) {
    logger.error({ err }, "Error saat cek akun VPN kedaluwarsa");
  }
}

/**
 * Auto-cancel order QRIS yang sudah lewat waktu bayar (expiresAt < now, status masih pending).
 * Dijalankan setiap 5 menit.
 */
async function cancelExpiredQrisOrders(): Promise<void> {
  try {
    const now = new Date();
    const result = await db
      .update(ordersTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.status, "pending"),
          eq(ordersTable.paymentMethod, "qris"),
          lt(ordersTable.expiresAt, now)
        )
      )
      .returning({ id: ordersTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-expire: order QRIS melewati batas waktu pembayaran");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel order QRIS expired");
  }
}

async function checkResellerTargets(): Promise<void> {
  try {
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dateWib = nowWib.getUTCDate();
    const hourWib = nowWib.getUTCHours();

    if (dateWib !== 1 || hourWib !== 7) return;

    const [enabledRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerTargetEnabled")).limit(1);
    if (enabledRow?.value !== "true") return;

    const [targetRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerMonthlyTarget")).limit(1);
    const target = targetRow?.value ? parseInt(targetRow.value, 10) : 500000;

    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const resellers = await db.select({ id: usersTable.id, username: usersTable.username, whatsapp: usersTable.whatsapp, telegramId: usersTable.telegramId }).from(usersTable).where(eq(usersTable.role, "reseller"));

    for (const reseller of resellers) {
      const [result] = await db
        .select({ total: sum(ordersTable.amount) })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.userId, reseller.id),
          eq(ordersTable.status, "paid"),
          gte(ordersTable.createdAt, prevMonthStart),
          lt(ordersTable.createdAt, prevMonthEnd),
        ));

      const totalSales = Number(result?.total ?? 0);

      if (totalSales < target) {
        await db.update(usersTable).set({ role: "user" }).where(eq(usersTable.id, reseller.id));
        logger.info({ resellerId: reseller.id, totalSales, target }, "Reseller didowngrade karena tidak capai target bulanan");

        const msg = `⚠️ *Status Reseller Dinonaktifkan*\n\nHai *${reseller.username}*, status reseller kamu bulan ini telah dinonaktifkan karena total penjualan (Rp ${totalSales.toLocaleString("id-ID")}) belum mencapai target minimum (Rp ${target.toLocaleString("id-ID")}).\n\nHubungi admin untuk mengaktifkan kembali.`;

        if (reseller.whatsapp) sendWhatsapp(reseller.whatsapp, msg).catch(() => {});
        if (reseller.telegramId) sendMessage(String(reseller.telegramId), msg).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek target reseller bulanan");
  }
}

async function checkAndAutoDisableServers(): Promise<void> {
  try {
    const servers = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.isActive, true));

    for (const server of servers) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(
          and(
            eq(vpnAccountsTable.serverId, server.id),
            eq(vpnAccountsTable.isActive, true),
            gte(vpnAccountsTable.expiresAt, new Date()),
          ),
        );

      if ((count ?? 0) >= server.maxAccounts) {
        await db
          .update(serversTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(serversTable.id, server.id));
        logger.info(`[scheduler] Server "${server.name}" (id: ${server.id}) di-disable otomatis — ${count}/${server.maxAccounts} akun aktif`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek auto-disable server");
  }
}

async function cleanupGhostAccounts(): Promise<void> {
  try {
    const now = new Date();
    // Cari akun yang expired lebih dari 7 hari lalu
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(vpnAccountsTable)
      .where(lt(vpnAccountsTable.expiresAt, sevenDaysAgo))
      .returning({ id: vpnAccountsTable.id, username: vpnAccountsTable.username });

    if (result.length > 0) {
      logger.info({ count: result.length, accounts: result.map((r) => r.username) }, "Auto-cleanup: menghapus akun VPN hantu yang sudah lama expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cleanup akun hantu");
  }
}

export function startScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const FIVE_MIN = 5 * 60 * 1000;

  checkExpiringAccounts().catch(() => {});
  cancelExpiredQrisOrders().catch(() => {});
  checkResellerTargets().catch(() => {});
  checkAndAutoDisableServers().catch(() => {});
  cleanupGhostAccounts().catch(() => {});

  setInterval(() => {
    checkExpiringAccounts().catch(() => {});
  }, ONE_HOUR);

  setInterval(() => {
    cancelExpiredQrisOrders().catch(() => {});
  }, FIVE_MIN);

  setInterval(() => {
    checkResellerTargets().catch(() => {});
  }, ONE_HOUR);

  setInterval(() => {
    checkAndAutoDisableServers().catch(() => {});
  }, FIVE_MIN);

  // Auto-cleanup jalan setiap 3 jam
  setInterval(() => {
    cleanupGhostAccounts().catch(() => {});
  }, THREE_HOURS);

  logger.info("Scheduler notifikasi kedaluwarsa aktif (cek setiap jam, kirim sesuai jam WIB yang dikonfigurasi)");
  logger.info("Scheduler auto-cancel QRIS expired aktif (interval: 5 menit)");
  logger.info("Scheduler cek target reseller aktif (cek setiap jam, eksekusi tanggal 1 jam 07.00 WIB)");
  logger.info("Scheduler auto-disable server penuh aktif (interval: 5 menit)");
  logger.info("Scheduler auto-cleanup akun hantu aktif (cek setiap 3 jam)");

  // Auto-backup: cek setiap jam apakah sudah waktunya backup
  import("./backup").then(({ isBackupDue, performBackup }) => {
    const runBackupIfDue = async () => {
      try {
        const due = await isBackupDue();
        if (due) {
          logger.info("Auto-backup terjadwal dimulai...");
          await performBackup();
        }
      } catch (err) {
        logger.error({ err }, "Auto-backup scheduler error");
      }
    };

    // Cek pertama kali 1 menit setelah start
    setTimeout(() => runBackupIfDue().catch(() => {}), 60 * 1000);

    // Lalu cek setiap jam
    setInterval(() => runBackupIfDue().catch(() => {}), ONE_HOUR);

    logger.info("Scheduler auto-backup aktif (cek setiap jam)");
  }).catch((err) => {
    logger.error({ err }, "Failed to load backup module for scheduler");
  });
}

export { getReferralBonusAmount };

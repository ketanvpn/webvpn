import { db } from "@workspace/db";
import { vpnAccountsTable, usersTable, settingsTable, ordersTable, serversTable, topupsTable, paymentAttemptsTable, waVerificationsTable, dynamicVpnOrdersTable, dynamicProviderServersTable } from "@workspace/db";
import { eq, and, lte, gte, lt, sql, sum, ne, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { sendWhatsapp } from "./fonnte";
import { sendMessage } from "./telegram";
import { notifyAdminLowMarginServers } from "./telegram";
import { getDynamicCost } from "./dynamic-duration";
import {
  reconcileAutoGoPayGoPay,
  reconcileBeforePaymentExpiry,
  reconcileShopeePayTransactions,
  retryPaidOrderFulfillment,
} from "./payment/reconciliation";

async function getReferralBonusAmount(): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "referralBonusAmount"))
    .limit(1);
  const v = row?.value ? parseInt(row.value, 10) : 5000;
  return isNaN(v) ? 5000 : v;
}

export async function getReferralSettings(): Promise<{ enabled: boolean; bonusAmount: number }> {
  const [enabledRow, bonusRow] = await Promise.all([
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "referralEnabled"))
      .limit(1),
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "referralBonusAmount"))
      .limit(1),
  ]);
  
  const enabled = enabledRow[0]?.value !== "false";
  const bonusAmount = bonusRow[0]?.value ? parseInt(bonusRow[0].value, 10) : 5000;
  
  return {
    enabled,
    bonusAmount: isNaN(bonusAmount) ? 5000 : bonusAmount,
  };
}

function formatTanggal(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Simple in-memory lock to prevent overlapping tasks ──────────────────────
const runningTasks = new Set<string>();

async function runSafely(name: string, fn: () => Promise<void>) {
  if (runningTasks.has(name)) {
    logger.warn(`[scheduler] ${name} still running, skipping this tick to prevent overlap`);
    return;
  }
  runningTasks.add(name);
  const start = Date.now();
  try {
    logger.info(`[scheduler] ${name} started`);
    await fn();
    logger.info(`[scheduler] ${name} completed in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error({ err }, `[scheduler] ${name} failed`);
  } finally {
    runningTasks.delete(name);
  }
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
  const map = Object.fromEntries(allRows.map((r: any) => [r.key, r.value]));
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
 * Reconcile providers first, then expire only genuinely unpaid QRIS orders.
 * Paid/processing attempts are explicitly excluded; late confirmed provider
 * payments can recover an expired order through settlement reconciliation.
 * 
 * Also handles orders with NULL expiresAt (legacy bug fix) - treated as expired
 * if created more than 30 minutes ago.
 */
async function cancelExpiredQrisOrders(): Promise<void> {
  try {
    await reconcileBeforePaymentExpiry();
    const now = new Date();
    
    // Fallback untuk order dengan expiresAt NULL (legacy bug)
    // Jika order sudah lebih dari 30 menit dan masih pending tanpa expiresAt, expired
    const FALLBACK_EXPIRY_MINUTES = 30;
    const fallbackThreshold = new Date(now.getTime() - FALLBACK_EXPIRY_MINUTES * 60 * 1000);
    
    // Query: expired berdasarkan expiresAt ATAU (expiresAt NULL dan sudah > 30 menit)
    const result = await db
      .update(ordersTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(ordersTable.status, "pending"),
          eq(ordersTable.paymentMethod, "qris"),
          sql`(
            ${ordersTable.expiresAt} is not null and ${ordersTable.expiresAt} < ${now}
            or
            ${ordersTable.expiresAt} is null and ${ordersTable.createdAt} < ${fallbackThreshold}
          )`,
          sql`not exists (
            select 1 from ${paymentAttemptsTable}
            where ${paymentAttemptsTable.orderId} = ${ordersTable.id}
              and ${paymentAttemptsTable.status} in ('paid', 'processing', 'completed')
          )`,
        ),
      )
      .returning({ id: ordersTable.id, expiresAt: ordersTable.expiresAt, createdAt: ordersTable.createdAt });

    await db
      .update(paymentAttemptsTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(paymentAttemptsTable.status, "pending"),
          lt(paymentAttemptsTable.expiresAt, now),
          sql`exists (
            select 1 from ${ordersTable}
            where ${ordersTable.id} = ${paymentAttemptsTable.orderId}
              and ${ordersTable.status} = 'expired'
          )`,
        ),
      );

    if (result.length > 0) {
      const nullExpiresCount = result.filter((r: any) => r.expiresAt === null).length;
      logger.info({ 
        count: result.length,
        nullExpiresAt: nullExpiresCount,
        withExpiresAt: result.length - nullExpiresCount
      }, "Auto-expire: unpaid QRIS orders exceeded expiresAt (or NULL + fallback 30min)");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel order QRIS expired");
  }
}

/**
 * Expire topups using the provider/local expiresAt value. Records without an
 * expiry remain pending for manual handling rather than using an arbitrary 24h.
 */
async function cancelExpiredTopups(): Promise<void> {
  try {
    await reconcileBeforePaymentExpiry();
    const now = new Date();
    const result = await db
      .update(topupsTable)
      .set({
        status: "rejected",
        rejectionNote: "Auto-cleanup: Melewati batas waktu pembayaran",
        updatedAt: now,
      })
      .where(
        and(
          eq(topupsTable.status, "pending"),
          lt(topupsTable.expiresAt, now),
          sql`not exists (
            select 1 from ${paymentAttemptsTable}
            where ${paymentAttemptsTable.topupId} = ${topupsTable.id}
              and ${paymentAttemptsTable.status} in ('paid', 'processing', 'completed')
          )`,
        ),
      )
      .returning({ id: topupsTable.id });

    await db
      .update(paymentAttemptsTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(paymentAttemptsTable.status, "pending"),
          lt(paymentAttemptsTable.expiresAt, now),
          sql`exists (
            select 1 from ${topupsTable}
            where ${topupsTable.id} = ${paymentAttemptsTable.topupId}
              and ${topupsTable.status} = 'rejected'
          )`,
        ),
      );

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-expire: unpaid topups exceeded expiresAt");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel topup expired");
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

    // Cari ID akun yang akan dihapus
    const toDelete = await db
      .select({ id: vpnAccountsTable.id, username: vpnAccountsTable.username })
      .from(vpnAccountsTable)
      .where(lt(vpnAccountsTable.expiresAt, sevenDaysAgo));

    if (toDelete.length === 0) return;

    const ids = toDelete.map((r) => r.id);

    // Nullify FK reference di dynamic_vpn_orders dulu agar tidak violate constraint
    await db
      .update(dynamicVpnOrdersTable)
      .set({ vpnAccountId: null })
      .where(inArray(dynamicVpnOrdersTable.vpnAccountId, ids));

    // Baru hapus akun
    const result = await db
      .delete(vpnAccountsTable)
      .where(inArray(vpnAccountsTable.id, ids))
      .returning({ id: vpnAccountsTable.id, username: vpnAccountsTable.username });

    if (result.length > 0) {
      logger.info({ count: result.length, accounts: result.map((r: any) => r.username) }, "Auto-cleanup: menghapus akun VPN hantu yang sudah lama expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cleanup akun hantu");
  }
}

/**
 * Cleanup expired wa_verifications records.
 * Menghapus record yang expiresAt < NOW() - 1 day.
 * Dijalankan setiap 6 jam.
 */
async function cleanupExpiredWaVerifications(): Promise<void> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .delete(waVerificationsTable)
      .where(lt(waVerificationsTable.expiresAt, oneDayAgo))
      .returning({ id: waVerificationsTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-cleanup: menghapus wa_verifications expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat cleanup wa_verifications expired");
  }
}

export function startScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const FIVE_SECONDS = 5 * 1000;
  const TWO_MIN = 2 * 60 * 1000;
  const FIVE_MIN = 5 * 60 * 1000;
  const FIFTEEN_MIN = 15 * 60 * 1000;

  runSafely("initial-checkExpiringAccounts", checkExpiringAccounts);
  runSafely("initial-reconcilePayments", reconcileBeforePaymentExpiry);
  runSafely("initial-cancelExpiredQrisOrders", cancelExpiredQrisOrders);
  runSafely("initial-cancelExpiredTopups", cancelExpiredTopups);
  runSafely("initial-checkResellerTargets", checkResellerTargets);
  runSafely("initial-checkAndAutoDisableServers", checkAndAutoDisableServers);
  runSafely("initial-cleanupGhostAccounts", cleanupGhostAccounts);
  runSafely("initial-cleanupExpiredWaVerifications", cleanupExpiredWaVerifications);

  setInterval(() => {
    runSafely("checkExpiringAccounts", checkExpiringAccounts);
    runSafely("cancelExpiredTopups", cancelExpiredTopups);
    runSafely("sendDailyReport", sendDailyReport);
    runSafely("checkLowMarginServers", checkLowMarginServers);
  }, ONE_HOUR);

  setInterval(() => {
    runSafely("reconcileShopeePayTransactions", reconcileShopeePayTransactions);
  }, FIVE_SECONDS);

  setInterval(() => {
    runSafely("retryPaidOrderFulfillment", retryPaidOrderFulfillment);
  }, TWO_MIN);

  setInterval(() => {
    runSafely("reconcileAutoGoPayGoPay", reconcileAutoGoPayGoPay);
  }, TWO_MIN);

  setInterval(() => {
    runSafely("cancelExpiredQrisOrders", cancelExpiredQrisOrders);
  }, FIVE_MIN);

  setInterval(() => {
    runSafely("checkResellerTargets", checkResellerTargets);
  }, ONE_HOUR);

  setInterval(() => {
    runSafely("checkAndAutoDisableServers", checkAndAutoDisableServers);
  }, FIVE_MIN);

  // Auto-cleanup jalan setiap 3 jam
  setInterval(() => {
    runSafely("cleanupGhostAccounts", cleanupGhostAccounts);
  }, THREE_HOURS);

  // Cleanup wa_verifications expired setiap 6 jam
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(() => {
    runSafely("cleanupExpiredWaVerifications", cleanupExpiredWaVerifications);
  }, SIX_HOURS);

  // Proactive alert setiap 15 menit
  setTimeout(() => runSafely("runProactiveAlerts", runProactiveAlerts), 2 * 60 * 1000);
  setInterval(() => {
    runSafely("runProactiveAlerts", runProactiveAlerts);
  }, FIFTEEN_MIN);

  // Stuck orders health check setiap 1 jam
  runSafely("initial-checkStuckOrders", checkStuckOrders);
  setInterval(() => {
    runSafely("checkStuckOrders", checkStuckOrders);
  }, ONE_HOUR);

  logger.info("Scheduler notifikasi kedaluwarsa aktif (cek setiap jam, kirim sesuai jam WIB yang dikonfigurasi)");
  logger.info("Scheduler rekonsiliasi ShopeePay aktif (1 batch setiap 5 detik)");
  logger.info("Scheduler rekonsiliasi GoPay aktif (attempt stale setiap 2 menit)");
  logger.info("Scheduler retry fulfillment order berbayar aktif (interval: 2 menit)");
  logger.info("Scheduler auto-cancel QRIS expired aktif (interval: 5 menit, sesudah rekonsiliasi)");
  logger.info("Scheduler topup expiry aktif (setiap jam, berdasarkan expiresAt sesudah rekonsiliasi)");
  logger.info("Scheduler cek target reseller aktif (cek setiap jam, eksekusi tanggal 1 jam 07.00 WIB)");
  logger.info("Scheduler auto-disable server penuh aktif (interval: 5 menit)");
  logger.info("Scheduler auto-cleanup akun hantu aktif (cek setiap 3 jam)");
  logger.info("Scheduler cleanup wa_verifications expired aktif (cek setiap 6 jam)");
  logger.info("Scheduler low margin alert aktif (cek setiap jam, kirim jam 08.00 WIB)");
  logger.info("Scheduler proactive alerts aktif (interval: 15 menit)");
  logger.info("Scheduler stuck orders health check aktif (interval: 1 jam)");
  logger.info("Scheduler laporan harian aktif (cek setiap jam, kirim jam 08.00 WIB)");

  // Auto-backup: cek setiap jam apakah sudah waktunya backup
  import("./backup").then(({ isBackupDue, performBackup }) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [30_000, 120_000, 300_000]; // 30s, 2min, 5min

    const runBackupWithRetry = async (attempt = 1): Promise<void> => {
      try {
        logger.info(`Auto-backup terjadwal dimulai... (attempt ${attempt}/${MAX_RETRIES})`);
        await performBackup();
        logger.info("Auto-backup berhasil.");
      } catch (err) {
        logger.error({ err }, `Auto-backup gagal (attempt ${attempt}/${MAX_RETRIES})`);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1] ?? 300_000;
          logger.info(`Retry auto-backup dalam ${delay / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return runBackupWithRetry(attempt + 1);
        }
        // Semua retry gagal — kirim alert ke Telegram
        logger.error("Auto-backup gagal setelah semua retry. Mengirim alert ke admin...");
        try {
          const errMsg = err instanceof Error ? err.message : String(err);
          await sendMessage(
            `⚠️ *AUTO-BACKUP GAGAL*\n\n` +
            `Backup otomatis gagal setelah ${MAX_RETRIES}x percobaan.\n` +
            `Error terakhir: \`${errMsg.substring(0, 200)}\`\n\n` +
            `Segera cek server dan jalankan backup manual.`,
            { parse_mode: "Markdown" }
          );
        } catch (alertErr) {
          logger.error({ alertErr }, "Gagal mengirim alert backup failure ke Telegram");
        }
      }
    };

    const runBackupIfDue = async () => {
      runSafely("runBackupIfDue", async () => {
        const due = await isBackupDue();
        if (due) {
          await runBackupWithRetry();
        }
      });
    };

    // Cek pertama kali 1 menit setelah start
    setTimeout(() => runBackupIfDue(), 60 * 1000);

    // Lalu cek setiap jam
    setInterval(() => runBackupIfDue(), ONE_HOUR);

    logger.info("Scheduler auto-backup aktif (cek setiap jam)");
  }).catch((err) => {
    logger.error({ err }, "Failed to load backup module for scheduler");
  });
}

// ─── Laporan Harian Otomatis ─────────────────────────────────────────────────

let lastDailyReportDate = "";

async function sendDailyReport(): Promise<void> {
  try {
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hourWIB = nowWIB.getUTCHours();

    // Kirim jam 8 pagi WIB saja
    if (hourWIB !== 8) return;

    // Cegah kirim ganda di jam yang sama
    const todayKey = nowWIB.toISOString().slice(0, 10);
    if (lastDailyReportDate === todayKey) return;
    lastDailyReportDate = todayKey;

    const [adminChatRow] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "telegramAdminChatId"))
      .limit(1);
    const adminChatId = adminChatRow?.value;
    if (!adminChatId) return;

    // Hitung data kemarin
    const yesterday = new Date(nowWIB);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(nowWIB);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Revenue kemarin
    const [revRow] = await db
      .select({ total: sum(ordersTable.amount) })
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "paid"), gte(ordersTable.createdAt, yesterday), lt(ordersTable.createdAt, todayStart)));
    const revenue = Number(revRow?.total ?? 0);

    // User baru kemarin
    const [newUserRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(and(gte(usersTable.createdAt, yesterday), lt(usersTable.createdAt, todayStart)));
    const newUsers = newUserRow?.count ?? 0;

    // Total user
    const [totalUserRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const totalUsers = totalUserRow?.count ?? 0;

    // Akun VPN akan expired hari ini
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const [expTodayRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(and(eq(vpnAccountsTable.isActive, true), gte(vpnAccountsTable.expiresAt, todayStart), lt(vpnAccountsTable.expiresAt, todayEnd)));
    const expiringToday = expTodayRow?.count ?? 0;

    // Akun expired dalam 3 hari ke depan
    const threeDaysLater = new Date(todayStart);
    threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
    const [exp3Row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(and(eq(vpnAccountsTable.isActive, true), gte(vpnAccountsTable.expiresAt, todayStart), lt(vpnAccountsTable.expiresAt, threeDaysLater)));
    const expiring3Days = exp3Row?.count ?? 0;

    // Topup pending
    const [pendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(topupsTable)
      .where(eq(topupsTable.status, "pending"));
    const pendingTopups = pendingRow?.count ?? 0;

    // Total akun VPN aktif
    const [activeVpnRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(eq(vpnAccountsTable.isActive, true));
    const activeVpn = activeVpnRow?.count ?? 0;

    const tanggal = nowWIB.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

    let text = `📋 <b>Laporan Harian KETANTECH VPN</b>\n`;
    text += `📅 ${tanggal}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    text += `💰 <b>Revenue Kemarin:</b> <b>${fmtRp(revenue)}</b>\n`;
    text += `👥 <b>User Baru Kemarin:</b> ${newUsers}\n`;
    text += `👤 <b>Total User:</b> ${totalUsers}\n\n`;

    text += `🔌 <b>Akun VPN Aktif:</b> ${activeVpn}\n`;
    text += `⚠️ <b>Expired Hari Ini:</b> ${expiringToday}\n`;
    text += `📆 <b>Expired 3 Hari Ke Depan:</b> ${expiring3Days}\n\n`;

    if (pendingTopups > 0) {
      text += `💸 <b>Topup Pending:</b> ${pendingTopups} ⚠️\n\n`;
    }

    text += `<i>Selamat pagi, semoga harinya produktif! 💪</i>`;

    await sendMessage(adminChatId, text);
    logger.info("Laporan harian terkirim ke admin");
  } catch (err) {
    logger.error({ err }, "Error saat mengirim laporan harian");
  }
}

// ─── Low Margin Alert (Harian) ───────────────────────────────────────────────

let lastMarginCheckDate = "";
const LOW_MARGIN_THRESHOLD = 10; // persen

async function checkLowMarginServers(): Promise<void> {
  try {
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hourWIB = nowWIB.getUTCHours();

    // Cek hanya jam 8 pagi WIB (bareng daily report)
    if (hourWIB !== 8) return;

    const todayKey = nowWIB.toISOString().slice(0, 10);
    if (lastMarginCheckDate === todayKey) return;
    lastMarginCheckDate = todayKey;

    // Hitung profit bulan ini
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const orders = await db
      .select({
        dynamicServerId: dynamicVpnOrdersTable.dynamicServerId,
        amount: dynamicVpnOrdersTable.amount,
        durationType: dynamicVpnOrdersTable.durationType,
        duration: dynamicVpnOrdersTable.duration,
        serverDisplayName: dynamicVpnOrdersTable.serverDisplayName,
        provider: dynamicVpnOrdersTable.provider,
      })
      .from(dynamicVpnOrdersTable)
      .where(
        and(
          eq(dynamicVpnOrdersTable.status, "paid"),
          gte(dynamicVpnOrdersTable.createdAt, monthStart),
          lt(dynamicVpnOrdersTable.createdAt, monthEnd)
        )
      );

    if (orders.length === 0) return;

    const allServers = await db.select().from(dynamicProviderServersTable);
    const serverMap = new Map(allServers.map((s) => [s.id, s]));

    // Aggregate per server
    const statsMap = new Map<number, { serverName: string; provider: string; revenue: number; cost: number; orders: number }>();

    for (const order of orders) {
      const revenue = Number(order.amount ?? 0);
      const server = order.dynamicServerId ? serverMap.get(order.dynamicServerId) : null;
      const cost = server ? getDynamicCost(server, order.durationType) * order.duration : 0;

      const key = order.dynamicServerId ?? 0;
      const existing = statsMap.get(key);
      if (existing) {
        existing.revenue += revenue;
        existing.cost += cost;
        existing.orders++;
      } else {
        statsMap.set(key, {
          serverName: order.serverDisplayName ?? server?.displayName ?? "Unknown",
          provider: order.provider ?? "unknown",
          revenue,
          cost,
          orders: 1,
        });
      }
    }

    // Filter server dengan margin rendah
    const lowMarginServers = Array.from(statsMap.values())
      .map((s) => {
        const profit = s.revenue - s.cost;
        const marginPercent = s.revenue > 0 ? Math.round((profit / s.revenue) * 100) : 0;
        return { ...s, profit, marginPercent };
      })
      .filter((s) => s.marginPercent < LOW_MARGIN_THRESHOLD && s.orders >= 1);

    if (lowMarginServers.length > 0) {
      await notifyAdminLowMarginServers(lowMarginServers, LOW_MARGIN_THRESHOLD);
      logger.info({ count: lowMarginServers.length }, "Low margin alert sent to admin");
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek low margin servers");
  }
}

// ─── Proactive Alert Monitoring ──────────────────────────────────────────────

import os from "os";
import { exec as execCb } from "child_process";
import { checkPanelHealth } from "./vpn-panel";

// Cooldown: jangan spam alert yang sama berulang kali
const alertCooldowns = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit cooldown per alert

function shouldAlert(key: string): boolean {
  const last = alertCooldowns.get(key);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false;
  alertCooldowns.set(key, Date.now());
  return true;
}

async function getAdminChatIdForAlert(): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "telegramAdminChatId"))
    .limit(1);
  return row?.value ?? null;
}

async function runProactiveAlerts(): Promise<void> {
  try {
    const adminChatId = await getAdminChatIdForAlert();
    if (!adminChatId) return;

    const alerts: string[] = [];

    // 1. Cek RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    if (memPercent >= 90 && shouldAlert("ram_critical")) {
      alerts.push(`🔴 <b>RAM KRITIS: ${memPercent}%</b> terpakai!\nFree: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`);
    } else if (memPercent >= 80 && shouldAlert("ram_warning")) {
      alerts.push(`🟡 <b>RAM Warning: ${memPercent}%</b> terpakai`);
    }

    // 2. Cek CPU
    const cpuCount = os.cpus().length;
    const load1m = os.loadavg()[0];
    const cpuPercent = Math.min(100, Math.round((load1m / cpuCount) * 100));
    if (cpuPercent >= 90 && shouldAlert("cpu_critical")) {
      alerts.push(`🔴 <b>CPU KRITIS: Load ${load1m.toFixed(2)}</b> (${cpuPercent}% dari ${cpuCount} core)`);
    }

    // 3. Cek Disk
    try {
      const diskPercent = await new Promise<number | null>((resolve) => {
        execCb("df / | tail -1 | awk '{print $5}'", { timeout: 5000 }, (err, stdout) => {
          if (err) { resolve(null); return; }
          const p = parseInt(stdout.trim().replace("%", ""), 10);
          resolve(isNaN(p) ? null : p);
        });
      });
      if (diskPercent !== null && diskPercent >= 90 && shouldAlert("disk_critical")) {
        alerts.push(`🔴 <b>DISK KRITIS: ${diskPercent}%</b> terpakai!\nSegera bersihkan log/backup lama.`);
      } else if (diskPercent !== null && diskPercent >= 80 && shouldAlert("disk_warning")) {
        alerts.push(`🟡 <b>Disk Warning: ${diskPercent}%</b> terpakai`);
      }
    } catch { /* skip disk check */ }

    // 4. Cek Fonnte (WhatsApp)
    try {
      const [tokenRow] = await db
        .select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, "fonnteToken"))
        .limit(1);
      const fonnteToken = tokenRow?.value;
      if (fonnteToken) {
        const resp = await fetch("https://api.fonnte.com/device", {
          method: "POST",
          headers: { Authorization: fonnteToken },
        });
        const data = await resp.json() as { status?: boolean; device_status?: string };
        if (data.device_status === "disconnect" && shouldAlert("fonnte_disconnect")) {
          alerts.push(`🔴 <b>WhatsApp (Fonnte) TERPUTUS!</b>\nDevice tidak terhubung. Segera login ulang di dashboard Fonnte.`);
        }
      }
    } catch { /* skip fonnte check */ }

    // 5. Cek VPN Panel
    try {
      const servers = await db.select().from(serversTable).where(eq(serversTable.isActive, true));
      for (const server of servers) {
        if (!server.apiUrl || !server.apiToken) continue;
        const health = await checkPanelHealth({ apiUrl: server.apiUrl, apiToken: server.apiToken });
        if (!health.online && shouldAlert(`panel_down_${server.id}`)) {
          alerts.push(`🔴 <b>VPN Panel "${server.name}" DOWN!</b>\nTidak dapat terhubung ke panel server.`);
        }
      }
    } catch { /* skip panel check */ }

    // Kirim alert jika ada
    if (alerts.length > 0) {
      let text = `🚨 <b>ALERT — KETANTECH VPN</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
      text += alerts.join("\n\n");
      const now = new Date().toLocaleString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
      });
      text += `\n\n🕐 ${now} WIB`;
      await sendMessage(adminChatId, text);
      logger.info({ alertCount: alerts.length }, "Proactive alerts sent to admin");
    }
  } catch (err) {
    logger.error({ err }, "Error saat proactive alert monitoring");
  }
}

// ─── Stuck Order Health Check ────────────────────────────────────────────────

/**
 * Health check untuk order yang stuck pending terlalu lama (> 1 jam).
 * Alert ke admin jika ada anomali.
 */
const STUCK_ORDER_THRESHOLD_HOURS = 1;

async function checkStuckOrders(): Promise<void> {
  try {
    const adminChatId = await getAdminChatIdForAlert();
    if (!adminChatId) return;

    const threshold = new Date(Date.now() - STUCK_ORDER_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Cari order pending yang sudah > 1 jam
    const stuckOrders = await db
      .select({
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        createdAt: ordersTable.createdAt,
        expiresAt: ordersTable.expiresAt,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "pending"),
          lt(ordersTable.createdAt, threshold)
        )
      );

    if (stuckOrders.length === 0) return;

    // Group by payment method untuk insight
    const byMethod: Record<string, number> = {};
    let nullExpiresCount = 0;

    for (const order of stuckOrders) {
      const method = order.paymentMethod ?? "unknown";
      byMethod[method] = (byMethod[method] ?? 0) + 1;
      if (order.expiresAt === null) nullExpiresCount++;
    }

    // Alert dengan cooldown 1 jam
    if (!shouldAlert("stuck_orders")) return;

    const lines = [
      `⚠️ <b>ORDER PENDING TERLALU LAMA</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `Ditemukan <b>${stuckOrders.length} order</b> pending > ${STUCK_ORDER_THRESHOLD_HOURS} jam:`,
    ];

    for (const [method, count] of Object.entries(byMethod)) {
      lines.push(`  • ${method}: ${count} order`);
    }

    if (nullExpiresCount > 0) {
      lines.push(``);
      lines.push(`🔴 <b>${nullExpiresCount} order tanpa expiresAt</b> (indikasi bug)`);
    }

    lines.push(``);
    lines.push(`Cek dashboard admin → Orders untuk detail.`);
    lines.push(``);
    lines.push(`🕐 ${new Date().toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`);

    await sendMessage(adminChatId, lines.join("\n"));
    logger.info({ count: stuckOrders.length, byMethod, nullExpiresCount }, "Stuck orders alert sent to admin");
  } catch (err) {
    logger.error({ err }, "Error saat check stuck orders");
  }
}

export { getReferralBonusAmount };

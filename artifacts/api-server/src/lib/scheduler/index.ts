import { logger } from "../logger";
import { sendMessage } from "../telegram";
import { syncNadiaVpnServersFromProvider } from "../dynamic-order/sync";
import {
  reconcileAutoGoPayGoPay,
  reconcileBeforePaymentExpiry,
  reconcileShopeePayTransactions,
  retryPaidOrderFulfillment,
} from "../payment/reconciliation";

import { runSafely, getAdminChatIdForAlert } from "./helpers";
import { checkExpiringAccounts } from "./notifications";
import { cancelExpiredQrisOrders, cancelExpiredTopups } from "./payments";
import { checkResellerTargets } from "./reseller";
import { checkAndAutoDisableServers } from "./servers";
import { cleanupGhostAccounts, cleanupExpiredWaVerifications } from "./cleanup";
import { sendDailyReport, checkLowMarginServers } from "./reports";
import { runProactiveAlerts, checkStuckOrders } from "./alerts";

// Re-export public API used by other modules
export { getReferralBonusAmount, getReferralSettings } from "./settings";
export { checkExpiringAccounts } from "./notifications";

export function startScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const ONE_MIN = 60 * 1000;
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
  }, ONE_MIN);

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

  // Sync NadiaVPN server capacity setiap 2 menit
  setInterval(() => {
    runSafely("syncNadiaVpnServers", async () => { await syncNadiaVpnServersFromProvider(); });
  }, TWO_MIN);

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

  setTimeout(() => runSafely("initial-syncNadiaVpnServers", async () => { await syncNadiaVpnServersFromProvider(); }), 30 * 1000);
  setInterval(() => {
    runSafely("syncNadiaVpnServers", async () => { await syncNadiaVpnServersFromProvider(); });
  }, FIFTEEN_MIN);

  // Stuck orders health check setiap 1 jam
  runSafely("initial-checkStuckOrders", checkStuckOrders);
  setInterval(() => {
    runSafely("checkStuckOrders", checkStuckOrders);
  }, ONE_HOUR);

  logger.info("Scheduler notifikasi kedaluwarsa aktif (cek setiap jam, kirim sesuai jam WIB yang dikonfigurasi)");
  logger.info("Scheduler rekonsiliasi ShopeePay aktif (1 batch setiap 1 menit)");
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
  import("../backup").then(({ isBackupDue, performBackup }) => {
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
          const adminChatId = await getAdminChatIdForAlert();
          if (adminChatId) {
            await sendMessage(
              adminChatId,
              `⚠️ *AUTO-BACKUP GAGAL*\n\n` +
              `Backup otomatis gagal setelah ${MAX_RETRIES}x percobaan.\n` +
              `Error terakhir: \`${errMsg.substring(0, 200)}\`\n\n` +
              `Segera cek server dan jalankan backup manual.`,
              { parse_mode: "Markdown" }
            );
          }
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

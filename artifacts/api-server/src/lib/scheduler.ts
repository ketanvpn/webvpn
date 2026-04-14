import { db } from "@workspace/db";
import { vpnAccountsTable, usersTable, settingsTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";
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
}> {
  const allRows = await db.select().from(settingsTable);
  const map = Object.fromEntries(allRows.map((r) => [r.key, r.value]));
  const parse = (v: string | null | undefined, def = true) =>
    v === undefined || v === null ? def : v === "true";

  return {
    enabled: parse(map["expiryNotifEnabled"], true),
    notif3Days: parse(map["expiryNotif3DaysEnabled"], true),
    notif1Day: parse(map["expiryNotif1DayEnabled"], true),
  };
}

export async function checkExpiringAccounts(): Promise<void> {
  try {
    const cfg = await getExpiryNotifSettings();
    if (!cfg.enabled) {
      logger.info("Notifikasi kedaluwarsa dinonaktifkan, skip");
      return;
    }
    if (cfg.notif3Days) await notifyExpiring(3);
    if (cfg.notif1Day) await notifyExpiring(1);
  } catch (err) {
    logger.error({ err }, "Error saat cek akun VPN kedaluwarsa");
  }
}

export function startScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;

  checkExpiringAccounts().catch(() => {});

  setInterval(() => {
    checkExpiringAccounts().catch(() => {});
  }, 6 * ONE_HOUR);

  logger.info("Scheduler notifikasi kedaluwarsa aktif (interval: 6 jam)");

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

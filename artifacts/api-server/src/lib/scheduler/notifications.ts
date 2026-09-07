import { db } from "@workspace/db";
import { vpnAccountsTable, usersTable } from "@workspace/db";
import { eq, and, lte, gte } from "drizzle-orm";
import { logger } from "../logger";
import { sendWhatsapp } from "../fonnte";
import { sendMessage } from "../telegram";
import { formatTanggal } from "./helpers";
import { getExpiryNotifSettings } from "./settings";

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
      sendWhatsapp(acc.userWhatsapp, waMsg).catch((err) =>
        logger.error({ err, userId: acc.userId }, "Failed to send expiry WhatsApp notification")
      );
    }
    if (acc.userTelegramId) {
      sendMessage(acc.userTelegramId, tgMsg).catch((err) =>
        logger.error({ err, userId: acc.userId }, "Failed to send expiry Telegram notification")
      );
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

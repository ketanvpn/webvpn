import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getResellerSettings } from "../routes/settings";
import { sendMessage } from "./telegram";
import { sendWhatsapp } from "./fonnte";
import { getSettingValue } from "../routes/settings";
import { logger } from "./logger";

/**
 * Cek apakah user layak di-upgrade otomatis jadi reseller
 * setelah topup dikonfirmasi. Dipanggil dari webhook dan admin confirm.
 */
export async function tryAutoUpgradeReseller(
  userId: number,
  topupAmount: number,
): Promise<void> {
  try {
    const settings = await getResellerSettings();

    if (!settings.resellerAutoUpgradeEnabled) return;
    if (topupAmount < settings.resellerAutoUpgradeMinTopup) return;

    // Ambil data user
    const [user] = await db
      .select({ id: usersTable.id, role: usersTable.role, username: usersTable.username, whatsapp: usersTable.whatsapp, telegramId: usersTable.telegramId })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user || user.role !== "user") return;

    // Upgrade role ke reseller
    await db
      .update(usersTable)
      .set({ role: "reseller", updatedAt: new Date() })
      .where(eq(usersTable.id, userId));

    logger.info({ userId, topupAmount }, "Auto-upgrade: user upgraded to reseller");

    const formatRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

    // ── Notifikasi ke user via WhatsApp ────────────────────────────────
    if (user.whatsapp) {
      const msg = `🎉 Selamat, ${user.username}!\n\nAkun kamu telah otomatis diupgrade menjadi *Reseller KETANTECH VPN* karena topup sebesar ${formatRp(topupAmount)}.\n\nKamu sekarang mendapat harga spesial *${settings.resellerDiscountPercent}% lebih murah* untuk semua produk.\n\nLogin ke panel untuk melihat harga reseller kamu. Semangat berjualan! 💪`;
      sendWhatsapp(user.whatsapp, msg).catch(() => {});
    }

    // ── Notifikasi ke user via Telegram ───────────────────────────────
    if (user.telegramId) {
      const msg = `🎉 *Selamat, ${user.username}!*\n\nAkun kamu telah otomatis diupgrade menjadi *Reseller KETANTECH VPN* karena topup sebesar ${formatRp(topupAmount)}.\n\nKamu sekarang mendapat harga spesial *${settings.resellerDiscountPercent}% lebih murah* untuk semua produk.\n\nLogin ke panel untuk melihat harga reseller kamu. Semangat berjualan! 💪`;
      sendMessage(user.telegramId, msg, { parse_mode: "Markdown" }).catch(() => {});
    }

    // ── Notifikasi ke admin via Telegram ──────────────────────────────
    const adminChatId = await getSettingValue("telegramAdminChatId");
    if (adminChatId) {
      const wa = user.whatsapp ? `\nWA: ${user.whatsapp}` : "";
      const adminMsg = `⬆️ *Auto-Upgrade Reseller*\n\nUser *${user.username}* (ID: ${userId}) otomatis jadi reseller setelah topup ${formatRp(topupAmount)}.${wa}`;
      sendMessage(adminChatId, adminMsg, { parse_mode: "Markdown" }).catch(() => {});
    }
  } catch (err) {
    logger.error({ err, userId, topupAmount }, "tryAutoUpgradeReseller error");
  }
}

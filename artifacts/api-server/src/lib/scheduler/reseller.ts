import { db } from "@workspace/db";
import { usersTable, settingsTable, ordersTable } from "@workspace/db";
import { dynamicVpnOrdersTable as dynamicOrders } from "@workspace/db/schema";
import { eq, and, gte, lt, sum } from "drizzle-orm";
import { logger } from "../logger";
import { sendWhatsapp } from "../fonnte";
import { sendMessage } from "../telegram";

export async function checkResellerTargets(): Promise<void> {
  try {
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dateWib = nowWib.getUTCDate();
    const hourWib = nowWib.getUTCHours();

    if (dateWib !== 1 || hourWib !== 7) return;

    const [enabledRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerTargetEnabled")).limit(1);
    if (enabledRow?.value !== "true") return;

    const [targetRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerMonthlyTarget")).limit(1);
    const target = targetRow?.value ? parseInt(targetRow.value, 10) : 500000;

    // Note: target is compared against NET sales (amount after reseller discount).
    // This is intentional — we measure actual revenue generated, not gross price.
    
    // Use WIB-consistent date for month boundary calculation
    const nowWibForMonth = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const prevMonthStart = new Date(nowWibForMonth.getUTCFullYear(), nowWibForMonth.getUTCMonth() - 1, 1);
    const prevMonthEnd = new Date(nowWibForMonth.getUTCFullYear(), nowWibForMonth.getUTCMonth(), 1);

    const resellers = await db.select({ id: usersTable.id, username: usersTable.username, whatsapp: usersTable.whatsapp, telegramId: usersTable.telegramId }).from(usersTable).where(eq(usersTable.role, "reseller"));

    for (const reseller of resellers) {
      // Hitung penjualan dari orders reguler
      const [regularResult] = await db
        .select({ total: sum(ordersTable.amount) })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.userId, reseller.id),
          eq(ordersTable.status, "paid"),
          gte(ordersTable.createdAt, prevMonthStart),
          lt(ordersTable.createdAt, prevMonthEnd),
        ));

      // Hitung penjualan dari dynamic VPN orders
      const [dynamicResult] = await db
        .select({ total: sum(dynamicOrders.amount) })
        .from(dynamicOrders)
        .where(and(
          eq(dynamicOrders.userId, reseller.id),
          eq(dynamicOrders.status, "paid"),
          gte(dynamicOrders.createdAt, prevMonthStart),
          lt(dynamicOrders.createdAt, prevMonthEnd),
        ));

      const regularSales = Number(regularResult?.total ?? 0);
      const dynamicSales = Number(dynamicResult?.total ?? 0);
      const totalSales = regularSales + dynamicSales;

      if (totalSales < target) {
        await db.update(usersTable).set({ role: "user" }).where(eq(usersTable.id, reseller.id));
        logger.info({ resellerId: reseller.id, regularSales, dynamicSales, totalSales, target }, "Reseller didowngrade karena tidak capai target bulanan");

        const msg = `⚠️ *Status Reseller Dinonaktifkan*\\n\\nHai *${reseller.username}*, status reseller kamu bulan ini telah dinonaktifkan karena total penjualan (Rp ${totalSales.toLocaleString("id-ID")}) belum mencapai target minimum (Rp ${target.toLocaleString("id-ID")}).\\n\\nHubungi admin untuk mengaktifkan kembali.`;

        if (reseller.whatsapp) {
          sendWhatsapp(reseller.whatsapp, msg).catch((err) =>
            logger.error({ err, resellerId: reseller.id }, "Failed to send reseller downgrade WhatsApp notification")
          );
        }
        if (reseller.telegramId) {
          sendMessage(String(reseller.telegramId), msg).catch((err) =>
            logger.error({ err, resellerId: reseller.id }, "Failed to send reseller downgrade Telegram notification")
          );
        }

        // Notify admin about downgrade
        const [adminChatRow] = await db
          .select({ value: settingsTable.value })
          .from(settingsTable)
          .where(eq(settingsTable.key, "telegramAdminChatId"))
          .limit(1);
        
        if (adminChatRow?.value) {
          const adminMsg = `⬇️ *Reseller Downgrade*\n\nUser *${reseller.username}* (ID: ${reseller.id}) otomatis di-downgrade dari reseller ke user biasa.\n\nPenjualan: Rp ${totalSales.toLocaleString("id-ID")}\nTarget: Rp ${target.toLocaleString("id-ID")}\nKurang: Rp ${(target - totalSales).toLocaleString("id-ID")}`;
          sendMessage(adminChatRow.value, adminMsg, { parse_mode: "Markdown" }).catch((err) =>
            logger.error({ err, resellerId: reseller.id }, "Failed to send reseller downgrade admin notification")
          );
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek target reseller bulanan");
  }
}

import { db } from "@workspace/db";
import { usersTable, ordersTable, vpnAccountsTable, topupsTable, settingsTable, dynamicVpnOrdersTable, dynamicProviderServersTable } from "@workspace/db";
import { eq, and, gte, lt, sql, sum } from "drizzle-orm";
import { logger } from "../logger";
import { sendMessage } from "../telegram";
import { notifyAdminLowMarginServers } from "../telegram";
import { getDynamicCost } from "../dynamic-duration";
import { getSchedulerFlag, setSchedulerFlag } from "./helpers";

// ─── Laporan Harian Otomatis ─────────────────────────────────────────────────

export async function sendDailyReport(): Promise<void> {
  try {
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hourWIB = nowWIB.getUTCHours();

    if (hourWIB !== 8) return;

    const todayKey = nowWIB.toISOString().slice(0, 10);
    const lastSent = await getSchedulerFlag("lastDailyReportDate");
    if (lastSent === todayKey) return;
    await setSchedulerFlag("lastDailyReportDate", todayKey);

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

const LOW_MARGIN_THRESHOLD = 10;

export async function checkLowMarginServers(): Promise<void> {
  try {
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hourWIB = nowWIB.getUTCHours();

    if (hourWIB !== 8) return;

    const todayKey = nowWIB.toISOString().slice(0, 10);
    const lastChecked = await getSchedulerFlag("lastMarginCheckDate");
    if (lastChecked === todayKey) return;
    await setSchedulerFlag("lastMarginCheckDate", todayKey);

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

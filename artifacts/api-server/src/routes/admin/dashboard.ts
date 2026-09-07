import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import {
  usersTable,
  productsTable,
  serversTable,
  ordersTable,
  vpnAccountsTable,
  topupsTable,
  adminAuditLogsTable,
  dynamicVpnOrdersTable,
} from "@workspace/db";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { formatProduct, getActiveCountMap } from "../products";
import { formatOrders } from "../../lib/fulfillment/format-order";
import { formatTopup } from "../balance";
import { formatFullServer } from "../servers";
import { formatUser } from "./helpers";

const router = Router();

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

router.get("/admin/dashboard", requireAdmin, asyncHandler(async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

  // Total orders: gabungkan regular + dynamic
  const [totalStaticOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);
  const [totalDynamicOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(dynamicVpnOrdersTable);
  const totalOrders = (totalStaticOrders?.count ?? 0) + (totalDynamicOrders?.count ?? 0);

  // Revenue: gabungkan regular + dynamic
  const staticRevenueResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "paid"));

  const dynamicRevenueResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.status, "paid"));

  const totalRevenue = Number(staticRevenueResult[0]?.total ?? 0) + Number(dynamicRevenueResult[0]?.total ?? 0);

  // Revenue hari ini
  const staticRevTodayResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "paid"), sql`created_at >= ${todayStart}`));

  const dynamicRevTodayResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.status, "paid"), sql`created_at >= ${todayStart}`));

  const revenueToday = Number(staticRevTodayResult[0]?.total ?? 0) + Number(dynamicRevTodayResult[0]?.total ?? 0);

  // Revenue bulan ini
  const staticRevMonthResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "paid"), sql`created_at >= ${monthStart}`));

  const dynamicRevMonthResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.status, "paid"), sql`created_at >= ${monthStart}`));

  const revenueThisMonth = Number(staticRevMonthResult[0]?.total ?? 0) + Number(dynamicRevMonthResult[0]?.total ?? 0);

  const [activeAccounts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.isActive, true), sql`expires_at > now()`));

  const [pendingTopups] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(topupsTable)
    .where(eq(topupsTable.status, "pending"));

  // Pending orders: gabungkan regular + dynamic
  const [pendingStaticOrders] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "pending"));

  const [pendingDynamicOrders] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.status, "pending"));

  const pendingOrders = (pendingStaticOrders?.count ?? 0) + (pendingDynamicOrders?.count ?? 0);

  const ordersByProtocol = await db
    .select({
      protocol: productsTable.protocol,
      count: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(eq(ordersTable.status, "paid"))
    .groupBy(productsTable.protocol);

  // Recent orders: gabungkan regular + dynamic
  const [recentStatic, recentDynamic] = await Promise.all([
    db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10),
    db.select().from(dynamicVpnOrdersTable).orderBy(desc(dynamicVpnOrdersTable.createdAt)).limit(10),
  ]);

  // Format dan merge recent orders
  const formattedStaticRecent = await formatOrders(recentStatic);
  const formattedDynamicRecent = recentDynamic.map((o) => ({
    id: o.id,
    userId: o.userId,
    productId: null,
    product: { name: `Dynamic VPN - ${o.serverDisplayName}` },
    status: o.status,
    amount: Number(o.amount),
    payableAmount: Number(o.amount),
    vpnAccountId: o.vpnAccountId,
    paymentMethod: o.paymentMethod,
    notes: o.username,
    qrisUrl: null,
    expiresAt: null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    isDynamic: true,
    dynamicProvider: o.provider,
    protocol: o.protocol,
    duration: o.duration,
    durationType: o.durationType,
    serverDisplayName: o.serverDisplayName,
  }));

  const mergedRecentOrders = [...formattedStaticRecent, ...formattedDynamicRecent]
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 10);

  const recentTopups = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      paymentProvider: topupsTable.paymentProvider,
      paymentChannel: topupsTable.paymentChannel,
      payableAmount: topupsTable.payableAmount,
      uniqueCode: topupsTable.uniqueCode,
      qrisUrl: topupsTable.qrisUrl,
      status: topupsTable.status,
      confirmedBy: topupsTable.confirmedBy,
      rejectionNote: topupsTable.rejectionNote,
      expiresAt: topupsTable.expiresAt,
      autogopayTransactionId: topupsTable.autogopayTransactionId,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .orderBy(desc(topupsTable.createdAt))
    .limit(10);

  const recentAuditLogs = await db
    .select({
      id: adminAuditLogsTable.id,
      adminUserId: adminAuditLogsTable.adminUserId,
      adminUsername: usersTable.username,
      action: adminAuditLogsTable.action,
      targetType: adminAuditLogsTable.targetType,
      targetId: adminAuditLogsTable.targetId,
      createdAt: adminAuditLogsTable.createdAt,
    })
    .from(adminAuditLogsTable)
    .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(5);

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    totalOrders,
    totalRevenue,
    activeAccounts: activeAccounts?.count ?? 0,
    pendingTopups: pendingTopups?.count ?? 0,
    pendingOrders,
    revenueToday,
    revenueThisMonth,
    ordersByProtocol,
    recentOrders: mergedRecentOrders,
    recentTopups: recentTopups.map((t) => formatTopup(t as typeof topupsTable.$inferSelect & { username?: string | null })),
    recentAuditLogs,
  });
}));

// ─── Admin: Revenue Chart ─────────────────────────────────────────────────────

router.get("/admin/stats/revenue-chart", requireAdmin, asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(String(req.query.days ?? "14"), 10), 30);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  // Ambil data dari kedua tabel: regular orders dan dynamic VPN orders
  const [staticRows, dynamicRows] = await Promise.all([
    db
      .select({
        date: sql<string>`date_trunc('day', created_at)::date::text`,
        revenue: sql<string>`coalesce(sum(amount), 0)`,
        orders: sql<number>`count(*)::int`,
      })
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "paid"), sql`created_at >= ${startDate}`))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`),
    db
      .select({
        date: sql<string>`date_trunc('day', created_at)::date::text`,
        revenue: sql<string>`coalesce(sum(amount), 0)`,
        orders: sql<number>`count(*)::int`,
      })
      .from(dynamicVpnOrdersTable)
      .where(and(eq(dynamicVpnOrdersTable.status, "paid"), sql`created_at >= ${startDate}`))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`),
  ]);

  // Gabungkan data per tanggal
  const dateMap = new Map<string, { revenue: number; orders: number }>();
  
  for (const row of staticRows) {
    const existing = dateMap.get(row.date) ?? { revenue: 0, orders: 0 };
    dateMap.set(row.date, {
      revenue: existing.revenue + Number(row.revenue),
      orders: existing.orders + row.orders,
    });
  }
  
  for (const row of dynamicRows) {
    const existing = dateMap.get(row.date) ?? { revenue: 0, orders: 0 };
    dateMap.set(row.date, {
      revenue: existing.revenue + Number(row.revenue),
      orders: existing.orders + row.orders,
    });
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const found = dateMap.get(dateStr);
    result.push({
      date: dateStr,
      revenue: found?.revenue ?? 0,
      orders: found?.orders ?? 0,
    });
  }

  res.json(result);
}));

export default router;

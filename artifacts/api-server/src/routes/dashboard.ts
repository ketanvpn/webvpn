import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, vpnAccountsTable, usersTable, topupsTable, dynamicVpnOrdersTable } from "@workspace/db";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { formatOrder } from "./orders";
import { formatAccount } from "./accounts";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [user] = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const pendingTopupResult = await db
    .select({ amount: topupsTable.amount })
    .from(topupsTable)
    .where(and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")));

  const pendingTopup = pendingTopupResult.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const activeAccountsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.userId, userId), eq(vpnAccountsTable.isActive, true), gt(vpnAccountsTable.expiresAt, now)));

  const [totalStaticResult, totalDynamicResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.userId, userId)),
  ]);

  const [recentStatic, recentDynamic] = await Promise.all([
    db.select().from(ordersTable).where(eq(ordersTable.userId, userId)).orderBy(desc(ordersTable.createdAt)).limit(5),
    db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.userId, userId)).orderBy(desc(dynamicVpnOrdersTable.createdAt)).limit(5),
  ]);

  const formattedStatic = await Promise.all(recentStatic.map(formatOrder));
  const formattedDynamic = recentDynamic.map((o: any) => ({
    id: o.id,
    userId: o.userId,
    productId: null as any,
    product: { name: `Order VPN Dynamic - ${o.serverDisplayName}` },
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

  const mergedRecent = [...formattedStatic, ...formattedDynamic]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const expiringAccounts = await db
    .select()
    .from(vpnAccountsTable)
    .where(
      and(
        eq(vpnAccountsTable.userId, userId),
        eq(vpnAccountsTable.isActive, true),
        gt(vpnAccountsTable.expiresAt, now),
        sql`${vpnAccountsTable.expiresAt} <= ${threeDaysFromNow}`
      )
    )
    .orderBy(vpnAccountsTable.expiresAt)
    .limit(5);

  const formattedExpiring = await Promise.all(expiringAccounts.map(formatAccount));

  res.json({
    balance: Number(user?.balance ?? 0),
    activeAccounts: activeAccountsResult[0]?.count ?? 0,
    totalOrders: (totalStaticResult[0]?.count ?? 0) + (totalDynamicResult[0]?.count ?? 0),
    pendingTopup,
    recentOrders: mergedRecent,
    expiringAccounts: formattedExpiring,
  });
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, vpnAccountsTable, usersTable, topupsTable } from "@workspace/db";
import { eq, and, gt, gte, desc, sql } from "drizzle-orm";
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

  const pendingTopup = pendingTopupResult.reduce((sum, t) => sum + Number(t.amount), 0);

  const activeAccountsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.userId, userId), eq(vpnAccountsTable.isActive, true), gt(vpnAccountsTable.expiresAt, now)));

  const totalOrdersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId));

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(5);

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

  const formattedOrders = await Promise.all(recentOrders.map(formatOrder));
  const formattedExpiring = await Promise.all(expiringAccounts.map(formatAccount));

  res.json({
    balance: Number(user?.balance ?? 0),
    activeAccounts: activeAccountsResult[0]?.count ?? 0,
    totalOrders: totalOrdersResult[0]?.count ?? 0,
    pendingTopup,
    recentOrders: formattedOrders,
    expiringAccounts: formattedExpiring,
  });
});

export default router;

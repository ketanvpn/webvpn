import { Router } from "express";
import { db } from "@workspace/db";
import { balanceLogsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";

const router = Router();

export function formatBalanceLog(log: typeof balanceLogsTable.$inferSelect & { username?: string | null }) {
  return {
    id: log.id,
    userId: log.userId,
    username: (log as { username?: string | null }).username ?? null,
    type: log.type,
    amount: Number(log.amount),
    balanceBefore: Number(log.balanceBefore),
    balanceAfter: Number(log.balanceAfter),
    description: log.description,
    relatedId: log.relatedId ?? null,
    createdAt: log.createdAt,
  };
}

export async function addBalanceLog(params: {
  userId: number;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  relatedId?: number | null;
}) {
  await db.insert(balanceLogsTable).values({
    userId: params.userId,
    type: params.type,
    amount: String(params.amount),
    balanceBefore: String(params.balanceBefore),
    balanceAfter: String(params.balanceAfter),
    description: params.description,
    relatedId: params.relatedId ?? null,
  });
}

router.get("/balance/logs", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const logs = await db
    .select()
    .from(balanceLogsTable)
    .where(eq(balanceLogsTable.userId, userId))
    .orderBy(desc(balanceLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(balanceLogsTable)
    .where(eq(balanceLogsTable.userId, userId));

  res.json({
    data: logs.map((l) => formatBalanceLog(l)),
    total: countResult.count,
    limit,
    offset,
  });
});

router.get("/admin/users/:id/balance-logs", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const logs = await db
    .select({
      id: balanceLogsTable.id,
      userId: balanceLogsTable.userId,
      username: usersTable.username,
      type: balanceLogsTable.type,
      amount: balanceLogsTable.amount,
      balanceBefore: balanceLogsTable.balanceBefore,
      balanceAfter: balanceLogsTable.balanceAfter,
      description: balanceLogsTable.description,
      relatedId: balanceLogsTable.relatedId,
      createdAt: balanceLogsTable.createdAt,
    })
    .from(balanceLogsTable)
    .leftJoin(usersTable, eq(balanceLogsTable.userId, usersTable.id))
    .where(eq(balanceLogsTable.userId, userId))
    .orderBy(desc(balanceLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(balanceLogsTable)
    .where(eq(balanceLogsTable.userId, userId));

  res.json({
    data: logs.map((l) => formatBalanceLog(l as typeof balanceLogsTable.$inferSelect & { username?: string | null })),
    total: countResult.count,
    limit,
    offset,
  });
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable } from "@workspace/db";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { formatOrder } from "../orders";
import { retiredRouteResponse } from "../../lib/retired-route";

const router = Router();

// ─── Admin: Orders ────────────────────────────────────────────────────────────

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const { status, userId, search } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (userId) conditions.push(eq(ordersTable.userId, parseInt(userId, 10)));
  if (search) conditions.push(ilike(usersTable.username, `%${search}%`));

  const rows = await db
    .select({
      order: ordersTable,
      user: {
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        balance: usersTable.balance,
        isActive: usersTable.isActive,
        referralCode: usersTable.referralCode,
        createdAt: usersTable.createdAt,
      },
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const formatted = await Promise.all(
    rows.map(async ({ order, user }) => {
      const base = await formatOrder(order);
      return {
        ...base,
        user: user
          ? {
              id: user.id,
              username: user.username,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              balance: Number(user.balance),
              isActive: user.isActive,
              referralCode: user.referralCode,
              createdAt: user.createdAt,
            }
          : null,
      };
    })
  );

  res.json({ orders: formatted, total: total?.count ?? 0 });
});

router.post("/admin/orders/:id/confirm", requireAdmin, (_req, res) => {
  const response = retiredRouteResponse("adminStaticOrderConfirmation");
  res.status(response.status).json(response);
});

router.delete("/admin/orders/:id", requireAdmin, (_req, res) => {
  const response = retiredRouteResponse("adminStaticOrderDeletion");
  res.status(response.status).json(response);
});

export default router;

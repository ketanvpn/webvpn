import { Router } from "express";
import { asyncHandler } from "../lib/async-handler";
import { db } from "@workspace/db";
import { ordersTable, dynamicVpnOrdersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createOrderLimiter } from "../lib/rate-limit";
import { retiredRouteResponse } from "../lib/retired-route";
import { formatOrder, formatOrders } from "../lib/fulfillment/format-order";
export { fulfillOrder } from "../lib/fulfillment/static-order-fulfillment";

const router = Router();

router.get("/orders", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const { status } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [eq(ordersTable.userId, userId)];
  if (status) conditions.push(eq(ordersTable.status, status));

  const dynamicConditions = [eq(dynamicVpnOrdersTable.userId, userId)];
  if (status) dynamicConditions.push(eq(dynamicVpnOrdersTable.status, status));

  const fetchCount = limit + offset;

  const [orders, dynamicOrders, staticTotalResult, dynamicTotalResult] = await Promise.all([
    db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(fetchCount),
    db.select().from(dynamicVpnOrdersTable).where(and(...dynamicConditions)).orderBy(desc(dynamicVpnOrdersTable.createdAt)).limit(fetchCount),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(and(...conditions)),
    db.select({ count: sql<number>`count(*)::int` }).from(dynamicVpnOrdersTable).where(and(...dynamicConditions)),
  ]);

  const formattedStatic = await formatOrders(orders);
  const formattedDynamic = dynamicOrders.map((order) => ({
    id: order.id,
    userId: order.userId,
    productId: null,
    product: { name: `Order VPN Dynamic - ${order.serverDisplayName}` },
    status: order.status,
    amount: Number(order.amount),
    vpnAccountId: order.vpnAccountId,
    paymentMethod: order.paymentMethod,
    notes: order.username,
    qrisUrl: null,
    expiresAt: null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    isDynamic: true,
    dynamicProvider: order.provider,
    protocol: order.protocol,
    duration: order.duration,
    durationType: order.durationType,
  }));

  const merged = [...formattedStatic, ...formattedDynamic]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(offset, offset + limit);

  res.json({
    orders: merged,
    total: (staticTotalResult[0]?.count ?? 0) + (dynamicTotalResult[0]?.count ?? 0),
  });
}));

router.post("/orders", requireAuth, createOrderLimiter, asyncHandler(async (_req, res) => {
  const response = retiredRouteResponse("staticOrder");
  res.status(response.status).json(response);
}));

router.get("/orders/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(await formatOrder(order));
}));

router.post("/orders/:id/pay", requireAuth, createOrderLimiter, asyncHandler(async (_req, res) => {
  const response = retiredRouteResponse("staticOrderPayment");
  res.status(response.status).json(response);
}));

export { formatOrder, formatOrders };
export default router;

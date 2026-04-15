import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable, vpnAccountsTable, serversTable } from "@workspace/db";
import { eq, and, asc, count, gt, inArray } from "drizzle-orm";
import { getResellerSettings } from "./settings";
import { optionalAuth } from "../lib/auth";

const router = Router();

export function formatProduct(
  p: typeof productsTable.$inferSelect,
  activeCount = 0,
  resellerDiscount = 0,
  serverName: string | null = null,
) {
  const price = Number(p.price);
  const resellerPrice = resellerDiscount > 0 ? Math.floor(price * (1 - resellerDiscount / 100)) : null;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    protocol: p.protocol,
    durationDays: p.durationDays,
    price,
    resellerPrice,
    quota: p.quota != null ? Number(p.quota) : null,
    maxConnections: p.maxConnections,
    stock: p.stock,
    availableStock: Math.max(0, p.stock - activeCount),
    isActive: p.isActive,
    category: p.category,
    sortOrder: p.sortOrder,
    serverId: p.serverId ?? null,
    serverName: serverName ?? null,
  };
}

async function getActiveCountMap(productIds: number[]): Promise<Map<number, number>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({ productId: ordersTable.productId, cnt: count(vpnAccountsTable.id) })
    .from(vpnAccountsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, vpnAccountsTable.orderId))
    .where(
      and(
        inArray(ordersTable.productId, productIds),
        gt(vpnAccountsTable.expiresAt, new Date())
      )
    )
    .groupBy(ordersTable.productId);
  return new Map(rows.map((r) => [r.productId, Number(r.cnt)]));
}

router.get("/products", optionalAuth, async (req, res) => {
  const { protocol, category } = req.query as Record<string, string | undefined>;
  const userRole = (req as any).user?.role ?? "user";

  const conditions = [eq(productsTable.isActive, true)];
  if (protocol) conditions.push(eq(productsTable.protocol, protocol));
  if (category) conditions.push(eq(productsTable.category, category));

  const rows = await db
    .select({ product: productsTable, serverName: serversTable.name })
    .from(productsTable)
    .leftJoin(serversTable, eq(productsTable.serverId, serversTable.id))
    .where(and(...conditions))
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.id));

  const products = rows.map((r) => r.product);
  const countMap = await getActiveCountMap(products.map((p) => p.id));
  let resellerDiscount = 0;
  if (userRole === "reseller") {
    const settings = await getResellerSettings();
    if (settings.resellerEnabled) resellerDiscount = settings.resellerDiscountPercent;
  }
  res.json(rows.map((r) => formatProduct(r.product, countMap.get(r.product.id) ?? 0, resellerDiscount, r.serverName ?? null)));
});

router.get("/products/:id", optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userRole = (req as any).user?.role ?? "user";

  const [row] = await db
    .select({ product: productsTable, serverName: serversTable.name })
    .from(productsTable)
    .leftJoin(serversTable, eq(productsTable.serverId, serversTable.id))
    .where(and(eq(productsTable.id, id), eq(productsTable.isActive, true)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const { product, serverName } = row;
  const countMap = await getActiveCountMap([product.id]);
  let resellerDiscount = 0;
  if (userRole === "reseller") {
    const settings = await getResellerSettings();
    if (settings.resellerEnabled) resellerDiscount = settings.resellerDiscountPercent;
  }
  res.json(formatProduct(product, countMap.get(product.id) ?? 0, resellerDiscount, serverName ?? null));
});

export { getActiveCountMap };
export default router;

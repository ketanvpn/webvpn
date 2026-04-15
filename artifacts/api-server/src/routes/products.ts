import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, ordersTable, vpnAccountsTable } from "@workspace/db";
import { eq, and, asc, count, gt, inArray } from "drizzle-orm";

const router = Router();

export function formatProduct(p: typeof productsTable.$inferSelect, activeCount = 0) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    protocol: p.protocol,
    durationDays: p.durationDays,
    price: Number(p.price),
    quota: p.quota != null ? Number(p.quota) : null,
    maxConnections: p.maxConnections,
    stock: p.stock,
    availableStock: Math.max(0, p.stock - activeCount),
    isActive: p.isActive,
    category: p.category,
    sortOrder: p.sortOrder,
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

router.get("/products", async (req, res) => {
  const { protocol, category } = req.query as Record<string, string | undefined>;

  const conditions = [eq(productsTable.isActive, true)];
  if (protocol) conditions.push(eq(productsTable.protocol, protocol));
  if (category) conditions.push(eq(productsTable.category, category));

  const products = await db
    .select()
    .from(productsTable)
    .where(and(...conditions))
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.id));

  const countMap = await getActiveCountMap(products.map((p) => p.id));
  res.json(products.map((p) => formatProduct(p, countMap.get(p.id) ?? 0)));
});

router.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, id), eq(productsTable.isActive, true)))
    .limit(1);

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const countMap = await getActiveCountMap([product.id]);
  res.json(formatProduct(product, countMap.get(product.id) ?? 0));
});

export { getActiveCountMap };
export default router;

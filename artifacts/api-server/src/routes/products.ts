import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

const router = Router();

function formatProduct(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    protocol: p.protocol,
    durationDays: p.durationDays,
    price: Number(p.price),
    quota: p.quota != null ? Number(p.quota) : null,
    maxConnections: p.maxConnections,
    isActive: p.isActive,
    category: p.category,
    sortOrder: p.sortOrder,
  };
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

  res.json(products.map(formatProduct));
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

  res.json(formatProduct(product));
});

export { formatProduct };
export default router;

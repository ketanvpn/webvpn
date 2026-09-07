/**
 * Order formatting utilities with batch product preloading.
 *
 * Fixes the N+1 query problem: instead of fetching one product per order,
 * `formatOrders()` collects all unique productIds and fetches them in a
 * single `WHERE id IN (...)` query.
 *
 * For single-order formatting (e.g. GET /orders/:id), `formatOrder()` is
 * still available — it uses a single DB query, same as before.
 */

import { db } from "@workspace/db";
import { ordersTable, productsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { formatProduct } from "../../routes/products";

type OrderRow = typeof ordersTable.$inferSelect;

interface FormattedOrder {
  id: number;
  userId: number;
  productId: number;
  product: ReturnType<typeof formatProduct> | null;
  status: string;
  amount: number;
  payableAmount: number;
  paymentProvider: string | null;
  paymentChannel: string | null;
  uniqueCode: number;
  vpnAccountId: number | null;
  paymentMethod: string | null;
  notes: string | null;
  qrisUrl: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

function buildFormattedOrder(
  o: OrderRow,
  product: ReturnType<typeof formatProduct> | null,
): FormattedOrder {
  return {
    id: o.id,
    userId: o.userId,
    productId: o.productId,
    product,
    status: o.status,
    amount: Number(o.amount),
    payableAmount: Number(o.payableAmount ?? o.amount),
    paymentProvider: o.paymentProvider ?? null,
    paymentChannel: o.paymentChannel ?? null,
    uniqueCode: o.uniqueCode ?? 0,
    vpnAccountId: o.vpnAccountId,
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    qrisUrl: o.qrisUrl ?? null,
    expiresAt: o.expiresAt ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Format a single order (fetches product individually).
 * Use `formatOrders()` for lists to avoid N+1 queries.
 */
export async function formatOrder(o: OrderRow): Promise<FormattedOrder> {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, o.productId))
    .limit(1);

  return buildFormattedOrder(o, product ? formatProduct(product) : null);
}

/**
 * Format multiple orders with a single batch product query.
 *
 * Collects all unique productIds, fetches them in one query, then maps
 * each order to its product. This replaces the N+1 pattern of calling
 * `formatOrder()` per order via `Promise.all(orders.map(formatOrder))`.
 */
export async function formatOrders(orders: OrderRow[]): Promise<FormattedOrder[]> {
  if (orders.length === 0) return [];

  // Collect unique product IDs
  const productIds = [...new Set(orders.map((o) => o.productId))];

  // Single batch query instead of N individual queries
  const products = await db
    .select()
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));

  // Build a lookup map: productId → formatted product
  const productMap = new Map(
    products.map((p) => [p.id, formatProduct(p)]),
  );

  return orders.map((o) =>
    buildFormattedOrder(o, productMap.get(o.productId) ?? null),
  );
}

import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import { productsTable, serversTable, vpnAccountsTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { formatProduct, getActiveCountMap } from "../products";
import { retiredRouteResponse } from "../../lib/retired-route";

const router = Router();

// ─── Admin: Products ──────────────────────────────────────────────────────────

router.get("/admin/products", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db
    .select({ product: productsTable, serverName: serversTable.name })
    .from(productsTable)
    .leftJoin(serversTable, eq(productsTable.serverId, serversTable.id))
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.id));
  const products = rows.map((r) => r.product);
  const countMap = await getActiveCountMap(products.map((p) => p.id));
  res.json(rows.map((r) => formatProduct(r.product, countMap.get(r.product.id) ?? 0, 0, r.serverName ?? null)));
}));

router.post("/admin/products", requireAdmin, asyncHandler(async (_req, res) => {
  const response = retiredRouteResponse("adminProductMutation");
  res.status(response.status).json(response);
}));

router.patch("/admin/products/:id", requireAdmin, asyncHandler(async (_req, res) => {
  const response = retiredRouteResponse("adminProductMutation");
  res.status(response.status).json(response);
}));

router.delete("/admin/products/:id", requireAdmin, asyncHandler(async (_req, res) => {
  const response = retiredRouteResponse("adminProductMutation");
  res.status(response.status).json(response);
}));

export default router;

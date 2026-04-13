import { Router } from "express";
import { db } from "@workspace/db";
import { topupsTable, ordersTable, usersTable, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsv).join(",");
}

router.get("/admin/export/topups", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      status: topupsTable.status,
      autogopayTransactionId: topupsTable.autogopayTransactionId,
      rejectionNote: topupsTable.rejectionNote,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .orderBy(desc(topupsTable.createdAt))
    .limit(10000);

  const header = toCsvRow(["ID", "User ID", "Username", "Nominal", "Status", "Ref AutoGoPay", "Catatan Tolak", "Dibuat", "Diperbarui"]);
  const lines = rows.map((r) =>
    toCsvRow([
      r.id,
      r.userId,
      r.username ?? "",
      Number(r.amount),
      r.status,
      r.autogopayTransactionId ?? "",
      r.rejectionNote ?? "",
      r.createdAt?.toISOString() ?? "",
      r.updatedAt?.toISOString() ?? "",
    ]),
  );

  const csv = [header, ...lines].join("\n");
  const filename = `topups_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
});

router.get("/admin/export/orders", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      username: usersTable.username,
      productId: ordersTable.productId,
      productName: productsTable.name,
      amount: ordersTable.amount,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      notes: ordersTable.notes,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .leftJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(10000);

  const header = toCsvRow([
    "ID", "User ID", "Username", "Product ID", "Produk", "Nominal",
    "Status", "Metode Bayar", "Catatan", "Dibuat", "Diperbarui",
  ]);
  const lines = rows.map((r) =>
    toCsvRow([
      r.id,
      r.userId,
      r.username ?? "",
      r.productId,
      r.productName ?? "",
      Number(r.amount),
      r.status,
      r.paymentMethod ?? "",
      r.notes ?? "",
      r.createdAt?.toISOString() ?? "",
      r.updatedAt?.toISOString() ?? "",
    ]),
  );

  const csv = [header, ...lines].join("\n");
  const filename = `orders_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv);
});

export default router;

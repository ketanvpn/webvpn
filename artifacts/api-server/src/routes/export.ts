import { Router } from "express";
import { db } from "@workspace/db";
import { topupsTable, ordersTable, usersTable, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { escapeCsvCell } from "../lib/payment/csv-policy";

const router = Router();

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvCell).join(",");
}

router.get("/admin/export/topups", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      paymentProvider: topupsTable.paymentProvider,
      paymentChannel: topupsTable.paymentChannel,
      payableAmount: topupsTable.payableAmount,
      uniqueCode: topupsTable.uniqueCode,
      status: topupsTable.status,
      paymentReference: topupsTable.autogopayTransactionId,
      rejectionNote: topupsTable.rejectionNote,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .orderBy(desc(topupsTable.createdAt))
    .limit(10000);

  const header = toCsvRow([
    "ID", "User ID", "Username", "Nominal Dasar", "Provider Pembayaran",
    "Channel Pembayaran", "Jumlah Dibayar", "Kode Unik", "Status",
    "Referensi Pembayaran", "Catatan Tolak", "Dibuat", "Diperbarui",
  ]);
  const lines = rows.map((r) =>
    toCsvRow([
      r.id,
      r.userId,
      r.username ?? "",
      Number(r.amount),
      r.paymentProvider ?? "",
      r.paymentChannel ?? "",
      Number(r.payableAmount ?? r.amount),
      r.uniqueCode ?? 0,
      r.status,
      r.paymentReference ?? "",
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
      paymentProvider: ordersTable.paymentProvider,
      paymentChannel: ordersTable.paymentChannel,
      payableAmount: ordersTable.payableAmount,
      uniqueCode: ordersTable.uniqueCode,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      paymentReference: ordersTable.autogopayTransactionId,
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
    "ID", "User ID", "Username", "Product ID", "Produk", "Nominal Dasar",
    "Provider Pembayaran", "Channel Pembayaran", "Jumlah Dibayar", "Kode Unik",
    "Status", "Metode Bayar", "Referensi Pembayaran", "Catatan", "Dibuat", "Diperbarui",
  ]);
  const lines = rows.map((r) =>
    toCsvRow([
      r.id,
      r.userId,
      r.username ?? "",
      r.productId,
      r.productName ?? "",
      Number(r.amount),
      r.paymentProvider ?? "",
      r.paymentChannel ?? "",
      Number(r.payableAmount ?? r.amount),
      r.uniqueCode ?? 0,
      r.status,
      r.paymentMethod ?? "",
      r.paymentReference ?? "",
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

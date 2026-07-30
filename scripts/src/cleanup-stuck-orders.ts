/**
 * Script untuk cleanup order QRIS yang stuck pending tanpa expiresAt
 * atau sudah melewati waktu pembayaran.
 * 
 * Jalankan dengan: node --import tsx scripts/src/cleanup-stuck-orders.ts
 * 
 * Atau di production: node dist/cleanup-stuck-orders.js
 */

import { db } from "@workspace/db";
import { ordersTable, paymentAttemptsTable } from "@workspace/db";
import { eq, and, lt, isNull, sql } from "drizzle-orm";

const DRY_RUN = process.env.DRY_RUN !== "false"; // Default true untuk keamanan
const EXPIRY_MINUTES = 30; // Order lebih dari 30 menit dianggap expired

async function cleanupStuckOrders() {
  console.log("=== Cleanup Stuck QRIS Orders ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (tidak ada perubahan)" : "LIVE (akan mengubah data)"}`);
  console.log(`Threshold: ${EXPIRY_MINUTES} menit`);
  console.log("");

  const now = new Date();
  const threshold = new Date(now.getTime() - EXPIRY_MINUTES * 60 * 1000);

  // Cari order QRIS pending yang bermasalah
  const stuckOrders = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      amount: ordersTable.amount,
      paymentMethod: ordersTable.paymentMethod,
      status: ordersTable.status,
      expiresAt: ordersTable.expiresAt,
      createdAt: ordersTable.createdAt,
    })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "pending"),
        eq(ordersTable.paymentMethod, "qris"),
        sql`(
          ${ordersTable.expiresAt} is null 
          or 
          ${ordersTable.expiresAt} < ${now}
        )`,
        lt(ordersTable.createdAt, threshold)
      )
    );

  console.log(`Ditemukan ${stuckOrders.length} order QRIS stuck pending.\n`);

  if (stuckOrders.length === 0) {
    console.log("Tidak ada order yang perlu di-cleanup. Selesai.");
    return;
  }

  // Tampilkan detail order
  console.log("Detail order yang akan di-expire:");
  console.log("-".repeat(80));
  
  let nullExpiresCount = 0;
  let expiredCount = 0;

  for (const order of stuckOrders) {
    const ageMinutes = Math.round((now.getTime() - order.createdAt.getTime()) / 60000);
    const expiresStatus = order.expiresAt === null ? "NULL (BUG)" : "EXPIRED";
    
    if (order.expiresAt === null) nullExpiresCount++;
    else expiredCount++;
    
    console.log(
      `Order #${order.id} | User: ${order.userId} | Rp ${order.amount} | ` +
      `Age: ${ageMinutes} menit | ExpiresAt: ${expiresStatus} | ` +
      `Created: ${order.createdAt.toISOString()}`
    );
  }

  console.log("-".repeat(80));
  console.log(`\nRingkasan:`);
  console.log(`  - Dengan expiresAt NULL (bug): ${nullExpiresCount}`);
  console.log(`  - Dengan expiresAt expired: ${expiredCount}`);
  console.log(`  - Total: ${stuckOrders.length}`);
  console.log("");

  if (DRY_RUN) {
    console.log("=== DRY RUN SELESAI ===");
    console.log("Tidak ada perubahan data. Untuk menjalankan cleanup secara nyata:");
    console.log("  DRY_RUN=false node --import tsx scripts/src/cleanup-stuck-orders.ts");
    return;
  }

  // Konfirmasi sebelum proceed
  console.log("Melakukan cleanup...");
  
  try {
    // Update order ke status expired
    const result = await db
      .update(ordersTable)
      .set({ 
        status: "expired", 
        expiresAt: sql`coalesce(${ordersTable.expiresAt}, ${now})`,
        updatedAt: now 
      })
      .where(
        and(
          eq(ordersTable.status, "pending"),
          eq(ordersTable.paymentMethod, "qris"),
          sql`(
            ${ordersTable.expiresAt} is null 
            or 
            ${ordersTable.expiresAt} < ${now}
          )`,
          lt(ordersTable.createdAt, threshold)
        )
      )
      .returning({ id: ordersTable.id });

    // Update payment attempts terkait
    await db
      .update(paymentAttemptsTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(paymentAttemptsTable.status, "pending"),
          sql`exists (
            select 1 from ${ordersTable}
            where ${ordersTable.id} = ${paymentAttemptsTable.orderId}
              and ${ordersTable.status} = 'expired'
          )`
        )
      );

    console.log(`\n✅ Berhasil meng-expire ${result.length} order.`);
    console.log("Cleanup selesai.");
    
  } catch (err) {
    console.error("\n❌ Error saat cleanup:", err);
    process.exit(1);
  }
}

// Jalankan
cleanupStuckOrders()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });

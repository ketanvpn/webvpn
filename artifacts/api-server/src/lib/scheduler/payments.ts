import { db } from "@workspace/db";
import { ordersTable, topupsTable, paymentAttemptsTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "../logger";
import {
  reconcileBeforePaymentExpiry,
} from "../payment/reconciliation";

/**
 * Reconcile providers first, then expire only genuinely unpaid QRIS orders.
 * Paid/processing attempts are explicitly excluded; late confirmed provider
 * payments can recover an expired order through settlement reconciliation.
 * 
 * Also handles orders with NULL expiresAt (legacy bug fix) - treated as expired
 * if created more than 30 minutes ago.
 */
export async function cancelExpiredQrisOrders(): Promise<void> {
  try {
    await reconcileBeforePaymentExpiry();
    const now = new Date();
    
    // Fallback untuk order dengan expiresAt NULL (legacy bug)
    // Jika order sudah lebih dari 30 menit dan masih pending tanpa expiresAt, expired
    const FALLBACK_EXPIRY_MINUTES = 30;
    const fallbackThreshold = new Date(now.getTime() - FALLBACK_EXPIRY_MINUTES * 60 * 1000);
    
    // Query: expired berdasarkan expiresAt ATAU (expiresAt NULL dan sudah > 30 menit)
    const result = await db
      .update(ordersTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(ordersTable.status, "pending"),
          eq(ordersTable.paymentMethod, "qris"),
          sql`(
            ${ordersTable.expiresAt} is not null and ${ordersTable.expiresAt} < ${now}
            or
            ${ordersTable.expiresAt} is null and ${ordersTable.createdAt} < ${fallbackThreshold}
          )`,
          sql`not exists (
            select 1 from ${paymentAttemptsTable}
            where ${paymentAttemptsTable.orderId} = ${ordersTable.id}
              and ${paymentAttemptsTable.status} in ('paid', 'processing', 'completed')
          )`,
        ),
      )
      .returning({ id: ordersTable.id, expiresAt: ordersTable.expiresAt, createdAt: ordersTable.createdAt });

    await db
      .update(paymentAttemptsTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(paymentAttemptsTable.status, "pending"),
          lt(paymentAttemptsTable.expiresAt, now),
          sql`exists (
            select 1 from ${ordersTable}
            where ${ordersTable.id} = ${paymentAttemptsTable.orderId}
              and ${ordersTable.status} = 'expired'
          )`,
        ),
      );

    if (result.length > 0) {
      const nullExpiresCount = result.filter((r) => r.expiresAt === null).length;
      logger.info({ 
        count: result.length,
        nullExpiresAt: nullExpiresCount,
        withExpiresAt: result.length - nullExpiresCount
      }, "Auto-expire: unpaid QRIS orders exceeded expiresAt (or NULL + fallback 30min)");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel order QRIS expired");
  }
}

/**
 * Expire topups using the provider/local expiresAt value. Records without an
 * expiry remain pending for manual handling rather than using an arbitrary 24h.
 */
export async function cancelExpiredTopups(): Promise<void> {
  try {
    await reconcileBeforePaymentExpiry();
    const now = new Date();
    const result = await db
      .update(topupsTable)
      .set({
        status: "rejected",
        rejectionNote: "Auto-cleanup: Melewati batas waktu pembayaran",
        updatedAt: now,
      })
      .where(
        and(
          eq(topupsTable.status, "pending"),
          lt(topupsTable.expiresAt, now),
          sql`not exists (
            select 1 from ${paymentAttemptsTable}
            where ${paymentAttemptsTable.topupId} = ${topupsTable.id}
              and ${paymentAttemptsTable.status} in ('paid', 'processing', 'completed')
          )`,
        ),
      )
      .returning({ id: topupsTable.id });

    await db
      .update(paymentAttemptsTable)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(paymentAttemptsTable.status, "pending"),
          lt(paymentAttemptsTable.expiresAt, now),
          sql`exists (
            select 1 from ${topupsTable}
            where ${topupsTable.id} = ${paymentAttemptsTable.topupId}
              and ${topupsTable.status} = 'rejected'
          )`,
        ),
      );

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-expire: unpaid topups exceeded expiresAt");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel topup expired");
  }
}

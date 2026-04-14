import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, topupsTable, ordersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getPaymentSettingsMap } from "./settings";
import { logger } from "../lib/logger";
import { fulfillOrder } from "./orders";

const router = Router();

router.post("/webhooks/autogopay", async (req, res) => {
  const rawBody: string = (req as any).rawBody ?? JSON.stringify(req.body);
  const signature = req.headers["x-signature"] as string | undefined;

  const settingsMap = await getPaymentSettingsMap();
  const apiKey = settingsMap["autoGopaySecretKey"];

  if (apiKey && signature) {
    const expectedSig = crypto
      .createHmac("sha256", apiKey)
      .update(rawBody)
      .digest("hex");
    if (signature !== expectedSig) {
      logger.warn("AutoGoPay webhook: invalid signature");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }
  }

  let body: { event?: string; transaction?: { id?: string; amount?: number; status?: string } };
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const { event, transaction } = body;

  if (event === "verification.challenge") {
    logger.info("AutoGoPay webhook: verification challenge accepted");
    res.json({ success: true });
    return;
  }

  if (event === "transaction.received" && transaction?.status === "settlement" && transaction?.id) {
    const transactionId = transaction.id;
    logger.info({ transactionId }, "AutoGoPay webhook: settlement received");

    // ─── 1. Check if this matches a topup ────────────────────────────────────
    const [topup] = await db
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.autogopayTransactionId, transactionId))
      .limit(1);

    if (topup) {
      if (topup.status !== "pending") {
        logger.info({ transactionId, status: topup.status }, "AutoGoPay webhook: topup already processed");
        res.json({ success: true });
        return;
      }

      await db
        .update(usersTable)
        .set({ balance: sql`balance + ${Number(topup.amount)}` })
        .where(eq(usersTable.id, topup.userId));

      await db
        .update(topupsTable)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(topupsTable.id, topup.id));

      logger.info({ topupId: topup.id, userId: topup.userId, amount: topup.amount }, "AutoGoPay: topup auto-confirmed");
      res.json({ success: true });
      return;
    }

    // ─── 2. Check if this matches a QRIS order ───────────────────────────────
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.autogopayTransactionId, transactionId))
      .limit(1);

    if (order) {
      if (order.status !== "pending") {
        logger.info({ transactionId, orderId: order.id, status: order.status }, "AutoGoPay webhook: order already processed");
        res.json({ success: true });
        return;
      }

      // Atomic lock: pending → processing (prevents double-processing)
      const [locked] = await db
        .update(ordersTable)
        .set({ status: "processing", updatedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.status, "pending")))
        .returning();

      if (!locked) {
        logger.warn({ transactionId, orderId: order.id }, "AutoGoPay webhook: order already being processed");
        res.json({ success: true });
        return;
      }

      try {
        await fulfillOrder(order.id, { deductBalance: false });
        logger.info({ orderId: order.id, transactionId }, "AutoGoPay webhook: order fulfilled via QRIS");
      } catch (err) {
        logger.error({ err, orderId: order.id }, "AutoGoPay webhook: fulfillOrder failed");
        // Release lock so admin can retry manually
        await db
          .update(ordersTable)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(ordersTable.id, order.id))
          .catch(() => {});
      }

      res.json({ success: true });
      return;
    }

    logger.warn({ transactionId }, "AutoGoPay webhook: no matching topup or order found");
  }

  res.json({ success: true });
});

export default router;

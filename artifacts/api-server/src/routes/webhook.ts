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
  const rawBody: string = (req as any).rawBody ?? "";
  const reserializedBody: string = JSON.stringify(req.body);
  const signature = req.headers["x-signature"] as string | undefined;

  const settingsMap = await getPaymentSettingsMap();
  const apiKey = settingsMap["autoGopaySecretKey"];

  if (apiKey && signature) {
    // Try both raw body (PHP docs) and re-serialized (Node.js docs) for compatibility
    const sigFromRaw = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
    const sigFromReserialized = crypto.createHmac("sha256", apiKey).update(reserializedBody).digest("hex");

    const validRaw = signature === sigFromRaw;
    const validReserialized = signature === sigFromReserialized;

    if (!validRaw && !validReserialized) {
      logger.warn({
        receivedSig: signature.substring(0, 16) + "...",
        expectedRaw: sigFromRaw.substring(0, 16) + "...",
        expectedReserialized: sigFromReserialized.substring(0, 16) + "...",
      }, "AutoGoPay webhook: invalid signature — periksa API Key di Admin > Payment Gateway");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    logger.info({ method: validRaw ? "rawBody" : "reserialized" }, "AutoGoPay webhook: signature valid");
  }

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(rawBody || reserializedBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  // Log full payload for diagnosis (masked amount only)
  logger.info({ webhookBody: body }, "AutoGoPay webhook: payload received");

  const event = body.event as string | undefined;
  const transaction = (body.transaction ?? body.data ?? body) as {
    id?: string;
    transaction_id?: string;
    amount?: number;
    status?: string;
  };

  if (event === "verification.challenge") {
    logger.info("AutoGoPay webhook: verification challenge accepted");
    res.json({ success: true });
    return;
  }

  // Support multiple event names and status values AutoGoPay might use
  const isPaidEvent =
    event === "transaction.received" ||
    event === "transaction.settlement" ||
    event === "payment.received" ||
    event === "payment.success" ||
    !event; // some gateways send no event field

  const isPaidStatus =
    transaction?.status === "settlement" ||
    transaction?.status === "paid" ||
    transaction?.status === "success" ||
    transaction?.status === "completed";

  const transactionId = transaction?.id ?? transaction?.transaction_id;

  if ((isPaidEvent || isPaidStatus) && transactionId) {
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

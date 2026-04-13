import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, topupsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getPaymentSettingsMap } from "./settings";
import { logger } from "../lib/logger";

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

    const [topup] = await db
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.autogopayTransactionId, transactionId))
      .limit(1);

    if (!topup) {
      logger.warn({ transactionId }, "AutoGoPay webhook: topup not found for transaction");
      res.json({ success: true });
      return;
    }

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
  }

  res.json({ success: true });
});

export default router;

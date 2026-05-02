import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable, topupsTable, ordersTable } from "@workspace/db";
import { tryAutoUpgradeReseller } from "../lib/reseller-upgrade";
import { eq, sql, and } from "drizzle-orm";
import { getPaymentSettingsMap } from "./settings";
import { logger } from "../lib/logger";
import { fulfillOrder } from "./orders";
import { notifyUserTopupConfirmed, notifyAdminTopupAutoConfirmed } from "../lib/telegram";
import { addPoints, getPointsSettings } from "./points";

const router = Router();

const WEBHOOK_REPLAY_TTL_MS = 10 * 60 * 1000;
const replayCache = new Map<string, number>();

function markReplay(key: string): boolean {
  const now = Date.now();

  for (const [k, ts] of replayCache) {
    if (now - ts > WEBHOOK_REPLAY_TTL_MS) replayCache.delete(k);
  }

  if (replayCache.has(key)) return true;
  replayCache.set(key, now);
  return false;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

router.post("/webhooks/autogopay", async (req, res) => {
  const rawBody: string = (req as any).rawBody ?? "";
  const reserializedBody: string = JSON.stringify(req.body);
  const signature = req.headers["x-signature"] as string | undefined;

  const settingsMap = await getPaymentSettingsMap();
  const apiKey = settingsMap["autoGopaySecretKey"];

  if (!apiKey) {
    logger.error("AutoGoPay webhook rejected: secret key not configured");
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }

  if (!signature) {
    logger.warn("AutoGoPay webhook rejected: missing signature");
    res.status(401).json({ error: "Missing signature" });
    return;
  }

  // Try both raw body (PHP docs) and re-serialized (Node.js docs) for compatibility
  const sigFromRaw = crypto.createHmac("sha256", apiKey).update(rawBody).digest("hex");
  const sigFromReserialized = crypto.createHmac("sha256", apiKey).update(reserializedBody).digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const sigRawBuffer = Buffer.from(sigFromRaw, "hex");
  const sigReserializedBuffer = Buffer.from(sigFromReserialized, "hex");

  const validRaw = sigBuffer.length === sigRawBuffer.length && crypto.timingSafeEqual(sigBuffer, sigRawBuffer);
  const validReserialized = sigBuffer.length === sigReserializedBuffer.length && crypto.timingSafeEqual(sigBuffer, sigReserializedBuffer);

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

  let body: Record<string, unknown>;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(rawBody || reserializedBody);
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

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
    transaction?.status?.toLowerCase() === "settlement" ||
    transaction?.status?.toLowerCase() === "paid" ||
    transaction?.status?.toLowerCase() === "success" ||
    transaction?.status?.toLowerCase() === "completed";

  const transactionId = transaction?.id ?? transaction?.transaction_id;
  const transactionStatus = transaction?.status?.toLowerCase();
  const transactionAmount = toNumber(transaction?.amount);

  logger.info(
    {
      event: event ?? null,
      transactionId: transactionId ?? null,
      status: transactionStatus ?? null,
      amount: transactionAmount,
    },
    "AutoGoPay webhook: payload received",
  );

  if (transactionId) {
    const replayKey = `${transactionId}:${event ?? "none"}:${transactionStatus ?? "none"}:${signature}`;
    if (markReplay(replayKey)) {
      logger.warn({ transactionId, event: event ?? null }, "AutoGoPay webhook: replay detected");
      res.json({ success: true });
      return;
    }
  }

  if ((isPaidEvent || isPaidStatus) && transactionId) {
    logger.info({ transactionId }, "AutoGoPay webhook: settlement received");

    // ─── 1. Check if this matches a topup ────────────────────────────────────
    const [topup] = await db
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.autogopayTransactionId, transactionId))
      .limit(1);

    if (topup) {
      const expectedAmount = Number(topup.amount);
      if (transactionAmount === null || Math.abs(transactionAmount - expectedAmount) > 0.01) {
        logger.warn(
          { topupId: topup.id, transactionId, expectedAmount, receivedAmount: transactionAmount },
          "AutoGoPay webhook: topup amount mismatch",
        );
        res.status(400).json({ error: "Amount mismatch" });
        return;
      }

      if (topup.status !== "pending") {
        logger.info({ transactionId, status: topup.status }, "AutoGoPay webhook: topup already processed");
        res.json({ success: true });
        return;
      }

      // Amankan dari Race Condition: Hanya update topup jika statusnya MASIH pending.
      // Jika request webhook dipanggil bersamaan, hanya 1 request yang akan berhasil melakukan update ini.
      const [updatedTopup] = await db
        .update(topupsTable)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(and(eq(topupsTable.id, topup.id), eq(topupsTable.status, "pending")))
        .returning();

      if (!updatedTopup) {
        logger.warn({ topupId: topup.id }, "AutoGoPay webhook: Race condition prevented. Topup was already processed by another request.");
        res.json({ success: true });
        return;
      }

      // Aman untuk menambah saldo karena kita telah 'mengunci' status topup
      const [updatedUser] = await db
        .update(usersTable)
        .set({ balance: sql`balance + ${Number(topup.amount)}` })
        .where(eq(usersTable.id, topup.userId))
        .returning({ newBalance: usersTable.balance, username: usersTable.username });

      const newBalance = Number(updatedUser?.newBalance ?? 0);
      const username = updatedUser?.username ?? `User#${topup.userId}`;

      // Insert balance log
      import("../routes/balance-logs").then(({ addBalanceLog }) => {
        addBalanceLog({
          userId: topup.userId,
          type: "topup",
          amount: Number(topup.amount),
          balanceBefore: newBalance - Number(topup.amount),
          balanceAfter: newBalance,
          description: `Isi saldo otomatis via QRIS`,
          relatedId: topup.id,
        }).catch(() => {});
      }).catch(() => {});

      logger.info({ topupId: topup.id, userId: topup.userId, amount: topup.amount }, "AutoGoPay: topup auto-confirmed");

      // Kirim notifikasi Telegram ke user
      notifyUserTopupConfirmed(
        topup.userId,
        Number(topup.amount),
        newBalance,
      ).catch((err) => logger.error({ err }, "notifyUserTopupConfirmed failed"));

      // Kirim notifikasi Telegram ke admin (info saja, tanpa tombol)
      notifyAdminTopupAutoConfirmed(
        topup.id,
        Number(topup.amount),
        username,
        newBalance,
      ).catch((err) => logger.error({ err }, "notifyAdminTopupAutoConfirmed failed"));

      // Cek apakah user layak auto-upgrade jadi reseller
      tryAutoUpgradeReseller(topup.userId, Number(topup.amount)).catch(() => {});

      // Tambah poin jika sistem poin aktif (topup via QRIS otomatis)
      getPointsSettings().then(async (pts) => {
        const topupAmount = Number(topup.amount);
        if (pts.enabled && topupAmount >= pts.pointsMinTopup && pts.pointsRateTopup > 0) {
          const pointsEarned = Math.floor(topupAmount / pts.pointsRateTopup);
          if (pointsEarned > 0) {
            await addPoints(topup.userId, pointsEarned, "topup", `Topup QRIS otomatis #${topup.id}`, topup.id);
            logger.info({ topupId: topup.id, userId: topup.userId, pointsEarned }, "AutoGoPay: points added after QRIS topup");
          }
        }
      }).catch((err) => logger.error({ err }, "[webhook] addPoints for QRIS topup failed"));

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
      const expectedAmount = Number(order.amount);
      if (transactionAmount === null || Math.abs(transactionAmount - expectedAmount) > 0.01) {
        logger.warn(
          { orderId: order.id, transactionId, expectedAmount, receivedAmount: transactionAmount },
          "AutoGoPay webhook: order amount mismatch",
        );
        res.status(400).json({ error: "Amount mismatch" });
        return;
      }

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

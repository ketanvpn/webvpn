import crypto from "crypto";
import { Router } from "express";
import { logger } from "../lib/logger";
import {
  settleProviderPayment,
  type SettlementProvider,
} from "../lib/payment/settlement";
import { isPaidStatus } from "../lib/payment/helpers";
import { getPaymentSettingsMap } from "./settings";

const router = Router();
const KETANTECH_TIMESTAMP_TOLERANCE_MS = 5 * 60_000;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const firstRecord = (...values: unknown[]): Record<string, unknown> | undefined => {
  for (const value of values) {
    const record = asRecord(value);
    if (record) return record;
  }
  return undefined;
};

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
};

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

function parseRawJson(rawBody: string): Record<string, unknown> | undefined {
  try {
    return asRecord(JSON.parse(rawBody));
  } catch {
    return undefined;
  }
}

function validSha256HmacHex(
  signature: string | undefined,
  secret: string,
  signedPayload: string,
): boolean {
  // Buffer.from(hex) silently truncates malformed hex, so validate syntax first.
  if (!signature || !/^[0-9a-f]{64}$/iu.test(signature)) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function parseWebhookTimestamp(value: string): Date | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (/^\d{10,13}$/u.test(normalized)) {
    const number = Number(normalized);
    const date = new Date(normalized.length === 10 ? number * 1000 : number);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isFreshWebhookTimestamp(value: string): boolean {
  const timestamp = parseWebhookTimestamp(value);
  return (
    timestamp !== undefined &&
    Math.abs(Date.now() - timestamp.getTime()) <=
      KETANTECH_TIMESTAMP_TOLERANCE_MS
  );
}

function transactionFromPayload(payload: Record<string, unknown>) {
  const data = firstRecord(payload.data);
  return (
    firstRecord(
      payload.transaction,
      payload.payment,
      data?.transaction,
      data?.payment,
      data,
      payload,
    ) ?? payload
  );
}

function transactionFields(
  transaction: Record<string, unknown>,
  envelope: Record<string, unknown>,
) {
  return {
    transactionId: firstString(
      transaction.transactionId,
      transaction.transaction_id,
      transaction.id,
      transaction.paymentId,
      transaction.payment_id,
      envelope.transactionId,
      envelope.transaction_id,
      envelope.id,
    ),
    status: firstString(
      transaction.transactionStatus,
      transaction.transaction_status,
      transaction.paymentStatus,
      transaction.payment_status,
      transaction.status,
      envelope.transactionStatus,
      envelope.transaction_status,
      envelope.paymentStatus,
      envelope.payment_status,
      envelope.status,
    )?.toLowerCase(),
    amount: firstNumber(
      transaction.payableAmount,
      transaction.payable_amount,
      transaction.totalAmount,
      transaction.total_amount,
      transaction.grossAmount,
      transaction.gross_amount,
      transaction.amount,
      envelope.payableAmount,
      envelope.payable_amount,
      envelope.totalAmount,
      envelope.total_amount,
      envelope.amount,
    ),
  };
}

async function handlePaidTransaction(input: {
  provider: SettlementProvider;
  transactionId: string;
  transactionAmount?: number;
  source: string;
}) {
  const result = await settleProviderPayment({
    provider: input.provider,
    providerTransactionId: input.transactionId,
    transactionAmount: input.transactionAmount,
    source: input.source,
    requireAmount: true,
  });

  if (result.outcome === "amount_mismatch") {
    logger.warn(
      {
        provider: input.provider,
        transactionId: input.transactionId,
        ownerType: result.ownerType,
        ownerId: result.ownerId,
        expectedAmount: result.expectedAmount,
        receivedAmount: input.transactionAmount ?? null,
      },
      "Payment webhook rejected an amount mismatch",
    );
  } else if (result.outcome === "identity_conflict") {
    logger.warn(
      {
        provider: input.provider,
        transactionId: input.transactionId,
        attemptId: result.attemptId,
      },
      "Payment webhook transaction identity is already claimed",
    );
  } else if (result.outcome === "not_found") {
    logger.warn(
      { provider: input.provider, transactionId: input.transactionId },
      "Payment webhook has no matching local payment",
    );
  } else {
    logger.info(
      {
        provider: input.provider,
        transactionId: input.transactionId,
        outcome: result.outcome,
        ownerType: result.ownerType,
        ownerId: result.ownerId,
        attemptId: result.attemptId,
      },
      "Payment webhook processed",
    );
  }

  // A valid provider event is acknowledged even when it is duplicate, unmatched,
  // or permanently invalid. This prevents retry storms while retaining audit logs.
  return { success: true };
}

router.post("/webhooks/ketantechpay", async (req, res) => {
  const rawBody = typeof (req as any).rawBody === "string"
    ? (req as any).rawBody as string
    : "";
  const signature = firstString(
    req.headers["x-ketantechpay-signature"],
    req.headers["x-signature"],
  );
  const timestamp = firstString(
    req.headers["x-ketantechpay-timestamp"],
    req.headers["x-timestamp"],
  );

  const settingsMap = await getPaymentSettingsMap();
  const secret = settingsMap["ketantechPayWebhookSecret"];
  if (!secret) {
    logger.error("KetantechPay webhook rejected: secret not configured");
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }
  if (!rawBody) {
    res.status(400).json({ error: "Raw request body required" });
    return;
  }
  if (!signature || !timestamp) {
    res.status(401).json({ error: "Missing webhook signature/timestamp" });
    return;
  }
  if (!isFreshWebhookTimestamp(timestamp)) {
    logger.warn("KetantechPay webhook rejected: stale or invalid timestamp");
    res.status(401).json({ error: "Invalid webhook timestamp" });
    return;
  }
  if (!validSha256HmacHex(signature, secret, `${timestamp}.${rawBody}`)) {
    // Never log signature material, including seemingly harmless prefixes.
    logger.warn("KetantechPay webhook rejected: invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = parseRawJson(rawBody);
  if (!payload) {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }
  const fields = transactionFields(transactionFromPayload(payload), payload);
  if (!fields.transactionId || !isPaidStatus(fields.status)) {
    res.json({ success: true });
    return;
  }

  try {
    res.json(
      await handlePaidTransaction({
        provider: "ketantechpay",
        transactionId: fields.transactionId,
        transactionAmount: fields.amount,
        source: "ketantechpay-webhook",
      }),
    );
  } catch (err) {
    logger.error({ err }, "KetantechPay webhook settlement failed");
    res.status(500).json({ error: "Temporary settlement failure" });
  }
});

router.post("/webhooks/autogopay", async (req, res) => {
  const rawBody = typeof (req as any).rawBody === "string"
    ? (req as any).rawBody as string
    : "";
  const signature = firstString(req.headers["x-signature"]);
  const settingsMap = await getPaymentSettingsMap();
  const apiKey = settingsMap["autoGopaySecretKey"];

  if (!apiKey) {
    logger.error("AutoGoPay webhook rejected: secret key not configured");
    res.status(503).json({ error: "Payment gateway not configured" });
    return;
  }
  if (!rawBody) {
    res.status(400).json({ error: "Raw request body required" });
    return;
  }
  if (!signature) {
    logger.warn("AutoGoPay webhook rejected: missing signature");
    res.status(401).json({ error: "Missing signature" });
    return;
  }
  // AutoGoPay signs the exact bytes received. Re-serialized JSON is not valid.
  if (!validSha256HmacHex(signature, apiKey, rawBody)) {
    logger.warn("AutoGoPay webhook rejected: invalid signature");
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const payload = parseRawJson(rawBody);
  if (!payload) {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const event = firstString(payload.event, payload.eventName, payload.type);
  if (event === "verification.challenge") {
    res.json({ success: true });
    return;
  }

  const fields = transactionFields(transactionFromPayload(payload), payload);
  logger.info(
    {
      event: event ?? null,
      transactionId: fields.transactionId ?? null,
      status: fields.status ?? null,
      amount: fields.amount ?? null,
    },
    "AutoGoPay webhook payload verified",
  );

  // Event names are informational. A paid transaction status is mandatory.
  if (!fields.transactionId || !isPaidStatus(fields.status)) {
    res.json({ success: true });
    return;
  }

  try {
    res.json(
      await handlePaidTransaction({
        provider: "autogopay",
        transactionId: fields.transactionId,
        transactionAmount: fields.amount,
        source: "autogopay-webhook",
      }),
    );
  } catch (err) {
    logger.error({ err }, "AutoGoPay webhook settlement failed");
    res.status(500).json({ error: "Temporary settlement failure" });
  }
});

export default router;

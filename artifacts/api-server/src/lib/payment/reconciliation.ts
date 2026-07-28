import crypto from "crypto";
import {
  db,
  ordersTable,
  paymentAttemptsTable,
} from "@workspace/db";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { logger } from "../logger";
import { getPaymentSettingsMap } from "../../routes/settings";
import { createAutoGoPayGoPayAdapter } from "./autogopay-gopay";
import { isPaymentProviderError } from "./errors";
import {
  entityPaymentIdentities,
  isPaidStatus,
  matchesShopeeTransaction,
  shopeeTransactionFingerprint,
  type ShopeeTransactionLike,
} from "./helpers";
import { parsePaymentSettings } from "./settings";
import { formatShopeeTransactionsStartTime } from "./reconciliation-format";
import {
  retryLegacyPaidOrder,
  retryPaidOrderAttempt,
  settleProviderPayment,
} from "./settlement";

const SHOPEE_PAGE_SIZE = 200;
const SHOPEE_ATTEMPT_LIMIT = 250;
const SHOPEE_WINDOW_SKEW_MS = 5 * 60_000;
const SHOPEE_LATE_PAYMENT_GRACE_MS = 24 * 60 * 60_000;
const GOPAY_STALE_MS = 60_000;
const ORDER_RETRY_STALE_MS = 2 * 60_000;
const RECONCILABLE_ATTEMPT_STATUSES = [
  "pending",
  "unknown",
  "expired",
  "rejected",
];

interface JsonRecord {
  [key: string]: unknown;
}

const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;

const firstRecord = (...values: unknown[]): JsonRecord | undefined => {
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

const normalizeShopeeRow = (value: unknown): ShopeeTransactionLike | undefined => {
  const row = asRecord(value);
  if (!row) return undefined;
  return {
    ...row,
    transactionId: firstString(
      row.transactionId,
      row.transaction_id,
      row.id,
      row.paymentId,
      row.payment_id,
    ),
    payableAmount: firstNumber(
      row.payableAmount,
      row.payable_amount,
      row.totalAmount,
      row.total_amount,
      row.grossAmount,
      row.gross_amount,
      row.amount,
    ),
    transaction_status: firstString(
      row.transaction_status,
      row.payment_status,
      row.status,
    ),
    transactionTime: firstString(
      row.transactionTime,
      row.transaction_time,
      row.paidAt,
      row.paid_at,
      row.paymentTime,
      row.payment_time,
      row.createdAt,
      row.created_at,
      row.time,
      row.date,
    ),
  };
};

const transactionRows = (payload: unknown): ShopeeTransactionLike[] => {
  const response = asRecord(payload);
  if (!response) return [];
  const data = firstRecord(response.data);
  const candidate = Array.isArray(response.data)
    ? response.data
    : data?.transactions ??
      data?.items ??
      data?.records ??
      data?.data ??
      response.transactions ??
      response.items ??
      response.records;
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map(normalizeShopeeRow)
    .filter((row): row is ShopeeTransactionLike => Boolean(row));
};

const shopeeStatus = (transaction: ShopeeTransactionLike): string =>
  firstString(
    transaction.transaction_status,
    transaction.payment_status,
    transaction.status,
  ) ?? "unknown";

const shopeeTransactionId = (
  transaction: ShopeeTransactionLike,
): string | undefined =>
  firstString(
    transaction.transactionId,
    transaction.transaction_id,
    transaction.id,
  );

const fingerprint = (transaction: ShopeeTransactionLike): string =>
  crypto
    .createHash("sha256")
    .update(shopeeTransactionFingerprint(transaction), "utf8")
    .digest("hex");

async function fetchShopeeTransactions(
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
  startTime: Date,
): Promise<ShopeeTransactionLike[]> {
  const url = new URL(
    "/shopeepay/transactions",
    `${baseUrl.replace(/\/+$/u, "")}/`,
  );
  url.searchParams.set("pageSize", String(SHOPEE_PAGE_SIZE));
  url.searchParams.set(
    "startTime",
    formatShopeeTransactionsStartTime(startTime),
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ShopeePay transactions returned HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    return transactionRows(payload);
  } finally {
    clearTimeout(timeout);
  }
}

let shopeeRun: Promise<void> | undefined;

async function reconcileShopeePayTransactionsInternal(): Promise<void> {
  const settingsMap = await getPaymentSettingsMap();
  const settings = parsePaymentSettings(settingsMap);
  const channel = settings.autoGopayShopeePay;
  if (!channel.enabled || !channel.apiKey) return;

  const attempts = await db
    .select()
    .from(paymentAttemptsTable)
    .where(
      and(
        eq(paymentAttemptsTable.provider, "autogopay"),
        eq(paymentAttemptsTable.channel, "autogopay_shopeepay"),
        inArray(paymentAttemptsTable.status, RECONCILABLE_ATTEMPT_STATUSES),
      ),
    )
    .orderBy(desc(paymentAttemptsTable.startedAt))
    .limit(SHOPEE_ATTEMPT_LIMIT);
  if (attempts.length === 0) return;

  const earliestStart = attempts.reduce(
    (earliest, attempt) =>
      attempt.startedAt < earliest ? attempt.startedAt : earliest,
    attempts[0].startedAt,
  );
  const transactions = await fetchShopeeTransactions(
    channel.baseUrl,
    channel.apiKey,
    settings.timeoutMs,
    new Date(earliestStart.getTime() - SHOPEE_WINDOW_SKEW_MS),
  );
  const paidTransactions = transactions.filter((transaction) =>
    isPaidStatus(shopeeStatus(transaction)),
  );
  const now = new Date();

  for (const transaction of paidTransactions) {
    const transactionId = shopeeTransactionId(transaction);
    const transactionFingerprint = fingerprint(transaction);
    const candidates = attempts.filter((attempt) => {
      if (
        transactionId &&
        attempt.providerTransactionId &&
        attempt.providerTransactionId !== transactionId
      ) {
        return false;
      }
      const entity = attempt.orderId
        ? { kind: "order" as const, id: attempt.orderId }
        : attempt.topupId
          ? { kind: "topup" as const, id: attempt.topupId }
          : undefined;
      if (!entity) return false;
      const identities = entityPaymentIdentities(
        entity,
        "autogopay_shopeepay",
      );
      const paymentWindowEnd = new Date(
        (attempt.expiresAt ?? attempt.startedAt).getTime() +
          SHOPEE_LATE_PAYMENT_GRACE_MS,
      );
      return matchesShopeeTransaction(transaction, {
        localReference: identities.localReference,
        idempotencyKey: identities.idempotencyKey,
        baseAmount: Number(attempt.baseAmount),
        payableAmount: Number(attempt.payableAmount),
        uniqueCode: attempt.uniqueCode ?? undefined,
        requirePaid: true,
        createdAfter: new Date(
          attempt.startedAt.getTime() - SHOPEE_WINDOW_SKEW_MS,
        ),
        createdBefore: paymentWindowEnd,
      });
    });

    if (candidates.length !== 1) {
      if (candidates.length > 1) {
        logger.warn(
          { candidateAttemptIds: candidates.map((attempt) => attempt.id) },
          "ShopeePay reconciliation skipped an ambiguous transaction match",
        );
      }
      continue;
    }

    const attempt = candidates[0];
    const transactionAmount = firstNumber(
      transaction.payableAmount,
      transaction.payable_amount,
      transaction.totalAmount,
      transaction.total_amount,
      transaction.amount,
    );
    const result = await settleProviderPayment({
      provider: "autogopay",
      providerTransactionId: transactionId,
      transactionFingerprint,
      transactionAmount,
      attemptId: attempt.id,
      source: "shopeepay-reconciliation",
      requireAmount: true,
    });
    if (result.outcome === "amount_mismatch") {
      logger.warn(
        { attemptId: attempt.id, expectedAmount: result.expectedAmount },
        "ShopeePay reconciliation rejected an amount mismatch",
      );
    }
  }

  await db
    .update(paymentAttemptsTable)
    .set({ lastCheckedAt: now, updatedAt: now })
    .where(
      and(
        inArray(
          paymentAttemptsTable.id,
          attempts.map((attempt) => attempt.id),
        ),
        inArray(paymentAttemptsTable.status, RECONCILABLE_ATTEMPT_STATUSES),
      ),
    );
}

/** One coalesced, batched ShopeePay transaction-list request per scheduler tick. */
export async function reconcileShopeePayTransactions(): Promise<void> {
  if (shopeeRun) return shopeeRun;
  shopeeRun = reconcileShopeePayTransactionsInternal().finally(() => {
    shopeeRun = undefined;
  });
  return shopeeRun;
}

let goPayRun: Promise<void> | undefined;

async function reconcileAutoGoPayGoPayInternal(): Promise<void> {
  const settingsMap = await getPaymentSettingsMap();
  const settings = parsePaymentSettings(settingsMap);
  const channel = settings.autoGopayGoPay;
  if (!channel.enabled || !channel.apiKey) return;

  const staleBefore = new Date(Date.now() - GOPAY_STALE_MS);
  const attempts = await db
    .select()
    .from(paymentAttemptsTable)
    .where(
      and(
        eq(paymentAttemptsTable.provider, "autogopay"),
        eq(paymentAttemptsTable.channel, "autogopay_gopay"),
        inArray(paymentAttemptsTable.status, RECONCILABLE_ATTEMPT_STATUSES),
        isNotNull(paymentAttemptsTable.providerTransactionId),
        or(
          isNull(paymentAttemptsTable.lastCheckedAt),
          lte(paymentAttemptsTable.lastCheckedAt, staleBefore),
        ),
      ),
    )
    .orderBy(asc(paymentAttemptsTable.lastCheckedAt))
    .limit(20);
  if (attempts.length === 0) return;

  const adapter = createAutoGoPayGoPayAdapter({
    ...channel,
    timeoutMs: settings.timeoutMs,
    expiryMinutes: settings.expiryMinutes,
  });

  for (const attempt of attempts) {
    const transactionId = attempt.providerTransactionId;
    if (!transactionId) continue;
    const checkedAt = new Date();
    try {
      const remote = await adapter.status(transactionId);
      if (remote.paid) {
        const result = await settleProviderPayment({
          provider: "autogopay",
          providerTransactionId: remote.transactionId ?? transactionId,
          transactionAmount: remote.amount,
          attemptId: attempt.id,
          source: "gopay-reconciliation",
          requireAmount: false,
        });
        if (result.outcome === "amount_mismatch") {
          logger.warn(
            { attemptId: attempt.id, expectedAmount: result.expectedAmount },
            "GoPay reconciliation rejected an amount mismatch",
          );
        }
      } else {
        await db
          .update(paymentAttemptsTable)
          .set({
            lastCheckedAt: checkedAt,
            status:
              remote.status.toLowerCase() === "unknown"
                ? "unknown"
                : attempt.status,
            updatedAt: checkedAt,
          })
          .where(
            and(
              eq(paymentAttemptsTable.id, attempt.id),
              inArray(
                paymentAttemptsTable.status,
                RECONCILABLE_ATTEMPT_STATUSES,
              ),
            ),
          );
      }
    } catch (err) {
      logger.warn(
        { err, attemptId: attempt.id },
        "GoPay status reconciliation failed",
      );
      // Configuration errors (including a documented 404 endpoint mismatch)
      // should not delay all attempts for another stale interval. Transient
      // network/provider failures are timestamped to apply backoff.
      if (!isPaymentProviderError(err) || err.category !== "configuration") {
        await db
          .update(paymentAttemptsTable)
          .set({ lastCheckedAt: checkedAt, updatedAt: checkedAt })
          .where(eq(paymentAttemptsTable.id, attempt.id))
          .catch(() => {});
      }
    }
  }
}

/** Coalesced exact-id GoPay polling for stale local attempts. */
export async function reconcileAutoGoPayGoPay(): Promise<void> {
  if (goPayRun) return goPayRun;
  goPayRun = reconcileAutoGoPayGoPayInternal().finally(() => {
    goPayRun = undefined;
  });
  return goPayRun;
}

let orderRetryRun: Promise<void> | undefined;

async function retryPaidOrderFulfillmentInternal(): Promise<void> {
  const staleBefore = new Date(Date.now() - ORDER_RETRY_STALE_MS);
  const attempts = await db
    .select({ id: paymentAttemptsTable.id })
    .from(paymentAttemptsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, paymentAttemptsTable.orderId))
    .where(
      and(
        eq(paymentAttemptsTable.status, "paid"),
        inArray(ordersTable.status, ["processing", "paid"]),
        or(
          eq(ordersTable.status, "paid"),
          isNull(paymentAttemptsTable.lastCheckedAt),
          lte(paymentAttemptsTable.lastCheckedAt, staleBefore),
        ),
      ),
    )
    .limit(20);

  for (const attempt of attempts) {
    await retryPaidOrderAttempt(attempt.id);
  }

  // Pre-migration QRIS orders have no attempt row but still need fulfillment
  // retries. The NOT EXISTS guard keeps this path strictly legacy-only.
  const legacyOrders = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.status, "processing"),
        eq(ordersTable.paymentMethod, "qris"),
        isNotNull(ordersTable.autogopayTransactionId),
        isNull(ordersTable.paymentProvider),
        lte(ordersTable.updatedAt, staleBefore),
        sql`not exists (
          select 1 from ${paymentAttemptsTable}
          where ${paymentAttemptsTable.orderId} = ${ordersTable.id}
        )`,
      ),
    )
    .limit(10);

  for (const order of legacyOrders) {
    await retryLegacyPaidOrder(order.id);
  }
}

export async function retryPaidOrderFulfillment(): Promise<void> {
  if (orderRetryRun) return orderRetryRun;
  orderRetryRun = retryPaidOrderFulfillmentInternal().finally(() => {
    orderRetryRun = undefined;
  });
  return orderRetryRun;
}

/** Reconcile every permitted incoming-payment source before an expiry sweep. */
export async function reconcileBeforePaymentExpiry(): Promise<void> {
  // Shopee is one batch call; GoPay is exact-id polling. No OVO/outgoing endpoint
  // is ever invoked by this module.
  await reconcileShopeePayTransactions();
  await reconcileAutoGoPayGoPay();
  await retryPaidOrderFulfillment();
}

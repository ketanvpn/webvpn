import { PAYMENT_CHANNELS, type PaymentChannel } from "./types";

const PAID_STATUSES = new Set([
  "paid",
  "success",
  "successful",
  "settlement",
  "settled",
  "completed",
  "complete",
  "captured",
]);

const CHANNEL_ALIASES: Readonly<Record<string, PaymentChannel>> = {
  ketantechpay: "ketantechpay",
  ketantech_pay: "ketantechpay",
  ketantech: "ketantechpay",
  autogopay: "autogopay_gopay",
  autogopay_gopay: "autogopay_gopay",
  autogopaygopay: "autogopay_gopay",
  gopay: "autogopay_gopay",
  autogopay_shopeepay: "autogopay_shopeepay",
  autogopayshopeepay: "autogopay_shopeepay",
  shopeepay: "autogopay_shopeepay",
  shopee_pay: "autogopay_shopeepay",
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const scalarStatus = (value: unknown): string | undefined => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim().toLowerCase();
  }

  const record = asRecord(value);
  if (!record) return undefined;

  for (const key of ["status", "transaction_status", "payment_status"]) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate).trim().toLowerCase();
    }
  }
  return undefined;
};

/** Provider-neutral paid-state predicate used by polling and reconciliation. */
export const isPaidStatus = (status: unknown): boolean => {
  const normalized = scalarStatus(status);
  return normalized !== undefined && PAID_STATUSES.has(normalized);
};

export const paidStatusPredicate = isPaidStatus;

const tokenizeChannelOrder = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to delimiter parsing for forgiving settings migration.
    }
  }

  return trimmed.split(/[\s,;>|]+/u);
};

/** Parse JSON-array or delimited channel settings, dropping unknowns and duplicates. */
export const parseChannelOrder = (
  value: unknown,
  fallback: readonly PaymentChannel[] = [],
): PaymentChannel[] => {
  const result: PaymentChannel[] = [];

  for (const item of tokenizeChannelOrder(value)) {
    if (typeof item !== "string") continue;
    const key = item
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/gu, "_");
    const channel = CHANNEL_ALIASES[key];
    if (channel && !result.includes(channel)) result.push(channel);
  }

  return result.length > 0 ? result : [...fallback];
};

export const parsePaymentChannelOrder = parseChannelOrder;

export interface PaymentEntityIdentityReference {
  kind: "order" | "topup";
  id: number;
}

/**
 * Stable identities shared by provider creation and later reconciliation.
 * `matchingKey` is internal-only; it must not be sent or compared as a
 * provider reference/idempotency key.
 */
export const entityPaymentIdentities = (
  entity: PaymentEntityIdentityReference,
  channel: PaymentChannel,
) => {
  const localReference = `webvpn-${entity.kind}-${entity.id}`;
  return {
    localReference,
    idempotencyKey: `webvpn:${entity.kind}:${entity.id}:${channel}:create:v1`,
    matchingKey: `${channel}:${localReference}`,
  };
};

export interface ShopeeTransactionLike {
  id?: unknown;
  transactionId?: unknown;
  transaction_id?: unknown;
  reference?: unknown;
  localReference?: unknown;
  local_reference?: unknown;
  merchantReference?: unknown;
  merchant_reference?: unknown;
  idempotencyKey?: unknown;
  idempotency_key?: unknown;
  amount?: unknown;
  payableAmount?: unknown;
  payable_amount?: unknown;
  totalAmount?: unknown;
  total_amount?: unknown;
  uniqueCode?: unknown;
  unique_code?: unknown;
  status?: unknown;
  transaction_status?: unknown;
  payment_status?: unknown;
  time?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
  transactionTime?: unknown;
  transaction_time?: unknown;
}

export interface ShopeeTransactionMatch {
  localReference?: string;
  idempotencyKey?: string;
  baseAmount: number;
  payableAmount?: number;
  uniqueCode?: number;
  requirePaid?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
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

const transactionDate = (
  transaction: ShopeeTransactionLike,
): Date | undefined => {
  const raw = firstString(
    transaction.transactionTime,
    transaction.transaction_time,
    transaction.time,
    transaction.createdAt,
    transaction.created_at,
  );
  if (!raw) return undefined;
  const date = new Date(
    raw.includes("T") ? raw : raw.replace(" ", "T") + "+07:00",
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const transactionStatus = (transaction: ShopeeTransactionLike): string =>
  firstString(
    transaction.status,
    transaction.transaction_status,
    transaction.payment_status,
  )?.toLowerCase() ?? "unknown";

const transactionAmount = (
  transaction: ShopeeTransactionLike,
): number | undefined =>
  firstNumber(
    transaction.payableAmount,
    transaction.payable_amount,
    transaction.totalAmount,
    transaction.total_amount,
    transaction.amount,
  );

const transactionUniqueCode = (
  transaction: ShopeeTransactionLike,
): number | undefined =>
  firstNumber(transaction.uniqueCode, transaction.unique_code);

/** Stable, non-secret identity string for deduplicating ShopeePay transaction rows. */
export const shopeeTransactionFingerprint = (
  transaction: ShopeeTransactionLike,
): string => {
  const transactionId =
    firstString(
      transaction.transactionId,
      transaction.transaction_id,
      transaction.id,
    ) ?? "";
  const reference =
    firstString(
      transaction.localReference,
      transaction.local_reference,
      transaction.merchantReference,
      transaction.merchant_reference,
      transaction.reference,
    ) ?? "";
  const amount = transactionAmount(transaction);
  const uniqueCode = transactionUniqueCode(transaction);
  const date = transactionDate(transaction);

  return [
    transactionId,
    reference,
    amount ?? "",
    uniqueCode ?? "",
    date?.toISOString() ?? "",
  ].join("|");
};

export const fingerprintShopeeTransaction = shopeeTransactionFingerprint;

/** Match a ShopeePay row without relying on list order or a single weak field. */
export const matchesShopeeTransaction = (
  transaction: ShopeeTransactionLike,
  expected: ShopeeTransactionMatch,
): boolean => {
  if (
    expected.requirePaid !== false &&
    !isPaidStatus(transactionStatus(transaction))
  ) {
    return false;
  }

  const reference = firstString(
    transaction.localReference,
    transaction.local_reference,
    transaction.merchantReference,
    transaction.merchant_reference,
    transaction.reference,
  );
  const idempotencyKey = firstString(
    transaction.idempotencyKey,
    transaction.idempotency_key,
  );
  const identityRequested = Boolean(
    expected.localReference || expected.idempotencyKey,
  );
  const identityAvailable = Boolean(reference || idempotencyKey);
  const identityMatches =
    (Boolean(expected.localReference) &&
      reference === expected.localReference) ||
    (Boolean(expected.idempotencyKey) &&
      idempotencyKey === expected.idempotencyKey);

  if (identityRequested && identityAvailable && !identityMatches) return false;

  const expectedUniqueCode =
    expected.uniqueCode ??
    (expected.payableAmount === undefined
      ? undefined
      : expected.payableAmount - expected.baseAmount);
  const expectedPayableAmount =
    expected.payableAmount ?? expected.baseAmount + (expectedUniqueCode ?? 0);
  const amount = transactionAmount(transaction);
  if (amount === undefined || amount !== expectedPayableAmount) return false;

  const uniqueCode = transactionUniqueCode(transaction);
  if (
    expectedUniqueCode !== undefined &&
    uniqueCode !== undefined &&
    uniqueCode !== expectedUniqueCode
  ) {
    return false;
  }

  const date = transactionDate(transaction);
  if (expected.createdAfter && (!date || date < expected.createdAfter))
    return false;
  if (expected.createdBefore && (!date || date > expected.createdBefore))
    return false;

  return true;
};

export const matchShopeeTransaction = matchesShopeeTransaction;

export const isPaymentChannel = (value: unknown): value is PaymentChannel =>
  typeof value === "string" &&
  (PAYMENT_CHANNELS as readonly string[]).includes(value);

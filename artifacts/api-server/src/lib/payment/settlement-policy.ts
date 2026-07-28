import type { PaymentChannel } from "./types";

export const RECOVERABLE_TOPUP_STATUSES = [
  "pending",
  "rejected",
  "expired",
] as const;

export const RECOVERABLE_ORDER_STATUSES = [
  "pending",
  "expired",
  "rejected",
] as const;

export const isRecoverableTopupStatus = (status: string): boolean =>
  (RECOVERABLE_TOPUP_STATUSES as readonly string[]).includes(status);

export const isRecoverableOrderStatus = (status: string): boolean =>
  (RECOVERABLE_ORDER_STATUSES as readonly string[]).includes(status);

export const creditedTopupAmount = (
  channel: PaymentChannel | string,
  baseAmount: number,
  payableAmount: number,
): number =>
  channel === "autogopay_shopeepay" ? payableAmount : baseAmount;

export const isPaymentAmountMatch = (
  received: number,
  expected: number,
): boolean =>
  Number.isFinite(received) &&
  Number.isFinite(expected) &&
  Math.round(received * 100) === Math.round(expected * 100);

export const isSettlementIdentityConflict = (
  persisted: string | null | undefined,
  received: string | null | undefined,
): boolean => Boolean(persisted && received && persisted !== received);

/** PostgreSQL/Drizzle may expose SQLSTATE on a wrapped cause. */
export const isUniqueConstraintViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object") return false;
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "23505") return true;
    current = candidate.cause;
  }
  return false;
};

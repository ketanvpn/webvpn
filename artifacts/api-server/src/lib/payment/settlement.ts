import {
  db,
  ordersTable,
  paymentAttemptsTable,
  topupsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { logger } from "../logger";
import {
  isSettlementIdentityConflict,
  isPaymentAmountMatch,
  isUniqueConstraintViolation,
} from "./settlement-policy";
import { normalizeIdentifier } from "./settlement-types";
import { settleAttemptTopup, settleLegacyTopup } from "./settle-topup";
import {
  retryLegacyPaidOrder,
  settleAttemptOrder,
  settleLegacyOrder,
} from "./settle-order";

// Re-export all public types from the types module so callers can keep
// importing from "./settlement" without changes.
export type {
  SettlementProvider,
  SettlementOutcome,
  SettlementResult,
  SettleProviderPaymentInput,
} from "./settlement-types";
export { retryLegacyPaidOrder } from "./settle-order";

import type {
  SettleProviderPaymentInput,
  SettlementResult,
} from "./settlement-types";

// ---------------------------------------------------------------------------
// Attempt lookup
// ---------------------------------------------------------------------------

async function findAttempt(input: SettleProviderPaymentInput) {
  if (input.attemptId !== undefined) {
    const [attempt] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(
        and(
          eq(paymentAttemptsTable.id, input.attemptId),
          eq(paymentAttemptsTable.provider, input.provider),
        ),
      )
      .limit(1);
    return attempt;
  }

  const providerTransactionId = normalizeIdentifier(
    input.providerTransactionId,
  );
  if (providerTransactionId) {
    const [attempt] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(
        and(
          eq(paymentAttemptsTable.provider, input.provider),
          eq(
            paymentAttemptsTable.providerTransactionId,
            providerTransactionId,
          ),
        ),
      )
      .limit(1);
    if (attempt) return attempt;
  }

  const transactionFingerprint = normalizeIdentifier(
    input.transactionFingerprint,
  );
  if (transactionFingerprint) {
    const [attempt] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(
        and(
          eq(paymentAttemptsTable.provider, input.provider),
          eq(
            paymentAttemptsTable.transactionFingerprint,
            transactionFingerprint,
          ),
        ),
      )
      .limit(1);
    return attempt;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Validation helpers (exported for settle-topup / settle-order)
// ---------------------------------------------------------------------------

export function validateAttemptIdentity(
  attempt: typeof paymentAttemptsTable.$inferSelect,
  input: SettleProviderPaymentInput,
): SettlementResult | undefined {
  const providerTransactionId = normalizeIdentifier(
    input.providerTransactionId,
  );
  const transactionFingerprint = normalizeIdentifier(
    input.transactionFingerprint,
  );

  if (
    isSettlementIdentityConflict(
      attempt.providerTransactionId,
      providerTransactionId,
    )
  ) {
    return {
      outcome: "identity_conflict",
      attemptId: attempt.id,
      ownerType: attempt.topupId ? "topup" : "order",
      ownerId: attempt.topupId ?? attempt.orderId ?? undefined,
    };
  }
  if (
    isSettlementIdentityConflict(
      attempt.transactionFingerprint,
      transactionFingerprint,
    )
  ) {
    return {
      outcome: "identity_conflict",
      attemptId: attempt.id,
      ownerType: attempt.topupId ? "topup" : "order",
      ownerId: attempt.topupId ?? attempt.orderId ?? undefined,
    };
  }
  return undefined;
}

export function validateAttemptAmount(
  attempt: typeof paymentAttemptsTable.$inferSelect,
  input: SettleProviderPaymentInput,
): SettlementResult | undefined {
  const expectedAmount = Number(attempt.payableAmount);
  const received = input.transactionAmount;
  if (
    (input.requireAmount &&
      (received === null || received === undefined)) ||
    (received !== null &&
      received !== undefined &&
      !isPaymentAmountMatch(received, expectedAmount))
  ) {
    return {
      outcome: "amount_mismatch",
      attemptId: attempt.id,
      ownerType: attempt.topupId ? "topup" : "order",
      ownerId: attempt.topupId ?? attempt.orderId ?? undefined,
      expectedAmount,
    };
  }
  return undefined;
}

export const attemptIdentityUpdate = (
  attempt: typeof paymentAttemptsTable.$inferSelect,
  input: SettleProviderPaymentInput,
) => ({
  providerTransactionId:
    attempt.providerTransactionId ??
    normalizeIdentifier(input.providerTransactionId) ??
    null,
  transactionFingerprint:
    attempt.transactionFingerprint ??
    normalizeIdentifier(input.transactionFingerprint) ??
    null,
});

// ---------------------------------------------------------------------------
// Legacy owner lookup
// ---------------------------------------------------------------------------

async function findLegacyOwner(
  providerTransactionId: string,
): Promise<
  | { type: "topup"; row: typeof topupsTable.$inferSelect }
  | { type: "order"; row: typeof ordersTable.$inferSelect }
  | "ambiguous"
  | undefined
> {
  // New records are provider-scoped by payment_attempts. Only null-provider rows
  // are eligible for this pre-migration compatibility path.
  const [topups, orders] = await Promise.all([
    db
      .select()
      .from(topupsTable)
      .where(
        and(
          eq(topupsTable.autogopayTransactionId, providerTransactionId),
          isNull(topupsTable.paymentProvider),
        ),
      )
      .limit(2),
    db
      .select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.autogopayTransactionId, providerTransactionId),
          isNull(ordersTable.paymentProvider),
        ),
      )
      .limit(2),
  ]);

  if (topups.length + orders.length > 1) return "ambiguous";
  if (topups[0]) return { type: "topup", row: topups[0] };
  if (orders[0]) return { type: "order", row: orders[0] };
  return undefined;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Provider-scoped, idempotent settlement entry point used by webhooks and polling.
 * payment_attempts is authoritative; legacy ids are consulted only when no attempt
 * exists and only for rows created before provider fields were populated.
 */
export async function settleProviderPayment(
  rawInput: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  const input: SettleProviderPaymentInput = {
    ...rawInput,
    providerTransactionId: normalizeIdentifier(
      rawInput.providerTransactionId,
    ),
    transactionFingerprint: normalizeIdentifier(
      rawInput.transactionFingerprint,
    ),
  };

  try {
    const attempt = await findAttempt(input);
    if (attempt) {
      const identityError = validateAttemptIdentity(attempt, input);
      if (identityError) return identityError;
      const amountError = validateAttemptAmount(attempt, input);
      if (amountError) return amountError;

      if (attempt.topupId) return settleAttemptTopup(attempt.id, input);
      if (attempt.orderId) return settleAttemptOrder(attempt.id, input);
      return { outcome: "invalid_state", attemptId: attempt.id };
    }

    if (input.attemptId !== undefined || !input.providerTransactionId) {
      return { outcome: "not_found" };
    }

    const legacyOwner = await findLegacyOwner(input.providerTransactionId);
    if (!legacyOwner) return { outcome: "not_found" };
    if (legacyOwner === "ambiguous") return { outcome: "identity_conflict" };
    if (legacyOwner.type === "topup") {
      return settleLegacyTopup(legacyOwner.row.id, input);
    }
    return settleLegacyOrder(legacyOwner.row.id, input);
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      logger.warn(
        {
          provider: input.provider,
          attemptId: input.attemptId,
          source: input.source,
        },
        "Payment settlement identity was already claimed by another attempt",
      );
      return { outcome: "identity_conflict", attemptId: input.attemptId };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Reconciliation path
// ---------------------------------------------------------------------------

/** Reconciliation path for paid attempts whose order is processing or already paid. */
export async function retryPaidOrderAttempt(
  attemptId: number,
): Promise<SettlementResult> {
  const [attempt] = await db
    .select({ provider: paymentAttemptsTable.provider })
    .from(paymentAttemptsTable)
    .where(eq(paymentAttemptsTable.id, attemptId))
    .limit(1);
  if (
    !attempt ||
    (attempt.provider !== "autogopay" &&
      attempt.provider !== "ketantechpay")
  ) {
    return { outcome: "not_found", attemptId };
  }

  return settleAttemptOrder(attemptId, {
    provider: attempt.provider,
    attemptId,
    source: "order-reconciliation",
    requireAmount: false,
    retryProcessingOrder: true,
  });
}

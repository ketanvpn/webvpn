import {
  balanceLogsTable,
  db,
  ordersTable,
  pool,
  paymentAttemptsTable,
  topupsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { logger } from "../logger";
import { tryAutoUpgradeReseller } from "../reseller-upgrade";
import {
  notifyAdminTopupAutoConfirmed,
  notifyUserTopupConfirmed,
} from "../telegram";
import { fulfillOrder } from "../../routes/orders";
import { addPoints, getPointsSettings } from "../../routes/points";
import {
  creditedTopupAmount,
  isPaymentAmountMatch,
  isRecoverableOrderStatus,
  isRecoverableTopupStatus,
  isSettlementIdentityConflict,
  isUniqueConstraintViolation,
  RECOVERABLE_ORDER_STATUSES,
  RECOVERABLE_TOPUP_STATUSES,
} from "./settlement-policy";

export type SettlementProvider = "autogopay" | "ketantechpay";

export type SettlementOutcome =
  | "settled"
  | "processing"
  | "already_settled"
  | "amount_mismatch"
  | "not_found"
  | "identity_conflict"
  | "invalid_state";

export interface SettlementResult {
  outcome: SettlementOutcome;
  ownerType?: "topup" | "order";
  ownerId?: number;
  attemptId?: number;
  expectedAmount?: number;
}

export interface SettleProviderPaymentInput {
  provider: SettlementProvider;
  providerTransactionId?: string;
  transactionFingerprint?: string;
  transactionAmount?: number | null;
  /** A reconciliation match can bind an attempt which had no provider transaction id. */
  attemptId?: number;
  source: string;
  /** Webhooks must provide and match the amount. Exact-id polling may omit it. */
  requireAmount?: boolean;
  /** Only reconciliation workers should retry an already-processing order. */
  retryProcessingOrder?: boolean;
}

const ORDER_RETRY_LEASE_MS = 2 * 60_000;

const normalizeIdentifier = (value: string | undefined): string | undefined => {
  const normalized = value?.trim();
  return normalized || undefined;
};

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

function validateAttemptIdentity(
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

function validateAttemptAmount(
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

const attemptIdentityUpdate = (
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

interface TopupPostCommit {
  topupId: number;
  userId: number;
  creditedAmount: number;
  newBalance: number;
  username: string;
}

function runTopupPostCommit(result: TopupPostCommit): void {
  notifyUserTopupConfirmed(
    result.userId,
    result.creditedAmount,
    result.newBalance,
  ).catch((err) =>
    logger.error(
      { err, topupId: result.topupId },
      "notifyUserTopupConfirmed failed",
    ),
  );
  notifyAdminTopupAutoConfirmed(
    result.topupId,
    result.creditedAmount,
    result.username,
    result.newBalance,
  ).catch((err) =>
    logger.error(
      { err, topupId: result.topupId },
      "notifyAdminTopupAutoConfirmed failed",
    ),
  );
  tryAutoUpgradeReseller(result.userId, result.creditedAmount).catch((err) =>
    logger.error(
      { err, topupId: result.topupId },
      "tryAutoUpgradeReseller failed after topup settlement",
    ),
  );

  getPointsSettings()
    .then(async (settings) => {
      if (
        !settings.enabled ||
        result.creditedAmount < settings.pointsMinTopup ||
        settings.pointsRateTopup <= 0
      ) {
        return;
      }
      const points = Math.floor(
        result.creditedAmount / settings.pointsRateTopup,
      );
      if (points > 0) {
        await addPoints(
          result.userId,
          points,
          "topup",
          `Topup QRIS otomatis #${result.topupId}`,
          result.topupId,
        );
      }
    })
    .catch((err) =>
      logger.error(
        { err, topupId: result.topupId },
        "addPoints failed after topup settlement",
      ),
    );
}

async function settleAttemptTopup(
  attemptId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  let postCommit: TopupPostCommit | undefined;

  const result = await db.transaction(async (tx: any) => {
    const [attempt] = await tx
      .select()
      .from(paymentAttemptsTable)
      .where(
        and(
          eq(paymentAttemptsTable.id, attemptId),
          eq(paymentAttemptsTable.provider, input.provider),
        ),
      )
      .for("update")
      .limit(1);

    if (!attempt?.topupId) return { outcome: "not_found" } as SettlementResult;

    const identityError = validateAttemptIdentity(attempt, input);
    if (identityError) return identityError;
    const amountError = validateAttemptAmount(attempt, input);
    if (amountError) return amountError;

    const [topup] = await tx
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.id, attempt.topupId))
      .for("update")
      .limit(1);
    if (!topup) {
      return {
        outcome: "not_found",
        ownerType: "topup",
        ownerId: attempt.topupId,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    const now = new Date();
    const identity = attemptIdentityUpdate(attempt, input);

    if (topup.status === "confirmed") {
      if (attempt.status !== "completed") {
        await tx
          .update(paymentAttemptsTable)
          .set({
            ...identity,
            status: "completed",
            settledAt: attempt.settledAt ?? now,
            completedAt: now,
            lastCheckedAt: now,
            failureCode: null,
            failureMessage: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(paymentAttemptsTable.id, attempt.id),
              ne(paymentAttemptsTable.status, "completed"),
            ),
          );
      }
      return {
        outcome: "already_settled",
        ownerType: "topup",
        ownerId: topup.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    if (
      attempt.status === "completed" ||
      !isRecoverableTopupStatus(topup.status)
    ) {
      return {
        outcome: "invalid_state",
        ownerType: "topup",
        ownerId: topup.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    const [confirmedTopup] = await tx
      .update(topupsTable)
      .set({
        status: "confirmed",
        rejectionNote: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(topupsTable.id, topup.id),
          inArray(topupsTable.status, RECOVERABLE_TOPUP_STATUSES),
        ),
      )
      .returning({ id: topupsTable.id });
    if (!confirmedTopup) {
      return {
        outcome: "already_settled",
        ownerType: "topup",
        ownerId: topup.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    // ShopeePay's unique code is real customer money and must be credited too.
    const creditedAmount = creditedTopupAmount(
      attempt.channel,
      Number(attempt.baseAmount),
      Number(attempt.payableAmount),
    );
    const [updatedUser] = await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${creditedAmount}::numeric` })
      .where(eq(usersTable.id, topup.userId))
      .returning({
        balance: usersTable.balance,
        username: usersTable.username,
      });
    if (!updatedUser) throw new Error("Topup user not found");

    const balanceAfter = Number(updatedUser.balance);
    const balanceBefore = balanceAfter - creditedAmount;
    await tx.insert(balanceLogsTable).values({
      userId: topup.userId,
      type: "topup",
      amount: String(creditedAmount),
      balanceBefore: String(balanceBefore),
      balanceAfter: String(balanceAfter),
      description: "Isi saldo otomatis via QRIS",
      relatedId: topup.id,
    });

    await tx
      .update(paymentAttemptsTable)
      .set({
        ...identity,
        status: "completed",
        settledAt: attempt.settledAt ?? now,
        completedAt: now,
        lastCheckedAt: now,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentAttemptsTable.id, attempt.id),
          ne(paymentAttemptsTable.status, "completed"),
        ),
      );

    postCommit = {
      topupId: topup.id,
      userId: topup.userId,
      creditedAmount,
      newBalance: balanceAfter,
      username: updatedUser.username,
    };

    return {
      outcome: "settled",
      ownerType: "topup",
      ownerId: topup.id,
      attemptId: attempt.id,
    } as SettlementResult;
  });

  if (postCommit) runTopupPostCommit(postCommit);
  return result;
}

interface OrderPostCommit {
  orderId: number;
  userId: number;
  amount: number;
}

function runOrderPostCommit(result: OrderPostCommit): void {
  // Tambah poin jika sistem poin aktif
  getPointsSettings()
    .then(async (settings) => {
      if (
        !settings.enabled ||
        result.amount < settings.pointsMinOrder ||
        settings.pointsRateOrder <= 0
      ) {
        return;
      }
      const points = Math.floor(result.amount / settings.pointsRateOrder);
      if (points > 0) {
        await addPoints(
          result.userId,
          points,
          "order",
          `Order QRIS otomatis #${result.orderId}`,
          result.orderId,
        );
      }
    })
    .catch((err) =>
      logger.error(
        { err, orderId: result.orderId },
        "addPoints failed after order settlement",
      ),
    );
}

async function completePaidOrderAttempt(
  attemptId: number,
): Promise<SettlementResult> {
  let postCommit: OrderPostCommit | undefined;

  const result = await db.transaction(async (tx: any) => {
    const [attempt] = await tx
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, attemptId))
      .for("update")
      .limit(1);
    if (!attempt?.orderId) return { outcome: "not_found" } as SettlementResult;

    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, attempt.orderId))
      .for("update")
      .limit(1);
    if (!order) return { outcome: "not_found" } as SettlementResult;

    if (attempt.status === "completed") {
      return {
        outcome: "already_settled",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }
    if (order.status !== "paid") {
      return {
        outcome: "processing",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    const now = new Date();
    // Use an intermediate state while the order/user/log rows are locked. This
    // makes duplicate completion attempts conditional before balance mutation.
    const [completing] = await tx
      .update(paymentAttemptsTable)
      .set({
        status: "processing",
        lastCheckedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentAttemptsTable.id, attempt.id),
          inArray(paymentAttemptsTable.status, ["paid", "processing"]),
        ),
      )
      .returning({ id: paymentAttemptsTable.id });
    if (!completing) {
      return {
        outcome: "already_settled",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      } as SettlementResult;
    }

    const inferredUniqueCode =
      Number(attempt.payableAmount) - Number(attempt.baseAmount);
    const uniqueCode = Number(attempt.uniqueCode ?? inferredUniqueCode);
    if (Number.isInteger(uniqueCode) && uniqueCode > 0) {
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`${usersTable.balance} + ${uniqueCode}::numeric` })
        .where(eq(usersTable.id, order.userId))
        .returning({ balance: usersTable.balance });
      if (!updatedUser) throw new Error("Order user not found");

      const balanceAfter = Number(updatedUser.balance);
      await tx.insert(balanceLogsTable).values({
        userId: order.userId,
        type: "order_unique_code",
        amount: String(uniqueCode),
        balanceBefore: String(balanceAfter - uniqueCode),
        balanceAfter: String(balanceAfter),
        description: `Pengembalian kode unik pembayaran Order #${order.id}`,
        relatedId: order.id,
      });
    }

    await tx
      .update(paymentAttemptsTable)
      .set({
        status: "completed",
        settledAt: attempt.settledAt ?? now,
        completedAt: now,
        lastCheckedAt: now,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentAttemptsTable.id, attempt.id),
          eq(paymentAttemptsTable.status, "processing"),
        ),
      );

    postCommit = {
      orderId: order.id,
      userId: order.userId,
      amount: Number(order.amount),
    };

    return {
      outcome: "settled",
      ownerType: "order",
      ownerId: order.id,
      attemptId: attempt.id,
    } as SettlementResult;
  });

  if (postCommit) runOrderPostCommit(postCommit);
  return result;
}

async function settleAttemptOrder(
  attemptId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  const claim = await db.transaction(async (tx: any) => {
    const [attempt] = await tx
      .select()
      .from(paymentAttemptsTable)
      .where(
        and(
          eq(paymentAttemptsTable.id, attemptId),
          eq(paymentAttemptsTable.provider, input.provider),
        ),
      )
      .for("update")
      .limit(1);
    if (!attempt?.orderId) return { result: { outcome: "not_found" } };

    const identityError = validateAttemptIdentity(attempt, input);
    if (identityError) return { result: identityError };
    const amountError = validateAttemptAmount(attempt, input);
    if (amountError) return { result: amountError };

    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, attempt.orderId))
      .for("update")
      .limit(1);
    if (!order) {
      return {
        result: {
          outcome: "not_found",
          ownerType: "order",
          ownerId: attempt.orderId,
          attemptId: attempt.id,
        } as SettlementResult,
      };
    }

    if (attempt.status === "completed") {
      return {
        result: {
          outcome: "already_settled",
          ownerType: "order",
          ownerId: order.id,
          attemptId: attempt.id,
        } as SettlementResult,
      };
    }

    const now = new Date();
    const identity = attemptIdentityUpdate(attempt, input);
    let shouldFulfill = false;

    if (order.status === "paid") {
      // A crash may happen after fulfillOrder commits but before attempt completion.
    } else if (isRecoverableOrderStatus(order.status)) {
      const [claimedOrder] = await tx
        .update(ordersTable)
        .set({ status: "processing", updatedAt: now })
        .where(
          and(
            eq(ordersTable.id, order.id),
            inArray(ordersTable.status, RECOVERABLE_ORDER_STATUSES),
          ),
        )
        .returning({ id: ordersTable.id });
      shouldFulfill = Boolean(claimedOrder);
    } else if (order.status === "processing") {
      const leaseExpired =
        !attempt.lastCheckedAt ||
        attempt.lastCheckedAt.getTime() <= now.getTime() - ORDER_RETRY_LEASE_MS;
      shouldFulfill = Boolean(input.retryProcessingOrder && leaseExpired);
    } else {
      return {
        result: {
          outcome: "invalid_state",
          ownerType: "order",
          ownerId: order.id,
          attemptId: attempt.id,
        } as SettlementResult,
      };
    }

    await tx
      .update(paymentAttemptsTable)
      .set({
        ...identity,
        status: "paid",
        settledAt: attempt.settledAt ?? now,
        lastCheckedAt: now,
        failureCode: null,
        failureMessage: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentAttemptsTable.id, attempt.id),
          ne(paymentAttemptsTable.status, "completed"),
        ),
      );

    return {
      orderId: order.id,
      orderAlreadyPaid: order.status === "paid",
      shouldFulfill,
      result: {
        outcome: order.status === "paid" ? "settled" : "processing",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      } as SettlementResult,
    };
  });

  if (!claim.orderId) return claim.result as SettlementResult;

  if (claim.orderAlreadyPaid) return completePaidOrderAttempt(attemptId);
  if (!claim.shouldFulfill) return claim.result as SettlementResult;

  try {
    await fulfillOrder(claim.orderId, { deductBalance: false });
  } catch (err) {
    // A concurrent worker may have completed fulfillment while this one failed.
    const completion = await completePaidOrderAttempt(attemptId);
    if (completion.outcome === "settled") {
      return completion;
    }
    logger.error(
      { err, orderId: claim.orderId, attemptId, source: input.source },
      "Paid order fulfillment failed; leaving it processing for reconciliation",
    );
    return claim.result as SettlementResult;
  }

  return completePaidOrderAttempt(attemptId);
}

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

async function settleLegacyTopup(
  topupId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  let postCommit: TopupPostCommit | undefined;
  const result = await db.transaction(async (tx: any) => {
    const [topup] = await tx
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.id, topupId))
      .for("update")
      .limit(1);
    if (!topup) return { outcome: "not_found" } as SettlementResult;

    const expectedAmount = Number(topup.amount);
    if (
      input.transactionAmount === null ||
      input.transactionAmount === undefined ||
      !isPaymentAmountMatch(input.transactionAmount, expectedAmount)
    ) {
      return {
        outcome: "amount_mismatch",
        ownerType: "topup",
        ownerId: topup.id,
        expectedAmount,
      } as SettlementResult;
    }
    if (topup.status === "confirmed") {
      return {
        outcome: "already_settled",
        ownerType: "topup",
        ownerId: topup.id,
      } as SettlementResult;
    }
    if (!isRecoverableTopupStatus(topup.status)) {
      return {
        outcome: "invalid_state",
        ownerType: "topup",
        ownerId: topup.id,
      } as SettlementResult;
    }

    const [confirmed] = await tx
      .update(topupsTable)
      .set({ status: "confirmed", rejectionNote: null, updatedAt: new Date() })
      .where(
        and(
          eq(topupsTable.id, topup.id),
          inArray(topupsTable.status, RECOVERABLE_TOPUP_STATUSES),
        ),
      )
      .returning({ id: topupsTable.id });
    if (!confirmed) {
      return {
        outcome: "already_settled",
        ownerType: "topup",
        ownerId: topup.id,
      } as SettlementResult;
    }

    const [updatedUser] = await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${expectedAmount}::numeric` })
      .where(eq(usersTable.id, topup.userId))
      .returning({
        balance: usersTable.balance,
        username: usersTable.username,
      });
    if (!updatedUser) throw new Error("Legacy topup user not found");

    const balanceAfter = Number(updatedUser.balance);
    await tx.insert(balanceLogsTable).values({
      userId: topup.userId,
      type: "topup",
      amount: String(expectedAmount),
      balanceBefore: String(balanceAfter - expectedAmount),
      balanceAfter: String(balanceAfter),
      description: "Isi saldo otomatis via QRIS",
      relatedId: topup.id,
    });

    postCommit = {
      topupId: topup.id,
      userId: topup.userId,
      creditedAmount: expectedAmount,
      newBalance: balanceAfter,
      username: updatedUser.username,
    };
    return {
      outcome: "settled",
      ownerType: "topup",
      ownerId: topup.id,
    } as SettlementResult;
  });

  if (postCommit) runTopupPostCommit(postCommit);
  return result;
}

export async function retryLegacyPaidOrder(
  orderId: number,
): Promise<SettlementResult> {
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1, $2) as locked",
      [1_934_771_201, orderId],
    );
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) {
      return { outcome: "processing", ownerType: "order", ownerId: orderId };
    }

    const claim = await db.transaction(async (tx: any) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .for("update")
        .limit(1);
      if (!order) {
        return { result: { outcome: "not_found" } as SettlementResult };
      }
      if (order.status === "paid") {
        return {
          result: {
            outcome: "already_settled",
            ownerType: "order",
            ownerId: order.id,
          } as SettlementResult,
        };
      }
      if (order.status !== "processing") {
        return {
          result: {
            outcome: "invalid_state",
            ownerType: "order",
            ownerId: order.id,
          } as SettlementResult,
        };
      }
      return { orderId: order.id };
    });

    if (!claim.orderId) return claim.result!;
    try {
      await fulfillOrder(claim.orderId, { deductBalance: false });
      return {
        outcome: "settled",
        ownerType: "order",
        ownerId: claim.orderId,
      };
    } catch (err) {
      logger.error(
        { err, orderId: claim.orderId },
        "Legacy paid order retry failed; leaving it processing",
      );
      return {
        outcome: "processing",
        ownerType: "order",
        ownerId: claim.orderId,
      };
    }
  } finally {
    if (locked) {
      await client
        .query("select pg_advisory_unlock($1, $2)", [1_934_771_201, orderId])
        .catch(() => {});
    }
    client.release();
  }
}

async function settleLegacyOrder(
  orderId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  const claim = await db.transaction(async (tx: any) => {
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update")
      .limit(1);
    if (!order) return { result: { outcome: "not_found" } as SettlementResult };

    const expectedAmount = Number(order.amount);
    if (
      input.transactionAmount === null ||
      input.transactionAmount === undefined ||
      !isPaymentAmountMatch(input.transactionAmount, expectedAmount)
    ) {
      return {
        result: {
          outcome: "amount_mismatch",
          ownerType: "order",
          ownerId: order.id,
          expectedAmount,
        } as SettlementResult,
      };
    }
    if (order.status === "paid") {
      return {
        result: {
          outcome: "already_settled",
          ownerType: "order",
          ownerId: order.id,
        } as SettlementResult,
      };
    }
    if (order.status === "processing") {
      return {
        result: {
          outcome: "processing",
          ownerType: "order",
          ownerId: order.id,
        } as SettlementResult,
      };
    }
    if (!isRecoverableOrderStatus(order.status)) {
      return {
        result: {
          outcome: "invalid_state",
          ownerType: "order",
          ownerId: order.id,
        } as SettlementResult,
      };
    }

    const [claimed] = await tx
      .update(ordersTable)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.id, order.id),
          inArray(ordersTable.status, RECOVERABLE_ORDER_STATUSES),
        ),
      )
      .returning({ id: ordersTable.id });
    return claimed
      ? { orderId: order.id }
      : {
          result: {
            outcome: "processing",
            ownerType: "order",
            ownerId: order.id,
          } as SettlementResult,
        };
  });

  if (!claim.orderId) return claim.result!;
  try {
    await fulfillOrder(claim.orderId, { deductBalance: false });
    return {
      outcome: "settled",
      ownerType: "order",
      ownerId: claim.orderId,
    };
  } catch (err) {
    logger.error(
      { err, orderId: claim.orderId, source: input.source },
      "Legacy paid order fulfillment failed; leaving it processing",
    );
    return {
      outcome: "processing",
      ownerType: "order",
      ownerId: claim.orderId,
    };
  }
}

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

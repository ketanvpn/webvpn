import {
  balanceLogsTable,
  db,
  ordersTable,
  paymentAttemptsTable,
  pool,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { logger } from "../logger";
import { fulfillOrder } from "../fulfillment/static-order-fulfillment";
import { addPoints, getPointsSettings } from "../../routes/points";
import {
  isPaymentAmountMatch,
  isRecoverableOrderStatus,
  RECOVERABLE_ORDER_STATUSES,
} from "./settlement-policy";
import {
  ORDER_RETRY_LEASE_MS,
  type OrderPostCommit,
  type SettleProviderPaymentInput,
  type SettlementResult,
} from "./settlement-types";
import {
  attemptIdentityUpdate,
  validateAttemptAmount,
  validateAttemptIdentity,
} from "./settlement";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Advisory lock namespace for legacy order retry. */
const LEGACY_ORDER_LOCK_NS = 1_934_771_201;

// ---------------------------------------------------------------------------
// Post-commit side effects (fire-and-forget)
// ---------------------------------------------------------------------------

function runOrderPostCommit(result: OrderPostCommit): void {
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
        { err, orderId: result.orderId, userId: result.userId },
        "addPoints failed after order settlement",
      ),
    );
}

// ---------------------------------------------------------------------------
// Shared: complete a paid order attempt (unique-code refund + mark complete)
// ---------------------------------------------------------------------------

async function completePaidOrderAttempt(
  attemptId: number,
): Promise<SettlementResult> {
  let postCommit: OrderPostCommit | undefined;

  const result: SettlementResult = await db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.id, attemptId))
      .for("update")
      .limit(1);
    if (!attempt?.orderId) return { outcome: "not_found" };

    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, attempt.orderId))
      .for("update")
      .limit(1);
    if (!order) return { outcome: "not_found" };

    if (attempt.status === "completed") {
      return {
        outcome: "already_settled",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      };
    }
    if (order.status !== "paid") {
      return {
        outcome: "processing",
        ownerType: "order",
        ownerId: order.id,
        attemptId: attempt.id,
      };
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
      };
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
    };
  });

  if (postCommit) runOrderPostCommit(postCommit);
  return result;
}

// ---------------------------------------------------------------------------
// Shared: fulfill order and complete attempt (DRY helper)
// ---------------------------------------------------------------------------

/**
 * Attempt to fulfill a claimed order, then complete its payment attempt.
 *
 * On fulfillment failure:
 *  - Check whether a concurrent worker already completed the order.
 *  - If not, record the failure on the attempt and update `lastCheckedAt`
 *    so the reconciliation lease timer resets properly.
 */
async function fulfillAndCompleteAttempt(
  orderId: number,
  attemptId: number,
  source: string,
  fallbackResult: SettlementResult,
): Promise<SettlementResult> {
  try {
    await fulfillOrder(orderId, { deductBalance: false });
  } catch (err) {
    // A concurrent worker may have completed fulfillment while this one failed.
    const completion = await completePaidOrderAttempt(attemptId);
    if (completion.outcome === "settled") {
      return completion;
    }

    // Record the failure on the attempt so admins can see what went wrong and
    // so that `lastCheckedAt` resets the reconciliation lease timer.
    const failureMessage =
      err instanceof Error ? err.message : "Unknown fulfillment error";
    await db
      .update(paymentAttemptsTable)
      .set({
        lastCheckedAt: new Date(),
        failureCode: "fulfillment_error",
        failureMessage,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentAttemptsTable.id, attemptId),
          ne(paymentAttemptsTable.status, "completed"),
        ),
      )
      .catch((updateErr) =>
        logger.warn(
          { err: updateErr, orderId, attemptId },
          "Failed to record fulfillment failure on attempt",
        ),
      );

    logger.error(
      { err, orderId, attemptId, source },
      "Paid order fulfillment failed; leaving processing for reconciliation retry",
    );
    return fallbackResult;
  }

  return completePaidOrderAttempt(attemptId);
}

// ---------------------------------------------------------------------------
// Modern path: settle via paymentAttempts
// ---------------------------------------------------------------------------

export async function settleAttemptOrder(
  attemptId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  const claim = await db.transaction(async (tx) => {
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
    if (!attempt?.orderId) return { result: { outcome: "not_found" as const } };

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
          outcome: "not_found" as const,
          ownerType: "order" as const,
          ownerId: attempt.orderId,
          attemptId: attempt.id,
        },
      };
    }

    if (attempt.status === "completed") {
      return {
        result: {
          outcome: "already_settled" as const,
          ownerType: "order" as const,
          ownerId: order.id,
          attemptId: attempt.id,
        },
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
          outcome: "invalid_state" as const,
          ownerType: "order" as const,
          ownerId: order.id,
          attemptId: attempt.id,
        },
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
        outcome: (order.status === "paid" ? "settled" : "processing") as
          | "settled"
          | "processing",
        ownerType: "order" as const,
        ownerId: order.id,
        attemptId: attempt.id,
      },
    };
  });

  if (!("orderId" in claim)) return claim.result;

  if (claim.orderAlreadyPaid) return completePaidOrderAttempt(attemptId);
  if (!claim.shouldFulfill) return claim.result;

  return fulfillAndCompleteAttempt(
    claim.orderId,
    attemptId,
    input.source,
    claim.result,
  );
}

// ---------------------------------------------------------------------------
// Legacy path: settle via direct order row (pre-paymentAttempts migration)
// ---------------------------------------------------------------------------

export async function settleLegacyOrder(
  orderId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  const claim = await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update")
      .limit(1);
    if (!order) return { result: { outcome: "not_found" as const } };

    const expectedAmount = Number(order.amount);
    if (
      input.transactionAmount === null ||
      input.transactionAmount === undefined ||
      !isPaymentAmountMatch(input.transactionAmount, expectedAmount)
    ) {
      return {
        result: {
          outcome: "amount_mismatch" as const,
          ownerType: "order" as const,
          ownerId: order.id,
          expectedAmount,
        },
      };
    }
    if (order.status === "paid") {
      return {
        result: {
          outcome: "already_settled" as const,
          ownerType: "order" as const,
          ownerId: order.id,
        },
      };
    }
    if (order.status === "processing") {
      return {
        result: {
          outcome: "processing" as const,
          ownerType: "order" as const,
          ownerId: order.id,
        },
      };
    }
    if (!isRecoverableOrderStatus(order.status)) {
      return {
        result: {
          outcome: "invalid_state" as const,
          ownerType: "order" as const,
          ownerId: order.id,
        },
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
            outcome: "processing" as const,
            ownerType: "order" as const,
            ownerId: order.id,
          },
        };
  });

  if (!("orderId" in claim)) return claim.result;
  const claimedOrderId = claim.orderId as number;
  try {
    await fulfillOrder(claimedOrderId, { deductBalance: false });
    return {
      outcome: "settled",
      ownerType: "order",
      ownerId: claimedOrderId,
    };
  } catch (err) {
    logger.error(
      { err, orderId: claimedOrderId, source: input.source },
      "Legacy paid order fulfillment failed; leaving it processing for reconciliation retry",
    );
    return {
      outcome: "processing",
      ownerType: "order",
      ownerId: claimedOrderId,
    };
  }
}

// ---------------------------------------------------------------------------
// Legacy retry: advisory-lock-based retry for processing orders
//
// FIX: The advisory lock + pool connection are now released BEFORE calling
// fulfillOrder. Previously, the pool connection was held during the entire
// external API call (panel account creation), which could starve the
// connection pool under load.
// ---------------------------------------------------------------------------

export async function retryLegacyPaidOrder(
  orderId: number,
): Promise<SettlementResult> {
  // Phase 1: Acquire advisory lock and validate order status.
  // The lock prevents concurrent retry attempts for the same order.
  const validationResult = await validateWithAdvisoryLock(orderId);
  if (validationResult.outcome !== "ready") {
    return validationResult.result;
  }

  // Phase 2: Fulfill the order WITHOUT holding the advisory lock or pool
  // connection. This is the key fix — fulfillOrder calls external APIs
  // (VPN panel) which can be slow. Holding a pool connection during that
  // call risks connection pool starvation.
  const claimedOrderId = validationResult.claimedOrderId;
  try {
    await fulfillOrder(claimedOrderId, { deductBalance: false });
    return {
      outcome: "settled",
      ownerType: "order",
      ownerId: claimedOrderId,
    };
  } catch (err) {
    logger.error(
      { err, orderId: claimedOrderId },
      "Legacy paid order retry failed; leaving it processing for reconciliation retry",
    );
    return {
      outcome: "processing",
      ownerType: "order",
      ownerId: claimedOrderId,
    };
  }
}

// ---------------------------------------------------------------------------
// Advisory lock helper (scoped lifetime)
// ---------------------------------------------------------------------------

type LockValidationResult =
  | { outcome: "ready"; claimedOrderId: number }
  | { outcome: "skipped"; result: SettlementResult };

/**
 * Acquire an advisory lock for the given order, validate its status, and
 * release the lock + connection before returning. This ensures the pool
 * connection is never held during slow external calls.
 */
async function validateWithAdvisoryLock(
  orderId: number,
): Promise<LockValidationResult> {
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1, $2) as locked",
      [LEGACY_ORDER_LOCK_NS, orderId],
    );
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) {
      return {
        outcome: "skipped",
        result: { outcome: "processing", ownerType: "order", ownerId: orderId },
      };
    }

    const claim = await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .for("update")
        .limit(1);
      if (!order) {
        return { result: { outcome: "not_found" as const } };
      }
      if (order.status === "paid") {
        return {
          result: {
            outcome: "already_settled" as const,
            ownerType: "order" as const,
            ownerId: order.id,
          },
        };
      }
      if (order.status !== "processing") {
        return {
          result: {
            outcome: "invalid_state" as const,
            ownerType: "order" as const,
            ownerId: order.id,
          },
        };
      }
      return { orderId: order.id };
    });

    if (!("orderId" in claim)) {
      return { outcome: "skipped", result: claim.result };
    }
    return { outcome: "ready", claimedOrderId: claim.orderId as number };
  } finally {
    if (locked) {
      await client
        .query("select pg_advisory_unlock($1, $2)", [LEGACY_ORDER_LOCK_NS, orderId])
        .catch((unlockErr) =>
          logger.warn({ err: unlockErr, orderId }, "Failed to release pg_advisory_lock"),
        );
    }
    client.release();
  }
}

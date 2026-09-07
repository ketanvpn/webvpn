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
        { err, orderId: result.orderId },
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
    return claim.result;
  }

  return completePaidOrderAttempt(attemptId);
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
      "Legacy paid order fulfillment failed; leaving it processing",
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
// ---------------------------------------------------------------------------

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
        { err, orderId: claimedOrderId },
        "Legacy paid order retry failed; leaving it processing",
      );
      return {
        outcome: "processing",
        ownerType: "order",
        ownerId: claimedOrderId,
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

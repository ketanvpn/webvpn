import {
  balanceLogsTable,
  db,
  paymentAttemptsTable,
  topupsTable,
  usersTable,
} from "@workspace/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { logger } from "../logger";
import { tryAutoUpgradeReseller } from "../reseller-upgrade";
import {
  notifyAdminTopupAutoConfirmed,
  notifyUserTopupConfirmed,
} from "../telegram";
import { addPoints, getPointsSettings } from "../../routes/points";
import {
  creditedTopupAmount,
  isPaymentAmountMatch,
  isRecoverableTopupStatus,
  RECOVERABLE_TOPUP_STATUSES,
} from "./settlement-policy";
import {
  normalizeIdentifier,
  type SettleProviderPaymentInput,
  type SettlementResult,
  type TopupPostCommit,
} from "./settlement-types";
import {
  attemptIdentityUpdate,
  validateAttemptAmount,
  validateAttemptIdentity,
} from "./settlement";

// ---------------------------------------------------------------------------
// Post-commit side effects (fire-and-forget)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Modern path: settle via paymentAttempts
// ---------------------------------------------------------------------------

export async function settleAttemptTopup(
  attemptId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  let postCommit: TopupPostCommit | undefined;

  const result: SettlementResult = await db.transaction(async (tx) => {
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

    if (!attempt?.topupId) return { outcome: "not_found" };

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
      };
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
      };
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
      };
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
      };
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
    };
  });

  if (postCommit) runTopupPostCommit(postCommit);
  return result;
}

// ---------------------------------------------------------------------------
// Legacy path: settle via direct topup row (pre-paymentAttempts migration)
// ---------------------------------------------------------------------------

export async function settleLegacyTopup(
  topupId: number,
  input: SettleProviderPaymentInput,
): Promise<SettlementResult> {
  let postCommit: TopupPostCommit | undefined;
  const result: SettlementResult = await db.transaction(async (tx) => {
    const [topup] = await tx
      .select()
      .from(topupsTable)
      .where(eq(topupsTable.id, topupId))
      .for("update")
      .limit(1);
    if (!topup) return { outcome: "not_found" };

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
      };
    }
    if (topup.status === "confirmed") {
      return {
        outcome: "already_settled",
        ownerType: "topup",
        ownerId: topup.id,
      };
    }
    if (!isRecoverableTopupStatus(topup.status)) {
      return {
        outcome: "invalid_state",
        ownerType: "topup",
        ownerId: topup.id,
      };
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
      };
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
    };
  });

  if (postCommit) runTopupPostCommit(postCommit);
  return result;
}

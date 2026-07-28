import { db } from "@workspace/db";
import {
  ordersTable,
  paymentAttemptsTable,
  topupsTable,
} from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createPaymentOrchestrator } from "./orchestrator";
import {
  canRetryExistingPaymentAttempt,
  paymentAttemptFailureExpiry,
} from "./ambiguous-creation-policy";
import { paymentCreationFailureState } from "./creation-failure-state";
import {
  isPaymentProviderError,
  PaymentProviderError,
} from "./errors";
import { entityPaymentIdentities } from "./helpers";
import type { PaymentSettingsSource } from "./settings";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentChannel,
  PaymentProvider,
} from "./types";

export type PaymentEntityKind = "order" | "topup";

export interface PaymentEntityReference {
  kind: PaymentEntityKind;
  id: number;
}

export interface CreateEntityQrPaymentInput {
  entity: PaymentEntityReference;
  baseAmount: number;
  settings: PaymentSettingsSource;
  customer?: CreatePaymentInput["customer"];
  description?: string;
  signal?: AbortSignal;
}

export interface CreatedEntityQrPayment {
  payment: NormalizedPayment;
  attemptId: number;
}

const ACTIVE_ATTEMPT_STATUSES = ["creating", "pending", "unknown"] as const;
const SHOPEEPAY_CHANNEL = "autogopay_shopeepay" as const;
const UNIQUE_CODE_MIN = 1;
const UNIQUE_CODE_MAX = 99;
const UNIQUE_CODE_RESERVATION_RETRIES = 3;
const ADVISORY_LOCK_NAMESPACE = 834_917_221;

const entityOwnerValues = (entity: PaymentEntityReference) =>
  entity.kind === "order"
    ? { orderId: entity.id, topupId: null }
    : { orderId: null, topupId: entity.id };

const providerForChannel = (channel: PaymentChannel): PaymentProvider =>
  channel === "ketantechpay" ? "ketantechpay" : "autogopay";

const errorMetadata = (
  error: unknown,
): {
  status: "failed" | "unknown";
  code: string;
  message: string;
} => {
  if (isPaymentProviderError(error)) {
    return {
      status: error.category === "ambiguous" ? "unknown" : "failed",
      code: error.code ?? error.category,
      message: error.message,
    };
  }

  return {
    status: "unknown",
    code: "unexpected_error",
    message: error instanceof Error ? error.message : "Unexpected payment error",
  };
};

const providerError = (
  message: string,
  channel: PaymentChannel,
  code: string,
  cause?: unknown,
): PaymentProviderError =>
  new PaymentProviderError(message, {
    // DB allocation/persistence failures happen before an outbound request, so
    // fallback remains safe and cannot duplicate a provider transaction.
    category: "configuration",
    provider: providerForChannel(channel),
    channel,
    code,
    cause,
  });

const existingAttemptError = (
  attempt: typeof paymentAttemptsTable.$inferSelect,
  channel: PaymentChannel,
): PaymentProviderError =>
  new PaymentProviderError(
    "An existing payment attempt must be reconciled before another charge is created",
    {
      category: "ambiguous",
      provider: providerForChannel(channel),
      channel,
      code: `existing_attempt_${attempt.status}`,
    },
  );

const isUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "object") {
      const candidate = current as {
        code?: unknown;
        constraint?: unknown;
        message?: unknown;
        cause?: unknown;
      };
      if (candidate.code === "23505") return true;
      if (
        typeof candidate.message === "string" &&
        /unique|duplicate key/iu.test(candidate.message)
      ) {
        return true;
      }
      current = candidate.cause;
      continue;
    }
    break;
  }
  return false;
};

const findExistingAttempt = async (
  entity: PaymentEntityReference,
  channel: PaymentChannel,
) => {
  const [attempt] = await db
    .select()
    .from(paymentAttemptsTable)
    .where(
      and(
        entity.kind === "order"
          ? eq(paymentAttemptsTable.orderId, entity.id)
          : eq(paymentAttemptsTable.topupId, entity.id),
        eq(paymentAttemptsTable.channel, channel),
        eq(
          paymentAttemptsTable.matchingKey,
          entityPaymentIdentities(entity, channel).matchingKey,
        ),
      ),
    )
    .limit(1);
  return attempt;
};

const reusableAttemptInput = (
  entity: PaymentEntityReference,
  channel: PaymentChannel,
  baseAmount: number,
  attempt: typeof paymentAttemptsTable.$inferSelect,
): CreatePaymentInput => {
  const identities = entityPaymentIdentities(entity, channel);
  return {
    localReference: identities.localReference,
    idempotencyKey: identities.idempotencyKey,
    baseAmount,
    payableAmount: Number(attempt.payableAmount),
    uniqueCode: attempt.uniqueCode ?? 0,
  };
};

const insertStandardAttempt = async (params: {
  entity: PaymentEntityReference;
  channel: PaymentChannel;
  provider: PaymentProvider;
  baseAmount: number;
}): Promise<{ attemptId: number; input: CreatePaymentInput }> => {
  const { entity, channel, provider, baseAmount } = params;
  const identities = entityPaymentIdentities(entity, channel);
  const existingAttempt = await findExistingAttempt(entity, channel);
  if (existingAttempt) {
    if (!canRetryExistingPaymentAttempt(existingAttempt.status)) {
      throw existingAttemptError(existingAttempt, channel);
    }
    const [resetAttempt] = await db
      .update(paymentAttemptsTable)
      .set({
        status: "creating",
        providerTransactionId: null,
        transactionFingerprint: null,
        baseAmount: String(baseAmount),
        payableAmount: String(baseAmount),
        uniqueCode: 0,
        qrisUrl: null,
        qrString: null,
        checkoutUrl: null,
        failureCode: null,
        failureMessage: null,
        startedAt: new Date(),
        expiresAt: null,
        lastCheckedAt: null,
        settledAt: null,
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttemptsTable.id, existingAttempt.id))
      .returning();
    if (!resetAttempt) {
      throw providerError(
        "Could not reset the payment attempt",
        channel,
        "attempt_reset_failed",
      );
    }
    return {
      attemptId: resetAttempt.id,
      input: reusableAttemptInput(entity, channel, baseAmount, resetAttempt),
    };
  }

  const [attempt] = await db
    .insert(paymentAttemptsTable)
    .values({
      ...entityOwnerValues(entity),
      provider,
      channel,
      status: "creating",
      baseAmount: String(baseAmount),
      payableAmount: String(baseAmount),
      uniqueCode: 0,
      matchingKey: identities.matchingKey,
    })
    .returning({ id: paymentAttemptsTable.id });

  if (!attempt) {
    throw providerError(
      "Could not persist the payment attempt",
      channel,
      "attempt_persistence_failed",
    );
  }

  return {
    attemptId: attempt.id,
    input: {
      localReference: identities.localReference,
      idempotencyKey: identities.idempotencyKey,
      baseAmount,
      payableAmount: baseAmount,
      uniqueCode: 0,
    },
  };
};

const prepareStandardAttempt = async (params: {
  entity: PaymentEntityReference;
  channel: PaymentChannel;
  provider: PaymentProvider;
  baseAmount: number;
}): Promise<{ attemptId: number; input: CreatePaymentInput }> => {
  try {
    return await insertStandardAttempt(params);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existingAttempt = await findExistingAttempt(
      params.entity,
      params.channel,
    );
    if (!existingAttempt) throw error;
    return insertStandardAttempt(params);
  }
};

const reserveShopeePayAttempt = async (params: {
  entity: PaymentEntityReference;
  baseAmount: number;
}): Promise<{ attemptId: number; input: CreatePaymentInput }> => {
  const { entity, baseAmount } = params;
  const identities = entityPaymentIdentities(entity, SHOPEEPAY_CHANNEL);

  for (
    let reservationTry = 0;
    reservationTry < UNIQUE_CODE_RESERVATION_RETRIES;
    reservationTry += 1
  ) {
    try {
      return await db.transaction(async (tx) => {
        // A channel-wide transaction lock protects payable totals across nearby
        // base amounts too (for example 10_000+2 versus 10_001+1).
        await tx.execute(
          sql`select pg_advisory_xact_lock(${ADVISORY_LOCK_NAMESPACE}, hashtext(${SHOPEEPAY_CHANNEL}))`,
        );

        const [existingAttempt] = await tx
          .select()
          .from(paymentAttemptsTable)
          .where(
            and(
              entity.kind === "order"
                ? eq(paymentAttemptsTable.orderId, entity.id)
                : eq(paymentAttemptsTable.topupId, entity.id),
              eq(paymentAttemptsTable.channel, SHOPEEPAY_CHANNEL),
              eq(paymentAttemptsTable.matchingKey, identities.matchingKey),
            ),
          )
          .limit(1);
        if (existingAttempt) {
          if (!canRetryExistingPaymentAttempt(existingAttempt.status)) {
            throw existingAttemptError(existingAttempt, SHOPEEPAY_CHANNEL);
          }
          await tx
            .delete(paymentAttemptsTable)
            .where(eq(paymentAttemptsTable.id, existingAttempt.id));
        }

        const activeAttempts = await tx
          .select({ payableAmount: paymentAttemptsTable.payableAmount })
          .from(paymentAttemptsTable)
          .where(
            and(
              eq(paymentAttemptsTable.channel, SHOPEEPAY_CHANNEL),
              inArray(paymentAttemptsTable.status, [
                ...ACTIVE_ATTEMPT_STATUSES,
              ]),
              sql`${paymentAttemptsTable.expiresAt} is null or ${paymentAttemptsTable.expiresAt} > now()`,
            ),
          );

        const usedPayableAmounts = new Set(
          activeAttempts.map((attempt) => Number(attempt.payableAmount)),
        );
        let uniqueCode: number | undefined;
        for (let code = UNIQUE_CODE_MIN; code <= UNIQUE_CODE_MAX; code += 1) {
          if (!usedPayableAmounts.has(baseAmount + code)) {
            uniqueCode = code;
            break;
          }
        }
        if (uniqueCode === undefined) {
          throw providerError(
            "No ShopeePay unique payment code is currently available",
            SHOPEEPAY_CHANNEL,
            "unique_code_exhausted",
          );
        }

        const payableAmount = baseAmount + uniqueCode;
        const [attempt] = await tx
          .insert(paymentAttemptsTable)
          .values({
            ...entityOwnerValues(entity),
            provider: "autogopay",
            channel: SHOPEEPAY_CHANNEL,
            status: "creating",
            baseAmount: String(baseAmount),
            payableAmount: String(payableAmount),
            uniqueCode,
            matchingKey: identities.matchingKey,
          })
          .returning({ id: paymentAttemptsTable.id });

        if (!attempt) {
          throw providerError(
            "Could not reserve a ShopeePay unique payment code",
            SHOPEEPAY_CHANNEL,
            "unique_code_reservation_failed",
          );
        }

        return {
          attemptId: attempt.id,
          input: {
            localReference: identities.localReference,
            idempotencyKey: identities.idempotencyKey,
            baseAmount,
            payableAmount,
            uniqueCode,
          },
        };
      });
    } catch (error) {
      if (
        isUniqueViolation(error) &&
        reservationTry < UNIQUE_CODE_RESERVATION_RETRIES - 1
      ) {
        continue;
      }
      if (error instanceof PaymentProviderError) throw error;
      throw providerError(
        "Could not reserve a ShopeePay unique payment code",
        SHOPEEPAY_CHANNEL,
        isUniqueViolation(error)
          ? "unique_code_collision"
          : "unique_code_reservation_failed",
        error,
      );
    }
  }

  throw providerError(
    "Could not reserve a ShopeePay unique payment code",
    SHOPEEPAY_CHANNEL,
    "unique_code_collision",
  );
};

const persistSuccessfulAttempt = async (
  attemptId: number,
  payment: NormalizedPayment,
): Promise<void> => {
  await db
    .update(paymentAttemptsTable)
    .set({
      status: "pending",
      providerTransactionId: payment.transactionId ?? null,
      baseAmount: String(payment.baseAmount),
      payableAmount: String(payment.payableAmount),
      uniqueCode: payment.uniqueCode,
      qrisUrl: payment.qrisUrl,
      qrString: payment.qrString ?? null,
      checkoutUrl: payment.checkoutUrl ?? null,
      expiresAt: payment.expiry,
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentAttemptsTable.id, attemptId));
};

const persistFailedAttempt = async (
  attemptId: number,
  error: unknown,
  expiryMinutes: number,
): Promise<void> => {
  const metadata = errorMetadata(error);
  const failureState = paymentCreationFailureState(metadata.status);
  const now = new Date();
  const [attempt] = await db
    .select({ expiresAt: paymentAttemptsTable.expiresAt })
    .from(paymentAttemptsTable)
    .where(eq(paymentAttemptsTable.id, attemptId))
    .limit(1);
  await db
    .update(paymentAttemptsTable)
    .set({
      status: metadata.status,
      failureCode: metadata.code,
      failureMessage: metadata.message,
      expiresAt: paymentAttemptFailureExpiry(
        metadata.status,
        now,
        expiryMinutes,
        attempt?.expiresAt ?? null,
      ),
      completedAt: failureState.attemptCompleted ? now : null,
      updatedAt: now,
    })
    .where(eq(paymentAttemptsTable.id, attemptId));
};

const persistLegacyPaymentFields = async (
  entity: PaymentEntityReference,
  payment: NormalizedPayment,
): Promise<void> => {
  const values = {
    status: "pending",
    paymentProvider: payment.provider,
    paymentChannel: payment.channel,
    payableAmount: String(payment.payableAmount),
    uniqueCode: payment.uniqueCode,
    autogopayTransactionId: payment.transactionId ?? null,
    qrisUrl: payment.qrisUrl,
    expiresAt: payment.expiry,
    updatedAt: new Date(),
  };

  if (entity.kind === "order") {
    await db
      .update(ordersTable)
      .set(values)
      .where(eq(ordersTable.id, entity.id));
  } else {
    await db
      .update(topupsTable)
      .set(values)
      .where(eq(topupsTable.id, entity.id));
  }
};

export const markEntityQrCreationFailed = async (
  entity: PaymentEntityReference,
  error: unknown,
): Promise<void> => {
  const metadata = errorMetadata(error);
  const failureState = paymentCreationFailureState(metadata.status);
  const now = new Date();
  const [attempt] = await db
    .select({ expiresAt: paymentAttemptsTable.expiresAt })
    .from(paymentAttemptsTable)
    .where(
      and(
        entity.kind === "order"
          ? eq(paymentAttemptsTable.orderId, entity.id)
          : eq(paymentAttemptsTable.topupId, entity.id),
        eq(paymentAttemptsTable.status, "unknown"),
      ),
    )
    .limit(1);

  if (entity.kind === "order") {
    await db
      .update(ordersTable)
      .set({
        status: failureState.orderStatus,
        expiresAt:
          metadata.status === "unknown"
            ? attempt?.expiresAt ?? null
            : undefined,
        updatedAt: now,
      })
      .where(eq(ordersTable.id, entity.id));
    return;
  }

  await db
    .update(topupsTable)
    .set({
      status: failureState.topupStatus,
      rejectionNote: failureState.topupRejectionNote,
      expiresAt:
        metadata.status === "unknown" ? attempt?.expiresAt ?? null : undefined,
      updatedAt: now,
    })
    .where(eq(topupsTable.id, entity.id));
};

/**
 * Creates one provider-neutral QR payment for an already persisted local entity.
 * Each channel that is actually reached gets exactly one durable attempt row.
 */
export const createEntityQrPayment = async (
  request: CreateEntityQrPaymentInput,
): Promise<CreatedEntityQrPayment> => {
  const { entity, baseAmount, settings, customer, description, signal } = request;
  const expiryMinutes = (() => {
    const parsed = Number(
      settings.paymentExpiryMinutes ?? settings.qrisExpiryMinutes ?? 15,
    );
    return Number.isFinite(parsed)
      ? Math.min(24 * 60, Math.max(1, Math.trunc(parsed)))
      : 15;
  })();
  let activeAttemptId: number | undefined;
  let attemptedChannel: PaymentChannel | undefined;

  const payment = await createPaymentOrchestrator(settings, {
    lifecycle: {
      async prepareInput({ channel, adapter, input }) {
        activeAttemptId = undefined;
        attemptedChannel = channel;
        const prepared =
          channel === SHOPEEPAY_CHANNEL
            ? await reserveShopeePayAttempt({ entity, baseAmount })
            : await prepareStandardAttempt({
                entity,
                channel,
                provider: adapter.provider,
                baseAmount,
              });
        activeAttemptId = prepared.attemptId;
        return {
          ...input,
          ...prepared.input,
          customer,
          description,
          signal,
        };
      },
      async succeeded({ channel, payment: result }) {
        if (activeAttemptId === undefined || attemptedChannel !== channel) return;
        await persistSuccessfulAttempt(activeAttemptId, result);
      },
      async failed({ channel, error }) {
        if (activeAttemptId === undefined || attemptedChannel !== channel) return;
        await persistFailedAttempt(activeAttemptId, error, expiryMinutes);
      },
    },
  }).create({
    localReference: entityPaymentIdentities(entity, SHOPEEPAY_CHANNEL)
      .localReference,
    idempotencyKey: "prepared-per-channel",
    baseAmount,
    customer,
    description,
    signal,
  });

  if (activeAttemptId === undefined) {
    throw new Error("Payment completed without a persisted attempt");
  }
  await persistLegacyPaymentFields(entity, payment);
  return { payment, attemptId: activeAttemptId };
};

export const createQrPaymentForEntity = createEntityQrPayment;

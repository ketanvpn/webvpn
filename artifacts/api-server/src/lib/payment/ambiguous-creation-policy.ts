import type { PaymentAttemptFailureStatus } from "./creation-failure-state";

/**
 * Only a definitive/configuration failure is safe to recreate. Expired,
 * cancelled, unknown, or successful attempts may still exist provider-side and
 * must never cause a second charge.
 */
export const canRetryExistingPaymentAttempt = (status: string): boolean =>
  status === "failed";

/**
 * Unknown creation has no provider ID to poll, but receives a bounded local
 * payment/review window. Expiry does not erase the attempt, so a late webhook
 * with a safely correlated provider ID can still settle it.
 */
export const paymentAttemptFailureExpiry = (
  status: PaymentAttemptFailureStatus,
  now: Date,
  expiryMinutes: number,
  existingExpiry: Date | null,
): Date | null => {
  if (status !== "unknown") return existingExpiry;
  if (existingExpiry) return existingExpiry;
  return new Date(now.getTime() + expiryMinutes * 60_000);
};

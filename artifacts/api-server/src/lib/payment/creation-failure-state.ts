export type PaymentAttemptFailureStatus = "failed" | "unknown";

export interface PaymentCreationFailureState {
  orderStatus: "pending" | "failed";
  topupStatus: "pending" | "rejected";
  topupRejectionNote: string | null;
  attemptCompleted: boolean;
}

/**
 * An ambiguous provider result is authoritative only on payment_attempts.
 * The public owner stays pending so contracts, expiry, and late settlement keep
 * treating it as recoverable without introducing an undocumented owner status.
 */
export const paymentCreationFailureState = (
  attemptStatus: PaymentAttemptFailureStatus,
): PaymentCreationFailureState =>
  attemptStatus === "unknown"
    ? {
        orderStatus: "pending",
        topupStatus: "pending",
        topupRejectionNote: null,
        attemptCompleted: false,
      }
    : {
        orderStatus: "failed",
        topupStatus: "rejected",
        topupRejectionNote: "Pembuatan QRIS gagal",
        attemptCompleted: true,
      };

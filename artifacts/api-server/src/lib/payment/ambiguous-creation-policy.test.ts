import { describe, expect, it } from "vitest";
import {
  canRetryExistingPaymentAttempt,
  paymentAttemptFailureExpiry,
} from "./ambiguous-creation-policy";

describe("ambiguous payment creation policy", () => {
  it("assigns a bounded local review deadline to an unknown attempt", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(
      paymentAttemptFailureExpiry("unknown", now, 15, null)?.toISOString(),
    ).toBe("2026-07-28T12:15:00.000Z");
  });

  it("preserves an existing provider deadline and leaves definitive failures unchanged", () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    const existing = new Date("2026-07-28T12:10:00.000Z");
    expect(paymentAttemptFailureExpiry("unknown", now, 15, existing)).toBe(
      existing,
    );
    expect(paymentAttemptFailureExpiry("failed", now, 15, null)).toBeNull();
  });

  it("never recreates active or ambiguous attempts", () => {
    for (const status of [
      "creating",
      "pending",
      "unknown",
      "paid",
      "processing",
      "completed",
    ]) {
      expect(canRetryExistingPaymentAttempt(status)).toBe(false);
    }
    expect(canRetryExistingPaymentAttempt("expired")).toBe(false);
    expect(canRetryExistingPaymentAttempt("cancelled")).toBe(false);
    expect(canRetryExistingPaymentAttempt("failed")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  creditedTopupAmount,
  isPaymentAmountMatch,
  isRecoverableOrderStatus,
  isRecoverableTopupStatus,
  isSettlementIdentityConflict,
  isUniqueConstraintViolation,
} from "./settlement-policy";

describe("settlement policy", () => {
  it("recovers pending, rejected, and expired owners after a late payment", () => {
    expect(["pending", "rejected", "expired"].every(isRecoverableTopupStatus)).toBe(true);
    expect(["pending", "rejected", "expired"].every(isRecoverableOrderStatus)).toBe(true);
    expect(isRecoverableTopupStatus("confirmed")).toBe(false);
    expect(isRecoverableOrderStatus("paid")).toBe(false);
  });

  it("credits the whole paid amount only for ShopeePay topups", () => {
    expect(creditedTopupAmount("autogopay_shopeepay", 10_000, 10_042)).toBe(10_042);
    expect(creditedTopupAmount("autogopay_gopay", 10_000, 10_000)).toBe(10_000);
    expect(creditedTopupAmount("ketantechpay", 10_000, 10_000)).toBe(10_000);
  });

  it("matches provider amounts exactly to the cent", () => {
    expect(isPaymentAmountMatch(10_000, 10_000)).toBe(true);
    expect(isPaymentAmountMatch(10_000.004, 10_000)).toBe(true);
    expect(isPaymentAmountMatch(10_000.01, 10_000)).toBe(false);
    expect(isPaymentAmountMatch(Number.NaN, 10_000)).toBe(false);
  });

  it("rejects a provider identity that conflicts with an identity already bound to the attempt", () => {
    expect(isSettlementIdentityConflict("trx-1", "trx-2")).toBe(true);
    expect(isSettlementIdentityConflict("trx-1", "trx-1")).toBe(false);
    expect(isSettlementIdentityConflict(null, "trx-1")).toBe(false);
    expect(isSettlementIdentityConflict("trx-1", undefined)).toBe(false);
  });

  it("recognizes PostgreSQL unique violations through wrapped database errors", () => {
    expect(isUniqueConstraintViolation({ code: "23505" })).toBe(true);
    expect(
      isUniqueConstraintViolation({
        message: "query failed",
        cause: { code: "23505" },
      }),
    ).toBe(true);
    expect(isUniqueConstraintViolation(new Error("connection failed"))).toBe(false);
  });
});

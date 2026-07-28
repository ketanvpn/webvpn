import { describe, expect, it } from "vitest";
import {
  entityPaymentIdentities,
  isPaidStatus,
  matchesShopeeTransaction,
  parseChannelOrder,
  shopeeTransactionFingerprint,
} from "./helpers";

describe("payment helpers", () => {
  it.each([
    "paid",
    "SUCCESS",
    "settlement",
    "settled",
    "completed",
    "captured",
  ])("recognizes %s as paid", (status) => {
    expect(isPaidStatus(status)).toBe(true);
  });

  it.each(["pending", "failed", "expired", undefined, { status: "pending" }])(
    "does not recognize %j as paid",
    (status) => {
      expect(isPaidStatus(status)).toBe(false);
    },
  );

  it("parses aliases, drops duplicates, and ignores unknown channels", () => {
    expect(
      parseChannelOrder("shopee-pay > ketantech > gopay > shopeepay > unknown"),
    ).toEqual([
      "autogopay_shopeepay",
      "ketantechpay",
      "autogopay_gopay",
    ]);
  });

  it("derives the same ShopeePay identities used during creation and reconciliation", () => {
    const identities = entityPaymentIdentities(
      { kind: "order", id: 42 },
      "autogopay_shopeepay",
    );

    expect(identities).toEqual({
      localReference: "webvpn-order-42",
      idempotencyKey: "webvpn:order:42:autogopay_shopeepay:create:v1",
      matchingKey: "autogopay_shopeepay:webvpn-order-42",
    });
    expect(
      matchesShopeeTransaction(
        {
          reference: identities.localReference,
          idempotency_key: identities.idempotencyKey,
          amount: 10_042,
          status: "success",
        },
        {
          localReference: identities.localReference,
          idempotencyKey: identities.idempotencyKey,
          baseAmount: 10_000,
          payableAmount: 10_042,
        },
      ),
    ).toBe(true);
  });

  it("matches ShopeePay by exact payable amount and payment window", () => {
    const transaction = {
      id: "sp-001",
      amount: 10_042,
      status: "success",
      transactionTime: "2026-07-28T12:05:00Z",
    };

    expect(
      matchesShopeeTransaction(transaction, {
        baseAmount: 10_000,
        payableAmount: 10_042,
        uniqueCode: 42,
        createdAfter: new Date("2026-07-28T12:00:00Z"),
        createdBefore: new Date("2026-07-28T12:15:00Z"),
      }),
    ).toBe(true);
    expect(
      matchesShopeeTransaction({ ...transaction, amount: 10_041 }, {
        baseAmount: 10_000,
        payableAmount: 10_042,
        uniqueCode: 42,
      }),
    ).toBe(false);
  });

  it("rejects an explicit reference mismatch even when the amount matches", () => {
    expect(
      matchesShopeeTransaction(
        {
          reference: "another-order",
          amount: 10_042,
          status: "success",
        },
        {
          localReference: "webvpn-order-42",
          baseAmount: 10_000,
          payableAmount: 10_042,
        },
      ),
    ).toBe(false);
  });

  it("builds the same fingerprint regardless of object property order", () => {
    const first = {
      id: "sp-001",
      reference: "webvpn-topup-9",
      amount: "25031",
      uniqueCode: 31,
      transactionTime: "2026-07-28T12:05:00Z",
    };
    const second = {
      transactionTime: "2026-07-28T12:05:00Z",
      uniqueCode: 31,
      amount: "25031",
      reference: "webvpn-topup-9",
      id: "sp-001",
    };

    expect(shopeeTransactionFingerprint(first)).toBe(
      shopeeTransactionFingerprint(second),
    );
  });
});

import { describe, expect, it } from "vitest";
import { manualTopupCredit } from "./manual-topup-policy";

describe("manualTopupCredit", () => {
  it("credits the payable amount for a ShopeePay topup with a unique code", () => {
    expect(
      manualTopupCredit({
        paymentChannel: "autogopay_shopeepay",
        amount: "10000.00",
        payableAmount: "10042.00",
      }),
    ).toBe(10_042);
  });

  it("credits the base amount for non-ShopeePay and legacy topups", () => {
    expect(
      manualTopupCredit({
        paymentChannel: "autogopay_gopay",
        amount: "10000.00",
        payableAmount: "10000.00",
      }),
    ).toBe(10_000);
    expect(
      manualTopupCredit({
        paymentChannel: null,
        amount: "10000.00",
        payableAmount: null,
      }),
    ).toBe(10_000);
  });
});

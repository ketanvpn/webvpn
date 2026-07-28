import { describe, expect, it } from "vitest";
import { formatShopeeTransactionsStartTime } from "./reconciliation-format";

describe("formatShopeeTransactionsStartTime", () => {
  it("uses the Unix timestamp format required by AutoGoPay", () => {
    expect(
      formatShopeeTransactionsStartTime(new Date("2026-07-28T12:34:56.789Z")),
    ).toBe("1785242096");
  });

  it("rejects invalid dates", () => {
    expect(() => formatShopeeTransactionsStartTime(new Date("invalid"))).toThrow(
      "Invalid ShopeePay transaction start time",
    );
  });
});

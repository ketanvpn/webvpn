import { describe, it, expect } from "vitest";
import { parseOrderStatus, parseIsDynamicFlag, extractIsDynamicFromOrder } from "./parse-order";

describe("parseOrderStatus", () => {
  it("returns valid status for known values", () => {
    expect(parseOrderStatus("pending")).toBe("pending");
    expect(parseOrderStatus("processing")).toBe("processing");
    expect(parseOrderStatus("paid")).toBe("paid");
    expect(parseOrderStatus("failed")).toBe("failed");
    expect(parseOrderStatus("expired")).toBe("expired");
  });

  it("returns null for unknown values", () => {
    expect(parseOrderStatus("unknown")).toBeNull();
    expect(parseOrderStatus("")).toBeNull();
    expect(parseOrderStatus(null)).toBeNull();
    expect(parseOrderStatus(undefined)).toBeNull();
    expect(parseOrderStatus(123)).toBeNull();
    expect(parseOrderStatus({})).toBeNull();
  });
});

describe("parseIsDynamicFlag", () => {
  it("returns true only for true boolean", () => {
    expect(parseIsDynamicFlag(true)).toBe(true);
    expect(parseIsDynamicFlag(false)).toBe(false);
    expect(parseIsDynamicFlag("true")).toBe(false);
    expect(parseIsDynamicFlag(1)).toBe(false);
    expect(parseIsDynamicFlag(null)).toBe(false);
    expect(parseIsDynamicFlag(undefined)).toBe(false);
  });
});

describe("extractIsDynamicFromOrder", () => {
  it("returns true when order has isDynamic: true", () => {
    expect(extractIsDynamicFromOrder({ id: 1, isDynamic: true })).toBe(true);
  });

  it("returns false when order has isDynamic: false", () => {
    expect(extractIsDynamicFromOrder({ id: 1, isDynamic: false })).toBe(false);
  });

  it("returns false when order lacks isDynamic property", () => {
    expect(extractIsDynamicFromOrder({ id: 1 })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(extractIsDynamicFromOrder(null)).toBe(false);
    expect(extractIsDynamicFromOrder(undefined)).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(extractIsDynamicFromOrder("string")).toBe(false);
    expect(extractIsDynamicFromOrder(123)).toBe(false);
  });
});

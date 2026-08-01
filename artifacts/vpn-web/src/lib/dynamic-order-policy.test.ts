import { describe, it, expect } from "vitest";
import {
  validateUsername,
  getUnmetCheckoutRequirements,
  getServerSelectability,
  getDurationFieldLabel,
  getOrderStatusMetadata,
  type DynamicOrderPolicyInput,
  type CheckoutRequirement,
  type ServerSelectability,
  type OrderStatusMetadata,
} from "./dynamic-order-policy";
import { parseOrderStatus, parseIsDynamicFlag } from "./parse-order";

describe("validateUsername", () => {
  it("returns false when username is less than 5 characters", () => {
    expect(validateUsername("abc1")).toBe(false);
  });

  it("returns false when username has no letters", () => {
    expect(validateUsername("12345")).toBe(false);
  });

  it("returns false when username has fewer than 2 digits", () => {
    expect(validateUsername("abcde")).toBe(false);
  });

  it("returns true when username has 5+ chars, at least 1 letter, and at least 2 digits", () => {
    expect(validateUsername("ketan12")).toBe(true);
  });

  it("returns true for username with mixed case letters and 2+ digits", () => {
    expect(validateUsername("User99")).toBe(true);
  });

  it("returns false for username with special characters (after sanitization check)", () => {
    expect(validateUsername("user@12")).toBe(false);
  });
});

describe("getUnmetCheckoutRequirements", () => {
  const baseInput: DynamicOrderPolicyInput = {
    selectedServer: null,
    protocol: "",
    durationType: "month",
    duration: 1,
    username: "",
    password: "",
    balance: 0,
    quote: null,
    pendingOrders: [],
  };

  it("returns server requirement when no server selected", () => {
    const result = getUnmetCheckoutRequirements(baseInput);
    expect(result).toContainEqual<CheckoutRequirement>({ type: "server", message: "Pilih server VPN terlebih dahulu" });
  });

  it("returns protocol requirement when server selected but no protocol", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["ssh", "vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({ type: "protocol", message: "Pilih protocol VPN" });
  });

  it("returns duration requirement when duration is 0 or invalid", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["ssh"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "ssh",
      duration: 0,
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({ type: "duration", message: "Masukkan durasi yang valid" });
  });

  it("returns username requirement when username is invalid", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["ssh"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "ssh",
      duration: 1,
      username: "abc",
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({
      type: "username",
      message: "Username minimal 5 karakter dengan minimal 2 angka",
    });
  });

  it("returns SSH password requirement when protocol is SSH and password is missing", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["ssh"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "ssh",
      duration: 1,
      username: "user12",
      password: "",
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({
      type: "sshPassword",
      message: "Password SSH wajib diisi (minimal 6 karakter)",
    });
  });

  it("does not require SSH password when protocol is not SSH", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "vmess",
      duration: 1,
      username: "user12",
      password: "",
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result.find((r) => r.type === "sshPassword")).toBeUndefined();
  });

  it("returns quote requirement when quote is null", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "vmess",
      duration: 1,
      username: "user12",
      quote: null,
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({ type: "quote", message: "Menunggu kalkulasi harga" });
  });

  it("returns balance requirement when balance is insufficient", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "vmess",
      duration: 1,
      username: "user12",
      quote: { amount: 50000, baseAmount: 50000, unitPrice: 50000, durationLabel: "1 Bulan", resellerDiscountAmount: 0, voucherDiscountAmount: 0, discountAmount: 0, voucherCode: null },
      balance: 30000,
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result.find((r) => r.type === "balance")).toBeDefined();
    expect(result.find((r) => r.type === "balance")?.message).toContain("Saldo tidak cukup");
  });

  it("returns pending order requirement when user has pending orders", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "vmess",
      duration: 1,
      username: "user12",
      quote: { amount: 50000, baseAmount: 50000, unitPrice: 50000, durationLabel: "1 Bulan", resellerDiscountAmount: 0, voucherDiscountAmount: 0, discountAmount: 0, voucherCode: null },
      balance: 100000,
      pendingOrders: [{ id: 1, status: "pending" }],
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toContainEqual<CheckoutRequirement>({
      type: "pending",
      message: "Selesaikan order pending terlebih dahulu",
    });
  });

  it("returns empty array when all requirements are met", () => {
    const input: DynamicOrderPolicyInput = {
      ...baseInput,
      selectedServer: {
        id: 1,
        displayName: "Test Server",
        enabledProtocols: ["vmess"],
        supportedTypes: ["month"],
        capacityIsFull: false,
      },
      protocol: "vmess",
      duration: 1,
      username: "user12",
      quote: { amount: 50000, baseAmount: 50000, unitPrice: 50000, durationLabel: "1 Bulan", resellerDiscountAmount: 0, voucherDiscountAmount: 0, discountAmount: 0, voucherCode: null },
      balance: 100000,
      pendingOrders: [],
    };
    const result = getUnmetCheckoutRequirements(input);
    expect(result).toEqual([]);
  });
});

describe("getServerSelectability", () => {
  it("returns not selectable with full message when server capacity is full", () => {
    const server = {
      id: 1,
      displayName: "Full Server",
      capacityIsFull: true,
      capacityUsed: 100,
      capacityLimit: "100",
    };
    const result = getServerSelectability(server);
    const expected: ServerSelectability = {
      isSelectable: false,
      message: "Server penuh (100/100 akun). Pilih server lain.",
    };
    expect(result).toEqual(expected);
  });

  it("returns selectable with no message when server has capacity", () => {
    const server = {
      id: 1,
      displayName: "Available Server",
      capacityIsFull: false,
      capacityUsed: 50,
      capacityLimit: "100",
    };
    const result = getServerSelectability(server);
    const expected: ServerSelectability = {
      isSelectable: true,
      message: null,
    };
    expect(result).toEqual(expected);
  });

  it("returns selectable when capacity limit is unlimited (null)", () => {
    const server = {
      id: 1,
      displayName: "Unlimited Server",
      capacityIsFull: false,
      capacityUsed: 0,
      capacityLimit: null,
    };
    const result = getServerSelectability(server);
    expect(result.isSelectable).toBe(true);
    expect(result.message).toBeNull();
  });
});

describe("getDurationFieldLabel", () => {
  it("returns 'Jumlah Hari' for day duration type", () => {
    expect(getDurationFieldLabel("day")).toBe("Jumlah Hari");
  });

  it("returns 'Jumlah Minggu' for week duration type", () => {
    expect(getDurationFieldLabel("week")).toBe("Jumlah Minggu");
  });

  it("returns 'Jumlah Bulan' for month duration type", () => {
    expect(getDurationFieldLabel("month")).toBe("Jumlah Bulan");
  });
});

describe("getOrderStatusMetadata", () => {
  it("returns correct metadata for pending status", () => {
    const result = getOrderStatusMetadata("pending");
    const expected: OrderStatusMetadata = {
      label: "Menunggu Diproses",
      description: "Order menunggu pembayaran",
      color: "warning",
      isRetryable: true,
      nextAction: "Lakukan pembayaran untuk melanjutkan",
    };
    expect(result).toEqual(expected);
  });

  it("returns correct metadata for processing status", () => {
    const result = getOrderStatusMetadata("processing");
    const expected: OrderStatusMetadata = {
      label: "Sedang Diproses",
      description: "Order sedang diproses sistem",
      color: "info",
      isRetryable: false,
      nextAction: "Mohon tunggu, hindari membuat order duplikat",
    };
    expect(result).toEqual(expected);
  });

  it("returns correct metadata for paid status", () => {
    const result = getOrderStatusMetadata("paid");
    const expected: OrderStatusMetadata = {
      label: "Berhasil",
      description: "Pembayaran berhasil, akun VPN aktif",
      color: "success",
      isRetryable: false,
      nextAction: null,
    };
    expect(result).toEqual(expected);
  });

  it("returns correct metadata for failed status", () => {
    const result = getOrderStatusMetadata("failed");
    const expected: OrderStatusMetadata = {
      label: "Gagal",
      description: "Order gagal diproses",
      color: "destructive",
      isRetryable: true,
      nextAction: "Coba lagi atau hubungi bantuan",
    };
    expect(result).toEqual(expected);
  });

  it("returns correct metadata for expired status", () => {
    const result = getOrderStatusMetadata("expired");
    const expected: OrderStatusMetadata = {
      label: "Kedaluwarsa",
      description: "Order kedaluwarsa karena tidak dibayar",
      color: "muted",
      isRetryable: false,
      nextAction: null,
    };
    expect(result).toEqual(expected);
  });

  it("exhaustively handles all status values", () => {
    const statuses: Array<"pending" | "processing" | "paid" | "failed" | "expired"> = [
      "pending",
      "processing",
      "paid",
      "failed",
      "expired",
    ];
    statuses.forEach((status) => {
      const result = getOrderStatusMetadata(status);
      expect(result).toBeDefined();
      expect(result.label).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.color).toBeDefined();
      expect(typeof result.isRetryable).toBe("boolean");
    });
  });
});

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

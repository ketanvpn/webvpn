import type { DynamicDurationType } from "./dynamic-duration";

export type CheckoutRequirementType =
  | "server"
  | "protocol"
  | "duration"
  | "username"
  | "sshPassword"
  | "quote"
  | "balance"
  | "pending";

export type CheckoutRequirement = {
  readonly type: CheckoutRequirementType;
  readonly message: string;
};

export type ServerSelectability = {
  readonly isSelectable: boolean;
  readonly message: string | null;
};

export type OrderStatus = "pending" | "processing" | "paid" | "failed" | "expired";

export type OrderStatusMetadata = {
  readonly label: string;
  readonly description: string;
  readonly color: "warning" | "info" | "success" | "destructive" | "muted";
  readonly isRetryable: boolean;
  readonly nextAction: string | null;
};

export type QuoteData = {
  readonly amount: number;
  readonly baseAmount: number;
  readonly unitPrice: number;
  readonly durationLabel: string;
  readonly resellerDiscountAmount: number;
  readonly voucherDiscountAmount: number;
  readonly discountAmount: number;
  readonly voucherCode: string | null;
};

export type DynamicServerInfo = {
  readonly id: number;
  readonly displayName: string;
  readonly enabledProtocols: readonly string[];
  readonly supportedTypes: readonly DynamicDurationType[];
  readonly capacityIsFull: boolean;
  readonly capacityUsed?: number;
  readonly capacityLimit?: string | null;
};

export type PendingOrderInfo = {
  readonly id: number;
  readonly status: string;
};

export type DynamicOrderPolicyInput = {
  readonly selectedServer: DynamicServerInfo | null;
  readonly protocol: string;
  readonly durationType: DynamicDurationType;
  readonly duration: number;
  readonly username: string;
  readonly password: string;
  readonly balance: number;
  readonly quote: QuoteData | null;
  readonly pendingOrders: readonly PendingOrderInfo[];
};

export function validateUsername(username: string): boolean {
  if (username.length < 5) return false;
  const hasLetter = /[a-zA-Z]/.test(username);
  const digitCount = (username.match(/[0-9]/g) || []).length;
  if (!hasLetter || digitCount < 2) return false;
  const isValidFormat = /^[a-zA-Z0-9]+$/.test(username);
  return isValidFormat;
}

export function getUnmetCheckoutRequirements(
  input: DynamicOrderPolicyInput
): readonly CheckoutRequirement[] {
  const requirements: CheckoutRequirement[] = [];

  if (!input.selectedServer) {
    requirements.push({ type: "server", message: "Pilih server VPN terlebih dahulu" });
    return requirements;
  }

  if (!input.protocol) {
    requirements.push({ type: "protocol", message: "Pilih protocol VPN" });
  }

  if (!input.duration || input.duration < 1) {
    requirements.push({ type: "duration", message: "Masukkan durasi yang valid" });
  }

  if (!validateUsername(input.username)) {
    requirements.push({
      type: "username",
      message: "Username minimal 5 karakter dengan minimal 2 angka",
    });
  }

  if (input.protocol === "ssh" && input.password.length < 6) {
    requirements.push({
      type: "sshPassword",
      message: "Password SSH wajib diisi (minimal 6 karakter)",
    });
  }

  if (!input.quote) {
    requirements.push({ type: "quote", message: "Menunggu kalkulasi harga" });
  } else if (input.balance < input.quote.amount) {
    const shortfall = input.quote.amount - input.balance;
    const formattedShortfall = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(shortfall);
    requirements.push({
      type: "balance",
      message: `Saldo tidak cukup. Kurang ${formattedShortfall}`,
    });
  }

  if (input.pendingOrders.length > 0) {
    requirements.push({
      type: "pending",
      message: "Selesaikan order pending terlebih dahulu",
    });
  }

  return requirements;
}

export function getServerSelectability(server: {
  readonly capacityIsFull: boolean;
  readonly capacityUsed?: number;
  readonly capacityLimit?: string | null;
}): ServerSelectability {
  if (server.capacityIsFull) {
    const used = server.capacityUsed ?? 0;
    const limit = server.capacityLimit ?? "∞";
    return {
      isSelectable: false,
      message: `Server penuh (${used}/${limit} akun). Pilih server lain.`,
    };
  }

  return {
    isSelectable: true,
    message: null,
  };
}

export function getDurationFieldLabel(durationType: DynamicDurationType): string {
  switch (durationType) {
    case "day":
      return "Jumlah Hari";
    case "week":
      return "Jumlah Minggu";
    case "month":
      return "Jumlah Bulan";
  }
}

export function getOrderStatusMetadata(status: OrderStatus): OrderStatusMetadata {
  switch (status) {
    case "pending":
      return {
        label: "Menunggu Diproses",
        description: "Order menunggu pembayaran",
        color: "warning",
        isRetryable: true,
        nextAction: "Lakukan pembayaran untuk melanjutkan",
      };
    case "processing":
      return {
        label: "Sedang Diproses",
        description: "Order sedang diproses sistem",
        color: "info",
        isRetryable: false,
        nextAction: "Mohon tunggu, hindari membuat order duplikat",
      };
    case "paid":
      return {
        label: "Berhasil",
        description: "Pembayaran berhasil, akun VPN aktif",
        color: "success",
        isRetryable: false,
        nextAction: null,
      };
    case "failed":
      return {
        label: "Gagal",
        description: "Order gagal diproses",
        color: "destructive",
        isRetryable: true,
        nextAction: "Coba lagi atau hubungi bantuan",
      };
    case "expired":
      return {
        label: "Kedaluwarsa",
        description: "Order kedaluwarsa karena tidak dibayar",
        color: "muted",
        isRetryable: false,
        nextAction: null,
      };
  }
}

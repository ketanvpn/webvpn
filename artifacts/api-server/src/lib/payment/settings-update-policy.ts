import { PAYMENT_CHANNELS, type PaymentChannel } from "./types";

const MAX_PAYMENT_CHANNELS = PAYMENT_CHANNELS.length;

export const paymentChannelOrderValidationError = (
  order: unknown,
): string | null => {
  if (!Array.isArray(order) || order.length === 0) {
    return `paymentChannelOrder harus berisi minimal satu channel dari: ${PAYMENT_CHANNELS.join(", ")}`;
  }
  if (order.length > MAX_PAYMENT_CHANNELS) {
    return `paymentChannelOrder maksimal ${MAX_PAYMENT_CHANNELS} channel`;
  }
  if (
    !order.every(
      (channel): channel is PaymentChannel =>
        typeof channel === "string" &&
        (PAYMENT_CHANNELS as readonly string[]).includes(channel),
    )
  ) {
    return `paymentChannelOrder hanya boleh berisi: ${PAYMENT_CHANNELS.join(", ")}`;
  }
  if (new Set(order).size !== order.length) {
    return "paymentChannelOrder tidak boleh mengandung channel duplikat";
  }
  return null;
};

export interface PaymentSettingsUsabilityInput {
  ketantechPayEnabled: boolean;
  ketantechPayBaseUrl?: string | null;
  autoGopayGopayEnabled: boolean;
  autoGopayShopeePayEnabled: boolean;
  autoGopayApiUrl?: string | null;
  autoGopaySecretKey?: string | null;
  autoGopayShopeePayQrisStatic?: string | null;
}

const configured = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const paymentSettingsUsabilityError = (
  settings: PaymentSettingsUsabilityInput,
): string | null => {
  if (
    !settings.ketantechPayEnabled &&
    !settings.autoGopayGopayEnabled &&
    !settings.autoGopayShopeePayEnabled
  ) {
    return "Aktifkan minimal satu channel pembayaran";
  }

  if (
    settings.ketantechPayEnabled &&
    !configured(settings.ketantechPayBaseUrl)
  ) {
    return "Base URL KetantechPay wajib diisi saat channel aktif";
  }

  if (
    (settings.autoGopayGopayEnabled ||
      settings.autoGopayShopeePayEnabled) &&
    !configured(settings.autoGopayApiUrl)
  ) {
    return "Base URL AutoGoPay wajib diisi saat channel aktif";
  }

  if (
    (settings.autoGopayGopayEnabled ||
      settings.autoGopayShopeePayEnabled) &&
    !configured(settings.autoGopaySecretKey)
  ) {
    return "API Key AutoGoPay wajib diisi saat channel aktif";
  }

  if (
    settings.autoGopayShopeePayEnabled &&
    !configured(settings.autoGopayShopeePayQrisStatic)
  ) {
    return "Payload QRIS statis ShopeePay wajib diisi saat channel aktif";
  }

  return null;
};

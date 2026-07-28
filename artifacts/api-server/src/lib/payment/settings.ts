import { parseChannelOrder } from "./helpers";
import { PAYMENT_CHANNELS, type PaymentChannel } from "./types";

export type PaymentSettingsSource = Readonly<Record<string, unknown>>;

export interface KetantechPaySettings {
  enabled: boolean;
  baseUrl?: string;
  clientKey?: string;
}

export interface AutoGoPayChannelSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
}

export interface AutoGoPayShopeePaySettings extends AutoGoPayChannelSettings {
  /** Raw static QR payload. Keep this value out of logs and error messages. */
  staticQrString?: string;
}

export interface PaymentSettings {
  channelOrder: PaymentChannel[];
  fallbackEnabled: boolean;
  timeoutMs: number;
  expiryMinutes: number;
  ketantechpay: KetantechPaySettings;
  autoGopayGoPay: AutoGoPayChannelSettings;
  autoGopayShopeePay: AutoGoPayShopeePaySettings;
}

const DEFAULT_AUTOGOPAY_URL = "https://v1-gateway.autogopay.site";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_EXPIRY_MINUTES = 15;
const DEFAULT_CHANNEL_ORDER: readonly PaymentChannel[] = PAYMENT_CHANNELS;

const firstValue = (
  source: PaymentSettingsSource,
  keys: readonly string[],
): unknown => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const optionalString = (
  source: PaymentSettingsSource,
  keys: readonly string[],
): string | undefined => {
  const value = firstValue(source, keys);
  if (value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
};

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "disabled"].includes(normalized))
    return false;
  return fallback;
};

const boundedInteger = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(parsed)));
};

const cleanBaseUrl = (url: string | undefined): string | undefined =>
  url?.trim().replace(/\/+$/u, "") || undefined;

const legacyOrder = (source: PaymentSettingsSource): PaymentChannel[] => {
  const activeGateway = optionalString(source, [
    "activeGateway",
    "paymentActiveGateway",
    "paymentGateway",
  ]);
  if (!activeGateway) return [];
  if (activeGateway === "qris_static") return [...DEFAULT_CHANNEL_ORDER];
  const first = parseChannelOrder(activeGateway);
  return first.length === 0
    ? [...DEFAULT_CHANNEL_ORDER]
    : [
        ...first,
        ...DEFAULT_CHANNEL_ORDER.filter((channel) => !first.includes(channel)),
      ];
};

export const parsePaymentSettings = (
  source: PaymentSettingsSource,
): PaymentSettings => {
  const legacy = legacyOrder(source);
  const explicitOrder = firstValue(source, [
    "paymentChannelOrder",
    "paymentChannelsOrder",
    "paymentProviderOrder",
    "paymentGatewayOrder",
    "channelOrder",
  ]);
  const channelOrder = parseChannelOrder(
    explicitOrder,
    legacy.length > 0 ? legacy : DEFAULT_CHANNEL_ORDER,
  );

  const genericAutoGoPayUrl =
    cleanBaseUrl(
      optionalString(source, ["autoGopayApiUrl", "autogopayApiUrl"]),
    ) ?? DEFAULT_AUTOGOPAY_URL;
  const genericAutoGoPayKey = optionalString(source, [
    "autoGopaySecretKey",
    "autoGopayApiKey",
    "autogopaySecretKey",
    "autogopayApiKey",
  ]);

  const inOrder = (channel: PaymentChannel): boolean =>
    channelOrder.includes(channel);
  const autoGopayLegacyEnabled = parseBoolean(
    firstValue(source, ["autoGopayEnabled", "autogopayEnabled"]),
    false,
  );

  const ketantechEnabled = parseBoolean(
    firstValue(source, ["ketantechPayEnabled", "ketantechpayEnabled"]),
    legacy[0] === "ketantechpay",
  );
  const goPayEnabled = parseBoolean(
    firstValue(source, [
      "autoGopayGopayEnabled",
      "autoGopayGoPayEnabled",
      "autogopayGopayEnabled",
      "autogopayGoPayEnabled",
      "gopayEnabled",
    ]),
    (autoGopayLegacyEnabled || legacy[0] === "autogopay_gopay") &&
      inOrder("autogopay_gopay"),
  );
  const shopeePayEnabled = parseBoolean(
    firstValue(source, [
      "autoGopayShopeePayEnabled",
      "autogopayShopeePayEnabled",
      "shopeePayEnabled",
    ]),
    false,
  );

  return {
    channelOrder: channelOrder.filter((channel) => {
      if (channel === "ketantechpay") return ketantechEnabled;
      if (channel === "autogopay_gopay") return goPayEnabled;
      return shopeePayEnabled;
    }),
    fallbackEnabled: parseBoolean(
      firstValue(source, [
        "paymentFallbackEnabled",
        "paymentProviderFallbackEnabled",
      ]),
      false,
    ),
    timeoutMs: boundedInteger(
      firstValue(source, ["paymentTimeoutMs", "paymentProviderTimeoutMs"]),
      DEFAULT_TIMEOUT_MS,
      1_000,
      60_000,
    ),
    expiryMinutes: boundedInteger(
      firstValue(source, ["paymentExpiryMinutes", "qrisExpiryMinutes"]),
      DEFAULT_EXPIRY_MINUTES,
      1,
      24 * 60,
    ),
    ketantechpay: {
      enabled: ketantechEnabled,
      baseUrl: cleanBaseUrl(
        optionalString(source, ["ketantechPayBaseUrl", "ketantechpayBaseUrl"]),
      ),
      clientKey: optionalString(source, [
        "ketantechPayClientKey",
        "ketantechpayClientKey",
        "ketantechPayApiKey",
      ]),
    },
    autoGopayGoPay: {
      enabled: goPayEnabled,
      baseUrl:
        cleanBaseUrl(
          optionalString(source, [
            "autoGopayGoPayApiUrl",
            "autogopayGoPayApiUrl",
            "gopayApiUrl",
          ]),
        ) ?? genericAutoGoPayUrl,
      apiKey:
        optionalString(source, [
          "autoGopayGoPaySecretKey",
          "autoGopayGoPayApiKey",
          "gopayApiKey",
        ]) ?? genericAutoGoPayKey,
    },
    autoGopayShopeePay: {
      enabled: shopeePayEnabled,
      baseUrl:
        cleanBaseUrl(
          optionalString(source, [
            "autoGopayShopeePayApiUrl",
            "autogopayShopeePayApiUrl",
            "shopeePayApiUrl",
          ]),
        ) ?? genericAutoGoPayUrl,
      apiKey:
        optionalString(source, [
          "autoGopayShopeePaySecretKey",
          "autoGopayShopeePayApiKey",
          "shopeePayApiKey",
        ]) ?? genericAutoGoPayKey,
      staticQrString: optionalString(source, [
        "autoGopayShopeePayQrisStatic",
        "autoGopayShopeePayQrString",
        "shopeePayQrisStatic",
      ]),
    },
  };
};

export const parseProviderPaymentSettings = parsePaymentSettings;

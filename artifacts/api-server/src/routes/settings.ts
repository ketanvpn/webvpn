import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { sendOtp } from "../lib/fonnte";
import {
  paymentChannelOrderValidationError,
  paymentSettingsUsabilityError,
} from "../lib/payment/settings-update-policy";

const router = Router();

const PAYMENT_CHANNELS = [
  "ketantechpay",
  "autogopay_gopay",
  "autogopay_shopeepay",
] as const;
const DEFAULT_PAYMENT_CHANNEL_ORDER = [...PAYMENT_CHANNELS];
const PAYMENT_EXPIRY_MINUTES_MIN = 1;
const PAYMENT_EXPIRY_MINUTES_MAX = 1440;

const PAYMENT_KEYS = [
  "qrisStaticUrl",
  "qrisEnabled",
  "qrisExpiryMinutes",
  "paymentFallbackEnabled",
  "paymentChannelOrder",
  "autoGopayEnabled",
  "autoGopayApiUrl",
  "autoGopayMerchantId",
  "autoGopaySecretKey",
  "autoGopayCallbackToken",
  "autoGopayGopayEnabled",
  "autoGopayShopeePayEnabled",
  "autoGopayShopeePayQrisStatic",
  "activeGateway",
  "ketantechPayEnabled",
  "ketantechPayWebhookSecret",
  "ketantechPayBaseUrl",
  "ketantechPayClientKey",
] as const;

const PAYMENT_BOOLEAN_KEYS = [
  "qrisEnabled",
  "paymentFallbackEnabled",
  "autoGopayEnabled",
  "autoGopayGopayEnabled",
  "autoGopayShopeePayEnabled",
  "ketantechPayEnabled",
] as const;

const PAYMENT_HTTPS_URL_KEYS = [
  "qrisStaticUrl",
  "autoGopayApiUrl",
  "ketantechPayBaseUrl",
] as const;

const PAYMENT_NULLABLE_STRING_KEYS = [
  "autoGopayMerchantId",
  "autoGopaySecretKey",
  "autoGopayCallbackToken",
  "autoGopayShopeePayQrisStatic",
  "ketantechPayWebhookSecret",
  "ketantechPayClientKey",
] as const;

const LEGACY_PAYMENT_GATEWAYS = [
  "qris_static",
  "autogopay",
  "ketantechpay",
] as const;

const TELEGRAM_KEYS = [
  "telegramBotToken",
  "telegramAdminChatId",
  "telegramEnabled",
  "telegramBotUsername",
] as const;

const WHATSAPP_KEYS = [
  "fonnteToken",
  "fonnteWhatsappNumber",
  "whatsappOtpEnabled",
] as const;

type TelegramKey = (typeof TELEGRAM_KEYS)[number];
type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
type PaymentKey = (typeof PAYMENT_KEYS)[number];
type LegacyPaymentGateway = (typeof LEGACY_PAYMENT_GATEWAYS)[number];
type SettingsMap = Record<string, string | null | undefined>;

async function getSettingValue(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

async function setSettingValue(key: string, value: string | null): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

function parseBoolean(v: string | null | undefined): boolean {
  return v === "true";
}

function isPaymentChannel(value: unknown): value is PaymentChannel {
  return (
    typeof value === "string" &&
    (PAYMENT_CHANNELS as readonly string[]).includes(value)
  );
}

function normalizePaymentChannelOrder(
  order: readonly PaymentChannel[],
): PaymentChannel[] {
  const uniqueChannels = order.filter(
    (channel, index, channels) => channels.indexOf(channel) === index,
  );
  return [
    ...uniqueChannels,
    ...DEFAULT_PAYMENT_CHANNEL_ORDER.filter(
      (channel) => !uniqueChannels.includes(channel),
    ),
  ];
}

function getLegacyChannel(
  gateway: LegacyPaymentGateway,
): PaymentChannel | null {
  if (gateway === "ketantechpay") return "ketantechpay";
  if (gateway === "autogopay") return "autogopay_gopay";
  return null;
}

function getLegacyGateway(
  order: readonly PaymentChannel[],
  enabled: Record<PaymentChannel, boolean>,
): LegacyPaymentGateway {
  const firstEnabledChannel = order.find((channel) => enabled[channel]);
  return firstEnabledChannel === "ketantechpay"
    ? "ketantechpay"
    : firstEnabledChannel
      ? "autogopay"
      : "qris_static";
}

function getStoredPaymentChannelOrder(map: SettingsMap): PaymentChannel[] {
  const raw = map["paymentChannelOrder"];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every(isPaymentChannel)) {
        return normalizePaymentChannelOrder(parsed);
      }
    } catch {
      // Corrupt persisted values fall back to the legacy gateway/default order.
    }
  }

  const activeGateway = LEGACY_PAYMENT_GATEWAYS.includes(
    map["activeGateway"] as LegacyPaymentGateway,
  )
    ? (map["activeGateway"] as LegacyPaymentGateway)
    : "qris_static";
  const legacyChannel = getLegacyChannel(activeGateway);
  return legacyChannel
    ? normalizePaymentChannelOrder([
        legacyChannel,
        ...DEFAULT_PAYMENT_CHANNEL_ORDER.filter(
          (channel) => channel !== legacyChannel,
        ),
      ])
    : DEFAULT_PAYMENT_CHANNEL_ORDER;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function getPaymentValidationError(
  body: Record<string, unknown>,
): string | null {
  for (const key of PAYMENT_BOOLEAN_KEYS) {
    if (key in body && typeof body[key] !== "boolean") {
      return `${key} harus berupa boolean`;
    }
  }

  if ("qrisExpiryMinutes" in body && body.qrisExpiryMinutes !== null) {
    const expiry = body.qrisExpiryMinutes;
    if (
      typeof expiry !== "number" ||
      !Number.isInteger(expiry) ||
      expiry < PAYMENT_EXPIRY_MINUTES_MIN ||
      expiry > PAYMENT_EXPIRY_MINUTES_MAX
    ) {
      return `qrisExpiryMinutes harus berupa bilangan bulat ${PAYMENT_EXPIRY_MINUTES_MIN}-${PAYMENT_EXPIRY_MINUTES_MAX}`;
    }
  }

  if ("paymentChannelOrder" in body) {
    const error = paymentChannelOrderValidationError(body.paymentChannelOrder);
    if (error) return error;
  }

  for (const key of PAYMENT_HTTPS_URL_KEYS) {
    if (key in body && body[key] !== null) {
      const value = body[key];
      if (typeof value !== "string" || !isHttpsUrl(value.trim())) {
        return `${key} harus berupa URL HTTPS yang valid atau null`;
      }
    }
  }

  for (const key of PAYMENT_NULLABLE_STRING_KEYS) {
    if (key in body && body[key] !== null && typeof body[key] !== "string") {
      return `${key} harus berupa string atau null`;
    }
  }

  if ("activeGateway" in body && body.activeGateway !== null) {
    if (
      typeof body.activeGateway !== "string" ||
      !(LEGACY_PAYMENT_GATEWAYS as readonly string[]).includes(
        body.activeGateway,
      )
    ) {
      return `activeGateway hanya boleh berisi: ${LEGACY_PAYMENT_GATEWAYS.join(", ")}`;
    }
  }

  return null;
}

function buildPaymentSettingsResponse(map: SettingsMap) {
  const parsedExpiry = Number(map["qrisExpiryMinutes"] ?? 15);
  const qrisExpiryMinutes =
    Number.isInteger(parsedExpiry) &&
    parsedExpiry >= PAYMENT_EXPIRY_MINUTES_MIN &&
    parsedExpiry <= PAYMENT_EXPIRY_MINUTES_MAX
      ? parsedExpiry
      : 15;
  const activeGateway = (LEGACY_PAYMENT_GATEWAYS as readonly string[]).includes(
    map["activeGateway"] ?? "",
  )
    ? (map["activeGateway"] as LegacyPaymentGateway)
    : "qris_static";
  const hasNewAutoGopayFlags =
    map["autoGopayGopayEnabled"] != null ||
    map["autoGopayShopeePayEnabled"] != null;
  const autoGopayGopayEnabled =
    map["autoGopayGopayEnabled"] != null
      ? parseBoolean(map["autoGopayGopayEnabled"])
      : parseBoolean(map["autoGopayEnabled"]) || activeGateway === "autogopay";
  const autoGopayShopeePayEnabled = parseBoolean(
    map["autoGopayShopeePayEnabled"],
  );

  return {
    qrisStaticUrl: map["qrisStaticUrl"] ?? null,
    qrisEnabled: parseBoolean(map["qrisEnabled"] ?? "true"),
    qrisExpiryMinutes,
    paymentFallbackEnabled: parseBoolean(map["paymentFallbackEnabled"]),
    paymentChannelOrder: getStoredPaymentChannelOrder(map),
    autoGopayEnabled: hasNewAutoGopayFlags
      ? autoGopayGopayEnabled || autoGopayShopeePayEnabled
      : parseBoolean(map["autoGopayEnabled"]) || activeGateway === "autogopay",
    autoGopayApiUrl: map["autoGopayApiUrl"] ?? null,
    autoGopayMerchantId: map["autoGopayMerchantId"] ?? null,
    autoGopaySecretKey: map["autoGopaySecretKey"] ?? null,
    autoGopayCallbackToken: map["autoGopayCallbackToken"] ?? null,
    autoGopayGopayEnabled,
    autoGopayShopeePayEnabled,
    autoGopayShopeePayQrisStatic: map["autoGopayShopeePayQrisStatic"] ?? null,
    activeGateway,
    ketantechPayEnabled:
      map["ketantechPayEnabled"] != null
        ? parseBoolean(map["ketantechPayEnabled"])
        : activeGateway === "ketantechpay",
    ketantechPayWebhookSecret: map["ketantechPayWebhookSecret"] ?? null,
    ketantechPayBaseUrl: map["ketantechPayBaseUrl"] ?? null,
    ketantechPayClientKey: map["ketantechPayClientKey"] ?? null,
  };
}

router.get("/admin/settings/payment", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map: SettingsMap = Object.fromEntries(
    rows.map((row) => [row.key, row.value]),
  );
  res.json(buildPaymentSettingsResponse(map));
});

router.put("/admin/settings/payment", requireAdmin, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Body pengaturan payment harus berupa object" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const validationError = getPaymentValidationError(body);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const existingRows = await db.select().from(settingsTable);
  const existingMap: SettingsMap = Object.fromEntries(
    existingRows.map((row) => [row.key, row.value]),
  );
  const existingSettings = buildPaymentSettingsResponse(existingMap);
  const updates: Partial<Record<PaymentKey, string | null>> = {};

  for (const key of PAYMENT_KEYS) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (raw === null || raw === undefined) {
      updates[key] = null;
    } else if (key === "paymentChannelOrder") {
      updates[key] = JSON.stringify(
        normalizePaymentChannelOrder(raw as PaymentChannel[]),
      );
    } else if ((PAYMENT_HTTPS_URL_KEYS as readonly string[]).includes(key)) {
      updates[key] = String(raw).trim().replace(/\/$/, "");
    } else if (key === "autoGopayShopeePayQrisStatic") {
      updates[key] = String(raw).trim() || null;
    } else {
      updates[key] = String(raw);
    }
  }

  let channelOrder =
    "paymentChannelOrder" in body
      ? normalizePaymentChannelOrder(
          body.paymentChannelOrder as PaymentChannel[],
        )
      : existingSettings.paymentChannelOrder;

  if ("activeGateway" in body && body.activeGateway) {
    const legacyChannel = getLegacyChannel(
      body.activeGateway as LegacyPaymentGateway,
    );
    if (legacyChannel && !("paymentChannelOrder" in body)) {
      channelOrder = normalizePaymentChannelOrder([
        legacyChannel,
        ...channelOrder.filter((channel) => channel !== legacyChannel),
      ]);
      updates.paymentChannelOrder = JSON.stringify(channelOrder);
    }
    if (
      body.activeGateway === "ketantechpay" &&
      !("ketantechPayEnabled" in body)
    ) {
      updates.ketantechPayEnabled = "true";
    }
    if (
      body.activeGateway === "autogopay" &&
      !("autoGopayGopayEnabled" in body) &&
      !("autoGopayShopeePayEnabled" in body)
    ) {
      updates.autoGopayGopayEnabled =
        typeof body.autoGopayEnabled === "boolean"
          ? String(body.autoGopayEnabled)
          : "true";
    }
  }

  if (
    "autoGopayEnabled" in body &&
    !("autoGopayGopayEnabled" in body) &&
    !("autoGopayShopeePayEnabled" in body)
  ) {
    updates.autoGopayGopayEnabled = String(body.autoGopayEnabled);
  }

  const ketantechPayEnabled =
    updates.ketantechPayEnabled != null
      ? updates.ketantechPayEnabled === "true"
      : existingSettings.ketantechPayEnabled;
  const autoGopayGopayEnabled =
    updates.autoGopayGopayEnabled != null
      ? updates.autoGopayGopayEnabled === "true"
      : existingSettings.autoGopayGopayEnabled;
  const autoGopayShopeePayEnabled =
    updates.autoGopayShopeePayEnabled != null
      ? updates.autoGopayShopeePayEnabled === "true"
      : existingSettings.autoGopayShopeePayEnabled;
  const effectiveString = (
    key: PaymentKey,
    existingValue: string | null,
  ): string | null =>
    key in updates ? updates[key] ?? null : existingValue;
  const usabilityError = paymentSettingsUsabilityError({
    ketantechPayEnabled,
    ketantechPayBaseUrl: effectiveString(
      "ketantechPayBaseUrl",
      existingSettings.ketantechPayBaseUrl,
    ),
    autoGopayGopayEnabled,
    autoGopayShopeePayEnabled,
    autoGopayApiUrl: effectiveString(
      "autoGopayApiUrl",
      existingSettings.autoGopayApiUrl,
    ),
    autoGopaySecretKey: effectiveString(
      "autoGopaySecretKey",
      existingSettings.autoGopaySecretKey,
    ),
    autoGopayShopeePayQrisStatic: effectiveString(
      "autoGopayShopeePayQrisStatic",
      existingSettings.autoGopayShopeePayQrisStatic,
    ),
  });
  if (usabilityError) {
    res.status(400).json({ error: usabilityError });
    return;
  }

  const hasNewChannelConfiguration =
    "paymentChannelOrder" in body ||
    "ketantechPayEnabled" in body ||
    "autoGopayGopayEnabled" in body ||
    "autoGopayShopeePayEnabled" in body;

  if (hasNewChannelConfiguration) {
    updates.autoGopayEnabled = String(
      autoGopayGopayEnabled || autoGopayShopeePayEnabled,
    );
    if (!("activeGateway" in body)) {
      updates.activeGateway = getLegacyGateway(channelOrder, {
        ketantechpay: ketantechPayEnabled,
        autogopay_gopay: autoGopayGopayEnabled,
        autogopay_shopeepay: autoGopayShopeePayEnabled,
      });
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    await setSettingValue(key, value);
  }

  const rows = await db.select().from(settingsTable);
  const map: SettingsMap = Object.fromEntries(
    rows.map((row) => [row.key, row.value]),
  );
  res.json(buildPaymentSettingsResponse(map));
});

export async function getPaymentSettingsMap(): Promise<Record<string, string | null>> {
  const rows = await db.select().from(settingsTable);
  return Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
}

// ─── Telegram Settings ────────────────────────────────────────────────────────

function buildTelegramSettingsResponse(map: Record<string, string | null>) {
  return {
    telegramBotToken: map["telegramBotToken"] ?? null,
    telegramAdminChatId: map["telegramAdminChatId"] ?? null,
    telegramEnabled: parseBoolean(map["telegramEnabled"] ?? "false"),
    telegramBotUsername: map["telegramBotUsername"] ?? null,
  };
}

router.get("/admin/settings/telegram", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildTelegramSettingsResponse(map));
});

router.put("/admin/settings/telegram", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null>;

  for (const key of TELEGRAM_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }

  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildTelegramSettingsResponse(map));
});

// ─── WhatsApp / Fonnte Settings ────────────────────────────────────────────────

function buildWhatsappSettingsResponse(map: Record<string, string | null>) {
  return {
    fonnteToken: map["fonnteToken"] ?? null,
    fonnteWhatsappNumber: map["fonnteWhatsappNumber"] ?? null,
    whatsappOtpEnabled: parseBoolean(map["whatsappOtpEnabled"] ?? "true"),
  };
}

router.get("/admin/settings/whatsapp", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildWhatsappSettingsResponse(map));
});

router.put("/admin/settings/whatsapp", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null>;

  for (const key of WHATSAPP_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }

  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildWhatsappSettingsResponse(map));
});

router.post("/admin/settings/whatsapp/test", requireAdmin, async (req, res) => {
  const { whatsapp } = req.body as { whatsapp?: string };
  if (!whatsapp || typeof whatsapp !== "string") {
    res.status(400).json({ error: "Nomor WhatsApp diperlukan" });
    return;
  }
  const result = await sendOtp(whatsapp, "register");
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  if (result.simulateMode) {
    res.json({ simulateMode: true, otp: result.otp });
    return;
  }
  res.json({ success: true });
});

// ─── Expiry Notification Settings ────────────────────────────────────────────

const EXPIRY_NOTIF_KEYS = [
  "expiryNotifEnabled",
  "expiryNotif3DaysEnabled",
  "expiryNotif1DayEnabled",
  "expiryNotifSendHour",
] as const;

function buildExpiryNotifSettingsResponse(map: Record<string, string | null>) {
  const rawHour = parseInt(map["expiryNotifSendHour"] ?? "8", 10);
  return {
    expiryNotifEnabled: parseBoolean(map["expiryNotifEnabled"] ?? "true"),
    expiryNotif3DaysEnabled: parseBoolean(map["expiryNotif3DaysEnabled"] ?? "true"),
    expiryNotif1DayEnabled: parseBoolean(map["expiryNotif1DayEnabled"] ?? "true"),
    expiryNotifSendHour: isNaN(rawHour) ? 8 : Math.min(23, Math.max(0, rawHour)),
  };
}

router.get("/admin/settings/expiry-notif", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildExpiryNotifSettingsResponse(map));
});

router.put("/admin/settings/expiry-notif", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null>;
  for (const key of EXPIRY_NOTIF_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildExpiryNotifSettingsResponse(map));
});

// ─── Referral Settings ───────────────────────────────────────────────────────

const REFERRAL_KEYS = [
  "referralEnabled",
  "referralBonusAmount",
] as const;

function buildReferralSettingsResponse(map: Record<string, string | null>) {
  const amountRaw = map["referralBonusAmount"];
  return {
    referralEnabled: parseBoolean(map["referralEnabled"] ?? "true"),
    referralBonusAmount: amountRaw ? parseInt(amountRaw, 10) : 5000,
  };
}

router.get("/admin/settings/referral", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildReferralSettingsResponse(map));
});

router.put("/admin/settings/referral", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null | number>;

  for (const key of REFERRAL_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }

  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildReferralSettingsResponse(map));
});

// ─── Reseller Settings ────────────────────────────────────────────────────────

const RESELLER_KEYS = [
  "resellerEnabled", "resellerDiscountPercent", "resellerTargetEnabled", "resellerMonthlyTarget",
  "resellerPromoEnabled", "resellerPromoTitle", "resellerPromoText", "resellerRequestEnabled",
  "resellerAutoUpgradeEnabled", "resellerAutoUpgradeMinTopup",
];

function buildResellerSettingsResponse(map: Record<string, string | null>) {
  return {
    resellerEnabled: parseBoolean(map["resellerEnabled"] ?? "false"),
    resellerDiscountPercent: map["resellerDiscountPercent"] ? parseInt(map["resellerDiscountPercent"], 10) : 20,
    resellerTargetEnabled: parseBoolean(map["resellerTargetEnabled"] ?? "false"),
    resellerMonthlyTarget: map["resellerMonthlyTarget"] ? parseInt(map["resellerMonthlyTarget"], 10) : 500000,
    resellerPromoEnabled: parseBoolean(map["resellerPromoEnabled"] ?? "false"),
    resellerPromoTitle: map["resellerPromoTitle"] ?? "Jadi Reseller KETANTECH!",
    resellerPromoText: map["resellerPromoText"] ?? "Dapatkan harga spesial dan hemat lebih banyak setiap transaksi. Cocok buat kamu yang sering beli VPN!",
    resellerRequestEnabled: parseBoolean(map["resellerRequestEnabled"] ?? "true"),
    resellerAutoUpgradeEnabled: parseBoolean(map["resellerAutoUpgradeEnabled"] ?? "false"),
    resellerAutoUpgradeMinTopup: map["resellerAutoUpgradeMinTopup"] ? parseInt(map["resellerAutoUpgradeMinTopup"], 10) : 50000,
  };
}

export async function getResellerSettings() {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return buildResellerSettingsResponse(map);
}

router.get("/admin/settings/reseller", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildResellerSettingsResponse(map));
});

router.put("/admin/settings/reseller", requireAdmin, async (req, res) => {
  const body = req.body ?? {};
  for (const key of RESELLER_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildResellerSettingsResponse(map));
});

// ─── Dynamic VPN Settings ────────────────────────────────────────────────────

const DYNAMIC_VPN_KEYS = [
  "dynamicDefaultMarkupPercent",
] as const;

function buildDynamicVpnSettingsResponse(map: Record<string, string | null>) {
  const raw = map["dynamicDefaultMarkupPercent"];
  return {
    dynamicDefaultMarkupPercent: raw ? parseInt(raw, 10) : 30,
  };
}

router.get("/admin/settings/dynamic-vpn", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildDynamicVpnSettingsResponse(map));
});

router.put("/admin/settings/dynamic-vpn", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null | number>;
  for (const key of DYNAMIC_VPN_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  res.json(buildDynamicVpnSettingsResponse(map));
});

export { getSettingValue, setSettingValue };
export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

const PAYMENT_KEYS = [
  "qrisStaticUrl",
  "qrisEnabled",
  "qrisExpiryMinutes",
  "autoGopayEnabled",
  "autoGopayApiUrl",
  "autoGopayMerchantId",
  "autoGopaySecretKey",
  "autoGopayCallbackToken",
  "activeGateway",
] as const;

const TELEGRAM_KEYS = [
  "telegramBotToken",
  "telegramAdminChatId",
  "telegramEnabled",
  "telegramBotUsername",
] as const;

const WHATSAPP_KEYS = [
  "fonnteToken",
  "whatsappOtpEnabled",
] as const;

type TelegramKey = (typeof TELEGRAM_KEYS)[number];

type PaymentKey = (typeof PAYMENT_KEYS)[number];

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

function parseBoolean(v: string | null): boolean {
  return v === "true";
}

function buildPaymentSettingsResponse(map: Record<string, string | null>) {
  const expiryRaw = map["qrisExpiryMinutes"];
  const qrisExpiryMinutes = expiryRaw ? parseInt(expiryRaw, 10) : 15;
  return {
    qrisStaticUrl: map["qrisStaticUrl"] ?? null,
    qrisEnabled: parseBoolean(map["qrisEnabled"] ?? "true"),
    qrisExpiryMinutes,
    autoGopayEnabled: parseBoolean(map["autoGopayEnabled"] ?? null),
    autoGopayApiUrl: map["autoGopayApiUrl"] ?? null,
    autoGopayMerchantId: map["autoGopayMerchantId"] ?? null,
    autoGopaySecretKey: map["autoGopaySecretKey"] ?? null,
    autoGopayCallbackToken: map["autoGopayCallbackToken"] ?? null,
    activeGateway: map["activeGateway"] ?? "qris_static",
  };
}

router.get("/admin/settings/payment", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildPaymentSettingsResponse(map));
});

router.put("/admin/settings/payment", requireAdmin, async (req, res) => {
  const body = req.body as Record<string, string | boolean | null | number>;

  for (const key of PAYMENT_KEYS) {
    if (key in body) {
      const raw = body[key];
      const value = raw === null || raw === undefined ? null : String(raw);
      await setSettingValue(key, value);
    }
  }

  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildPaymentSettingsResponse(map));
});

export async function getPaymentSettingsMap(): Promise<Record<string, string | null>> {
  const rows = await db.select().from(settingsTable);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildTelegramSettingsResponse(map));
});

// ─── WhatsApp / Fonnte Settings ────────────────────────────────────────────────

function buildWhatsappSettingsResponse(map: Record<string, string | null>) {
  return {
    fonnteToken: map["fonnteToken"] ?? null,
    whatsappOtpEnabled: parseBoolean(map["whatsappOtpEnabled"] ?? "true"),
  };
}

router.get("/admin/settings/whatsapp", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildWhatsappSettingsResponse(map));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildReferralSettingsResponse(map));
});

// ─── Reseller Settings ────────────────────────────────────────────────────────

const RESELLER_KEYS = ["resellerEnabled", "resellerDiscountPercent", "resellerTargetEnabled", "resellerMonthlyTarget"];

function buildResellerSettingsResponse(map: Record<string, string | null>) {
  return {
    resellerEnabled: parseBoolean(map["resellerEnabled"] ?? "false"),
    resellerDiscountPercent: map["resellerDiscountPercent"] ? parseInt(map["resellerDiscountPercent"], 10) : 20,
    resellerTargetEnabled: parseBoolean(map["resellerTargetEnabled"] ?? "false"),
    resellerMonthlyTarget: map["resellerMonthlyTarget"] ? parseInt(map["resellerMonthlyTarget"], 10) : 500000,
  };
}

export async function getResellerSettings() {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return buildResellerSettingsResponse(map);
}

router.get("/admin/settings/reseller", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
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
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json(buildResellerSettingsResponse(map));
});

export { getSettingValue, setSettingValue };
export default router;

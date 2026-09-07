import {
  db,
  dynamicProviderServersTable,
  usersTable,
  vouchersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getDynamicDurationLabel,
  getDynamicSellPrice,
  isDynamicDurationType,
  type DynamicDurationType,
} from "../dynamic-duration";
import { getResellerSettings, getSettingValue } from "../../routes/settings";

// ─── Markup helpers ───────────────────────────────────────────────────────────

/** Hitung harga jual dari harga modal + markup persen */
export function applyMarkup(cost: number, markupPercent: number): number {
  return Math.ceil(cost * (1 + markupPercent / 100));
}

// ─── Base quote (no DB calls) ─────────────────────────────────────────────────

export function calculateBaseQuote(
  server: typeof dynamicProviderServersTable.$inferSelect,
  durationType: string,
  duration: number,
) {
  if (!isDynamicDurationType(durationType)) throw new Error("Tipe durasi tidak valid");
  if (!server.supportedTypes.includes(durationType)) {
    const labels: Record<DynamicDurationType, string> = { day: "harian", week: "mingguan", month: "bulanan" };
    throw new Error(`Server ini tidak mendukung durasi ${labels[durationType]}`);
  }

  if (server.provider === "nadiavpn" && duration !== 1) {
    throw new Error("Order server NadiaVPN hanya dapat dibeli untuk durasi 1 periode (1 hari / 1 minggu / 1 bulan). Untuk memperpanjang, gunakan menu perpanjang (renew).");
  }

  if (durationType === "day" && (duration < server.minDays || duration > server.maxDays)) {
    throw new Error(`Durasi harian harus ${server.minDays}-${server.maxDays} hari`);
  }
  if (durationType === "week") {
    if (server.provider !== "nadiavpn") throw new Error("Paket mingguan hanya tersedia untuk server NadiaVPN");
  }
  if (durationType === "month" && (duration < server.minMonths || duration > server.maxMonths)) {
    throw new Error(`Durasi bulanan harus ${server.minMonths}-${server.maxMonths} bulan`);
  }

  const unitPrice = getDynamicSellPrice(server, durationType);
  if (unitPrice <= 0) throw new Error(`Harga ${getDynamicDurationLabel(durationType, 1).toLowerCase()} belum diatur admin`);
  return { unitPrice, baseAmount: unitPrice * duration, durationLabel: getDynamicDurationLabel(durationType, duration) };
}

// ─── Full price calculation (with reseller discount + voucher) ─────────────────

export async function calculateDynamicPrice(
  server: typeof dynamicProviderServersTable.$inferSelect,
  durationType: string,
  duration: number,
  userId: number,
  voucherCode?: unknown,
) {
  const base = calculateBaseQuote(server, durationType, duration);
  let amountAfterReseller = base.baseAmount;
  let resellerDiscountAmount = 0;

  const [dbUser] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (dbUser?.role === "reseller") {
    const resellerSettings = await getResellerSettings();
    if (resellerSettings.resellerEnabled && resellerSettings.resellerDiscountPercent > 0) {
      const discountPercent = Math.max(1, Math.min(99, resellerSettings.resellerDiscountPercent));
      resellerDiscountAmount = Math.floor(base.baseAmount * (discountPercent / 100));
      amountAfterReseller = Math.max(0, base.baseAmount - resellerDiscountAmount);
    }
  }

  const code = typeof voucherCode === "string" ? voucherCode.trim().toUpperCase() : "";
  let voucherId: number | null = null;
  let voucherDiscountAmount = 0;

  if (code) {
    const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code)).limit(1);
    if (!voucher || !voucher.isActive) throw new Error("Voucher tidak valid atau sudah tidak aktif");
    if (voucher.maxUses && voucher.currentUses >= voucher.maxUses) throw new Error("Voucher telah mencapai batas maksimal penggunaan");
    if (voucher.expiresAt && new Date() > voucher.expiresAt) throw new Error("Voucher sudah kedaluwarsa");

    voucherId = voucher.id;
    if (voucher.discountType === "percent") {
      voucherDiscountAmount = Math.floor(amountAfterReseller * (Number(voucher.discountValue) / 100));
    } else if (voucher.discountType === "fixed") {
      voucherDiscountAmount = Number(voucher.discountValue);
    }
    voucherDiscountAmount = Math.min(voucherDiscountAmount, amountAfterReseller);
  }

  const amount = Math.max(0, amountAfterReseller - voucherDiscountAmount);
  return {
    ...base,
    amount,
    resellerDiscountAmount,
    voucherDiscountAmount,
    discountAmount: resellerDiscountAmount + voucherDiscountAmount,
    voucherId,
    voucherCode: code || null,
  };
}

// ─── Default markup from settings ─────────────────────────────────────────────

export async function getDefaultMarkupPercent(): Promise<number> {
  const raw = await getSettingValue("dynamicDefaultMarkupPercent");
  return raw ? parseInt(raw, 10) : 30;
}

import { db } from "@workspace/db";
import { settingsTable, otpTable } from "@workspace/db";
import { eq, and, gt, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

// ─── Anti-Spam Configuration ──────────────────────────────────────────────────
// Konfigurasi ini mencegah nomor WA pengirim terdeteksi spam oleh WhatsApp.

/** Minimum detik antara pengiriman OTP ke nomor yang sama */
const OTP_COOLDOWN_SECONDS = 90;

/** Maksimal OTP yang bisa dikirim ke satu nomor per hari (semua purpose) */
const OTP_DAILY_LIMIT_PER_NUMBER = 5;

/** Jika OTP masih valid dan belum terlalu tua, kirim ulang kode yang sama
 *  daripada generate baru (mengurangi jumlah pesan WA). Dalam detik. */
const OTP_REUSE_WINDOW_SECONDS = 120;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFonnteToken(): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "fonnteToken"))
    .limit(1);
  return row?.value ?? null;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeWhatsapp(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("08")) p = "628" + p.slice(2);
  if (p.startsWith("8") && !p.startsWith("62")) p = "62" + p;
  return p;
}

/**
 * Variasi template pesan OTP agar tidak terdeteksi sebagai pesan massal.
 * WhatsApp menandai spam jika pesan identik dikirim berulang-ulang.
 */
function buildOtpMessage(otp: string, purpose: "register" | "reset"): string {
  const templates =
    purpose === "reset"
      ? [
          `Hai! Kode verifikasi reset password KETANTECH VPN kamu: *${otp}*\n\nBerlaku 5 menit. Jangan berikan ke siapapun ya.`,
          `Kode OTP reset password KETANTECH VPN: *${otp}*\n\nKode ini berlaku selama 5 menit. Abaikan jika bukan kamu yang meminta.`,
          `Reset password KETANTECH VPN\nKode kamu: *${otp}*\n\nBerlaku 5 menit, jangan share ke orang lain.`,
        ]
      : [
          `Hai! Kode verifikasi registrasi KETANTECH VPN kamu: *${otp}*\n\nBerlaku 5 menit. Jangan berikan ke siapapun ya.`,
          `Kode OTP registrasi KETANTECH VPN: *${otp}*\n\nKode ini berlaku selama 5 menit. Abaikan jika bukan kamu yang meminta.`,
          `Selamat datang di KETANTECH VPN!\nKode verifikasi kamu: *${otp}*\n\nBerlaku 5 menit, jangan share ke orang lain.`,
        ];

  return templates[Math.floor(Math.random() * templates.length)];
}

// ─── Anti-Spam Checks ─────────────────────────────────────────────────────────

/**
 * Cek apakah nomor masih dalam cooldown (sudah kirim OTP terlalu cepat).
 * Mengembalikan sisa detik cooldown, atau 0 jika sudah boleh kirim.
 */
async function getCooldownRemaining(whatsapp: string): Promise<number> {
  const cooldownThreshold = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000);

  const [recent] = await db
    .select({ createdAt: otpTable.createdAt })
    .from(otpTable)
    .where(
      and(
        eq(otpTable.whatsapp, whatsapp),
        gt(otpTable.createdAt, cooldownThreshold)
      )
    )
    .orderBy(sql`${otpTable.createdAt} DESC`)
    .limit(1);

  if (!recent) return 0;

  const elapsed = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_COOLDOWN_SECONDS - elapsed));
}

/**
 * Cek apakah nomor sudah melebihi batas harian pengiriman OTP.
 */
async function getDailyOtpCount(whatsapp: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ id: otpTable.id })
    .from(otpTable)
    .where(
      and(
        eq(otpTable.whatsapp, whatsapp),
        gte(otpTable.createdAt, todayStart)
      )
    );

  return rows.length;
}

/**
 * Cek apakah ada OTP yang masih bisa di-reuse (masih valid, belum used,
 * dan dibuat baru-baru ini).
 */
async function getReusableOtp(
  whatsapp: string,
  purpose: "register" | "reset"
): Promise<{ code: string; expiresAt: Date } | null> {
  const reuseThreshold = new Date(Date.now() - OTP_REUSE_WINDOW_SECONDS * 1000);
  const now = new Date();

  const [row] = await db
    .select({ code: otpTable.code, expiresAt: otpTable.expiresAt, createdAt: otpTable.createdAt })
    .from(otpTable)
    .where(
      and(
        eq(otpTable.whatsapp, whatsapp),
        eq(otpTable.purpose, purpose),
        eq(otpTable.used, false),
        gt(otpTable.expiresAt, now),
        gt(otpTable.createdAt, reuseThreshold)
      )
    )
    .limit(1);

  return row ? { code: row.code, expiresAt: row.expiresAt } : null;
}

// ─── Main sendOtp ─────────────────────────────────────────────────────────────

export async function sendOtp(
  rawPhone: string,
  purpose: "register" | "reset" = "register"
): Promise<{
  success: boolean;
  simulateMode: boolean;
  otp?: string;
  error?: string;
  cooldown?: number;
}> {
  const whatsapp = normalizeWhatsapp(rawPhone);
  const token = await getFonnteToken();

  // ── Anti-Spam #1: Cooldown per nomor ──
  const cooldown = await getCooldownRemaining(whatsapp);
  if (cooldown > 0) {
    logger.warn({ whatsapp, cooldown }, "OTP send blocked: cooldown active");
    return {
      success: false,
      simulateMode: false,
      error: `Tunggu ${cooldown} detik sebelum meminta OTP lagi.`,
      cooldown,
    };
  }

  // ── Anti-Spam #2: Daily limit per nomor ──
  const dailyCount = await getDailyOtpCount(whatsapp);
  if (dailyCount >= OTP_DAILY_LIMIT_PER_NUMBER) {
    logger.warn({ whatsapp, dailyCount }, "OTP send blocked: daily limit reached");
    return {
      success: false,
      simulateMode: false,
      error: "Batas pengiriman OTP harian tercapai. Coba lagi besok.",
    };
  }

  // ── Anti-Spam #3: Reuse OTP jika masih valid ──
  const reusable = await getReusableOtp(whatsapp, purpose);
  let otp: string;

  if (reusable) {
    // Gunakan kode yang sama — tidak perlu kirim WA lagi
    logger.info({ whatsapp, purpose }, "Reusing existing OTP (still valid)");
    return {
      success: true,
      simulateMode: !token,
      ...(token ? {} : { otp: reusable.code }),
    };
  }

  // Generate OTP baru
  otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Hapus OTP lama untuk nomor + purpose ini
  await db.delete(otpTable).where(
    and(eq(otpTable.whatsapp, whatsapp), eq(otpTable.purpose, purpose))
  );

  await db.insert(otpTable).values({
    whatsapp,
    code: otp,
    purpose,
    expiresAt,
  });

  if (!token) {
    return { success: true, simulateMode: true, otp };
  }

  // ── Anti-Spam #4: Variasi pesan ──
  const message = buildOtpMessage(otp, purpose);

  try {
    const resp = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: whatsapp,
        message,
        // Fonnte: delay agar tidak instant burst (dalam detik)
        delay: "2",
      }),
    });

    const data = await resp.json() as { status: boolean; detail?: string; reason?: string; message?: string };
    logger.info(
      { fonnte_status: data.status, fonnte_reason: data.reason, fonnte_detail: data.detail, whatsapp },
      "Fonnte API response"
    );
    if (!data.status) {
      const errMsg = data.reason ?? data.detail ?? data.message ?? "Gagal mengirim OTP";
      return { success: false, simulateMode: false, error: errMsg };
    }
    return { success: true, simulateMode: false };
  } catch (err) {
    logger.error({ err }, "Fonnte API call failed");
    return { success: false, simulateMode: false, error: "Tidak dapat terhubung ke layanan WhatsApp" };
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────

export async function verifyOtp(
  rawPhone: string,
  code: string,
  purpose: "register" | "reset" = "register"
): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const whatsapp = normalizeWhatsapp(rawPhone);
  const now = new Date();

  const [row] = await db
    .select()
    .from(otpTable)
    .where(
      and(
        eq(otpTable.whatsapp, whatsapp),
        eq(otpTable.purpose, purpose),
        eq(otpTable.used, false),
        gt(otpTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!row) {
    return { valid: false, reason: "Kode OTP tidak ditemukan atau sudah kedaluwarsa" };
  }

  if (row.attempts >= 5) {
    return { valid: false, reason: "Terlalu banyak percobaan. Minta OTP baru." };
  }

  if (row.code !== code) {
    await db
      .update(otpTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpTable.id, row.id));
    return { valid: false, reason: "Kode OTP salah" };
  }

  await db.update(otpTable).set({ used: true }).where(eq(otpTable.id, row.id));
  return { valid: true };
}

/**
 * Cek OTP valid tanpa mark used = true.
 * Dipakai oleh endpoint /auth/verify-otp untuk pre-verification di step OTP.
 * OTP tetap bisa dipakai di /auth/register yang memanggil verifyOtp() (full verify).
 */
export async function verifyOtpOnly(
  rawPhone: string,
  code: string,
  purpose: "register" | "reset" = "register"
): Promise<{
  valid: boolean;
  reason?: string;
}> {
  const whatsapp = normalizeWhatsapp(rawPhone);
  const now = new Date();

  const [row] = await db
    .select()
    .from(otpTable)
    .where(
      and(
        eq(otpTable.whatsapp, whatsapp),
        eq(otpTable.purpose, purpose),
        eq(otpTable.used, false),
        gt(otpTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!row) {
    return { valid: false, reason: "Kode OTP tidak ditemukan atau sudah kedaluwarsa" };
  }

  if (row.attempts >= 5) {
    return { valid: false, reason: "Terlalu banyak percobaan. Minta OTP baru." };
  }

  if (row.code !== code) {
    // Increment attempts untuk anti brute-force, tapi JANGAN mark used
    await db
      .update(otpTable)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpTable.id, row.id));
    return { valid: false, reason: "Kode OTP salah" };
  }

  // Valid, tapi tidak mark used — biarkan /auth/register yang lakukan itu
  return { valid: true };
}

// ─── Send generic WhatsApp message ────────────────────────────────────────────

export async function sendWhatsapp(rawPhone: string, message: string): Promise<boolean> {
  const token = await getFonnteToken();
  if (!token) return false;

  const whatsapp = normalizeWhatsapp(rawPhone);
  try {
    const resp = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ target: whatsapp, message, delay: "2" }),
    });
    const data = await resp.json() as { status: boolean };
    return data.status === true;
  } catch {
    return false;
  }
}

export { normalizeWhatsapp };

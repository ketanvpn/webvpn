import { db } from "@workspace/db";
import { settingsTable, otpTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

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

export async function sendOtp(rawPhone: string): Promise<{
  success: boolean;
  simulateMode: boolean;
  otp?: string;
  error?: string;
}> {
  const whatsapp = normalizeWhatsapp(rawPhone);
  const token = await getFonnteToken();

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.delete(otpTable).where(
    and(eq(otpTable.whatsapp, whatsapp), eq(otpTable.purpose, "register"))
  );

  await db.insert(otpTable).values({
    whatsapp,
    code: otp,
    purpose: "register",
    expiresAt,
  });

  if (!token) {
    return { success: true, simulateMode: true, otp };
  }

  const message = `Kode OTP KETANTECH VPN kamu adalah: *${otp}*\n\nKode berlaku 5 menit. Jangan bagikan ke siapapun.`;

  try {
    const resp = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target: whatsapp, message }),
    });

    const data = await resp.json() as { status: boolean; detail?: string };
    if (!data.status) {
      return { success: false, simulateMode: false, error: data.detail ?? "Gagal mengirim OTP" };
    }
    return { success: true, simulateMode: false };
  } catch (err) {
    return { success: false, simulateMode: false, error: "Tidak dapat terhubung ke layanan WhatsApp" };
  }
}

export async function verifyOtp(rawPhone: string, code: string): Promise<{
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
        eq(otpTable.purpose, "register"),
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

export { normalizeWhatsapp };

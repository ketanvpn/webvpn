import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

/**
 * Tabel untuk tracking bahwa user sudah mengirim pesan WA ke nomor Fonnte kita.
 * Digunakan dalam alur "user chat duluan" agar nomor kita tidak terdeteksi spam.
 *
 * Flow:
 * 1. User klik "Kirim Pesan WA" → record dibuat dengan token unik
 * 2. User kirim pesan "DAFTAR" ke nomor Fonnte kita
 * 3. Fonnte webhook terima → set messageReceived = true, lalu balas OTP
 * 4. Frontend polling status via token → lanjut ke step OTP
 */
export const waVerificationsTable = pgTable("wa_verifications", {
  id: serial("id").primaryKey(),
  whatsapp: text("whatsapp").notNull(),
  token: text("token").notNull().unique(),
  messageReceived: boolean("message_received").notNull().default(false),
  otpSent: boolean("otp_sent").notNull().default(false),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WaVerification = typeof waVerificationsTable.$inferSelect;

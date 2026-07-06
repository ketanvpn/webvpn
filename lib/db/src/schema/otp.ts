import { pgTable, serial, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";

export const otpTable = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  whatsapp: text("whatsapp").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull().default("register"),
  used: boolean("used").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("otp_verifications_whatsapp_idx").on(t.whatsapp),
]);

export type OtpVerification = typeof otpTable.$inferSelect;

import { pgTable, serial, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const otpTable = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  whatsapp: text("whatsapp").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull().default("register"),
  used: boolean("used").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpVerification = typeof otpTable.$inferSelect;

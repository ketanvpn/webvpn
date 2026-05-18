import { pgTable, serial, text, boolean, numeric, integer, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name"),
  whatsapp: text("whatsapp").unique(),
  isVerified: boolean("is_verified").notNull().default(false),
  role: text("role").notNull().default("user"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  referralBonusClaimed: boolean("referral_bonus_claimed").notNull().default(false),
  points: integer("points").notNull().default(0),
  telegramId: bigint("telegram_id", { mode: "number" }),
  telegramLinkToken: text("telegram_link_token"),
  // Linkage terpisah untuk Bot VPN (BotVPN repo / @panelketan_bot).
  // Kolom telegramId di atas dipakai oleh Bot Notifikasi (kirim notif order/topup,
  // tiket support). Karena Bot VPN punya token & username berbeda, kita pakai
  // pasangan kolom terpisah supaya 1 user web bisa terhubung ke 2 bot independen
  // tanpa konflik.
  vpnTelegramId: bigint("vpn_telegram_id", { mode: "number" }),
  vpnTelegramLinkToken: text("vpn_telegram_link_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

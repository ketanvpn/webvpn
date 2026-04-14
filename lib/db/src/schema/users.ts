import { pgTable, serial, text, boolean, numeric, timestamp, bigint } from "drizzle-orm/pg-core";
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
  referralCode: text("referral_code").unique(),
  telegramId: bigint("telegram_id", { mode: "number" }),
  telegramLinkToken: text("telegram_link_token"),
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

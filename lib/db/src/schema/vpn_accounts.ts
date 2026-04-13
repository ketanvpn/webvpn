import { pgTable, serial, text, boolean, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { serversTable } from "./servers";

export const vpnAccountsTable = pgTable("vpn_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  orderId: integer("order_id"),
  protocol: text("protocol").notNull(),
  username: text("username").notNull(),
  password: text("password"),
  uuid: text("uuid"),
  serverId: integer("server_id").notNull().references(() => serversTable.id),
  configLink: text("config_link"),
  expiresAt: timestamp("expires_at").notNull(),
  quota: numeric("quota", { precision: 10, scale: 2 }),
  usedQuota: numeric("used_quota", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVpnAccountSchema = createInsertSchema(vpnAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVpnAccount = z.infer<typeof insertVpnAccountSchema>;
export type VpnAccount = typeof vpnAccountsTable.$inferSelect;

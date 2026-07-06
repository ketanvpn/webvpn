import { pgTable, serial, text, boolean, numeric, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  allLinks: jsonb("all_links").$type<Record<string, string | null>>(),
  expiresAt: timestamp("expires_at").notNull(),
  quota: numeric("quota", { precision: 10, scale: 2 }),
  usedQuota: numeric("used_quota", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  notified3Days: boolean("notified_3_days").notNull().default(false),
  notified1Day: boolean("notified_1_day").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("vpn_accounts_active_username_idx")
    .on(t.username)
    .where(sql`is_active = true`),
  index("vpn_accounts_user_id_idx").on(t.userId),
]);

export const insertVpnAccountSchema = createInsertSchema(vpnAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVpnAccount = z.infer<typeof insertVpnAccountSchema>;
export type VpnAccount = typeof vpnAccountsTable.$inferSelect;

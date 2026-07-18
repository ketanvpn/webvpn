import { pgTable, serial, text, boolean, numeric, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { vpnAccountsTable } from "./vpn_accounts";
import { vouchersTable } from "./vouchers";

export const dynamicProviderServersTable = pgTable("dynamic_provider_servers", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("nadiavpn"),
  providerServerId: text("provider_server_id").notNull(),
  providerName: text("provider_name").notNull(),
  displayName: text("display_name").notNull(),
  location: text("location"),
  supportedProtocols: jsonb("supported_protocols").$type<string[]>().notNull().default([]),
  enabledProtocols: jsonb("enabled_protocols").$type<string[]>().notNull().default([]),
  supportedTypes: jsonb("supported_types").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(false),
  trialEnabled: boolean("trial_enabled").notNull().default(false),
  providerTrialEnabled: boolean("provider_trial_enabled").notNull().default(false),
  trialDuration: text("trial_duration"),
  renewEnabled: boolean("renew_enabled").notNull().default(true),
  costPerDay: numeric("cost_per_day", { precision: 12, scale: 2 }).default("0"),
  costPerWeek: numeric("cost_per_week", { precision: 12, scale: 2 }).default("0"),
  costPerMonth: numeric("cost_per_month", { precision: 12, scale: 2 }).default("0"),
  sellPricePerDay: numeric("sell_price_per_day", { precision: 12, scale: 2 }).default("0"),
  sellPricePerWeek: numeric("sell_price_per_week", { precision: 12, scale: 2 }).default("0"),
  sellPricePerMonth: numeric("sell_price_per_month", { precision: 12, scale: 2 }).default("0"),
  minDays: integer("min_days").notNull().default(1),
  maxDays: integer("max_days").notNull().default(30),
  minMonths: integer("min_months").notNull().default(1),
  maxMonths: integer("max_months").notNull().default(12),
  capacityLimit: text("capacity_limit"),
  capacityUsed: integer("capacity_used").notNull().default(0),
  capacityIsFull: boolean("capacity_is_full").notNull().default(false),
  maxConnections: integer("max_connections").notNull().default(0),
  pricingMode: text("pricing_mode").notNull().default("manual"),
  markupPercent: integer("markup_percent").notNull().default(30),
  sortOrder: integer("sort_order").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("dynamic_provider_servers_provider_sid_idx").on(t.provider, t.providerServerId),
]);

export const dynamicVpnOrdersTable = pgTable("dynamic_vpn_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  dynamicServerId: integer("dynamic_server_id").references(() => dynamicProviderServersTable.id),
  provider: text("provider").notNull().default("nadiavpn"),
  providerServerId: text("provider_server_id").notNull(),
  serverDisplayName: text("server_display_name").notNull(),
  protocol: text("protocol").notNull(),
  durationType: text("duration_type").notNull(),
  duration: integer("duration").notNull(),
  username: text("username").notNull(),
  password: text("password"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  voucherId: integer("voucher_id").references(() => vouchersTable.id),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  status: text("status").notNull().default("pending"),
  paymentMethod: text("payment_method").notNull().default("balance"),
  vpnAccountId: integer("vpn_account_id").references(() => vpnAccountsTable.id),
  providerAccountId: text("provider_account_id"),
  providerResponse: jsonb("provider_response").$type<Record<string, unknown>>(),
  qrisUrl: text("qris_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("dynamic_vpn_orders_user_id_idx").on(t.userId),
  index("dynamic_vpn_orders_vpn_account_id_idx").on(t.vpnAccountId),
  index("dynamic_vpn_orders_status_idx").on(t.status),
]);

export const insertDynamicProviderServerSchema = createInsertSchema(dynamicProviderServersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDynamicVpnOrderSchema = createInsertSchema(dynamicVpnOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDynamicProviderServer = z.infer<typeof insertDynamicProviderServerSchema>;
export type DynamicProviderServer = typeof dynamicProviderServersTable.$inferSelect;
export type InsertDynamicVpnOrder = z.infer<typeof insertDynamicVpnOrderSchema>;
export type DynamicVpnOrder = typeof dynamicVpnOrdersTable.$inferSelect;

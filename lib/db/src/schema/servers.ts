import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serversTable = pgTable("vpn_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  flag: text("flag").notNull().default("🌐"),
  host: text("host").notNull(),
  apiUrl: text("api_url"),
  apiToken: text("api_token"),
  supportedProtocols: text("supported_protocols").array().notNull().default(["ssh"]),
  isActive: boolean("is_active").notNull().default(true),
  maxAccounts: integer("max_accounts").notNull().default(500),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServerSchema = createInsertSchema(serversTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServer = z.infer<typeof insertServerSchema>;
export type VpnServer = typeof serversTable.$inferSelect;

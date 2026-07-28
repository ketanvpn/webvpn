import { pgTable, serial, text, boolean, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { productsTable } from "./products";
import { vouchersTable } from "./vouchers";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  productId: integer("product_id").notNull().references(() => productsTable.id),
  status: text("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  vpnAccountId: integer("vpn_account_id"),
  paymentMethod: text("payment_method").default("balance"),
  paymentProvider: text("payment_provider"),
  paymentChannel: text("payment_channel"),
  payableAmount: numeric("payable_amount", { precision: 12, scale: 2 }),
  uniqueCode: integer("unique_code"),
  notes: text("notes"),
  autogopayTransactionId: text("autogopay_transaction_id"),
  qrisUrl: text("qris_url"),
  expiresAt: timestamp("expires_at"),
  voucherId: integer("voucher_id").references(() => vouchersTable.id),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_user_id_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
]);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

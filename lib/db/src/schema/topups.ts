import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const topupsTable = pgTable("topup_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentProvider: text("payment_provider"),
  paymentChannel: text("payment_channel"),
  payableAmount: numeric("payable_amount", { precision: 12, scale: 2 }),
  uniqueCode: integer("unique_code"),
  qrisUrl: text("qris_url"),
  status: text("status").notNull().default("pending"),
  confirmedBy: integer("confirmed_by"),
  rejectionNote: text("rejection_note"),
  autogopayTransactionId: text("autogopay_transaction_id"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("topup_transactions_user_id_idx").on(t.userId),
  index("topup_transactions_status_idx").on(t.status),
]);

export const insertTopupSchema = createInsertSchema(topupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTopup = z.infer<typeof insertTopupSchema>;
export type Topup = typeof topupsTable.$inferSelect;

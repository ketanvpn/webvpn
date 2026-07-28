import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { ordersTable } from "./orders";
import { topupsTable } from "./topups";

export const paymentAttemptsTable = pgTable(
  "payment_attempts",
  {
    id: serial("id").primaryKey(),
    // Payment attempts are immutable audit/correlation records. Owners with an
    // attempt must be retained rather than deleted or cascaded away.
    orderId: integer("order_id").references(() => ordersTable.id, {
      onDelete: "restrict",
    }),
    topupId: integer("topup_id").references(() => topupsTable.id, {
      onDelete: "restrict",
    }),
    provider: text("provider").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    providerTransactionId: text("provider_transaction_id"),
    baseAmount: numeric("base_amount", { precision: 12, scale: 2 }).notNull(),
    payableAmount: numeric("payable_amount", { precision: 12, scale: 2 }).notNull(),
    uniqueCode: integer("unique_code"),
    qrisUrl: text("qris_url"),
    qrString: text("qr_string"),
    checkoutUrl: text("checkout_url"),
    matchingKey: text("matching_key"),
    transactionFingerprint: text("transaction_fingerprint"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    settledAt: timestamp("settled_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "payment_attempts_exactly_one_owner_check",
      sql`(${table.orderId} is not null and ${table.topupId} is null) or (${table.orderId} is null and ${table.topupId} is not null)`,
    ),
    index("payment_attempts_order_id_idx")
      .on(table.orderId)
      .where(sql`${table.orderId} is not null`),
    index("payment_attempts_topup_id_idx")
      .on(table.topupId)
      .where(sql`${table.topupId} is not null`),
    index("payment_attempts_provider_status_idx").on(table.provider, table.status),
    index("payment_attempts_status_last_checked_at_idx").on(
      table.status,
      table.lastCheckedAt,
    ),
    index("payment_attempts_status_expires_at_idx").on(table.status, table.expiresAt),
    uniqueIndex("payment_attempts_provider_transaction_id_uidx")
      .on(table.provider, table.providerTransactionId)
      .where(sql`${table.providerTransactionId} is not null`),
    uniqueIndex("payment_attempts_provider_matching_key_uidx")
      .on(table.provider, table.matchingKey)
      .where(sql`${table.matchingKey} is not null`),
    uniqueIndex("payment_attempts_provider_transaction_fingerprint_uidx")
      .on(table.provider, table.transactionFingerprint)
      .where(sql`${table.transactionFingerprint} is not null`),
  ],
);

export const insertPaymentAttemptSchema = createInsertSchema(paymentAttemptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentAttempt = z.infer<typeof insertPaymentAttemptSchema>;
export type PaymentAttempt = typeof paymentAttemptsTable.$inferSelect;

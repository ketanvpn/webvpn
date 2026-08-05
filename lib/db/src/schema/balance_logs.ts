import { pgTable, serial, integer, numeric, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const balanceLogsTable = pgTable("balance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  relatedId: integer("related_id"),
  refId: text("ref_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("balance_logs_user_id_idx").on(t.userId),
  index("balance_logs_ref_id_idx").on(t.refId),
  uniqueIndex("balance_logs_user_ref_unique").on(t.userId, t.refId),
]);

export type BalanceLog = typeof balanceLogsTable.$inferSelect;

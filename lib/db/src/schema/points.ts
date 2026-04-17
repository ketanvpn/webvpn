import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pointLogsTable = pgTable("point_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  pointsBefore: integer("points_before").notNull(),
  pointsAfter: integer("points_after").notNull(),
  description: text("description").notNull(),
  relatedId: integer("related_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

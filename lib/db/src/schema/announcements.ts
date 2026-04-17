import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("info"),
  isActive: boolean("is_active").notNull().default(true),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

import { pgTable, serial, text, boolean, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  protocol: text("protocol").notNull(),
  durationDays: integer("duration_days").notNull(),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  quota: numeric("quota", { precision: 10, scale: 2 }),
  maxConnections: integer("max_connections"),
  isActive: boolean("is_active").notNull().default(true),
  category: text("category"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

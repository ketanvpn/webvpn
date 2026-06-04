import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bugPresetsTable = pgTable("bug_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  bugDomain: text("bug_domain").notNull(),
  mode: text("mode").notNull(), // 'wildcard', 'sni', 'host'
  isActive: boolean("is_active").notNull().default(true),
  sshInjectConfig: jsonb("ssh_inject_config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBugPresetSchema = createInsertSchema(bugPresetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBugPreset = z.infer<typeof insertBugPresetSchema>;
export type BugPreset = typeof bugPresetsTable.$inferSelect;

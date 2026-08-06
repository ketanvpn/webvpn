import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TutorialStepActionType =
  | "none"
  | "playstore"
  | "payload_proxy"
  | "sni"
  | "ssh_account"
  | "connect";

export interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  imageUrl: string | null;
  actionType?: TutorialStepActionType;
}

// ─── Table ────────────────────────────────────────────────────────────────────

export const appTutorialsTable = pgTable(
  "app_tutorials",
  {
    id: serial("id").primaryKey(),
    appSlug: text("app_slug").notNull().unique(),
    appName: text("app_name").notNull(),
    description: text("description"),
    steps: jsonb("steps")
      .$type<TutorialStep[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "app_tutorials_slug_format_check",
      sql`${table.appSlug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check("app_tutorials_name_nonempty_check", sql`btrim(${table.appName}) <> ''`),
  ],
);

// ─── Inferred types ───────────────────────────────────────────────────────────

export type AppTutorial = typeof appTutorialsTable.$inferSelect;
export type InsertAppTutorial = typeof appTutorialsTable.$inferInsert;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const trimmedNonempty = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(max));

export const tutorialStepSchema = z
  .object({
    id: z.string().uuid(),
    stepNumber: z.int().min(1),
    title: trimmedNonempty(200),
    description: trimmedNonempty(2000),
    imageUrl: z.string().min(1).nullish().transform((v) => v ?? null),
    actionType: z
      .enum(["none", "playstore", "payload_proxy", "sni", "ssh_account", "connect"])
      .optional()
      .default("none"),
  })
  .strict();

export const createTutorialSchema = z
  .object({
    appSlug: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1).max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)),
    appName: trimmedNonempty(100),
    description: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().max(500))
      .nullish()
      .transform((v) => v ?? null),
    steps: z.array(tutorialStepSchema).default([]),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.int().optional().default(0),
  })
  .strict();

export const updateTutorialSchema = z
  .object({
    appSlug: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().min(1).max(50).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/))
      .optional(),
    appName: trimmedNonempty(100).optional(),
    description: z
      .string()
      .transform((s) => s.trim())
      .pipe(z.string().max(500))
      .nullish()
      .transform((v) => v ?? null),
    steps: z.array(tutorialStepSchema).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.int().optional(),
  })
  .strict();

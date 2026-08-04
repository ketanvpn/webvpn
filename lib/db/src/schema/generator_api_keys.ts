import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

// ============================================================================
// Constants & Types
// ============================================================================

export const GENERATOR_API_SCOPES = ["generate", "unlock", "inspect"] as const;

export type GeneratorApiScope = (typeof GENERATOR_API_SCOPES)[number];

// ============================================================================
// Table Definition
// ============================================================================

export const generatorApiKeysTable = pgTable(
  "generator_api_keys",
  {
    id: serial("id").primaryKey(),
    
    // Key identifier (public part, displayed in UI as btg_<keyId>_<secret>)
    keyId: text("key_id").notNull().unique(),
    
    // SHA-256 hash of the full raw key (btg_<keyId>_<secret>)
    keyHash: text("key_hash").notNull(),
    
    // Human-readable label for the key
    label: text("label").notNull(),
    
    // Scopes granted to this key
    scopes: text("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY['generate']::text[]`),
    
    // Whether the key is enabled
    enabled: boolean("enabled").notNull().default(true),
    
    // Expiration timestamp (null = no expiration)
    expiresAt: timestamp("expires_at"),
    
    // Daily request quota (null = unlimited)
    dailyLimit: integer("daily_limit"),
    
    // Current daily usage date (YYYY-MM-DD format)
    dailyUsageDate: text("daily_usage_date"),
    
    // Current daily usage count
    dailyUsage: integer("daily_usage").notNull().default(0),
    
    // Total usage count
    usageCount: integer("usage_count").notNull().default(0),
    
    // Last used timestamp
    lastUsedAt: timestamp("last_used_at"),
    
    // Last IP address that used the key
    lastIp: text("last_ip"),
    
    // Admin who created this key
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    
    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Key ID format: 8 hex characters
    check(
      "generator_api_keys_key_id_format_check",
      sql`${table.keyId} ~ '^[a-f0-9]{8}$'`
    ),
    
    // Label must not be empty
    check(
      "generator_api_keys_label_nonempty_check",
      sql`btrim(${table.label}) <> ''`
    ),
    
    // Daily limit must be positive if set
    check(
      "generator_api_keys_daily_limit_check",
      sql`${table.dailyLimit} is null or ${table.dailyLimit} > 0`
    ),
    
    // Daily usage must be non-negative
    check(
      "generator_api_keys_daily_usage_check",
      sql`${table.dailyUsage} >= 0`
    ),
    
    // Usage count must be non-negative
    check(
      "generator_api_keys_usage_count_check",
      sql`${table.usageCount} >= 0`
    ),
    
    // Unique index on keyId (already unique via column definition, but explicit)
    uniqueIndex("generator_api_keys_key_id_idx").on(table.keyId),
  ]
);

// ============================================================================
// Validation Schemas
// ============================================================================

const trimmedNonempty = (max: number) => z.string().trim().min(1).max(max);

export const generatorApiKeyScopesSchema = z
  .array(z.enum(GENERATOR_API_SCOPES))
  .min(1, { message: "At least one scope is required" })
  .default(["generate"]);

export const createGeneratorApiKeySchema = z
  .object({
    label: trimmedNonempty(200),
    scopes: generatorApiKeyScopesSchema,
    expiresAt: z.coerce.date().nullable().optional(),
    dailyLimit: z.number().int().positive().nullable().optional(),
  })
  .strict();

export const updateGeneratorApiKeySchema = z
  .object({
    label: trimmedNonempty(200).optional(),
    scopes: generatorApiKeyScopesSchema.optional(),
    enabled: z.boolean().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    dailyLimit: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const insertGeneratorApiKeySchema = createInsertSchema(generatorApiKeysTable).omit({
  id: true,
  keyId: true,
  keyHash: true,
  dailyUsageDate: true,
  dailyUsage: true,
  usageCount: true,
  lastUsedAt: true,
  lastIp: true,
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateGeneratorApiKey = z.infer<typeof createGeneratorApiKeySchema>;
export type UpdateGeneratorApiKey = z.infer<typeof updateGeneratorApiKeySchema>;
export type InsertGeneratorApiKey = typeof generatorApiKeysTable.$inferInsert;
export type GeneratorApiKey = typeof generatorApiKeysTable.$inferSelect;

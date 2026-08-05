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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const EASY_INJECT_ACCOUNT_KINDS = ["normal", "cloudfront"] as const;
export const EASY_INJECT_MODES = ["PROXY", "PROXY_SNI"] as const;
export const EASY_INJECT_SNI_POLICIES = ["none", "account_host", "custom"] as const;

export type EasyInjectAccountKind = (typeof EASY_INJECT_ACCOUNT_KINDS)[number];
export type EasyInjectMode = (typeof EASY_INJECT_MODES)[number];
export type EasyInjectSniPolicy = (typeof EASY_INJECT_SNI_POLICIES)[number];

export type EasyInjectPurchaseOption = {
  id: string;
  label: string;
  quotaText?: string;
  priceText?: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
};

export interface EasyInjectPresetSnapshot {
  id: number;
  slug: string;
  name: string;
  description: string;
  accountLabel: string;
  requiredAccountKind: EasyInjectAccountKind;
  sshPort: number;
  mode: EasyInjectMode;
  proxyHost: string;
  proxyPort: number;
  payload: string;
  sniPolicy: EasyInjectSniPolicy;
  customSni: string | null;
  usePayload: boolean;
  ssl: boolean;
  supportsDarkTunnel: boolean;
  supportsHttpCustom: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  sortOrder: number;
  version: number;
  purchaseOptions: EasyInjectPurchaseOption[];
  createdAt: string;
  updatedAt: string;
}

export const easyInjectPresetsTable = pgTable(
  "easy_inject_presets",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    accountLabel: text("account_label").notNull(),
    requiredAccountKind: text("required_account_kind")
      .$type<EasyInjectAccountKind>()
      .notNull(),
    sshPort: integer("ssh_port").notNull(),
    mode: text("mode").$type<EasyInjectMode>().notNull(),
    proxyHost: text("proxy_host").notNull(),
    proxyPort: integer("proxy_port").notNull(),
    payload: text("payload").notNull(),
    sniPolicy: text("sni_policy").$type<EasyInjectSniPolicy>().notNull(),
    customSni: text("custom_sni"),
    usePayload: boolean("use_payload").notNull(),
    ssl: boolean("ssl").notNull(),
    supportsDarkTunnel: boolean("supports_dark_tunnel").notNull(),
    supportsHttpCustom: boolean("supports_http_custom").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isBuiltIn: boolean("is_built_in").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    purchaseOptions: jsonb("purchase_options")
      .$type<EasyInjectPurchaseOption[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "easy_inject_presets_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    check("easy_inject_presets_name_nonempty_check", sql`btrim(${table.name}) <> ''`),
    check(
      "easy_inject_presets_description_nonempty_check",
      sql`btrim(${table.description}) <> ''`,
    ),
    check(
      "easy_inject_presets_account_label_nonempty_check",
      sql`btrim(${table.accountLabel}) <> ''`,
    ),
    check(
      "easy_inject_presets_account_kind_check",
      sql`${table.requiredAccountKind} in ('normal', 'cloudfront')`,
    ),
    check(
      "easy_inject_presets_ssh_port_check",
      sql`${table.sshPort} between 1 and 65535`,
    ),
    check("easy_inject_presets_mode_check", sql`${table.mode} in ('PROXY', 'PROXY_SNI')`),
    check(
      "easy_inject_presets_proxy_host_nonempty_check",
      sql`btrim(${table.proxyHost}) <> ''`,
    ),
    check(
      "easy_inject_presets_proxy_port_check",
      sql`${table.proxyPort} between 1 and 65535`,
    ),
    check(
      "easy_inject_presets_payload_nonempty_check",
      sql`btrim(${table.payload}) <> ''`,
    ),
    check(
      "easy_inject_presets_sni_policy_check",
      sql`${table.sniPolicy} in ('none', 'account_host', 'custom')`,
    ),
    check(
      "easy_inject_presets_proxy_sni_policy_check",
      sql`${table.mode} <> 'PROXY_SNI' or ${table.sniPolicy} <> 'none'`,
    ),
    check(
      "easy_inject_presets_custom_sni_check",
      sql`(${table.sniPolicy} = 'custom' and btrim(coalesce(${table.customSni}, '')) <> '') or (${table.sniPolicy} <> 'custom' and ${table.customSni} is null)`,
    ),
    check(
      "easy_inject_presets_none_ssl_check",
      sql`${table.sniPolicy} <> 'none' or ${table.ssl} = false`,
    ),
    check(
      "easy_inject_presets_supported_app_check",
      sql`${table.supportsDarkTunnel} = true or ${table.supportsHttpCustom} = true`,
    ),
    check("easy_inject_presets_sort_order_check", sql`${table.sortOrder} >= 0`),
    check("easy_inject_presets_version_check", sql`${table.version} > 0`),
  ],
);

export const easyInjectPresetRevisionsTable = pgTable(
  "easy_inject_preset_revisions",
  {
    id: serial("id").primaryKey(),
    presetId: integer("preset_id")
      .notNull()
      .references(() => easyInjectPresetsTable.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    snapshot: jsonb("snapshot").$type<EasyInjectPresetSnapshot>().notNull(),
    action: text("action").notNull(),
    adminUserId: integer("admin_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("easy_inject_preset_revisions_preset_version_idx").on(
      table.presetId,
      table.version,
    ),
    check("easy_inject_preset_revisions_version_check", sql`${table.version} > 0`),
    check(
      "easy_inject_preset_revisions_action_nonempty_check",
      sql`btrim(${table.action}) <> ''`,
    ),
  ],
);

const trimmedNonempty = (max: number) => z.string().trim().min(1).max(max);
const portSchema = z.number().int().min(1).max(65535);

const optionalShortText = z.preprocess(
  (val) => {
    if (typeof val === "string" && val.trim() === "") return undefined;
    return val;
  },
  z.string().trim().min(1).max(120).optional(),
);

export const easyInjectPurchaseOptionSchema = z
  .object({
    id: trimmedNonempty(50).regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/),
    label: trimmedNonempty(120),
    quotaText: optionalShortText,
    priceText: optionalShortText,
    url: z
      .string()
      .trim()
      .url()
      .max(2000)
      .refine((v) => v.startsWith("https://"), {
        message: "Must be https",
      }),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
  })
  .strict();

export const easyInjectPresetConfigurationSchema = z
  .object({
    slug: trimmedNonempty(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: trimmedNonempty(120),
    description: trimmedNonempty(1000),
    accountLabel: trimmedNonempty(120),
    requiredAccountKind: z.enum(EASY_INJECT_ACCOUNT_KINDS),
    sshPort: portSchema,
    mode: z.enum(EASY_INJECT_MODES),
    proxyHost: trimmedNonempty(255),
    proxyPort: portSchema,
    payload: trimmedNonempty(16_000),
    sniPolicy: z.enum(EASY_INJECT_SNI_POLICIES),
    customSni: trimmedNonempty(255).nullable(),
    usePayload: z.boolean(),
    ssl: z.boolean(),
    supportsDarkTunnel: z.boolean(),
    supportsHttpCustom: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
    purchaseOptions: z.array(easyInjectPurchaseOptionSchema).max(10),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.supportsDarkTunnel && !value.supportsHttpCustom) {
      ctx.addIssue({
        code: "custom",
        path: ["supportsDarkTunnel"],
        message: "At least one app must be supported",
      });
    }
    if (value.mode === "PROXY_SNI" && value.sniPolicy === "none") {
      ctx.addIssue({
        code: "custom",
        path: ["sniPolicy"],
        message: "PROXY_SNI requires an SNI policy",
      });
    }
    if (value.sniPolicy === "custom" && !value.customSni) {
      ctx.addIssue({
        code: "custom",
        path: ["customSni"],
        message: "customSni is required when sniPolicy is custom",
      });
    }
    if (value.sniPolicy !== "custom" && value.customSni !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["customSni"],
        message: "customSni must be null unless sniPolicy is custom",
      });
    }
    if (value.sniPolicy === "none" && value.ssl) {
      ctx.addIssue({
        code: "custom",
        path: ["ssl"],
        message: "SSL cannot be enabled when sniPolicy is none",
      });
    }
  });

const createEasyInjectPresetObjectSchema = z
  .object({
    slug: trimmedNonempty(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: trimmedNonempty(120),
    description: trimmedNonempty(1000),
    accountLabel: trimmedNonempty(120),
    requiredAccountKind: z.enum(EASY_INJECT_ACCOUNT_KINDS),
    sshPort: portSchema,
    mode: z.enum(EASY_INJECT_MODES),
    proxyHost: trimmedNonempty(255),
    proxyPort: portSchema,
    payload: trimmedNonempty(16_000),
    sniPolicy: z.enum(EASY_INJECT_SNI_POLICIES),
    customSni: trimmedNonempty(255).nullable().default(null),
    usePayload: z.boolean(),
    ssl: z.boolean(),
    supportsDarkTunnel: z.boolean(),
    supportsHttpCustom: z.boolean(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).default(0),
    purchaseOptions: z.array(easyInjectPurchaseOptionSchema).max(10).default([]),
  })
  .strict();

export const createEasyInjectPresetSchema = createEasyInjectPresetObjectSchema.superRefine(
  (value, ctx) => {
    const result = easyInjectPresetConfigurationSchema.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue(issue);
      }
    }
  },
);

export const updateEasyInjectPresetSchema = z
  .object({
    name: trimmedNonempty(120).optional(),
    description: trimmedNonempty(1000).optional(),
    accountLabel: trimmedNonempty(120).optional(),
    requiredAccountKind: z.enum(EASY_INJECT_ACCOUNT_KINDS).optional(),
    sshPort: portSchema.optional(),
    mode: z.enum(EASY_INJECT_MODES).optional(),
    proxyHost: trimmedNonempty(255).optional(),
    proxyPort: portSchema.optional(),
    payload: trimmedNonempty(16_000).optional(),
    sniPolicy: z.enum(EASY_INJECT_SNI_POLICIES).optional(),
    customSni: trimmedNonempty(255).nullable().optional(),
    usePayload: z.boolean().optional(),
    ssl: z.boolean().optional(),
    supportsDarkTunnel: z.boolean().optional(),
    supportsHttpCustom: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    purchaseOptions: z.array(easyInjectPurchaseOptionSchema).max(10).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const insertEasyInjectPresetSchema = createInsertSchema(easyInjectPresetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateEasyInjectPreset = z.infer<typeof createEasyInjectPresetSchema>;
export type UpdateEasyInjectPreset = z.infer<typeof updateEasyInjectPresetSchema>;
export type InsertEasyInjectPreset = typeof easyInjectPresetsTable.$inferInsert;
export type EasyInjectPreset = typeof easyInjectPresetsTable.$inferSelect;
export type EasyInjectPresetRevision = typeof easyInjectPresetRevisionsTable.$inferSelect;

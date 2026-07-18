import { Router, type Request } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  adminAuditLogsTable,
  createEasyInjectPresetSchema,
  db,
  easyInjectPresetConfigurationSchema,
  easyInjectPresetRevisionsTable,
  easyInjectPresetsTable,
  updateEasyInjectPresetSchema,
  type EasyInjectPreset,
  type EasyInjectPresetSnapshot,
} from "@workspace/db";
import { requireAdmin, requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";
import { getClientIp } from "../lib/request-ip";

const router = Router();

const mutablePresetFields = [
  "name",
  "description",
  "accountLabel",
  "requiredAccountKind",
  "sshPort",
  "mode",
  "proxyHost",
  "proxyPort",
  "payload",
  "sniPolicy",
  "customSni",
  "usePayload",
  "ssl",
  "supportsDarkTunnel",
  "supportsHttpCustom",
  "isActive",
  "sortOrder",
] as const;

type MutablePresetField = (typeof mutablePresetFields)[number];
type MutablePresetValues = Pick<EasyInjectPreset, MutablePresetField>;

function toPublicPresetDto(preset: EasyInjectPreset) {
  return {
    id: preset.id,
    slug: preset.slug,
    name: preset.name,
    description: preset.description,
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: preset.sshPort,
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: preset.proxyPort,
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni,
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    version: preset.version,
  };
}

function toAdminPresetDto(preset: EasyInjectPreset) {
  return {
    ...toPublicPresetDto(preset),
    isActive: preset.isActive,
    isBuiltIn: preset.isBuiltIn,
    sortOrder: preset.sortOrder,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  };
}

function toSnapshot(preset: EasyInjectPreset): EasyInjectPresetSnapshot {
  return {
    id: preset.id,
    slug: preset.slug,
    name: preset.name,
    description: preset.description,
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: preset.sshPort,
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: preset.proxyPort,
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni,
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    isActive: preset.isActive,
    isBuiltIn: preset.isBuiltIn,
    sortOrder: preset.sortOrder,
    version: preset.version,
    createdAt: preset.createdAt.toISOString(),
    updatedAt: preset.updatedAt.toISOString(),
  };
}

function snapshotConfiguration(snapshot: EasyInjectPresetSnapshot) {
  return {
    slug: snapshot.slug,
    name: snapshot.name,
    description: snapshot.description,
    accountLabel: snapshot.accountLabel,
    requiredAccountKind: snapshot.requiredAccountKind,
    sshPort: snapshot.sshPort,
    mode: snapshot.mode,
    proxyHost: snapshot.proxyHost,
    proxyPort: snapshot.proxyPort,
    payload: snapshot.payload,
    sniPolicy: snapshot.sniPolicy,
    customSni: snapshot.customSni,
    usePayload: snapshot.usePayload,
    ssl: snapshot.ssl,
    supportsDarkTunnel: snapshot.supportsDarkTunnel,
    supportsHttpCustom: snapshot.supportsHttpCustom,
    isActive: snapshot.isActive,
    sortOrder: snapshot.sortOrder,
  };
}

function parsePositiveId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validationError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return {
    error: "Invalid input",
    issues: error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") {
    return true;
  }

  return candidate.cause !== undefined && isUniqueViolation(candidate.cause);
}

function selectMutableValues(preset: EasyInjectPreset): MutablePresetValues {
  return {
    name: preset.name,
    description: preset.description,
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: preset.sshPort,
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: preset.proxyPort,
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni,
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    isActive: preset.isActive,
    sortOrder: preset.sortOrder,
  };
}

function changedFields(before: MutablePresetValues, after: MutablePresetValues) {
  return mutablePresetFields.filter((field) => before[field] !== after[field]);
}

function getAdminContext(req: Request) {
  return {
    adminUserId: req.user!.userId,
    ipAddress: getClientIp(req),
  };
}

router.get("/easy-inject-presets", requireAuth, async (_req, res) => {
  try {
    res.set("Cache-Control", "private, no-store");
    const presets = await db
      .select()
      .from(easyInjectPresetsTable)
      .where(eq(easyInjectPresetsTable.isActive, true))
      .orderBy(
        asc(easyInjectPresetsTable.sortOrder),
        asc(easyInjectPresetsTable.name),
        asc(easyInjectPresetsTable.id),
      );

    res.json(presets.map(toPublicPresetDto));
  } catch (error) {
    logger.error({ err: error }, "Failed to list active Easy Inject presets");
    res.status(500).json({ error: "Failed to fetch Easy Inject presets" });
  }
});

router.get("/admin/easy-inject-presets", requireAdmin, async (_req, res) => {
  try {
    const presets = await db
      .select()
      .from(easyInjectPresetsTable)
      .orderBy(
        asc(easyInjectPresetsTable.sortOrder),
        asc(easyInjectPresetsTable.name),
        asc(easyInjectPresetsTable.id),
      );

    res.json(presets.map(toAdminPresetDto));
  } catch (error) {
    logger.error({ err: error }, "Failed to list Easy Inject presets for admin");
    res.status(500).json({ error: "Failed to fetch Easy Inject presets" });
  }
});

router.post("/admin/easy-inject-presets", requireAdmin, async (req, res) => {
  const parsed = createEasyInjectPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  try {
    const created = await db.transaction(async (tx) => {
      const [preset] = await tx
        .insert(easyInjectPresetsTable)
        .values({
          ...parsed.data,
          isBuiltIn: false,
          version: 1,
        })
        .returning();

      if (!preset) {
        throw new Error("Easy Inject preset insert returned no row");
      }

      const snapshot = toSnapshot(preset);

      await tx.insert(easyInjectPresetRevisionsTable).values({
        presetId: preset.id,
        version: preset.version,
        snapshot,
        action: "create",
        adminUserId,
      });

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action: "create_easy_inject_preset",
        targetType: "easy_inject_preset",
        targetId: preset.id,
        details: { before: null, after: snapshot, changedFields: ["created"] },
        ipAddress,
      });

      return preset;
    });

    res.status(201).json(toAdminPresetDto(created));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "An Easy Inject preset with this slug already exists" });
      return;
    }

    logger.error({ err: error, adminUserId }, "Failed to create Easy Inject preset");
    res.status(500).json({ error: "Failed to create Easy Inject preset" });
  }
});

router.patch("/admin/easy-inject-presets/:id", requireAdmin, async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid preset id" });
    return;
  }

  const parsed = updateEasyInjectPresetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(validationError(parsed.error));
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(easyInjectPresetsTable)
        .where(eq(easyInjectPresetsTable.id, id))
        .for("update")
        .limit(1);

      if (!current) {
        return { kind: "not_found" as const };
      }

      const candidate = {
        slug: current.slug,
        ...selectMutableValues(current),
        ...parsed.data,
      };
      const validated = easyInjectPresetConfigurationSchema.safeParse(candidate);
      if (!validated.success) {
        return { kind: "invalid" as const, error: validated.error };
      }

      const beforeValues = selectMutableValues(current);
      const nextValues: MutablePresetValues = {
        name: validated.data.name,
        description: validated.data.description,
        accountLabel: validated.data.accountLabel,
        requiredAccountKind: validated.data.requiredAccountKind,
        sshPort: validated.data.sshPort,
        mode: validated.data.mode,
        proxyHost: validated.data.proxyHost,
        proxyPort: validated.data.proxyPort,
        payload: validated.data.payload,
        sniPolicy: validated.data.sniPolicy,
        customSni: validated.data.customSni,
        usePayload: validated.data.usePayload,
        ssl: validated.data.ssl,
        supportsDarkTunnel: validated.data.supportsDarkTunnel,
        supportsHttpCustom: validated.data.supportsHttpCustom,
        isActive: validated.data.isActive,
        sortOrder: validated.data.sortOrder,
      };
      const fields = changedFields(beforeValues, nextValues);

      if (fields.length === 0) {
        return { kind: "unchanged" as const, preset: current };
      }

      const [updated] = await tx
        .update(easyInjectPresetsTable)
        .set({
          ...nextValues,
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(easyInjectPresetsTable.id, id))
        .returning();

      if (!updated) {
        throw new Error("Easy Inject preset disappeared during update");
      }

      const before = toSnapshot(current);
      const after = toSnapshot(updated);
      const action = fields.length === 1 && fields[0] === "isActive" ? "toggle" : "update";

      await tx.insert(easyInjectPresetRevisionsTable).values({
        presetId: updated.id,
        version: updated.version,
        snapshot: after,
        action,
        adminUserId,
      });

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action:
          action === "toggle"
            ? "toggle_easy_inject_preset"
            : "update_easy_inject_preset",
        targetType: "easy_inject_preset",
        targetId: updated.id,
        details: { before, after, changedFields: fields },
        ipAddress,
      });

      return { kind: "updated" as const, preset: updated };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Easy Inject preset not found" });
      return;
    }
    if (result.kind === "invalid") {
      res.status(400).json(validationError(result.error));
      return;
    }

    res.json(toAdminPresetDto(result.preset));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Easy Inject preset identity conflicts with existing data" });
      return;
    }

    logger.error({ err: error, presetId: id, adminUserId }, "Failed to update Easy Inject preset");
    res.status(500).json({ error: "Failed to update Easy Inject preset" });
  }
});

router.delete("/admin/easy-inject-presets/:id", requireAdmin, async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid preset id" });
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(easyInjectPresetsTable)
        .where(eq(easyInjectPresetsTable.id, id))
        .for("update")
        .limit(1);

      if (!current) {
        return { kind: "not_found" as const };
      }
      if (current.isBuiltIn) {
        return { kind: "built_in" as const };
      }

      const before = toSnapshot(current);

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action: "delete_easy_inject_preset",
        targetType: "easy_inject_preset",
        targetId: current.id,
        details: { before, after: null, changedFields: ["deleted"] },
        ipAddress,
      });

      await tx.delete(easyInjectPresetsTable).where(eq(easyInjectPresetsTable.id, id));

      return { kind: "deleted" as const, preset: current };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Easy Inject preset not found" });
      return;
    }
    if (result.kind === "built_in") {
      res.status(409).json({
        error: "Built-in presets cannot be deleted; deactivate the preset instead",
      });
      return;
    }

    res.json({ success: true, id: result.preset.id });
  } catch (error) {
    logger.error({ err: error, presetId: id, adminUserId }, "Failed to delete Easy Inject preset");
    res.status(500).json({ error: "Failed to delete Easy Inject preset" });
  }
});

router.get(
  "/admin/easy-inject-presets/:id/revisions",
  requireAdmin,
  async (req, res) => {
    const id = parsePositiveId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid preset id" });
      return;
    }

    try {
      const [preset] = await db
        .select({ id: easyInjectPresetsTable.id })
        .from(easyInjectPresetsTable)
        .where(eq(easyInjectPresetsTable.id, id))
        .limit(1);

      if (!preset) {
        res.status(404).json({ error: "Easy Inject preset not found" });
        return;
      }

      const revisions = await db
        .select()
        .from(easyInjectPresetRevisionsTable)
        .where(eq(easyInjectPresetRevisionsTable.presetId, id))
        .orderBy(
          desc(easyInjectPresetRevisionsTable.version),
          desc(easyInjectPresetRevisionsTable.id),
        );

      res.json(
        revisions.map((revision) => ({
          id: revision.id,
          presetId: revision.presetId,
          version: revision.version,
          snapshot: revision.snapshot,
          action: revision.action,
          adminUserId: revision.adminUserId,
          createdAt: revision.createdAt.toISOString(),
        })),
      );
    } catch (error) {
      logger.error({ err: error, presetId: id }, "Failed to list Easy Inject preset revisions");
      res.status(500).json({ error: "Failed to fetch Easy Inject preset revisions" });
    }
  },
);

router.post(
  "/admin/easy-inject-presets/:id/revisions/:revisionId/restore",
  requireAdmin,
  async (req, res) => {
    const id = parsePositiveId(req.params.id);
    const revisionId = parsePositiveId(req.params.revisionId);
    if (id === null || revisionId === null) {
      res.status(400).json({ error: "Invalid preset or revision id" });
      return;
    }

    const { adminUserId, ipAddress } = getAdminContext(req);

    try {
      const result = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(easyInjectPresetsTable)
          .where(eq(easyInjectPresetsTable.id, id))
          .for("update")
          .limit(1);

        if (!current) {
          return { kind: "preset_not_found" as const };
        }

        const [revision] = await tx
          .select()
          .from(easyInjectPresetRevisionsTable)
          .where(
            and(
              eq(easyInjectPresetRevisionsTable.id, revisionId),
              eq(easyInjectPresetRevisionsTable.presetId, id),
            ),
          )
          .limit(1);

        if (!revision) {
          return { kind: "revision_not_found" as const };
        }

        const restoredConfiguration = snapshotConfiguration(revision.snapshot);
        const validated = easyInjectPresetConfigurationSchema.safeParse({
          ...restoredConfiguration,
          slug: current.slug,
        });
        if (!validated.success) {
          return { kind: "invalid_revision" as const };
        }

        const nextValues: MutablePresetValues = {
          name: validated.data.name,
          description: validated.data.description,
          accountLabel: validated.data.accountLabel,
          requiredAccountKind: validated.data.requiredAccountKind,
          sshPort: validated.data.sshPort,
          mode: validated.data.mode,
          proxyHost: validated.data.proxyHost,
          proxyPort: validated.data.proxyPort,
          payload: validated.data.payload,
          sniPolicy: validated.data.sniPolicy,
          customSni: validated.data.customSni,
          usePayload: validated.data.usePayload,
          ssl: validated.data.ssl,
          supportsDarkTunnel: validated.data.supportsDarkTunnel,
          supportsHttpCustom: validated.data.supportsHttpCustom,
          isActive: validated.data.isActive,
          sortOrder: validated.data.sortOrder,
        };
        const fields = changedFields(selectMutableValues(current), nextValues);

        const [updated] = await tx
          .update(easyInjectPresetsTable)
          .set({
            ...nextValues,
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(easyInjectPresetsTable.id, id))
          .returning();

        if (!updated) {
          throw new Error("Easy Inject preset disappeared during restore");
        }

        const before = toSnapshot(current);
        const after = toSnapshot(updated);

        await tx.insert(easyInjectPresetRevisionsTable).values({
          presetId: updated.id,
          version: updated.version,
          snapshot: after,
          action: "restore",
          adminUserId,
        });

        await tx.insert(adminAuditLogsTable).values({
          adminUserId,
          action: "restore_easy_inject_preset",
          targetType: "easy_inject_preset",
          targetId: updated.id,
          details: {
            before,
            after,
            changedFields: fields,
            sourceRevisionId: revision.id,
            sourceVersion: revision.version,
          },
          ipAddress,
        });

        return { kind: "restored" as const, preset: updated };
      });

      if (result.kind === "preset_not_found") {
        res.status(404).json({ error: "Easy Inject preset not found" });
        return;
      }
      if (result.kind === "revision_not_found") {
        res.status(404).json({ error: "Easy Inject preset revision not found" });
        return;
      }
      if (result.kind === "invalid_revision") {
        res.status(409).json({ error: "Stored revision is not valid under current preset rules" });
        return;
      }

      res.json(toAdminPresetDto(result.preset));
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: "Unable to allocate a new preset revision" });
        return;
      }

      logger.error(
        { err: error, presetId: id, revisionId, adminUserId },
        "Failed to restore Easy Inject preset revision",
      );
      res.status(500).json({ error: "Failed to restore Easy Inject preset revision" });
    }
  },
);

export default router;

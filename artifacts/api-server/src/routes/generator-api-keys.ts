/**
 * Admin routes for managing Generator API keys
 * 
 * Endpoints:
 * - GET /api/admin/generator-api-keys - List all keys
 * - POST /api/admin/generator-api-keys - Create new key
 * - GET /api/admin/generator-api-keys/:id - Get key details
 * - PATCH /api/admin/generator-api-keys/:id - Update key
 * - DELETE /api/admin/generator-api-keys/:id - Delete key
 * - POST /api/admin/generator-api-keys/:id/regenerate - Regenerate key secret
 */

import { Router } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  adminAuditLogsTable,
  createGeneratorApiKeySchema,
  db,
  generatorApiKeysTable,
  updateGeneratorApiKeySchema,
  type GeneratorApiKey,
  type GeneratorApiScope,
} from "@workspace/db";
import { requireAdmin, type AuthenticatedRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import { getClientIp } from "../lib/request-ip";
import crypto from "crypto";

const router = Router();

// ============================================================================
// Constants
// ============================================================================

const KEY_ID_LENGTH = 8;
const SECRET_LENGTH = 32;
const KEY_PREFIX = "btg";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random hex string of specified length
 */
function generateHexRandom(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

/**
 * Generate a new API key with format btg_<keyId>_<secret>
 */
function generateRawKey(): { keyId: string; secret: string; rawKey: string } {
  const keyId = generateHexRandom(KEY_ID_LENGTH);
  const secret = generateHexRandom(SECRET_LENGTH);
  const rawKey = `${KEY_PREFIX}_${keyId}_${secret}`;
  return { keyId, secret, rawKey };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const c = error as { code?: unknown; cause?: unknown };
  if (c.code === "23505") return true;
  if (c.cause) return isUniqueViolation(c.cause);
  return false;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return mismatch === 0;
  }
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function verifyKey(rawKey: string, hash: string): boolean {
  const computed = hashKey(rawKey);
  return timingSafeHexEqual(computed, hash);
}

/**
 * Parse and validate raw key format
 */
function parseRawKey(rawKey: string): { keyId: string; secret: string } | null {
  const parts = rawKey.split("_");
  if (parts.length !== 3) return null;
  if (parts[0] !== KEY_PREFIX) return null;
  if (!/^[a-f0-9]{8}$/.test(parts[1])) return null;
  if (!/^[a-f0-9]{32}$/.test(parts[2])) return null;
  return { keyId: parts[1], secret: parts[2] };
}

/**
 * Get current date in YYYY-MM-DD format (UTC)
 */
function getCurrentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Convert database key to safe DTO (without hash)
 */
function toKeyDto(key: GeneratorApiKey) {
  return {
    id: key.id,
    keyId: key.keyId,
    label: key.label,
    scopes: key.scopes as GeneratorApiScope[],
    enabled: key.enabled,
    expiresAt: key.expiresAt?.toISOString() ?? null,
    dailyLimit: key.dailyLimit,
    dailyUsageDate: key.dailyUsageDate,
    dailyUsage: key.dailyUsage,
    usageCount: key.usageCount,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    lastIp: key.lastIp,
    createdBy: key.createdBy,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  };
}

/**
 * Get admin context from request
 */
function getAdminContext(req: AuthenticatedRequest) {
  return {
    adminUserId: req.user!.userId,
    ipAddress: getClientIp(req),
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * List all API keys
 */
router.get("/admin/generator-api-keys", requireAdmin, async (req, res) => {
  try {
    const keys = await db
      .select()
      .from(generatorApiKeysTable)
      .orderBy(desc(generatorApiKeysTable.createdAt));

    res.json(keys.map(toKeyDto));
  } catch (error) {
    logger.error({ err: error }, "Failed to list Generator API keys");
    res.status(500).json({ error: "Failed to fetch Generator API keys" });
  }
});

/**
 * Create a new API key
 */
router.post("/admin/generator-api-keys", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const parsed = createGeneratorApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      issues: parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const { label, scopes, expiresAt, dailyLimit } = parsed.data;

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    res.status(400).json({ error: "Expiration date must be in the future" });
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  const { keyId, rawKey } = generateRawKey();
  const keyHash = hashKey(rawKey);

  try {
    const [created] = await db.transaction(async (tx) => {
      const [key] = await tx
        .insert(generatorApiKeysTable)
        .values({
          keyId,
          keyHash,
          label: label.trim(),
          scopes: scopes as string[],
          expiresAt: expiresAt ?? null,
          dailyLimit: dailyLimit ?? null,
          createdBy: adminUserId,
        })
        .returning();

      if (!key) {
        throw new Error("Generator API key insert returned no row");
      }

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action: "create_generator_api_key",
        targetType: "generator_api_key",
        targetId: key.id,
        details: {
          keyId: key.keyId,
          label: key.label,
          scopes: key.scopes,
          expiresAt: key.expiresAt?.toISOString() ?? null,
          dailyLimit: key.dailyLimit,
        },
        ipAddress,
      });

      return [key];
    });

    // Return key with raw key (only shown once!)
    res.status(201).json({
      ...toKeyDto(created),
      // WARNING: Raw key is only shown once!
      rawKey,
      warning: "Store the raw key securely. It will not be shown again.",
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Key ID collision, please try again" });
      return;
    }

    logger.error({ err: error, adminUserId }, "Failed to create Generator API key");
    res.status(500).json({ error: "Failed to create Generator API key" });
  }
});

router.get("/admin/generator-api-keys/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key id" });
    return;
  }

  try {
    const [key] = await db
      .select()
      .from(generatorApiKeysTable)
      .where(eq(generatorApiKeysTable.id, id))
      .limit(1);

    if (!key) {
      res.status(404).json({ error: "Generator API key not found" });
      return;
    }

    res.json(toKeyDto(key));
  } catch (error) {
    logger.error({ err: error, keyId: id }, "Failed to fetch Generator API key");
    res.status(500).json({ error: "Failed to fetch Generator API key" });
  }
});

/**
 * Update an API key
 */
router.patch("/admin/generator-api-keys/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key id" });
    return;
  }

  const parsed = updateGeneratorApiKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid input",
      issues: parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (parsed.data.expiresAt && parsed.data.expiresAt.getTime() <= Date.now()) {
    res.status(400).json({ error: "Expiration date must be in the future" });
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(generatorApiKeysTable)
        .where(eq(generatorApiKeysTable.id, id))
        .for("update")
        .limit(1);

      if (!current) {
        return { kind: "not_found" as const };
      }

      const updates: Partial<GeneratorApiKey> = {
        ...parsed.data,
        updatedAt: new Date(),
      };

      if (parsed.data.label) {
        updates.label = parsed.data.label.trim();
      }

      if (parsed.data.scopes) {
        updates.scopes = parsed.data.scopes as string[];
      }

      const [updated] = await tx
        .update(generatorApiKeysTable)
        .set(updates)
        .where(eq(generatorApiKeysTable.id, id))
        .returning();

      if (!updated) {
        throw new Error("Generator API key disappeared during update");
      }

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action: "update_generator_api_key",
        targetType: "generator_api_key",
        targetId: updated.id,
        details: {
          before: toKeyDto(current),
          after: toKeyDto(updated),
          changedFields: Object.keys(parsed.data),
        },
        ipAddress,
      });

      return { kind: "updated" as const, key: updated };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Generator API key not found" });
      return;
    }

    res.json(toKeyDto(result.key));
  } catch (error) {
    logger.error({ err: error, keyId: id, adminUserId }, "Failed to update Generator API key");
    res.status(500).json({ error: "Failed to update Generator API key" });
  }
});

/**
 * Delete an API key
 */
router.delete("/admin/generator-api-keys/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid key id" });
    return;
  }

  const { adminUserId, ipAddress } = getAdminContext(req);

  try {
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(generatorApiKeysTable)
        .where(eq(generatorApiKeysTable.id, id))
        .for("update")
        .limit(1);

      if (!current) {
        return { kind: "not_found" as const };
      }

      await tx.insert(adminAuditLogsTable).values({
        adminUserId,
        action: "delete_generator_api_key",
        targetType: "generator_api_key",
        targetId: current.id,
        details: {
          before: toKeyDto(current),
        },
        ipAddress,
      });

      await tx.delete(generatorApiKeysTable).where(eq(generatorApiKeysTable.id, id));

      return { kind: "deleted" as const, key: current };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "Generator API key not found" });
      return;
    }

    res.json({ success: true, id: result.key.id });
  } catch (error) {
    logger.error({ err: error, keyId: id, adminUserId }, "Failed to delete Generator API key");
    res.status(500).json({ error: "Failed to delete Generator API key" });
  }
});

/**
 * Regenerate the secret part of an API key
 * This invalidates the old key and returns a new one
 */
router.post(
  "/admin/generator-api-keys/:id/regenerate",
  requireAdmin,
  async (req: AuthenticatedRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid key id" });
      return;
    }

    const { adminUserId, ipAddress } = getAdminContext(req);

    try {
      const result = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(generatorApiKeysTable)
          .where(eq(generatorApiKeysTable.id, id))
          .for("update")
          .limit(1);

        if (!current) {
          return { kind: "not_found" as const };
        }

        // Generate new key with same keyId but new secret
        const secret = generateHexRandom(SECRET_LENGTH);
        const rawKey = `${KEY_PREFIX}_${current.keyId}_${secret}`;
        const keyHash = hashKey(rawKey);

        const [updated] = await tx
          .update(generatorApiKeysTable)
          .set({
            keyHash,
            updatedAt: new Date(),
            // Reset usage stats since this is essentially a new key
            usageCount: 0,
            dailyUsage: 0,
            dailyUsageDate: null,
            lastUsedAt: null,
            lastIp: null,
          })
          .where(eq(generatorApiKeysTable.id, id))
          .returning();

        if (!updated) {
          throw new Error("Generator API key disappeared during regenerate");
        }

        await tx.insert(adminAuditLogsTable).values({
          adminUserId,
          action: "regenerate_generator_api_key",
          targetType: "generator_api_key",
          targetId: updated.id,
          details: {
            keyId: updated.keyId,
          },
          ipAddress,
        });

        return { kind: "regenerated" as const, key: updated, rawKey };
      });

      if (result.kind === "not_found") {
        res.status(404).json({ error: "Generator API key not found" });
        return;
      }

      // Return key with new raw key (only shown once!)
      res.json({
        ...toKeyDto(result.key),
        rawKey: result.rawKey,
        warning: "Store the new raw key securely. The old key is now invalid.",
      });
    } catch (error) {
      logger.error({ err: error, keyId: id, adminUserId }, "Failed to regenerate Generator API key");
      res.status(500).json({ error: "Failed to regenerate Generator API key" });
    }
  }
);

// ============================================================================
// Exports
// ============================================================================

export default router;

// Export helper functions for use in other modules
export { parseRawKey, verifyKey, hashKey, generateRawKey, getCurrentDate };

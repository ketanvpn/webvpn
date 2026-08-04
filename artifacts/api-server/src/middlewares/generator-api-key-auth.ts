import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, generatorApiKeysTable, type GeneratorApiScope } from "@workspace/db";
import { logger } from "../lib/logger";
import { getClientIp } from "../lib/request-ip";
import crypto from "crypto";

const KEY_PREFIX = "btg";

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
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

function parseRawKey(rawKey: string): { keyId: string; secret: string } | null {
  const parts = rawKey.split("_");
  if (parts.length !== 3) return null;
  if (parts[0] !== KEY_PREFIX) return null;
  if (!/^[a-f0-9]{8}$/.test(parts[1])) return null;
  if (!/^[a-f0-9]{32}$/.test(parts[2])) return null;
  return { keyId: parts[1], secret: parts[2] };
}

function getCurrentDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export type GeneratorApiKeyRequest = Request & {
  generatorApiKey?: {
    id: number;
    keyId: string;
    label: string;
    scopes: GeneratorApiScope[];
    dailyLimit: number | null;
    dailyUsage: number;
  };
};

export function requireGeneratorApiKey(requiredScopes?: GeneratorApiScope[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = String(req.header("authorization") || "").trim();
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!bearer) {
      res.status(401).json({ error: "Missing Authorization Bearer token (btg_<id>_<secret>)" });
      return;
    }

    const parsed = parseRawKey(bearer);
    if (!parsed) {
      res.status(401).json({ error: "Invalid API key format" });
      return;
    }

    try {
      const [stored] = await db
        .select()
        .from(generatorApiKeysTable)
        .where(eq(generatorApiKeysTable.keyId, parsed.keyId))
        .limit(1);

      if (!stored) {
        res.status(401).json({ error: "API key not found" });
        return;
      }

      const computedHash = hashKey(bearer);
      if (!timingSafeHexEqual(computedHash, stored.keyHash)) {
        logger.warn({ keyId: parsed.keyId, ip: getClientIp(req) }, "Invalid generator API key hash");
        res.status(401).json({ error: "Invalid API key" });
        return;
      }

      if (!stored.enabled) {
        res.status(401).json({ error: "API key disabled" });
        return;
      }

      if (stored.expiresAt && stored.expiresAt.getTime() <= Date.now()) {
        res.status(401).json({ error: "API key expired" });
        return;
      }

      const today = getCurrentDateString();
      let currentDailyUsage = stored.dailyUsage;
      if (stored.dailyUsageDate !== today) {
        currentDailyUsage = 0;
      }

      if (stored.dailyLimit !== null && currentDailyUsage >= stored.dailyLimit) {
        res.status(429).json({ error: "Daily quota exceeded", dailyLimit: stored.dailyLimit, dailyUsage: currentDailyUsage });
        return;
      }

      if (requiredScopes && requiredScopes.length > 0) {
        const hasScope = requiredScopes.some((s) => (stored.scopes as string[]).includes(s));
        if (!hasScope) {
          res.status(403).json({ error: "Insufficient scope", required: requiredScopes, granted: stored.scopes });
          return;
        }
      }

      const clientIp = getClientIp(req);

      await db
        .update(generatorApiKeysTable)
        .set({
          dailyUsage: currentDailyUsage + 1,
          dailyUsageDate: today,
          usageCount: stored.usageCount + 1,
          lastUsedAt: new Date(),
          lastIp: clientIp,
          updatedAt: new Date(),
        })
        .where(eq(generatorApiKeysTable.id, stored.id));

      (req as GeneratorApiKeyRequest).generatorApiKey = {
        id: stored.id,
        keyId: stored.keyId,
        label: stored.label,
        scopes: stored.scopes as GeneratorApiScope[],
        dailyLimit: stored.dailyLimit,
        dailyUsage: currentDailyUsage + 1,
      };

      next();
    } catch (error) {
      logger.error({ err: error, keyId: parsed.keyId }, "Failed to verify generator API key");
      res.status(500).json({ error: "Failed to verify API key" });
    }
  };
}

export const requireGeneratorApiKeyGenerate = requireGeneratorApiKey(["generate"]);
export const requireGeneratorApiKeyAny = requireGeneratorApiKey();

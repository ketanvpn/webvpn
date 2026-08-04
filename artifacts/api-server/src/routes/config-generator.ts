/**
 * Config Generator Routes
 * 
 * Endpoints for generating HTTP Custom (.hc) and Dark Tunnel (.dark) config files
 * by calling the external Generator API.
 * 
 * These routes are for authenticated users to generate configs from their SSH accounts
 * and easy inject presets.
 */

import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  easyInjectPresetsTable,
  vpnAccountsTable,
  serversTable,
} from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";
import { logger } from "../lib/logger";
import {
  GeneratorApiClient,
  GeneratorApiError,
  generateHcFromSshAccount,
  generateDarkFromSshAccount,
} from "../lib/generator-api-client";

const router = Router();

type HcGenerateRequestBody = {
  presetId: number;
  accountId: number;
  name?: string;
  noteHtml?: string;
};

type DarkGenerateRequestBody = {
  presetId: number;
  accountId: number;
  name?: string;
  noteHtml?: string;
};

const EMPTY_VALUES_BACKEND = new Set([
  "",
  "no",
  "none",
  "null",
  "undefined",
  "-",
  "false",
  "0",
  "off",
]);

function usableStringBackend(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  return EMPTY_VALUES_BACKEND.has(normalized.toLowerCase()) ? null : normalized;
}

function firstUsableBackend(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    const u = usableStringBackend(v);
    if (u) return u;
  }
  return null;
}

function extractHostFromValue(value: string | null | undefined): string | null {
  const usable = usableStringBackend(value);
  if (!usable) return null;
  let candidate = usable;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      return new URL(candidate).hostname || null;
    } catch {
      return null;
    }
  }
  candidate = candidate.split("@")[0]?.trim() ?? "";
  if (candidate.startsWith("[")) {
    const closing = candidate.indexOf("]");
    return closing > 1 ? candidate.slice(1, closing) : null;
  }
  return usableStringBackend(candidate.split(":")[0]);
}

function sanitizeFilename(input: string): string {
  const base = String(input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "config";
}

function resolveSniBackend(
  preset: { sniPolicy: string; customSni: string | null },
  host: string,
): string | undefined {
  if (preset.sniPolicy === "none") return undefined;
  if (preset.sniPolicy === "account_host") return host;
  const custom = usableStringBackend(preset.customSni);
  if (!custom) return undefined;
  return custom.replaceAll("[host]", host);
}

function getAccountHostBackend(
  account: { allLinks?: Record<string, string | null> | null; configLink?: string | null; server?: { originalHost?: string | null } | null },
  server: { host: string; originalHost?: string | null },
): string | null {
  const links = (account.allLinks ?? {}) as Record<string, string | null>;
  return firstUsableBackend(
    links.domain,
    links.host,
    links.server,
    links.sni,
    links.servername,
    links.hostname,
    extractHostFromValue(account.configLink ?? null),
    extractHostFromValue(links.tls ?? null),
    extractHostFromValue(links.ws ?? null),
    extractHostFromValue(links.udp ?? null),
    (account.server as { originalHost?: string | null })?.originalHost ?? null,
    server.originalHost ?? null,
    server.host,
  );
}

function getSystemGeneratorClient(): GeneratorApiClient | null {
  const baseUrl = process.env.GENERATOR_API_BASE_URL;
  const apiKey = process.env.GENERATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return new GeneratorApiClient({ baseUrl, apiKey });
}

function isAccountExpired(account: { expiresAt: string | Date | null | undefined }): boolean {
  if (!account.expiresAt) return false;
  const exp = new Date(account.expiresAt as string | Date);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() <= Date.now();
}

/**
 * POST /api/config/hc/generate
 * Generate HTTP Custom (.hc) config file from SSH account and preset
 */
router.post(
  "/config/hc/generate",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const body = req.body as HcGenerateRequestBody;
    const userId = req.user!.userId;

    if (!body.presetId || !body.accountId) {
      res.status(400).json({ error: "presetId and accountId are required" });
      return;
    }

    const client = getSystemGeneratorClient();
    if (!client) {
      res.status(503).json({
        error: "Generator API not configured",
        message: "The server administrator has not configured the Generator API.",
      });
      return;
    }

    try {
      // Fetch the SSH account with server data
      const [accountWithServer] = await db
        .select({
          account: vpnAccountsTable,
          server: serversTable,
        })
        .from(vpnAccountsTable)
        .innerJoin(serversTable, eq(vpnAccountsTable.serverId, serversTable.id))
        .where(
          and(
            eq(vpnAccountsTable.id, body.accountId),
            eq(vpnAccountsTable.userId, userId)
          )
        )
        .limit(1);

      if (!accountWithServer) {
        res.status(404).json({ error: "Account not found" });
        return;
      }

      const { account, server } = accountWithServer;

      if (account.protocol.toLowerCase() !== "ssh") {
        res.status(400).json({ error: "Only SSH accounts are supported" });
        return;
      }

      if (!account.isActive) {
        res.status(400).json({ error: "Account is not active" });
        return;
      }

      if (isAccountExpired(account as { expiresAt: string | Date })) {
        res.status(400).json({ error: "Account has expired" });
        return;
      }

      if ((server as { isActive?: boolean }).isActive === false) {
        res.status(400).json({ error: "Server is not active" });
        return;
      }

      // Fetch the preset
      const [preset] = await db
        .select()
        .from(easyInjectPresetsTable)
        .where(eq(easyInjectPresetsTable.id, body.presetId))
        .limit(1);

      if (!preset) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }

      if (!preset.supportsHttpCustom) {
        res.status(400).json({ error: "Preset does not support HTTP Custom" });
        return;
      }

      // Get template from environment
      const templateBase64 = process.env.GENERATOR_API_HC_TEMPLATE;
      if (!templateBase64 || !templateBase64.trim()) {
        res.status(503).json({
          error: "HC template not configured",
          message: "The server administrator has not configured the HC template.",
        });
        return;
      }

      const host = getAccountHostBackend(
        account as { allLinks?: Record<string, string | null> | null; configLink?: string | null; server?: { originalHost?: string | null } | null },
        server as { host: string; originalHost?: string | null },
      );

      const username = usableStringBackend(account.username ?? null);
      const password = usableStringBackend(account.password ?? null);

      if (!host || !username || !password) {
        res.status(400).json({ error: "Account data is incomplete (host/username/password)" });
        return;
      }

      const sni = resolveSniBackend(
        { sniPolicy: preset.sniPolicy, customSni: preset.customSni },
        host,
      );

      const result = await generateHcFromSshAccount({
        client,
        templateBase64: templateBase64.trim(),
        host,
        port: preset.sshPort,
        username,
        password,
        name: body.name || `${preset.name} - ${username}`,
        payload: preset.usePayload ? preset.payload : undefined,
        proxyHost: preset.proxyHost,
        proxyPort: preset.proxyPort,
        sni,
        noteHtml: body.noteHtml,
      });

      res.json({
        success: true,
        data: {
          format: "hc",
          variant: "locked",
          method: "ssh",
          filename: `${sanitizeFilename(preset.slug)}-${sanitizeFilename(username)}.hc`,
          content: result.content,
          contentBase64: result.contentBase64,
        },
      });
    } catch (error) {
      if (error instanceof GeneratorApiError) {
        logger.error(
          { err: error, userId, presetId: body.presetId, accountId: body.accountId },
          "Generator API error during HC generate"
        );
        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }

      logger.error(
        { err: error, userId, presetId: body.presetId, accountId: body.accountId },
        "Failed to generate HC config"
      );
      res.status(500).json({ error: "Failed to generate HC config" });
    }
  }
);

/**
 * POST /api/config/dark/generate
 * Generate Dark Tunnel (.dark) config file from SSH account and preset
 */
router.post(
  "/config/dark/generate",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const body = req.body as DarkGenerateRequestBody;
    const userId = req.user!.userId;

    if (!body.presetId || !body.accountId) {
      res.status(400).json({ error: "presetId and accountId are required" });
      return;
    }

    const client = getSystemGeneratorClient();
    if (!client) {
      res.status(503).json({
        error: "Generator API not configured",
        message: "The server administrator has not configured the Generator API.",
      });
      return;
    }

    try {
      // Fetch the SSH account with server data
      const [accountWithServer] = await db
        .select({
          account: vpnAccountsTable,
          server: serversTable,
        })
        .from(vpnAccountsTable)
        .innerJoin(serversTable, eq(vpnAccountsTable.serverId, serversTable.id))
        .where(
          and(
            eq(vpnAccountsTable.id, body.accountId),
            eq(vpnAccountsTable.userId, userId)
          )
        )
        .limit(1);

      if (!accountWithServer) {
        res.status(404).json({ error: "Account not found" });
        return;
      }

      const { account, server } = accountWithServer;

      if (account.protocol.toLowerCase() !== "ssh") {
        res.status(400).json({ error: "Only SSH accounts are supported" });
        return;
      }

      if (!account.isActive) {
        res.status(400).json({ error: "Account is not active" });
        return;
      }

      if (isAccountExpired(account as { expiresAt: string | Date })) {
        res.status(400).json({ error: "Account has expired" });
        return;
      }

      if ((server as { isActive?: boolean }).isActive === false) {
        res.status(400).json({ error: "Server is not active" });
        return;
      }

      const [preset] = await db
        .select()
        .from(easyInjectPresetsTable)
        .where(eq(easyInjectPresetsTable.id, body.presetId))
        .limit(1);

      if (!preset) {
        res.status(404).json({ error: "Preset not found" });
        return;
      }

      if (!preset.supportsDarkTunnel) {
        res.status(400).json({ error: "Preset does not support Dark Tunnel" });
        return;
      }

      const rawDarkTemplate = process.env.GENERATOR_API_DARK_TEMPLATE;
      if (!rawDarkTemplate || !rawDarkTemplate.trim()) {
        res.status(503).json({
          error: "Dark Tunnel template not configured",
          message: "The server administrator has not configured the Dark Tunnel template.",
        });
        return;
      }

      const host = getAccountHostBackend(
        account as { allLinks?: Record<string, string | null> | null; configLink?: string | null; server?: { originalHost?: string | null } | null },
        server as { host: string; originalHost?: string | null },
      );

      const username = usableStringBackend(account.username ?? null);
      const password = usableStringBackend(account.password ?? null);

      if (!host || !username || !password) {
        res.status(400).json({ error: "Account data is incomplete (host/username/password)" });
        return;
      }

      const result = await generateDarkFromSshAccount({
        client,
        template: rawDarkTemplate.trim(),
        host,
        port: preset.sshPort,
        username,
        password,
        name: body.name || `${preset.name} - ${username}`,
        noteHtml: body.noteHtml,
      });

      res.json({
        success: true,
        data: {
          format: "dark",
          variant: "locked",
          method: "ssh",
          filename: `${sanitizeFilename(preset.slug)}-${sanitizeFilename(username)}.dark`,
          link: result.content,
          config: result.config,
        },
      });
    } catch (error) {
      if (error instanceof GeneratorApiError) {
        logger.error(
          { err: error, userId, presetId: body.presetId, accountId: body.accountId },
          "Generator API error during Dark generate"
        );
        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }

      logger.error(
        { err: error, userId, presetId: body.presetId, accountId: body.accountId },
        "Failed to generate Dark Tunnel config"
      );
      res.status(500).json({ error: "Failed to generate Dark Tunnel config" });
    }
  }
);

/**
 * GET /api/config/status
 * Check if Generator API is configured and available
 */
router.get("/config/status", requireAuth, async (_req, res) => {
  const client = getSystemGeneratorClient();

  if (!client) {
    res.json({
      configured: false,
      message: "Generator API not configured by administrator",
    });
    return;
  }

  try {
    // Try to call health endpoint
    const health = await client.health();
    res.json({
      configured: true,
      available: true,
      endpoints: health.endpoints,
    });
  } catch (error) {
    res.json({
      configured: true,
      available: false,
      message: error instanceof Error ? error.message : "Generator API unreachable",
    });
  }
});

export default router;

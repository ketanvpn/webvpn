import { Router } from "express";
import { db } from "@workspace/db";
import { serversTable, vpnAccountsTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { logger } from "../../lib/logger";
import { formatFullServer } from "../servers";
import { logAdminAction } from "../admin-audit";
import { getClientIp } from "../../lib/request-ip";
import { checkPanelHealth } from "../../lib/vpn-panel";
import { AdminCreateServerBody, AdminUpdateServerBody } from "@workspace/api-zod";
import { getAdminId } from "./helpers";

const router = Router();

// ─── Admin: Servers ───────────────────────────────────────────────────────────

router.get("/admin/servers", requireAdmin, async (_req, res) => {
  const servers = await db
    .select()
    .from(serversTable)
    .orderBy(asc(serversTable.sortOrder), asc(serversTable.id));

  const result = await Promise.all(
    servers.map(async (s) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(and(eq(vpnAccountsTable.serverId, s.id), eq(vpnAccountsTable.isActive, true)));
      return { ...formatFullServer(s), activeAccounts: count ?? 0 };
    })
  );

  res.json(result);
});

router.post("/admin/servers", requireAdmin, async (req, res) => {
  const parsed = AdminCreateServerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [server] = await db
    .insert(serversTable)
    .values({
      name: data.name,
      location: data.location,
      flag: data.flag,
      host: data.host,
      apiUrl: data.apiUrl ?? null,
      apiToken: data.apiToken ?? null,
      supportedProtocols: data.supportedProtocols,
      isActive: data.isActive ?? true,
      maxAccounts: data.maxAccounts ?? 500,
    })
    .returning();

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "create_server",
    targetType: "server",
    targetId: server.id,
    details: { name: server.name, location: server.location, isActive: server.isActive },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "create_server" }, "Failed to log admin action"));

  res.status(201).json(formatFullServer(server));
});

router.patch("/admin/servers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const parsed = AdminUpdateServerBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.flag !== undefined) updateData.flag = data.flag;
  if (data.host !== undefined) updateData.host = data.host;
  if (data.apiUrl !== undefined) updateData.apiUrl = data.apiUrl;
  if (data.apiToken !== undefined) updateData.apiToken = data.apiToken;
  if (data.supportedProtocols !== undefined) updateData.supportedProtocols = data.supportedProtocols;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.maxAccounts !== undefined) updateData.maxAccounts = data.maxAccounts;

  const [server] = await db
    .update(serversTable)
    .set(updateData)
    .where(eq(serversTable.id, id))
    .returning();

  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "update_server",
    targetType: "server",
    targetId: server.id,
    details: { changes: data },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "update_server" }, "Failed to log admin action"));

  res.json(formatFullServer(server));
});

router.delete("/admin/servers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const [server] = await db.select({ name: serversTable.name, location: serversTable.location }).from(serversTable).where(eq(serversTable.id, id)).limit(1);

  await db.update(serversTable).set({ isActive: false }).where(eq(serversTable.id, id));

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "delete_server",
    targetType: "server",
    targetId: id,
    details: { name: server?.name, location: server?.location },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "delete_server" }, "Failed to log admin action"));

  res.json({ message: "Server deleted" });
});

router.get("/admin/servers/health", requireAdmin, async (_req, res) => {
  const servers = await db.select().from(serversTable).orderBy(asc(serversTable.sortOrder), asc(serversTable.id));

  const result = await Promise.all(
    servers.map(async (s) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(and(eq(vpnAccountsTable.serverId, s.id), eq(vpnAccountsTable.isActive, true)));

      let health = null;
      if (s.apiUrl && s.apiToken) {
        try {
          health = await checkPanelHealth({ apiUrl: s.apiUrl, apiToken: s.apiToken });
        } catch {
          health = { online: false, latencyMs: null };
        }
      }

      return {
        id: s.id,
        name: s.name,
        flag: s.flag ?? "🌐",
        host: s.host,
        location: s.location,
        isActive: s.isActive,
        activeAccounts: count ?? 0,
        maxAccounts: s.maxAccounts ?? 500,
        health,
      };
    })
  );

  res.json(result);
});

router.get("/admin/servers/:id/health", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, id))
    .limit(1);

  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  if (!server.apiUrl || !server.apiToken) {
    res.json({ online: false, error: "Server tidak punya API URL atau token" });
    return;
  }

  const result = await checkPanelHealth({ apiUrl: server.apiUrl, apiToken: server.apiToken });
  res.json(result);
});

export default router;

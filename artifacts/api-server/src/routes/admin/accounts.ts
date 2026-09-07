import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import {
  usersTable,
  serversTable,
  vpnAccountsTable,
  dynamicVpnOrdersTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { logger } from "../../lib/logger";
import { renewPanelAccount, deletePanelAccount, checkPanelHealth, syncPanelAccount, lockPanelAccount, unlockPanelAccount } from "../../lib/vpn-panel";
import { logAdminAction } from "../admin-audit";
import { getClientIp } from "../../lib/request-ip";
import { getAdminId } from "./helpers";

const router = Router();

// ─── Admin: VPN Accounts ─────────────────────────────────────────────────────

router.get("/admin/accounts", requireAdmin, asyncHandler(async (req, res) => {
  const { userId, protocol, isActive, search } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (userId) conditions.push(eq(vpnAccountsTable.userId, parseInt(userId, 10)));
  if (protocol) conditions.push(eq(vpnAccountsTable.protocol, protocol));
  if (isActive !== undefined) conditions.push(eq(vpnAccountsTable.isActive, isActive === "true"));
  if (search) {
    conditions.push(
      or(
        ilike(vpnAccountsTable.username, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
        ilike(usersTable.email, `%${search}%`)
      )!
    );
  }

  const accounts = await db
    .select({
      id: vpnAccountsTable.id,
      userId: vpnAccountsTable.userId,
      orderId: vpnAccountsTable.orderId,
      protocol: vpnAccountsTable.protocol,
      username: vpnAccountsTable.username,
      password: vpnAccountsTable.password,
      uuid: vpnAccountsTable.uuid,
      serverId: vpnAccountsTable.serverId,
      configLink: vpnAccountsTable.configLink,
      expiresAt: vpnAccountsTable.expiresAt,
      quota: vpnAccountsTable.quota,
      usedQuota: vpnAccountsTable.usedQuota,
      isActive: vpnAccountsTable.isActive,
      createdAt: vpnAccountsTable.createdAt,
      updatedAt: vpnAccountsTable.updatedAt,
      userUsername: usersTable.username,
      userEmail: usersTable.email,
      serverName: serversTable.name,
      serverLocation: serversTable.location,
      serverFlag: serversTable.flag,
      serverIsActive: serversTable.isActive,
    })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .leftJoin(serversTable, eq(vpnAccountsTable.serverId, serversTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vpnAccountsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const formatted = accounts.map((a) => ({
    id: a.id,
    userId: a.userId,
    orderId: a.orderId,
    protocol: a.protocol,
    username: a.username,
    password: a.password,
    uuid: a.uuid,
    serverId: a.serverId,
    server: {
      id: a.serverId,
      name: a.serverName ?? "",
      location: a.serverLocation ?? "",
      flag: a.serverFlag ?? "🌐",
      isActive: a.serverIsActive ?? false,
    },
    configLink: a.configLink,
    expiresAt: a.expiresAt,
    quota: a.quota != null ? Number(a.quota) : null,
    usedQuota: a.usedQuota != null ? Number(a.usedQuota) : null,
    isActive: a.isActive,
    createdAt: a.createdAt,
    user: a.userUsername
      ? { id: a.userId, username: a.userUsername, email: a.userEmail ?? "" }
      : null,
  }));

  res.json({ accounts: formatted, total: total?.count ?? 0 });
}));

router.post("/admin/accounts/:id/extend", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const days = parseInt(String(req.body?.days ?? "30"), 10);

  if (isNaN(days) || days < 1 || days > 365) {
    res.status(400).json({ error: "Jumlah hari tidak valid (1–365)" });
    return;
  }

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const base = account.expiresAt && new Date(account.expiresAt) > new Date()
    ? new Date(account.expiresAt)
    : new Date();

  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  // Notify VPS panel to extend account on the actual server (fail-closed)
  const [server] = await db
    .select({ apiUrl: serversTable.apiUrl, apiToken: serversTable.apiToken, isActive: serversTable.isActive })
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (!server) {
    res.status(404).json({ error: "Server akun tidak ditemukan" });
    return;
  }

  if (!server.isActive) {
    res.status(400).json({ error: "Server sedang maintenance/offline. Extend dibatalkan agar data tetap sinkron." });
    return;
  }

  if (!server.apiUrl || !server.apiToken) {
    res.status(400).json({ error: "Server tidak memiliki konfigurasi API panel yang valid" });
    return;
  }

  try {
    await renewPanelAccount({
      apiUrl: server.apiUrl,
      apiToken: server.apiToken,
      protocol: account.protocol,
      username: account.username,
      durationDays: days,
      quota: account.quota ? Number(account.quota) : null,
    });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Gagal extend akun di panel VPS" });
    return;
  }

  const [updated] = await db
    .update(vpnAccountsTable)
    .set({ expiresAt: newExpiry, isActive: true, updatedAt: new Date() })
    .where(eq(vpnAccountsTable.id, id))
    .returning();

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "extend_account",
    targetType: "account",
    targetId: id,
    details: { days, username: account.username, newExpiry: newExpiry.toISOString() },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "extend_account" }, "Failed to log admin action"));

  res.json({ id: updated.id, expiresAt: updated.expiresAt, isActive: updated.isActive });
}));

router.delete("/admin/accounts/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // Remove account from VPS panel server first (fail-closed when panel configured)
  const [server] = await db
    .select({ apiUrl: serversTable.apiUrl, apiToken: serversTable.apiToken })
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (server?.apiUrl && server?.apiToken) {
    try {
      await deletePanelAccount({
        apiUrl: server.apiUrl,
        apiToken: server.apiToken,
        protocol: account.protocol,
        username: account.username,
        bestEffort: false,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Gagal menghapus akun dari panel VPS" });
      return;
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(dynamicVpnOrdersTable)
        .set({ vpnAccountId: null })
        .where(eq(dynamicVpnOrdersTable.vpnAccountId, id));

      await tx.delete(vpnAccountsTable).where(eq(vpnAccountsTable.id, id));
    });
  } catch (err) {
    logger.error({
      err,
      accountId: id,
      username: account.username,
    }, "CRITICAL: panel account was deleted but local DB cleanup failed");
    res.status(500).json({ error: "Akun berhasil dihapus dari panel, tetapi gagal membersihkan data lokal. Hubungi developer untuk repair data." });
    return;
  }

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "delete_account",
    targetType: "account",
    targetId: id,
    details: { username: account.username, protocol: account.protocol },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "delete_account" }, "Failed to log admin action"));

  res.json({ success: true });
}));

router.post("/admin/accounts/bulk-delete", requireAdmin, asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids diperlukan" });
    return;
  }
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    res.status(400).json({ error: "ids tidak valid" });
    return;
  }

  const accounts = await db
    .select()
    .from(vpnAccountsTable)
    .where(inArray(vpnAccountsTable.id, numIds));

  const deletableIds: number[] = [];
  const failed: Array<{ id: number; username: string; reason: string }> = [];

  const serverIds = [...new Set(accounts.map((a) => a.serverId))];
  const serverRows = serverIds.length > 0
    ? await db
        .select({ id: serversTable.id, apiUrl: serversTable.apiUrl, apiToken: serversTable.apiToken })
        .from(serversTable)
        .where(inArray(serversTable.id, serverIds))
    : [];
  const serverById = new Map(serverRows.map((s) => [s.id, s]));

  for (const account of accounts) {
    const server = serverById.get(account.serverId);

    if (server?.apiUrl && server?.apiToken) {
      try {
        await deletePanelAccount({
          apiUrl: server.apiUrl,
          apiToken: server.apiToken,
          protocol: account.protocol,
          username: account.username,
          bestEffort: false,
        });
      } catch (err) {
        failed.push({
          id: account.id,
          username: account.username,
          reason: err instanceof Error ? err.message : "Gagal hapus di panel VPS",
        });
        continue;
      }
    }

    deletableIds.push(account.id);
  }

  if (deletableIds.length > 0) {
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(dynamicVpnOrdersTable)
          .set({ vpnAccountId: null })
          .where(inArray(dynamicVpnOrdersTable.vpnAccountId, deletableIds));

        await tx.delete(vpnAccountsTable).where(inArray(vpnAccountsTable.id, deletableIds));
      });
    } catch (err) {
      logger.error({
        err,
        accountIds: deletableIds,
      }, "CRITICAL: panel accounts were deleted but local DB cleanup failed");
      res.status(500).json({ error: "Sebagian akun berhasil dihapus dari panel, tetapi gagal membersihkan data lokal. Hubungi developer untuk repair data.", failed });
      return;
    }
  }

  // Audit log for bulk
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "bulk_delete_accounts",
    targetType: "account",
    targetId: null,
    details: { requested: numIds, deleted: deletableIds.length, failedCount: failed.length },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "bulk_delete_accounts" }, "Failed to log admin action"));

  res.json({
    requested: numIds.length,
    deleted: deletableIds.length,
    failed,
  });
}));

router.post("/admin/accounts/:id/toggle", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  const nextIsActive = !account.isActive;

  if (server.apiUrl && server.apiToken) {
    try {
      if (nextIsActive) {
        await unlockPanelAccount({
          apiUrl: server.apiUrl,
          apiToken: server.apiToken,
          protocol: account.protocol,
          username: account.username,
        });
      } else {
        await lockPanelAccount({
          apiUrl: server.apiUrl,
          apiToken: server.apiToken,
          protocol: account.protocol,
          username: account.username,
        });
      }
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Gagal sinkron toggle akun ke panel VPS" });
      return;
    }
  }

  const [updated] = await db
    .update(vpnAccountsTable)
    .set({ isActive: nextIsActive, updatedAt: new Date() })
    .where(eq(vpnAccountsTable.id, id))
    .returning();

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: nextIsActive ? "unlock_account" : "lock_account",
    targetType: "account",
    targetId: id,
    details: { username: account.username, protocol: account.protocol },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: nextIsActive ? "unlock_account" : "lock_account" }, "Failed to log admin action"));

  res.json({
    id: updated.id,
    userId: updated.userId,
    orderId: updated.orderId,
    protocol: updated.protocol,
    username: updated.username,
    password: updated.password,
    uuid: updated.uuid,
    serverId: updated.serverId,
    server: server
      ? { id: server.id, name: server.name, location: server.location, flag: server.flag, isActive: server.isActive }
      : null,
    configLink: updated.configLink,
    expiresAt: updated.expiresAt,
    quota: updated.quota != null ? Number(updated.quota) : null,
    usedQuota: updated.usedQuota != null ? Number(updated.usedQuota) : null,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
  });
}));

router.post("/admin/accounts/:id/sync", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (!server?.apiUrl || !server?.apiToken) {
    res.status(400).json({ error: "Server tidak punya API URL atau token" });
    return;
  }

  const info = await syncPanelAccount({
    apiUrl: server.apiUrl,
    apiToken: server.apiToken,
    protocol: account.protocol,
    username: account.username,
  });

  if (!info) {
    res.status(502).json({ error: "Gagal mengambil data dari panel VPS (akun mungkin tidak ditemukan)" });
    return;
  }

  // Update DB dengan data terbaru dari panel
  const updateData: Partial<typeof vpnAccountsTable.$inferInsert> = {};
  if (info.uuid) updateData.uuid = info.uuid;
  if (info.configLink) updateData.configLink = info.configLink;
  if (info.allLinks) updateData.allLinks = info.allLinks as Record<string, string | null>;
  updateData.updatedAt = new Date();

  const [updated] = await db
    .update(vpnAccountsTable)
    .set(updateData)
    .where(eq(vpnAccountsTable.id, id))
    .returning();

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "sync_account",
    targetType: "account",
    targetId: id,
    details: { username: account.username, protocol: account.protocol },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "sync_account" }, "Failed to log admin action"));

  res.json({ success: true, panelInfo: info, account: { id: updated.id, uuid: updated.uuid, configLink: updated.configLink } });
}));

export default router;

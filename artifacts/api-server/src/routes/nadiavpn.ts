import { Router, type Response } from "express";
import { requireAdmin } from "../lib/auth";
import { logAdminAction } from "./admin-audit";
import { getClientIp } from "../lib/request-ip";
import {
  createNadiaVpnOrder,
  createNadiaVpnTrial,
  deleteNadiaVpnAccount,
  getNadiaVpnAccountDetails,
  getNadiaVpnAccounts,
  getNadiaVpnBalance,
  getNadiaVpnServers,
  migrateNadiaVpnAccount,
  NadiaVpnApiError,
  NadiaVpnConfigError,
  renewNadiaVpnAccount,
  syncNadiaVpnAccount,
  type NadiaVpnDurationType,
} from "../lib/nadiavpn";

const router = Router();

function sendNadiaVpnError(res: Response, error: unknown) {
  if (error instanceof NadiaVpnConfigError) {
    res.status(500).json({ error: error.message });
    return;
  }

  if (error instanceof NadiaVpnApiError) {
    res.status(error.status && error.status >= 400 ? error.status : 502).json({
      error: error.message || "NadiaVPN API error",
      upstream: error.upstreamData,
    });
    return;
  }

  res.status(500).json({ error: "Gagal memproses request NadiaVPN" });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} wajib diisi`);
  }
  return value.trim();
}

function requireDurationType(value: unknown): NadiaVpnDurationType {
  const type = requireString(value, "type").toLowerCase();
  if (type !== "day" && type !== "week" && type !== "month") {
    throw new Error("type harus day, week, atau month");
  }
  return type;
}

function requirePositiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${field} harus berupa angka minimal 1`);
  }
  return parsed;
}

function parseValidation<T>(res: Response, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid input" });
    return undefined;
  }
}

router.get("/admin/nadiavpn/balance", requireAdmin, async (_req, res) => {
  try {
    res.json(await getNadiaVpnBalance());
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.get("/admin/nadiavpn/servers", requireAdmin, async (_req, res) => {
  try {
    res.json(await getNadiaVpnServers());
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/trial", requireAdmin, async (req, res) => {
  const payload = parseValidation(res, () => ({
    server_id: requireString(req.body?.server_id, "server_id"),
    protocol: requireString(req.body?.protocol, "protocol"),
  }));
  if (!payload) return;

  if (payload.protocol === "zivpn") {
    res.status(400).json({ error: "Protocol zivpn tidak didukung untuk Trial NadiaVPN" });
    return;
  }

  try {
    const result = await createNadiaVpnTrial(payload);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "create_nadiavpn_trial",
      targetType: "nadiavpn",
      targetId: null,
      details: payload,
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/order", requireAdmin, async (req, res) => {
  const payload = parseValidation(res, () => ({
    server_id: requireString(req.body?.server_id, "server_id"),
    protocol: requireString(req.body?.protocol, "protocol"),
    type: requireDurationType(req.body?.type),
    duration: requirePositiveInteger(req.body?.duration, "duration"),
    username: requireString(req.body?.username, "username"),
  }));
  if (!payload) return;

  try {
    const result = await createNadiaVpnOrder(payload);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "create_nadiavpn_order",
      targetType: "nadiavpn",
      targetId: null,
      details: payload,
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/renew", requireAdmin, async (req, res) => {
  const payload = parseValidation(res, () => ({
    account_id: requireString(req.body?.account_id, "account_id"),
    type: requireDurationType(req.body?.type),
    duration: requirePositiveInteger(req.body?.duration, "duration"),
  }));
  if (!payload) return;

  try {
    const result = await renewNadiaVpnAccount(payload);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "renew_nadiavpn",
      targetType: "nadiavpn",
      targetId: null,
      details: payload,
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/migrate", requireAdmin, async (req, res) => {
  const payload = parseValidation(res, () => ({
    account_id: requireString(req.body?.account_id, "account_id"),
    new_server_id: requireString(req.body?.new_server_id, "new_server_id"),
  }));
  if (!payload) return;

  try {
    const result = await migrateNadiaVpnAccount(payload);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "migrate_nadiavpn",
      targetType: "nadiavpn",
      targetId: null,
      details: payload,
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.get("/admin/nadiavpn/accounts", requireAdmin, async (_req, res) => {
  try {
    res.json(await getNadiaVpnAccounts());
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/account/details", requireAdmin, async (req, res) => {
  const accountId = parseValidation(res, () => requireString(req.body?.account_id, "account_id"));
  if (!accountId) return;

  try {
    const result = await getNadiaVpnAccountDetails(accountId);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "get_nadiavpn_account_details",
      targetType: "nadiavpn",
      targetId: null,
      details: { account_id: accountId },
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.post("/admin/nadiavpn/account/sync", requireAdmin, async (req, res) => {
  const accountId = parseValidation(res, () => requireString(req.body?.account_id, "account_id"));
  if (!accountId) return;

  try {
    const result = await syncNadiaVpnAccount(accountId);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "sync_nadiavpn_account",
      targetType: "nadiavpn",
      targetId: null,
      details: { account_id: accountId },
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

router.delete("/admin/nadiavpn/account/delete", requireAdmin, async (req, res) => {
  const accountId = parseValidation(res, () => requireString(req.body?.account_id, "account_id"));
  if (!accountId) return;

  try {
    const result = await deleteNadiaVpnAccount(accountId);
    const adminId = req.user!.userId;
    logAdminAction({
      adminUserId: adminId,
      action: "delete_nadiavpn_account",
      targetType: "nadiavpn",
      targetId: null,
      details: { account_id: accountId },
      ipAddress: getClientIp(req as any),
    }).catch(() => {});
    res.json(result);
  } catch (error) {
    sendNadiaVpnError(res, error);
  }
});

export default router;

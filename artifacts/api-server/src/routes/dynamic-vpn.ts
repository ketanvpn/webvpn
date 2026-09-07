import { Router, type Response } from "express";
import { asyncHandler } from "../lib/async-handler";
import {
  db,
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  usersTable,
  vouchersTable,
  vpnAccountsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { NadiaVpnApiError } from "../lib/nadiavpn";
import { AxiosError } from "axios";
import { dynamicOrderLimiter } from "../lib/rate-limit";
import { logger } from "../lib/logger";
import { logAdminAction } from "./admin-audit";
import { getClientIp } from "../lib/request-ip";
import {
  DYNAMIC_DURATION_TYPES,
  getDynamicCost,
  getDynamicDurationLabel,
  isDynamicDurationType,
  type DynamicDurationType,
} from "../lib/dynamic-duration";
import {
  decideCreation,
  decidePaymentLock,
  parseDynamicOrderStatus,
  toDynamicOrderConfiguration,
  type DynamicOrderConfiguration,
} from "../lib/dynamic-order/lifecycle-policy";
import { formatDynamicOrderForUser } from "../lib/dynamic-order/order-response";
import { applyMarkup, calculateDynamicPrice } from "../lib/dynamic-order/pricing";
import {
  syncNadiaVpnServersFromProvider,
  syncLocalPanelServers,
  syncAllServersThrottled,
  refreshLocalDynamicServerCapacity,
} from "../lib/dynamic-order/sync";
import { fulfillDynamicOrder } from "../lib/dynamic-order/fulfillment";

const router = Router();
const VALID_PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const VALID_TYPES = [...DYNAMIC_DURATION_TYPES];
const DYNAMIC_ORDER_CREATION_LOCK_NAMESPACE = 1_904_231;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

function normalizeProtocol(protocol: unknown) {
  return String(protocol ?? "").trim().toLowerCase();
}

function normalizeDurationType(type: unknown) {
  return String(type ?? "").trim().toLowerCase();
}

function sanitizeUsername(raw: unknown) {
  return String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
}

function isCloudfrontCapableServerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /cloudfront/i.test(name);
}

function isPremiumServerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /premium/i.test(name);
}

function formatServer(row: typeof dynamicProviderServersTable.$inferSelect, admin = false) {
  const isCloudfrontCapable = isCloudfrontCapableServerName(row.displayName) || isCloudfrontCapableServerName(row.providerName);
  const isPremium = isPremiumServerName(row.displayName) || isPremiumServerName(row.providerName);
  const base = {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    location: row.location,
    enabledProtocols: row.enabledProtocols,
    supportedTypes: row.supportedTypes,
    isActive: row.isActive,
    trialEnabled: row.trialEnabled,
    trialDuration: row.trialDuration,
    renewEnabled: row.renewEnabled,
    sellPricePerDay: Number(row.sellPricePerDay ?? 0),
    sellPricePerWeek: Number(row.sellPricePerWeek ?? 0),
    sellPricePerMonth: Number(row.sellPricePerMonth ?? 0),
    minDays: row.minDays,
    maxDays: row.maxDays,
    minMonths: row.minMonths,
    maxMonths: row.maxMonths,
    capacityLimit: row.capacityLimit,
    capacityUsed: row.capacityUsed,
    capacityIsFull: row.capacityIsFull,
    maxConnections: row.maxConnections,
    sortOrder: row.sortOrder,
    isCloudfrontCapable,
    isPremium,
  };

  if (!admin) return base;

  return {
    ...base,
    provider: row.provider,
    providerServerId: row.providerServerId,
    providerName: row.providerName,
    supportedProtocols: row.supportedProtocols,
    providerTrialEnabled: row.providerTrialEnabled,
    costPerDay: Number(row.costPerDay ?? 0),
    costPerWeek: Number(row.costPerWeek ?? 0),
    costPerMonth: Number(row.costPerMonth ?? 0),
    pricingMode: row.pricingMode,
    markupPercent: row.markupPercent,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Admin Routes ─────────────────────────────────────────────────────────────

router.get("/admin/dynamic-vpn/servers", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await db.select().from(dynamicProviderServersTable).orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, true)) });
}));

router.post("/admin/dynamic-vpn/servers/sync/nadiavpn", requireAdmin, asyncHandler(async (req, res) => {
  const synced = await syncNadiaVpnServersFromProvider();
  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "sync_nadiavpn_servers",
    targetType: "dynamic_server",
    targetId: null,
    details: { total: synced.length },
    ipAddress: getClientIp(req as any),
  }).catch((err) => logger.error({ err }, "[dynamic-vpn] logAdminAction failed for sync_nadiavpn_servers"));
  res.json({ success: true, total: synced.length, servers: synced.map((row) => formatServer(row, true)) });
}));

router.post("/admin/dynamic-vpn/servers/sync/local-panel", requireAdmin, asyncHandler(async (req, res) => {
  const synced = await syncLocalPanelServers();
  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "sync_local_panel_servers",
    targetType: "dynamic_server",
    targetId: null,
    details: { total: synced.length },
    ipAddress: getClientIp(req as any),
  }).catch((err) => logger.error({ err }, "[dynamic-vpn] logAdminAction failed for sync_local_panel_servers"));
  res.json({ success: true, total: synced.length, servers: synced.map((row) => formatServer(row, true)) });
}));

router.get("/admin/dynamic-vpn/orders", requireAdmin, asyncHandler(async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const provider = typeof req.query.provider === "string" ? req.query.provider : "";
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
  const conditions = [];
  if (status && status !== "all") conditions.push(eq(dynamicVpnOrdersTable.status, status));
  if (provider && provider !== "all") conditions.push(eq(dynamicVpnOrdersTable.provider, provider));

  const rows = await db
    .select({
      order: dynamicVpnOrdersTable,
      buyerUsername: usersTable.username,
      buyerEmail: usersTable.email,
      voucherCode: vouchersTable.code,
    })
    .from(dynamicVpnOrdersTable)
    .leftJoin(usersTable, eq(dynamicVpnOrdersTable.userId, usersTable.id))
    .leftJoin(vouchersTable, eq(dynamicVpnOrdersTable.voucherId, vouchersTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dynamicVpnOrdersTable.createdAt))
    .limit(limit);

  res.json({
    orders: rows.map(({ order, buyerUsername, buyerEmail, voucherCode }) => ({
      ...formatDynamicOrderForUser(order),
      buyer: { username: buyerUsername, email: buyerEmail },
      voucherCode: voucherCode ?? null,
    })),
  });
}));

// ─── Admin PATCH with validated fields ────────────────────────────────────────

/** Allowed fields with their sanitizers. Only these keys are accepted. */
const ADMIN_PATCH_FIELDS: Record<string, (v: unknown) => unknown> = {
  displayName: (v) => String(v).trim(),
  isActive: (v) => !!v,
  trialEnabled: (v) => !!v,
  enabledProtocols: (v) => {
    if (!Array.isArray(v)) return undefined;
    return v.map((p: unknown) => String(p ?? "").trim().toLowerCase()).filter((p: string) => VALID_PROTOCOLS.includes(p));
  },
  sellPricePerDay: (v) => String(Math.max(0, Number(v))),
  sellPricePerWeek: (v) => String(Math.max(0, Number(v))),
  sellPricePerMonth: (v) => String(Math.max(0, Number(v))),
  minDays: (v) => Math.max(1, parseInt(String(v), 10)),
  maxDays: (v) => Math.max(1, parseInt(String(v), 10)),
  minMonths: (v) => Math.max(1, parseInt(String(v), 10)),
  maxMonths: (v) => Math.max(1, parseInt(String(v), 10)),
  maxConnections: (v) => Math.max(0, parseInt(String(v), 10) || 0),
  sortOrder: (v) => parseInt(String(v), 10) || 0,
  pricingMode: (v) => (v === "auto_markup" ? "auto_markup" : "manual"),
  markupPercent: (v) => Math.max(0, Math.min(1000, parseInt(String(v), 10) || 0)),
};

router.patch("/admin/dynamic-vpn/servers/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) return sendError(res, 400, "ID server tidak valid");

  const body = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };

  const [existingServer] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, id)).limit(1);
  if (!existingServer) return sendError(res, 404, "Server tidak ditemukan");

  // Only accept whitelisted fields
  for (const [key, sanitize] of Object.entries(ADMIN_PATCH_FIELDS)) {
    if (body[key] === undefined) continue;
    // displayName is only editable for non-nadiavpn servers
    if (key === "displayName" && existingServer.provider === "nadiavpn") continue;
    const sanitized = sanitize(body[key]);
    if (sanitized !== undefined) update[key] = sanitized;
  }

  // If mode auto_markup, recalculate sell price from cost in DB
  const newMode = update.pricingMode as string | undefined;
  const newMarkup = update.markupPercent as number | undefined;
  if (newMode === "auto_markup" || newMarkup !== undefined) {
    const mode = (newMode ?? existingServer.pricingMode) as string;
    const markup = newMarkup ?? existingServer.markupPercent;
    if (mode === "auto_markup") {
      update.sellPricePerDay = String(applyMarkup(Number(existingServer.costPerDay ?? 0), markup));
      update.sellPricePerWeek = String(applyMarkup(Number(existingServer.costPerWeek ?? 0), markup));
      update.sellPricePerMonth = String(applyMarkup(Number(existingServer.costPerMonth ?? 0), markup));
    }
  }

  const [row] = await db.update(dynamicProviderServersTable).set(update).where(eq(dynamicProviderServersTable.id, id)).returning();
  if (!row) return sendError(res, 404, "Server tidak ditemukan");

  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "update_dynamic_server",
    targetType: "dynamic_server",
    targetId: id,
    details: { changes: Object.keys(update).filter((k) => k !== "updatedAt") },
    ipAddress: getClientIp(req as any),
  }).catch((err) => logger.error({ err, targetId: id }, "[dynamic-vpn] logAdminAction failed for update_dynamic_server"));

  res.json(formatServer(row, true));
}));

// ─── Public Routes ────────────────────────────────────────────────────────────

router.get("/dynamic-vpn/public-servers", asyncHandler(async (_req, res) => {
  const rows = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.isActive, true))
    .orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, false)) });
}));

// ─── Authenticated User Routes ────────────────────────────────────────────────

router.get("/dynamic-vpn/servers", requireAuth, asyncHandler(async (_req, res) => {
  // Throttled sync: max once per 5 minutes instead of every request
  await syncAllServersThrottled();

  const rows = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(and(eq(dynamicProviderServersTable.isActive, true), eq(dynamicProviderServersTable.capacityIsFull, false)))
    .orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, false)) });
}));

router.post("/dynamic-vpn/quote", requireAuth, asyncHandler(async (req, res) => {
  const serverId = parseInt(String(req.body?.serverId ?? ""), 10);
  const protocol = normalizeProtocol(req.body?.protocol);
  const durationType = normalizeDurationType(req.body?.durationType);
  const duration = parseInt(String(req.body?.duration ?? ""), 10);

  let [server] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, serverId)).limit(1);
  if (server?.provider === "local_panel") server = await refreshLocalDynamicServerCapacity(server);
  if (!server || !server.isActive || server.capacityIsFull) return sendError(res, 404, "Server tidak tersedia");
  if (!server.enabledProtocols.includes(protocol)) return sendError(res, 400, "Protocol tidak tersedia untuk server ini");
  if (!Number.isInteger(duration) || duration < 1) return sendError(res, 400, "Durasi tidak valid");

  try {
    const quote = await calculateDynamicPrice(server, durationType, duration, req.user!.userId, req.body?.voucherCode);
    res.json(quote);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Quote gagal");
  }
}));

router.post("/dynamic-vpn/orders", requireAuth, dynamicOrderLimiter, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const serverId = parseInt(String(req.body?.serverId ?? ""), 10);
  const protocol = normalizeProtocol(req.body?.protocol);
  const durationType = normalizeDurationType(req.body?.durationType);
  const duration = parseInt(String(req.body?.duration ?? ""), 10);
  const username = sanitizeUsername(req.body?.username);
  const rawPassword = req.body?.password;
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";
  const paymentMethod = String(req.body?.paymentMethod ?? "balance");
  const voucherCode = req.body?.voucherCode;

  if (username.length < 5 || !/[a-z]/.test(username) || !/\d{2,}/.test(username)) {
    return sendError(res, 400, "Username minimal 5 karakter, huruf kecil/angka, dan minimal 2 angka");
  }
  if (protocol === "ssh" && (password.length < 6 || password.length > 32)) {
    return sendError(res, 400, "Password SSH wajib diisi 6-32 karakter");
  }
  if (paymentMethod !== "balance") return sendError(res, 400, "Dynamic order saat ini baru mendukung pembayaran saldo");

  // Throttled sync instead of per-request sync
  await syncAllServersThrottled();

  let [server] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, serverId)).limit(1);
  if (server?.provider === "local_panel") server = await refreshLocalDynamicServerCapacity(server);
  if (!server || !server.isActive || server.capacityIsFull) return sendError(res, 409, "Server penuh atau sedang tidak tersedia. Silakan pilih server lain.");
  if (!server.enabledProtocols.includes(protocol)) return sendError(res, 400, "Protocol tidak tersedia untuk server ini");
  if (!Number.isInteger(duration) || duration < 1) return sendError(res, 400, "Durasi tidak valid");

  let quote;
  try {
    quote = await calculateDynamicPrice(server, durationType, duration, userId, voucherCode);
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : "Quote gagal");
  }

  const [existingAccount] = await db
    .select({ id: vpnAccountsTable.id })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.username, username), eq(vpnAccountsTable.isActive, true)))
    .limit(1);
  if (existingAccount) return sendError(res, 409, `Nama akun "${username}" sudah dipakai`);

  const requestedConfiguration = {
    dynamicServerId: server.id,
    protocol,
    durationType,
    duration,
    username,
    password: protocol === "ssh" ? password : null,
    paymentMethod,
    voucherId: quote.voucherId,
  } satisfies DynamicOrderConfiguration;
  const creationResult = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${DYNAMIC_ORDER_CREATION_LOCK_NAMESPACE}, ${userId})`,
    );

    const candidateOrders = await tx
      .select()
      .from(dynamicVpnOrdersTable)
      .where(
        and(
          eq(dynamicVpnOrdersTable.userId, userId),
          inArray(dynamicVpnOrdersTable.status, ["pending", "processing", "failed"]),
        ),
      )
      .orderBy(desc(dynamicVpnOrdersTable.createdAt));

    for (const candidate of candidateOrders) {
      const status = parseDynamicOrderStatus(candidate.status);
      if (status === null) {
        logger.error({ orderId: candidate.id, status: candidate.status }, "[dynamic-vpn] unknown dynamic order status during creation");
        return { kind: "invalid-status" } as const;
      }

      const configuration = toDynamicOrderConfiguration(candidate);
      const decision = decideCreation(
        configuration === null ? null : { status, configuration },
        requestedConfiguration,
      );
      if (decision.kind === "reuse") return { kind: "reuse", order: candidate } as const;
      if (decision.kind === "conflict") return { kind: "conflict" } as const;
    }

    const [order] = await tx
      .insert(dynamicVpnOrdersTable)
      .values({
        userId,
        dynamicServerId: server.id,
        provider: server.provider,
        providerServerId: server.providerServerId,
        serverDisplayName: server.displayName,
        protocol,
        durationType,
        duration,
        username,
        password: protocol === "ssh" ? password : null,
        amount: String(quote.amount),
        voucherId: quote.voucherId,
        discountAmount: String(quote.discountAmount),
        status: "pending",
        paymentMethod,
      })
      .returning();
    return { kind: "create", order } as const;
  });

  switch (creationResult.kind) {
    case "reuse":
      return res.json({ order: formatDynamicOrderForUser(creationResult.order), quote, reused: true });
    case "conflict":
      return sendError(res, 409, "Order dengan konfigurasi yang sama sedang diproses. Tunggu beberapa menit; jika tetap belum selesai, hubungi bantuan.");
    case "invalid-status":
      return sendError(res, 500, "Order tidak dapat diproses. Silakan hubungi bantuan.");
    case "create":
      return res.status(201).json({ order: formatDynamicOrderForUser(creationResult.order), quote, reused: false });
  }
}));

router.post("/dynamic-vpn/orders/:id/pay", requireAuth, dynamicOrderLimiter, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const userId = req.user!.userId;

  const [locked] = await db
    .update(dynamicVpnOrdersTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(
      eq(dynamicVpnOrdersTable.id, id),
      eq(dynamicVpnOrdersTable.userId, userId),
      inArray(dynamicVpnOrdersTable.status, ["pending", "failed"]),
    ))
    .returning();

  if (!locked) {
    const [existingOrder] = await db
      .select({ status: dynamicVpnOrdersTable.status })
      .from(dynamicVpnOrdersTable)
      .where(and(eq(dynamicVpnOrdersTable.id, id), eq(dynamicVpnOrdersTable.userId, userId)))
      .limit(1);
    if (!existingOrder) return sendError(res, 404, "Order tidak ditemukan");

    const status = parseDynamicOrderStatus(existingOrder.status);
    if (status === null) {
      logger.error({ orderId: id, status: existingOrder.status }, "[dynamic-vpn] unknown dynamic order status during payment lock");
      return sendError(res, 500, "Status order tidak dapat diproses. Silakan hubungi bantuan.");
    }

    const decision = decidePaymentLock(status);
    if (decision.kind === "lock") {
      logger.error({ orderId: id, status }, "[dynamic-vpn] payment lock was not acquired for retryable order");
      return sendError(res, 409, "Order sedang diperbarui. Silakan coba lagi.");
    }

    switch (decision.status) {
      case "processing":
        return sendError(res, 409, "Order sedang diproses. Jangan ulangi pembayaran; tunggu beberapa menit atau hubungi bantuan jika status tidak berubah.");
      case "paid":
        return sendError(res, 409, "Order ini sudah berhasil dibayar dan akun VPN sudah dibuat.");
      case "expired":
        return sendError(res, 409, "Order ini sudah kedaluwarsa dan tidak dapat dibayar ulang. Buat order baru.");
    }
  }

  logger.info({ orderId: id, userId }, "[dynamic-vpn] Order locked to processing, starting fulfill");

  try {
    await fulfillDynamicOrder(id, userId);
  } catch (error) {
    try {
      await db
        .update(dynamicVpnOrdersTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(eq(dynamicVpnOrdersTable.id, id), eq(dynamicVpnOrdersTable.userId, userId), eq(dynamicVpnOrdersTable.status, "processing")));
    } catch (statusError) {
      logger.error({ err: statusError, originalError: error, orderId: id, userId }, "[dynamic-vpn] failed to mark failed dynamic order after fulfillment error");
      return sendError(res, 500, "Order gagal diproses dan statusnya belum dapat diperbarui. Silakan hubungi bantuan.");
    }
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "INSUFFICIENT_BALANCE") {
      logger.warn({ orderId: id, userId }, "Dynamic order pay failed due to insufficient balance (should have been caught earlier)");
      return sendError(res, 400, "Saldo tidak cukup");
    }

    if (error instanceof NadiaVpnApiError) {
      const upstream = String(error.upstreamData ?? error.message).toLowerCase();
      logger.error({ err: error, orderId: id, userId, upstream }, "[dynamic-vpn] pay failed - NadiaVPN API error");
      if (upstream.includes("saldo") || upstream.includes("balance") || upstream.includes("insufficient")) {
        return sendError(res, 503, "Provider VPN sedang tidak tersedia (saldo provider habis). Silakan coba lagi nanti atau hubungi bantuan.");
      }
      if (upstream.includes("username") && (upstream.includes("exist") || upstream.includes("duplicate") || upstream.includes("already"))) {
        return sendError(res, 409, "Username sudah digunakan di server ini. Silakan buat order baru dengan username berbeda.");
      }
      if (upstream.includes("server") && (upstream.includes("full") || upstream.includes("penuh") || upstream.includes("capacity"))) {
        return sendError(res, 503, "Server VPN sedang penuh. Silakan pilih server lain atau coba lagi nanti.");
      }
      return sendError(res, 502, "Gagal membuat akun di provider VPN. Anda dapat mencoba lagi atau hubungi bantuan.");
    }

    if (error instanceof AxiosError) {
      logger.error({ err: error, orderId: id, userId, code: error.code }, "[dynamic-vpn] pay failed - network/panel error");
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return sendError(res, 504, "Server VPN tidak merespons (timeout). Silakan coba lagi dalam beberapa menit.");
      }
      if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        return sendError(res, 503, "Server VPN tidak dapat dihubungi. Silakan coba lagi nanti atau hubungi bantuan.");
      }
      return sendError(res, 502, "Gagal menghubungi server VPN. Anda dapat mencoba lagi atau hubungi bantuan.");
    }

    if (msg === "Server penuh atau sedang tidak tersedia") {
      return sendError(res, 503, "Server VPN sedang penuh. Silakan pilih server lain atau coba lagi nanti.");
    }
    if (msg === "Server tidak aktif") {
      return sendError(res, 503, "Server VPN sedang tidak aktif. Silakan pilih server lain.");
    }

    logger.error({ err: error, orderId: id, userId }, "[dynamic-vpn] pay failed - order marked failed, any necessary refunds handled inside fulfill");
    return sendError(res, 500, "Gagal memproses order. Anda dapat mencoba pembayaran lagi atau hubungi bantuan jika masalah berlanjut.");
  }

  const [paid] = await db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.id, id)).limit(1);
  if (!paid) {
    logger.error({ orderId: id, userId }, "[dynamic-vpn] fulfilled order missing after successful fulfillment");
    return sendError(res, 500, "Order berhasil diproses tetapi detailnya belum tersedia. Silakan hubungi bantuan.");
  }
  res.json({ order: formatDynamicOrderForUser(paid) });
}));

router.get("/dynamic-vpn/orders", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.userId;
  const limitRaw = req.query.limit;
  const limit = limitRaw ? Math.min(parseInt(String(limitRaw), 10) || 50, 100) : undefined;
  const query = db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.userId, userId)).orderBy(desc(dynamicVpnOrdersTable.createdAt));
  const rows = limit ? await query.limit(limit) : await query;
  res.json({ orders: rows.map(formatDynamicOrderForUser) });
}));

router.get("/dynamic-vpn/orders/:id", requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id)) return sendError(res, 400, "ID order tidak valid");

  const [order] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.id, id), eq(dynamicVpnOrdersTable.userId, req.user!.userId)))
    .limit(1);
  if (!order) return sendError(res, 404, "Order tidak ditemukan");

  res.json({ order: formatDynamicOrderForUser(order) });
}));

// ─── Admin: Profit Tracking per Server ────────────────────────────────────────

router.get("/admin/stats/profit-tracking", requireAdmin, asyncHandler(async (req, res) => {
  const monthParam = typeof req.query.month === "string" ? req.query.month : "";
  const now = new Date();

  let periodStart: Date;
  let periodEnd: Date;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number);
    periodStart = new Date(year, month - 1, 1);
    periodEnd = new Date(year, month, 1);
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const orders = await db
    .select({
      orderId: dynamicVpnOrdersTable.id,
      dynamicServerId: dynamicVpnOrdersTable.dynamicServerId,
      amount: dynamicVpnOrdersTable.amount,
      durationType: dynamicVpnOrdersTable.durationType,
      duration: dynamicVpnOrdersTable.duration,
      serverDisplayName: dynamicVpnOrdersTable.serverDisplayName,
      provider: dynamicVpnOrdersTable.provider,
    })
    .from(dynamicVpnOrdersTable)
    .where(
      and(
        eq(dynamicVpnOrdersTable.status, "paid"),
        gte(dynamicVpnOrdersTable.createdAt, periodStart),
        lt(dynamicVpnOrdersTable.createdAt, periodEnd),
      ),
    );

  const allServers = await db.select().from(dynamicProviderServersTable);
  const serverMap = new Map(allServers.map((s) => [s.id, s]));

  const serverStats = new Map<number, {
    serverId: number;
    serverName: string;
    provider: string;
    orders: number;
    revenue: number;
    cost: number;
  }>();

  let totalRevenue = 0;
  let totalCost = 0;
  let totalOrders = 0;

  for (const order of orders) {
    const revenue = Number(order.amount ?? 0);
    const server = order.dynamicServerId ? serverMap.get(order.dynamicServerId) : null;
    const cost = server ? getDynamicCost(server, order.durationType) * order.duration : 0;

    totalRevenue += revenue;
    totalCost += cost;
    totalOrders++;

    const key = order.dynamicServerId ?? 0;
    const existing = serverStats.get(key);
    if (existing) {
      existing.orders++;
      existing.revenue += revenue;
      existing.cost += cost;
    } else {
      serverStats.set(key, {
        serverId: key,
        serverName: order.serverDisplayName ?? server?.displayName ?? "Unknown",
        provider: order.provider ?? server?.provider ?? "unknown",
        orders: 1,
        revenue,
        cost,
      });
    }
  }

  const totalProfit = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const servers = Array.from(serverStats.values())
    .map((s) => {
      const profit = s.revenue - s.cost;
      const margin = s.revenue > 0 ? Math.round((profit / s.revenue) * 100) : 0;
      const serverData = s.serverId ? serverMap.get(s.serverId) : null;
      return {
        serverId: s.serverId,
        serverName: s.serverName,
        provider: s.provider,
        orders: s.orders,
        revenue: s.revenue,
        cost: s.cost,
        profit,
        marginPercent: margin,
        costPerDay: Number(serverData?.costPerDay ?? 0),
        costPerWeek: Number(serverData?.costPerWeek ?? 0),
        costPerMonth: Number(serverData?.costPerMonth ?? 0),
        sellPricePerDay: Number(serverData?.sellPricePerDay ?? 0),
        sellPricePerWeek: Number(serverData?.sellPricePerWeek ?? 0),
        sellPricePerMonth: Number(serverData?.sellPricePerMonth ?? 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  res.json({
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      marginPercent,
      totalOrders,
    },
    servers,
  });
}));

export default router;

import { Router, type Response } from "express";
import { db } from "@workspace/db";
import {
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  serversTable,
  usersTable,
  vpnAccountsTable,
} from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { createNadiaVpnOrder, getNadiaVpnServers } from "../lib/nadiavpn";
import { addBalanceLog } from "./balance-logs";
import { logger } from "../lib/logger";

const router = Router();
const VALID_PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const VALID_TYPES = ["day", "month"];

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

function formatServer(row: typeof dynamicProviderServersTable.$inferSelect, admin = false) {
  const base = {
    id: row.id,
    displayName: row.displayName,
    location: row.location,
    enabledProtocols: row.enabledProtocols,
    supportedTypes: row.supportedTypes,
    isActive: row.isActive,
    trialEnabled: row.trialEnabled,
    trialDuration: row.trialDuration,
    sellPricePerDay: Number(row.sellPricePerDay ?? 0),
    sellPricePerMonth: Number(row.sellPricePerMonth ?? 0),
    minDays: row.minDays,
    maxDays: row.maxDays,
    minMonths: row.minMonths,
    maxMonths: row.maxMonths,
    capacityLimit: row.capacityLimit,
    capacityUsed: row.capacityUsed,
    capacityIsFull: row.capacityIsFull,
    sortOrder: row.sortOrder,
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
    costPerMonth: Number(row.costPerMonth ?? 0),
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function calculateQuote(server: typeof dynamicProviderServersTable.$inferSelect, durationType: string, duration: number) {
  if (durationType === "day") {
    if (!server.supportedTypes.includes("day")) throw new Error("Server ini tidak mendukung durasi harian");
    if (duration < server.minDays || duration > server.maxDays) {
      throw new Error(`Durasi harian harus ${server.minDays}-${server.maxDays} hari`);
    }
    const unitPrice = Number(server.sellPricePerDay ?? 0);
    if (unitPrice <= 0) throw new Error("Harga harian belum diatur admin");
    return { unitPrice, amount: unitPrice * duration, durationLabel: `${duration} Hari` };
  }

  if (durationType === "month") {
    if (!server.supportedTypes.includes("month")) throw new Error("Server ini tidak mendukung durasi bulanan");
    if (duration < server.minMonths || duration > server.maxMonths) {
      throw new Error(`Durasi bulanan harus ${server.minMonths}-${server.maxMonths} bulan`);
    }
    const unitPrice = Number(server.sellPricePerMonth ?? 0);
    if (unitPrice <= 0) throw new Error("Harga bulanan belum diatur admin");
    return { unitPrice, amount: unitPrice * duration, durationLabel: `${duration} Bulan` };
  }

  throw new Error("Tipe durasi tidak valid");
}

async function getKetantechProviderServerId() {
  const [existing] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.host, "premium.ketantech.provider"))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(serversTable)
    .values({
      name: "KETANTECH Premium Network",
      location: "Premium Network",
      flag: "🌐",
      host: "premium.ketantech.provider",
      apiUrl: null,
      apiToken: null,
      supportedProtocols: VALID_PROTOCOLS,
      isActive: true,
      maxAccounts: 999999,
    })
    .returning();

  return created.id;
}

function parseNadiaExpireAt(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.replace(" ", "T") + "+07:00";
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function stringifyConfigValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function extractConnectionDetails(response: any, protocol: string): Record<string, string | null> | null {
  const config = response?.data?.config;
  const rawLinks = config?.link;

  if (rawLinks && typeof rawLinks === "object") {
    const links: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(rawLinks)) {
      links[key] = typeof value === "string" ? value : null;
    }
    return links;
  }

  if (protocol !== "ssh" || !config || typeof config !== "object") return null;

  const port = config.port && typeof config.port === "object" ? config.port : {};
  const sshDetails: Record<string, string | null> = {
    hostname: stringifyConfigValue(config.hostname),
    servername: stringifyConfigValue(config.servername),
    pubkey: stringifyConfigValue(config.pubkey),
    isp: stringifyConfigValue(config.ISP),
    city: stringifyConfigValue(config.CITY),
    port_tls: stringifyConfigValue(port.tls),
    port_none: stringifyConfigValue(port.none),
    port_any: stringifyConfigValue(port.any),
    openvpn_tcp: stringifyConfigValue(port.ovpntcp),
    openvpn_udp: stringifyConfigValue(port.ovpnudp),
    slowdns: stringifyConfigValue(port.slowdns),
    ssh_ohp: stringifyConfigValue(port.sshohp),
    ovpn_ohp: stringifyConfigValue(port.ovpnohp),
    squid: stringifyConfigValue(port.squid),
    udp_custom: stringifyConfigValue(port.udpcustom),
    udpgw: stringifyConfigValue(port.udpgw),
  };

  return Object.values(sshDetails).some(Boolean) ? sshDetails : null;
}

async function fulfillDynamicOrder(orderId: number, userId: number) {
  const [order] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.id, orderId), eq(dynamicVpnOrdersTable.userId, userId)))
    .limit(1);

  if (!order) throw new Error("Order tidak ditemukan");
  if (order.status !== "processing") throw new Error("Order tidak dalam status processing");

  const [server] = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.id, order.dynamicServerId!))
    .limit(1);

  if (!server || !server.isActive) throw new Error("Server tidak aktif");

  const amount = Number(order.amount);
  const [updatedUser] = await db
    .update(usersTable)
    .set({ balance: sql`balance - ${amount}` })
    .where(and(eq(usersTable.id, userId), sql`balance >= ${amount}::numeric`))
    .returning({ balance: usersTable.balance });

  if (!updatedUser) throw new Error("INSUFFICIENT_BALANCE");
  const balanceAfter = Number(updatedUser.balance);
  const balanceBefore = balanceAfter + amount;

  let providerResponse: any;
  try {
    providerResponse = await createNadiaVpnOrder({
      server_id: order.providerServerId,
      protocol: order.protocol,
      type: order.durationType,
      duration: order.duration,
      username: order.username,
      ...(order.password ? { password: order.password } : {}),
    });
  } catch (error) {
    await db.update(usersTable).set({ balance: sql`balance + ${amount}` }).where(eq(usersTable.id, userId)).catch(() => {});
    throw error;
  }

  const fallbackExpiry = new Date(Date.now() + (order.durationType === "day" ? order.duration : order.duration * 30) * 24 * 60 * 60 * 1000);
  const data = providerResponse?.data ?? {};
  const accountProtocol = normalizeProtocol(data.protocol ?? order.protocol);
  const allLinks = extractConnectionDetails(providerResponse, accountProtocol);
  const configLink = accountProtocol === "ssh" ? null : allLinks?.tls ?? Object.values(allLinks ?? {}).find(Boolean) ?? null;
  const providerPassword = data.password ?? data.config?.password ?? order.password ?? null;
  const localServerId = await getKetantechProviderServerId();

  try {
    await db.transaction(async (tx: any) => {
      const [account] = await tx
        .insert(vpnAccountsTable)
        .values({
          userId,
          orderId: null,
          protocol: accountProtocol,
          username: data.username ?? order.username,
          password: providerPassword,
          uuid: data.uuid ?? null,
          serverId: localServerId,
          configLink,
          allLinks,
          expiresAt: parseNadiaExpireAt(data.expire_at, fallbackExpiry),
          quota: null,
        })
        .returning();

      await tx
        .update(dynamicVpnOrdersTable)
        .set({
          status: "paid",
          vpnAccountId: account.id,
          providerAccountId: data.account_id ?? null,
          providerResponse,
          updatedAt: new Date(),
        })
        .where(eq(dynamicVpnOrdersTable.id, orderId));
    });
  } catch (error) {
    logger.error({ err: error, orderId }, "[dynamic-vpn] DB insert failed after provider order");
    throw error;
  }

  addBalanceLog({
    userId,
    type: "order",
    amount: -amount,
    balanceBefore,
    balanceAfter,
    description: `Dynamic VPN order: ${order.serverDisplayName} ${order.protocol.toUpperCase()} ${order.duration} ${order.durationType}`,
    relatedId: order.id,
  }).catch(() => {});
}

router.get("/admin/dynamic-vpn/servers", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(dynamicProviderServersTable).orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, true)) });
});

router.post("/admin/dynamic-vpn/servers/sync/nadiavpn", requireAdmin, async (_req, res) => {
  const response: any = await getNadiaVpnServers();
  const servers = response?.data?.servers ?? [];
  const now = new Date();
  const synced = [];

  for (const srv of servers) {
    const providerServerId = String(srv.server_id);
    const [existing] = await db
      .select()
      .from(dynamicProviderServersTable)
      .where(and(eq(dynamicProviderServersTable.provider, "nadiavpn"), eq(dynamicProviderServersTable.providerServerId, providerServerId)))
      .limit(1);

    const supportedProtocols = Array.isArray(srv.supported_protocols) ? srv.supported_protocols.map(normalizeProtocol).filter(Boolean) : [];
    const supportedTypes = Array.isArray(srv.supported_types) ? srv.supported_types.map(normalizeDurationType).filter((t: string) => VALID_TYPES.includes(t)) : [];
    const values = {
      providerName: String(srv.name ?? providerServerId),
      displayName: existing?.displayName ?? String(srv.name ?? providerServerId),
      location: srv.location ? String(srv.location) : null,
      supportedProtocols,
      enabledProtocols: existing?.enabledProtocols?.length ? existing.enabledProtocols.filter((p: string) => supportedProtocols.includes(p)) : supportedProtocols,
      supportedTypes,
      providerTrialEnabled: !!srv.trial_enabled,
      trialEnabled: existing?.trialEnabled ?? !!srv.trial_enabled,
      trialDuration: srv.trial_duration ? String(srv.trial_duration) : null,
      costPerDay: String(srv.pricing?.per_day ?? 0),
      costPerMonth: String(srv.pricing?.per_month ?? 0),
      sellPricePerDay: existing?.sellPricePerDay ?? String(Math.max(Number(srv.pricing?.per_day ?? 0), 1000)),
      sellPricePerMonth: existing?.sellPricePerMonth ?? String(Math.max(Number(srv.pricing?.per_month ?? 0), 10000)),
      minDays: existing?.minDays ?? 1,
      maxDays: existing?.maxDays ?? 30,
      minMonths: existing?.minMonths ?? 1,
      maxMonths: existing?.maxMonths ?? 12,
      capacityLimit: srv.capacity?.limit != null ? String(srv.capacity.limit) : null,
      capacityUsed: Number(srv.capacity?.used ?? 0),
      capacityIsFull: !!srv.capacity?.is_full,
      isActive: existing?.isActive ?? false,
      lastSyncedAt: now,
      updatedAt: now,
    };

    const [row] = existing
      ? await db.update(dynamicProviderServersTable).set(values).where(eq(dynamicProviderServersTable.id, existing.id)).returning()
      : await db.insert(dynamicProviderServersTable).values({ provider: "nadiavpn", providerServerId, ...values }).returning();
    synced.push(formatServer(row, true));
  }

  res.json({ success: true, total: synced.length, servers: synced });
});

router.patch("/admin/dynamic-vpn/servers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const body = req.body ?? {};
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (body.displayName !== undefined) update.displayName = String(body.displayName).trim();
  if (body.isActive !== undefined) update.isActive = !!body.isActive;
  if (body.trialEnabled !== undefined) update.trialEnabled = !!body.trialEnabled;
  if (Array.isArray(body.enabledProtocols)) {
    const protocols = body.enabledProtocols.map(normalizeProtocol).filter((p: string) => VALID_PROTOCOLS.includes(p));
    update.enabledProtocols = protocols;
  }
  if (body.sellPricePerDay !== undefined) update.sellPricePerDay = String(Math.max(0, Number(body.sellPricePerDay)));
  if (body.sellPricePerMonth !== undefined) update.sellPricePerMonth = String(Math.max(0, Number(body.sellPricePerMonth)));
  if (body.minDays !== undefined) update.minDays = Math.max(1, parseInt(String(body.minDays), 10));
  if (body.maxDays !== undefined) update.maxDays = Math.max(1, parseInt(String(body.maxDays), 10));
  if (body.minMonths !== undefined) update.minMonths = Math.max(1, parseInt(String(body.minMonths), 10));
  if (body.maxMonths !== undefined) update.maxMonths = Math.max(1, parseInt(String(body.maxMonths), 10));
  if (body.sortOrder !== undefined) update.sortOrder = parseInt(String(body.sortOrder), 10) || 0;

  const [row] = await db.update(dynamicProviderServersTable).set(update).where(eq(dynamicProviderServersTable.id, id)).returning();
  if (!row) return sendError(res, 404, "Server tidak ditemukan");
  res.json(formatServer(row, true));
});

router.get("/dynamic-vpn/servers", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(and(eq(dynamicProviderServersTable.isActive, true), eq(dynamicProviderServersTable.capacityIsFull, false)))
    .orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, false)) });
});

router.post("/dynamic-vpn/quote", requireAuth, async (req, res) => {
  const serverId = parseInt(String(req.body?.serverId ?? ""), 10);
  const protocol = normalizeProtocol(req.body?.protocol);
  const durationType = normalizeDurationType(req.body?.durationType);
  const duration = parseInt(String(req.body?.duration ?? ""), 10);

  const [server] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, serverId)).limit(1);
  if (!server || !server.isActive) return sendError(res, 404, "Server tidak tersedia");
  if (!server.enabledProtocols.includes(protocol)) return sendError(res, 400, "Protocol tidak tersedia untuk server ini");
  if (!Number.isInteger(duration) || duration < 1) return sendError(res, 400, "Durasi tidak valid");

  try {
    res.json(calculateQuote(server, durationType, duration));
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : "Quote gagal");
  }
});

router.post("/dynamic-vpn/orders", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const serverId = parseInt(String(req.body?.serverId ?? ""), 10);
  const protocol = normalizeProtocol(req.body?.protocol);
  const durationType = normalizeDurationType(req.body?.durationType);
  const duration = parseInt(String(req.body?.duration ?? ""), 10);
  const username = sanitizeUsername(req.body?.username);
  const rawPassword = req.body?.password;
  const password = typeof rawPassword === "string" ? rawPassword.trim() : "";
  const paymentMethod = String(req.body?.paymentMethod ?? "balance");

  if (username.length < 5 || !/[a-z]/.test(username) || !/\d{2,}/.test(username)) {
    return sendError(res, 400, "Username minimal 5 karakter, huruf kecil/angka, dan minimal 2 angka");
  }
  if (protocol === "ssh" && (password.length < 6 || password.length > 32)) {
    return sendError(res, 400, "Password SSH wajib diisi 6-32 karakter");
  }
  if (paymentMethod !== "balance") return sendError(res, 400, "Dynamic order saat ini baru mendukung pembayaran saldo");

  const [server] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, serverId)).limit(1);
  if (!server || !server.isActive || server.capacityIsFull) return sendError(res, 404, "Server tidak tersedia");
  if (!server.enabledProtocols.includes(protocol)) return sendError(res, 400, "Protocol tidak tersedia untuk server ini");
  if (!Number.isInteger(duration) || duration < 1) return sendError(res, 400, "Durasi tidak valid");

  let quote;
  try {
    quote = calculateQuote(server, durationType, duration);
  } catch (error) {
    return sendError(res, 400, error instanceof Error ? error.message : "Quote gagal");
  }

  const [existingAccount] = await db
    .select({ id: vpnAccountsTable.id })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.username, username), eq(vpnAccountsTable.isActive, true)))
    .limit(1);
  if (existingAccount) return sendError(res, 409, `Nama akun "${username}" sudah dipakai`);

  const [order] = await db
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
      status: "pending",
      paymentMethod,
    })
    .returning();

  res.status(201).json({ order: { ...order, amount: Number(order.amount) }, quote });
});

router.post("/dynamic-vpn/orders/:id/pay", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const userId = req.user!.userId;

  const [locked] = await db
    .update(dynamicVpnOrdersTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(dynamicVpnOrdersTable.id, id), eq(dynamicVpnOrdersTable.userId, userId), eq(dynamicVpnOrdersTable.status, "pending")))
    .returning();

  if (!locked) return sendError(res, 409, "Order tidak ditemukan atau sedang diproses");

  try {
    await fulfillDynamicOrder(id, userId);
  } catch (error) {
    await db.update(dynamicVpnOrdersTable).set({ status: "pending", updatedAt: new Date() }).where(eq(dynamicVpnOrdersTable.id, id)).catch(() => {});
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "INSUFFICIENT_BALANCE") return sendError(res, 400, "Saldo tidak cukup");
    logger.error({ err: error, id }, "[dynamic-vpn] pay failed");
    return sendError(res, 500, `Gagal memproses order: ${msg}`);
  }

  const [paid] = await db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.id, id)).limit(1);
  res.json({ order: { ...paid, amount: Number(paid.amount) } });
});

router.get("/dynamic-vpn/orders", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rows = await db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.userId, userId)).orderBy(asc(dynamicVpnOrdersTable.id));
  res.json({ orders: rows.map((row) => ({ ...row, amount: Number(row.amount), providerResponse: undefined })) });
});

export default router;

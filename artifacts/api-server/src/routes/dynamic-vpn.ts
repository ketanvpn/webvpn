import { Router, type Response } from "express";
import { db } from "@workspace/db";
import {
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  serversTable,
  usersTable,
  vouchersTable,
  vpnAccountsTable,
} from "@workspace/db";
import { and, asc, count, desc, eq, gt, gte, lt, sql, sum } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAdmin, requireAuth } from "../lib/auth";
import { createNadiaVpnOrder, getNadiaVpnAccountDetails, getNadiaVpnServers } from "../lib/nadiavpn";
import { createPanelAccount, deletePanelAccount } from "../lib/vpn-panel";
import { addBalanceLog } from "./balance-logs";
import { getResellerSettings, getSettingValue } from "./settings";
import { dynamicOrderLimiter } from "../lib/rate-limit";
import { notifyAdminDynamicOrderFulfilled, notifyUserDynamicVpnAccountCreated, notifyAdminPriceChanged } from "../lib/telegram";
import { logger } from "../lib/logger";
import { logAdminAction } from "./admin-audit";
import { getClientIp } from "../lib/request-ip";
import {
  DYNAMIC_DURATION_TYPES,
  getDynamicCost,
  getDynamicDurationDays,
  getDynamicDurationLabel,
  getDynamicSellPrice,
  isDynamicDurationType,
  type DynamicDurationType,
} from "../lib/dynamic-duration";

const router = Router();
const VALID_PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const VALID_TYPES = [...DYNAMIC_DURATION_TYPES];

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

/** Hitung harga jual dari harga modal + markup persen */
function applyMarkup(cost: number, markupPercent: number): number {
  return Math.ceil(cost * (1 + markupPercent / 100));
}

function calculateBaseQuote(server: typeof dynamicProviderServersTable.$inferSelect, durationType: string, duration: number) {
  if (!isDynamicDurationType(durationType)) throw new Error("Tipe durasi tidak valid");
  if (!server.supportedTypes.includes(durationType)) {
    const labels: Record<DynamicDurationType, string> = { day: "harian", week: "mingguan", month: "bulanan" };
    throw new Error(`Server ini tidak mendukung durasi ${labels[durationType]}`);
  }

  if (durationType === "day" && (duration < server.minDays || duration > server.maxDays)) {
    throw new Error(`Durasi harian harus ${server.minDays}-${server.maxDays} hari`);
  }
  if (durationType === "week") {
    if (server.provider !== "nadiavpn") throw new Error("Paket mingguan hanya tersedia untuk server NadiaVPN");
    if (duration !== 1) throw new Error("Paket mingguan hanya tersedia untuk tepat 1 minggu");
  }
  if (durationType === "month" && (duration < server.minMonths || duration > server.maxMonths)) {
    throw new Error(`Durasi bulanan harus ${server.minMonths}-${server.maxMonths} bulan`);
  }

  const unitPrice = getDynamicSellPrice(server, durationType);
  if (unitPrice <= 0) throw new Error(`Harga ${getDynamicDurationLabel(durationType, 1).toLowerCase()} belum diatur admin`);
  return { unitPrice, baseAmount: unitPrice * duration, durationLabel: getDynamicDurationLabel(durationType, duration) };
}

async function calculateDynamicPrice(server: typeof dynamicProviderServersTable.$inferSelect, durationType: string, duration: number, userId: number, voucherCode?: unknown) {
  const base = calculateBaseQuote(server, durationType, duration);
  let amountAfterReseller = base.baseAmount;
  let resellerDiscountAmount = 0;

  const [dbUser] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (dbUser?.role === "reseller") {
    const resellerSettings = await getResellerSettings();
    if (resellerSettings.resellerEnabled && resellerSettings.resellerDiscountPercent > 0) {
      const discountPercent = Math.max(1, Math.min(99, resellerSettings.resellerDiscountPercent));
      resellerDiscountAmount = Math.floor(base.baseAmount * (discountPercent / 100));
      amountAfterReseller = Math.max(0, base.baseAmount - resellerDiscountAmount);
    }
  }

  const code = typeof voucherCode === "string" ? voucherCode.trim().toUpperCase() : "";
  let voucherId: number | null = null;
  let voucherDiscountAmount = 0;

  if (code) {
    const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code)).limit(1);
    if (!voucher || !voucher.isActive) throw new Error("Voucher tidak valid atau sudah tidak aktif");
    if (voucher.maxUses && voucher.currentUses >= voucher.maxUses) throw new Error("Voucher telah mencapai batas maksimal penggunaan");
    if (voucher.expiresAt && new Date() > voucher.expiresAt) throw new Error("Voucher sudah kedaluwarsa");

    voucherId = voucher.id;
    if (voucher.discountType === "percent") {
      voucherDiscountAmount = Math.floor(amountAfterReseller * (Number(voucher.discountValue) / 100));
    } else if (voucher.discountType === "fixed") {
      voucherDiscountAmount = Number(voucher.discountValue);
    }
    voucherDiscountAmount = Math.min(voucherDiscountAmount, amountAfterReseller);
  }

  const amount = Math.max(0, amountAfterReseller - voucherDiscountAmount);
  return {
    ...base,
    amount,
    resellerDiscountAmount,
    voucherDiscountAmount,
    discountAmount: resellerDiscountAmount + voucherDiscountAmount,
    voucherId,
    voucherCode: code || null,
  };
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
  const data = response?.data ?? {};
  const config = data.config ?? data.config_data;
  const rawLinks = config?.link;
  const serverInfo = data.server && typeof data.server === "object" ? data.server : {};

  if (rawLinks && typeof rawLinks === "object") {
    const links: Record<string, string | null> = {
      hostname: stringifyConfigValue(config?.hostname ?? data.hostname),
      servername: stringifyConfigValue(config?.servername ?? data.servername),
      host: stringifyConfigValue(config?.host ?? data.host),
      domain: stringifyConfigValue(serverInfo?.domain ?? config?.domain ?? data.domain),
      server: stringifyConfigValue(config?.server ?? data.server),
      sni: stringifyConfigValue(config?.sni ?? data.sni),
      cloudfront: stringifyConfigValue(config?.cloudfront ?? data.cloudfront),
    };
    for (const [key, value] of Object.entries(rawLinks)) {
      links[key] = typeof value === "string" ? value : null;
    }
    return links;
  }

  if (!config || typeof config !== "object") return null;

  const port = config.port && typeof config.port === "object" ? config.port : {};
  const payloadws = config.payloadws && typeof config.payloadws === "object" ? config.payloadws : {};
  const details: Record<string, string | null> = {
    hostname: stringifyConfigValue(config.hostname ?? data.hostname),
    servername: stringifyConfigValue(config.servername ?? data.servername),
    domain: stringifyConfigValue(serverInfo?.domain ?? config.domain ?? data.domain),
    host: stringifyConfigValue(config.host ?? data.host),
    cloudfront: stringifyConfigValue(config.cloudfront ?? data.cloudfront),
    sni: stringifyConfigValue(config.sni ?? data.sni),
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
    payload_cdn: stringifyConfigValue(payloadws.payloadcdn),
    payload_with_path: stringifyConfigValue(payloadws.payloadwithpath),
  };

  return Object.values(details).some(Boolean) ? details : null;
}

function extractProviderAccountId(data: any): string | null {
  return stringifyConfigValue(
    data?.account_id ??
    data?.accountId ??
    data?.id ??
    data?.account?.account_id ??
    data?.account?.id
  );
}

function extractPanelConnectionDetails(result: Awaited<ReturnType<typeof createPanelAccount>>): Record<string, string | null> | null {
  const details: Record<string, string | null> = {};
  if (result.hostname) details.hostname = result.hostname;
  if (result.allLinks) {
    for (const [key, value] of Object.entries(result.allLinks)) {
      details[key] = value ?? null;
    }
  }
  return Object.keys(details).length ? details : null;
}

async function getLocalServerCapacity(localServerId: number) {
  const [{ activeCount }] = await db
    .select({ activeCount: count(vpnAccountsTable.id) })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.serverId, localServerId), eq(vpnAccountsTable.isActive, true), gt(vpnAccountsTable.expiresAt, new Date())));
  return Number(activeCount ?? 0);
}

async function refreshLocalDynamicServerCapacity(server: typeof dynamicProviderServersTable.$inferSelect) {
  if (server.provider !== "local_panel") return server;
  const localServerId = parseInt(server.providerServerId, 10);
  if (!Number.isInteger(localServerId)) return server;

  const [localServer] = await db.select().from(serversTable).where(eq(serversTable.id, localServerId)).limit(1);
  const capacityUsed = await getLocalServerCapacity(localServerId);
  const capacityLimit = localServer?.maxAccounts ?? Number(server.capacityLimit ?? 0) ?? 0;
  const capacityIsFull = capacityLimit > 0 ? capacityUsed >= capacityLimit : false;

  const [updated] = await db
    .update(dynamicProviderServersTable)
    .set({
      capacityLimit: capacityLimit > 0 ? String(capacityLimit) : null,
      capacityUsed,
      capacityIsFull,
      updatedAt: new Date(),
    })
    .where(eq(dynamicProviderServersTable.id, server.id))
    .returning();

  return updated ?? server;
}

async function fulfillDynamicOrder(orderId: number, userId: number) {
  logger.info({ orderId, userId }, "[dynamic-vpn] Starting fulfillDynamicOrder");

  const [order] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.id, orderId), eq(dynamicVpnOrdersTable.userId, userId)))
    .limit(1);

  if (!order) throw new Error("Order tidak ditemukan");
  if (order.status !== "processing") throw new Error("Order tidak dalam status processing");

  let [server] = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.id, order.dynamicServerId!))
    .limit(1);

  if (!server || !server.isActive) throw new Error("Server tidak aktif");
  server = await refreshLocalDynamicServerCapacity(server);
  if (server.capacityIsFull) throw new Error("Server penuh atau sedang tidak tersedia");

  const amount = Number(order.amount);
  const [buyer] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  logger.info({ orderId, userId, amount, provider: server.provider }, "[dynamic-vpn] Provider creation successful, proceeding to deduct balance");

  let providerResponse: any;
  let accountProtocol = order.protocol;
  let accountUsername = order.username;
  let providerPassword: string | null = order.password ?? null;
  let providerUuid: string | null = null;
  let providerAccountId: string | null = null;
  let configLink: string | null = null;
  let allLinks: Record<string, string | null> | null = null;
  let localServerId: number;
  if (!isDynamicDurationType(order.durationType)) throw new Error("Tipe durasi order tidak valid");
  calculateBaseQuote(server, order.durationType, order.duration);
  const fallbackExpiry = new Date(Date.now() + getDynamicDurationDays(order.durationType, order.duration) * 24 * 60 * 60 * 1000);
  let expiresAt = fallbackExpiry;
  let rollbackPanelAccount: null | { apiUrl: string; apiToken: string; protocol: string; username: string } = null;

  try {
    if (server.provider === "local_panel") {
      localServerId = parseInt(server.providerServerId, 10);
      if (!Number.isInteger(localServerId)) throw new Error("Mapping server lokal tidak valid");

      const [localServer] = await db.select().from(serversTable).where(eq(serversTable.id, localServerId)).limit(1);
      if (!localServer || !localServer.isActive) throw new Error("Server lokal tidak aktif");
      if (!localServer.apiUrl || !localServer.apiToken) throw new Error("API panel server lokal belum diatur");
      if (!Array.isArray(localServer.supportedProtocols) || !localServer.supportedProtocols.includes(order.protocol)) {
        throw new Error("Protocol tidak didukung server lokal");
      }

      const panelResult = await createPanelAccount({
        apiUrl: localServer.apiUrl,
        apiToken: localServer.apiToken,
        protocol: order.protocol,
        username: order.username,
        password: order.password ?? undefined,
        durationDays: getDynamicDurationDays(order.durationType, order.duration),
        uuid: randomUUID(),
        maxConnections: server.maxConnections ?? null,
      });

      rollbackPanelAccount = {
        apiUrl: localServer.apiUrl,
        apiToken: localServer.apiToken,
        protocol: order.protocol,
        username: panelResult.username,
      };
      accountUsername = panelResult.username;
      providerPassword = panelResult.password ?? order.password ?? null;
      providerUuid = panelResult.uuid ?? null;
      providerAccountId = panelResult.username;
      configLink = panelResult.configLink ?? null;
      allLinks = extractPanelConnectionDetails(panelResult);
      providerResponse = {
        provider: "local_panel",
        serverId: localServer.id,
        username: panelResult.username,
        uuid: panelResult.uuid ?? null,
        hostname: panelResult.hostname ?? null,
        expiryInfo: panelResult.expiryInfo ?? null,
      };
    } else {
      providerResponse = await createNadiaVpnOrder({
        server_id: order.providerServerId,
        protocol: order.protocol,
        type: order.durationType,
        duration: order.duration,
        username: order.username,
        ...(order.password ? { password: order.password } : {}),
      });

      let data = providerResponse?.data ?? {};
      let connectionResponse = providerResponse;
      providerAccountId = extractProviderAccountId(data);

      if (providerAccountId) {
        try {
          const detailResponse: any = await getNadiaVpnAccountDetails(providerAccountId);
          if (detailResponse?.data) {
            providerResponse = {
              order: providerResponse,
              details: detailResponse,
            };
            connectionResponse = detailResponse;
            data = detailResponse.data;
          }
        } catch (detailError) {
          logger.warn({ err: detailError, orderId, providerAccountId }, "[dynamic-vpn] failed to fetch Nadia account details after order");
        }
      }

      accountProtocol = normalizeProtocol(data.protocol ?? order.protocol);
      allLinks = extractConnectionDetails(connectionResponse, accountProtocol);
      configLink = accountProtocol === "ssh" ? null : allLinks?.tls ?? Object.values(allLinks ?? {}).find(Boolean) ?? null;
      providerPassword = data.password ?? data.config?.password ?? data.config_data?.password ?? order.password ?? null;
      providerUuid = data.uuid ?? data.config?.uuid ?? data.config_data?.uuid ?? null;
      providerAccountId = providerAccountId ?? extractProviderAccountId(data);
      accountUsername = data.username ?? data.config?.username ?? data.config_data?.username ?? order.username;
      localServerId = await getKetantechProviderServerId();
      expiresAt = parseNadiaExpireAt(data.expire_at, fallbackExpiry);
    }
  } catch (error) {
    logger.error({ err: error, orderId, userId }, "[dynamic-vpn] Provider order creation failed - no balance was deducted");
    throw error;
  }

  // Deduct balance ONLY after successful provider creation (protect user saldo)
  // This ensures: if provider create fails, no money is touched.
  // If later DB tx fails, money is refunded (see catch below).
  const [updatedUser] = await db
    .update(usersTable)
    .set({ balance: sql`balance - ${amount}` })
    .where(and(eq(usersTable.id, userId), sql`balance >= ${amount}::numeric`))
    .returning({ balance: usersTable.balance });

  if (!updatedUser) {
    if (rollbackPanelAccount) {
      await deletePanelAccount(rollbackPanelAccount).catch(() => {});
    }
    logger.warn({ orderId, userId, amount }, "[dynamic-vpn] Insufficient balance after provider success - refunding not needed as deduction didn't happen, rolling back panel");
    throw new Error("INSUFFICIENT_BALANCE");
  }
  const balanceAfter = Number(updatedUser.balance);
  const balanceBefore = balanceAfter + amount;
  logger.info({ orderId, userId, balanceBefore, balanceAfter, amount }, "[dynamic-vpn] Balance deducted successfully for dynamic order");

  try {
    await db.transaction(async (tx: any) => {
      const [account] = await tx
        .insert(vpnAccountsTable)
        .values({
          userId,
          orderId: null,
          protocol: accountProtocol,
          username: accountUsername,
          password: providerPassword,
          uuid: providerUuid,
          serverId: localServerId,
          configLink,
          allLinks,
          expiresAt,
          quota: null,
        })
        .returning();

      await tx
        .update(dynamicVpnOrdersTable)
        .set({
          status: "paid",
          vpnAccountId: account.id,
          providerAccountId,
          providerResponse,
          updatedAt: new Date(),
        })
        .where(eq(dynamicVpnOrdersTable.id, orderId));

      if (order.voucherId) {
        await tx
          .update(vouchersTable)
          .set({ currentUses: sql`current_uses + 1`, updatedAt: new Date() })
          .where(eq(vouchersTable.id, order.voucherId));
      }
    });
  } catch (error) {
    // Refund balance if DB tx fails after deduction
    logger.error({ err: error, orderId, userId, amount }, "[dynamic-vpn] DB transaction failed after balance deduction - attempting refund and panel rollback");
    await db.update(usersTable).set({ balance: sql`balance + ${amount}` }).where(eq(usersTable.id, userId)).catch(() => {});
    if (rollbackPanelAccount) {
      await deletePanelAccount(rollbackPanelAccount).catch((deleteErr) => {
        logger.error({ err: deleteErr, orderId, username: rollbackPanelAccount?.username }, "[dynamic-vpn] failed to rollback local panel account");
      });
    }
    logger.warn({ orderId, userId, amount }, "[dynamic-vpn] Balance refunded and panel rolled back due to DB tx failure");
    throw error;
  }

  logger.info({ orderId, userId, amount, balanceBefore, balanceAfter }, "[dynamic-vpn] DB transaction successful, balance change recorded via log");

  addBalanceLog({
    userId,
    type: "order",
    amount: -amount,
    balanceBefore,
    balanceAfter,
    description: `Dynamic VPN order: ${order.serverDisplayName} ${order.protocol.toUpperCase()} ${order.duration} ${order.durationType}`,
    relatedId: order.id,
  }).catch(() => {});

  if (server.provider === "local_panel") {
    const refreshed = await refreshLocalDynamicServerCapacity(server).catch(() => null);
    if (refreshed) server = refreshed;
  }

  const host = allLinks?.hostname ?? null;
  notifyUserDynamicVpnAccountCreated({
    userId,
    orderId: order.id,
    serverName: order.serverDisplayName,
    protocol: accountProtocol,
    username: accountUsername,
    password: providerPassword,
    host,
    configLink,
    expiresAt,
  }).catch((err) => logger.error({ err, orderId }, "notifyUserDynamicVpnAccountCreated failed"));

  notifyAdminDynamicOrderFulfilled({
    orderId: order.id,
    buyerUsername: buyer?.username ?? `User #${userId}`,
    serverName: order.serverDisplayName,
    protocol: accountProtocol,
    vpnUsername: accountUsername,
    amount,
    discountAmount: Number(order.discountAmount ?? 0),
    paymentMethod: order.paymentMethod,
    providerAccountId,
  }).catch((err) => logger.error({ err, orderId }, "notifyAdminDynamicOrderFulfilled failed"));
}

async function syncNadiaVpnServersFromProvider() {
  const response: any = await getNadiaVpnServers();
  const servers = response?.data?.servers ?? [];
  const now = new Date();
  const synced = [];
  const priceChanges: {
    serverName: string;
    provider: string;
    costPerDayOld: number;
    costPerDayNew: number;
    costPerWeekOld: number;
    costPerWeekNew: number;
    costPerMonthOld: number;
    costPerMonthNew: number;
  }[] = [];

  // Ambil default markup % dari admin settings
  const rawDefaultMarkup = await getSettingValue("dynamicDefaultMarkupPercent");
  const defaultMarkup = rawDefaultMarkup ? parseInt(rawDefaultMarkup, 10) : 30;

  for (const srv of servers) {
    const providerServerId = String(srv.server_id);
    const [existing] = await db
      .select()
      .from(dynamicProviderServersTable)
      .where(and(eq(dynamicProviderServersTable.provider, "nadiavpn"), eq(dynamicProviderServersTable.providerServerId, providerServerId)))
      .limit(1);

    const supportedProtocols = Array.isArray(srv.supported_protocols) ? srv.supported_protocols.map(normalizeProtocol).filter(Boolean) : [];
    const supportedTypes = Array.isArray(srv.supported_types) ? srv.supported_types.map(normalizeDurationType).filter((t: string) => VALID_TYPES.includes(t as DynamicDurationType)) : [];
    const costDay = Number(srv.pricing?.per_day ?? 0);
    const costWeek = Number(srv.pricing?.per_week ?? 0);
    const costMonth = Number(srv.pricing?.per_month ?? 0);

    // Tentukan markup: pakai existing atau default dari settings
    const markupPercent = existing?.markupPercent ?? defaultMarkup;
    const pricingMode = existing?.pricingMode ?? "auto_markup";

    // Hitung harga jual berdasarkan mode
    let sellDay: string;
    let sellWeek: string;
    let sellMonth: string;
    if (pricingMode === "auto_markup") {
      // Auto: hitung dari cost + markup %
      sellDay = String(applyMarkup(costDay, markupPercent));
      sellWeek = String(applyMarkup(costWeek, markupPercent));
      sellMonth = String(applyMarkup(costMonth, markupPercent));
    } else {
      // Manual: pertahankan harga yang sudah diset admin, atau fallback
      sellDay = existing?.sellPricePerDay ?? String(Math.max(costDay, 1000));
      sellWeek = existing?.sellPricePerWeek ?? String(Math.max(costWeek, 1000));
      sellMonth = existing?.sellPricePerMonth ?? String(Math.max(costMonth, 10000));
    }

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
      renewEnabled: srv.renew_enabled !== false,
      costPerDay: String(costDay),
      costPerWeek: String(costWeek),
      costPerMonth: String(costMonth),
      sellPricePerDay: sellDay,
      sellPricePerWeek: sellWeek,
      sellPricePerMonth: sellMonth,
      pricingMode,
      markupPercent,
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

    // Deteksi perubahan harga cost dari provider
    if (existing) {
      const oldCostDay = Number(existing.costPerDay ?? 0);
      const oldCostWeek = Number(existing.costPerWeek ?? 0);
      const oldCostMonth = Number(existing.costPerMonth ?? 0);
      if (oldCostDay !== costDay || oldCostWeek !== costWeek || oldCostMonth !== costMonth) {
        priceChanges.push({
          serverName: existing.displayName ?? String(srv.name ?? providerServerId),
          provider: "nadiavpn",
          costPerDayOld: oldCostDay,
          costPerDayNew: costDay,
          costPerWeekOld: oldCostWeek,
          costPerWeekNew: costWeek,
          costPerMonthOld: oldCostMonth,
          costPerMonthNew: costMonth,
        });
      }
    }

    const [row] = existing
      ? await db.update(dynamicProviderServersTable).set(values).where(eq(dynamicProviderServersTable.id, existing.id)).returning()
      : await db.insert(dynamicProviderServersTable).values({ provider: "nadiavpn", providerServerId, ...values }).returning();
    synced.push(formatServer(row, true));
  }

  // Kirim notifikasi Telegram jika ada perubahan harga
  if (priceChanges.length > 0) {
    notifyAdminPriceChanged(priceChanges).catch((err) =>
      logger.error({ err }, "notifyAdminPriceChanged failed")
    );
  }

  return synced;
}

async function syncLocalPanelServers() {
  const localServers = await db.select().from(serversTable).where(eq(serversTable.isActive, true)).orderBy(asc(serversTable.sortOrder), asc(serversTable.id));
  const now = new Date();
  const synced = [];

  for (const srv of localServers) {
    const providerServerId = String(srv.id);
    const [existing] = await db
      .select()
      .from(dynamicProviderServersTable)
      .where(and(eq(dynamicProviderServersTable.provider, "local_panel"), eq(dynamicProviderServersTable.providerServerId, providerServerId)))
      .limit(1);

    const supportedProtocols = Array.isArray(srv.supportedProtocols)
      ? srv.supportedProtocols.map(normalizeProtocol).filter((p: string) => VALID_PROTOCOLS.includes(p))
      : [];
    const capacityUsed = await getLocalServerCapacity(srv.id);
    const capacityLimit = srv.maxAccounts ?? 0;
    const capacityIsFull = capacityLimit > 0 ? capacityUsed >= capacityLimit : false;
    const values = {
      providerName: srv.name,
      displayName: existing?.displayName ?? srv.name,
      location: srv.location ?? null,
      supportedProtocols,
      enabledProtocols: existing?.enabledProtocols?.length ? existing.enabledProtocols.filter((p: string) => supportedProtocols.includes(p)) : supportedProtocols,
      supportedTypes: ["day", "month"],
      providerTrialEnabled: false,
      trialEnabled: existing?.trialEnabled ?? false,
      trialDuration: existing?.trialDuration ?? null,
      renewEnabled: true,
      costPerDay: existing?.costPerDay ?? "0",
      costPerWeek: "0",
      costPerMonth: existing?.costPerMonth ?? "0",
      sellPricePerDay: existing?.sellPricePerDay ?? "0",
      sellPricePerWeek: "0",
      sellPricePerMonth: existing?.sellPricePerMonth ?? "0",
      minDays: existing?.minDays ?? 1,
      maxDays: existing?.maxDays ?? 30,
      minMonths: existing?.minMonths ?? 1,
      maxMonths: existing?.maxMonths ?? 12,
      capacityLimit: capacityLimit > 0 ? String(capacityLimit) : null,
      capacityUsed,
      capacityIsFull,
      maxConnections: existing?.maxConnections ?? 0,
      isActive: existing?.isActive ?? false,
      sortOrder: existing?.sortOrder ?? srv.sortOrder ?? 0,
      lastSyncedAt: now,
      updatedAt: now,
    };

    const [row] = existing
      ? await db.update(dynamicProviderServersTable).set(values).where(eq(dynamicProviderServersTable.id, existing.id)).returning()
      : await db.insert(dynamicProviderServersTable).values({ provider: "local_panel", providerServerId, ...values }).returning();
    synced.push(formatServer(row, true));
  }

  return synced;
}

router.get("/admin/dynamic-vpn/servers", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(dynamicProviderServersTable).orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, true)) });
});

router.post("/admin/dynamic-vpn/servers/sync/nadiavpn", requireAdmin, async (req, res) => {
  const synced = await syncNadiaVpnServersFromProvider();
  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "sync_nadiavpn_servers",
    targetType: "dynamic_server",
    targetId: null,
    details: { total: synced.length },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});
  res.json({ success: true, total: synced.length, servers: synced });
});

router.post("/admin/dynamic-vpn/servers/sync/local-panel", requireAdmin, async (req, res) => {
  const synced = await syncLocalPanelServers();
  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "sync_local_panel_servers",
    targetType: "dynamic_server",
    targetId: null,
    details: { total: synced.length },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});
  res.json({ success: true, total: synced.length, servers: synced });
});

router.get("/admin/dynamic-vpn/orders", requireAdmin, async (req, res) => {
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
      ...order,
      amount: Number(order.amount),
      discountAmount: Number(order.discountAmount ?? 0),
      providerResponse: undefined,
      buyer: { username: buyerUsername, email: buyerEmail },
      voucherCode: voucherCode ?? null,
    })),
  });
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
  if (body.sellPricePerWeek !== undefined) update.sellPricePerWeek = String(Math.max(0, Number(body.sellPricePerWeek)));
  if (body.sellPricePerMonth !== undefined) update.sellPricePerMonth = String(Math.max(0, Number(body.sellPricePerMonth)));
  if (body.minDays !== undefined) update.minDays = Math.max(1, parseInt(String(body.minDays), 10));
  if (body.maxDays !== undefined) update.maxDays = Math.max(1, parseInt(String(body.maxDays), 10));
  if (body.minMonths !== undefined) update.minMonths = Math.max(1, parseInt(String(body.minMonths), 10));
  if (body.maxMonths !== undefined) update.maxMonths = Math.max(1, parseInt(String(body.maxMonths), 10));
  if (body.maxConnections !== undefined) update.maxConnections = Math.max(0, parseInt(String(body.maxConnections), 10) || 0);
  if (body.sortOrder !== undefined) update.sortOrder = parseInt(String(body.sortOrder), 10) || 0;
  if (body.pricingMode !== undefined) update.pricingMode = body.pricingMode === "auto_markup" ? "auto_markup" : "manual";
  if (body.markupPercent !== undefined) update.markupPercent = Math.max(0, Math.min(1000, parseInt(String(body.markupPercent), 10) || 0));

  // Jika mode auto_markup, recalculate sell price dari cost yang ada di DB
  const newMode = update.pricingMode as string | undefined;
  const newMarkup = update.markupPercent as number | undefined;
  if (newMode === "auto_markup" || newMarkup !== undefined) {
    // Ambil data server saat ini untuk mendapatkan cost
    const [current] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, id)).limit(1);
    if (current) {
      const mode = (newMode ?? current.pricingMode) as string;
      const markup = newMarkup ?? current.markupPercent;
      if (mode === "auto_markup") {
        update.sellPricePerDay = String(applyMarkup(Number(current.costPerDay ?? 0), markup));
        update.sellPricePerWeek = String(applyMarkup(Number(current.costPerWeek ?? 0), markup));
        update.sellPricePerMonth = String(applyMarkup(Number(current.costPerMonth ?? 0), markup));
      }
    }
  }

  const [row] = await db.update(dynamicProviderServersTable).set(update).where(eq(dynamicProviderServersTable.id, id)).returning();
  if (!row) return sendError(res, 404, "Server tidak ditemukan");

  // Audit log
  const adminId = req.user!.userId;
  logAdminAction({
    adminUserId: adminId,
    action: "update_dynamic_server",
    targetType: "dynamic_server",
    targetId: id,
    details: { changes: body },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.json(formatServer(row, true));
});

// Public endpoint (no auth) — untuk landing page
router.get("/dynamic-vpn/public-servers", async (_req, res) => {
  const rows = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.isActive, true))
    .orderBy(asc(dynamicProviderServersTable.sortOrder), asc(dynamicProviderServersTable.id));
  res.json({ servers: rows.map((row) => formatServer(row, false)) });
});

router.get("/dynamic-vpn/servers", requireAuth, async (_req, res) => {
  try {
    await syncNadiaVpnServersFromProvider();
  } catch (error) {
    logger.warn({ err: error }, "[dynamic-vpn] stock sync failed, using cached Nadia servers");
  }
  try {
    await syncLocalPanelServers();
  } catch (error) {
    logger.warn({ err: error }, "[dynamic-vpn] local panel sync failed, using cached local servers");
  }

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
});

router.post("/dynamic-vpn/orders", requireAuth, dynamicOrderLimiter, async (req, res) => {
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

  try {
    await syncNadiaVpnServersFromProvider();
  } catch (error) {
    logger.warn({ err: error }, "[dynamic-vpn] stock sync before order failed, using cached Nadia state");
  }
  try {
    await syncLocalPanelServers();
  } catch (error) {
    logger.warn({ err: error }, "[dynamic-vpn] local sync before order failed, using cached local state");
  }

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
      voucherId: quote.voucherId,
      discountAmount: String(quote.discountAmount),
      status: "pending",
      paymentMethod,
    })
    .returning();

  res.status(201).json({ order: { ...order, amount: Number(order.amount) }, quote });
});

router.post("/dynamic-vpn/orders/:id/pay", requireAuth, dynamicOrderLimiter, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const userId = req.user!.userId;

  const [locked] = await db
    .update(dynamicVpnOrdersTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(dynamicVpnOrdersTable.id, id), eq(dynamicVpnOrdersTable.userId, userId), eq(dynamicVpnOrdersTable.status, "pending")))
    .returning();

  if (!locked) return sendError(res, 409, "Order tidak ditemukan atau sedang diproses");

  logger.info({ orderId: id, userId }, "[dynamic-vpn] Order locked to processing, starting fulfill");

  try {
    await fulfillDynamicOrder(id, userId);
  } catch (error) {
    await db.update(dynamicVpnOrdersTable).set({ status: "pending", updatedAt: new Date() }).where(eq(dynamicVpnOrdersTable.id, id)).catch(() => {});
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "INSUFFICIENT_BALANCE") {
      logger.warn({ orderId: id, userId }, "Dynamic order pay failed due to insufficient balance (should have been caught earlier)");
      return sendError(res, 400, "Saldo tidak cukup");
    }
    logger.error({ err: error, orderId: id, userId }, "[dynamic-vpn] pay failed - order reset to pending, any necessary refunds handled inside fulfill");
    return sendError(res, 500, `Gagal memproses order: ${msg}`);
  }

  const [paid] = await db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.id, id)).limit(1);
  res.json({ order: { ...paid, amount: Number(paid.amount) } });
});

router.get("/dynamic-vpn/orders", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const limitRaw = req.query.limit;
  const limit = limitRaw ? Math.min(parseInt(String(limitRaw), 10) || 50, 100) : undefined;
  let q = db.select().from(dynamicVpnOrdersTable).where(eq(dynamicVpnOrdersTable.userId, userId)).orderBy(desc(dynamicVpnOrdersTable.createdAt));
  if (limit) q = q.limit(limit) as any;
  const rows = await q;
  res.json({ orders: rows.map((row) => ({ ...row, amount: Number(row.amount), providerResponse: undefined })) });
});

// ─── Admin: Profit Tracking per Server ────────────────────────────────────────

router.get("/admin/stats/profit-tracking", requireAdmin, async (req, res) => {
  try {
    const monthParam = typeof req.query.month === "string" ? req.query.month : "";
    const now = new Date();

    // Parse period
    let periodStart: Date;
    let periodEnd: Date;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [year, month] = monthParam.split("-").map(Number);
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 1);
    } else {
      // Default: bulan ini
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    // Ambil paid dynamic orders dalam period
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
          lt(dynamicVpnOrdersTable.createdAt, periodEnd)
        )
      );

    // Ambil semua servers untuk cost lookup
    const allServers = await db.select().from(dynamicProviderServersTable);
    const serverMap = new Map(allServers.map((s) => [s.id, s]));

    // Aggregate per server
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

      // Hitung cost berdasarkan durationType
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

    // Format servers array, sorted by revenue desc
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
  } catch (err) {
    logger.error({ err }, "[admin] profit-tracking failed");
    sendError(res, 500, "Gagal menghitung profit tracking");
  }
});

export default router;

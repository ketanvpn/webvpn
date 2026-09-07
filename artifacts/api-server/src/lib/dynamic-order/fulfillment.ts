import {
  db,
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  serversTable,
  usersTable,
  vouchersTable,
  vpnAccountsTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNadiaVpnOrder, getNadiaVpnAccountDetails } from "../nadiavpn";
import { createPanelAccount } from "../vpn-panel";
import { deletePanelAccountWithRetry } from "../fulfillment/retry-utils";
import { addBalanceLog } from "../../routes/balance-logs";
import { addPoints, getPointsSettings } from "../../routes/points";
import { notifyAdminDynamicOrderFulfilled, notifyUserDynamicVpnAccountCreated } from "../telegram";
import { logger } from "../logger";
import { getDynamicDurationDays, isDynamicDurationType } from "../dynamic-duration";
import { calculateBaseQuote } from "./pricing";
import { refreshLocalDynamicServerCapacity } from "./sync";

// ─── Helper functions ─────────────────────────────────────────────────────────

function normalizeProtocol(protocol: unknown) {
  return String(protocol ?? "").trim().toLowerCase();
}

function stringifyConfigValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function parseNadiaExpireAt(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.replace(" ", "T") + "+07:00";
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function extractConnectionDetails(response: any, protocol: string): Record<string, string | null> | null {
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

export function extractProviderAccountId(data: any): string | null {
  return stringifyConfigValue(
    data?.account_id ??
    data?.accountId ??
    data?.id ??
    data?.account?.account_id ??
    data?.account?.id,
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

async function getKetantechProviderServerId() {
  const [existing] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.host, "premium.ketantech.provider"))
    .limit(1);

  if (existing) return existing.id;

  const VALID_PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
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

// ─── Fulfillment Step Tracker ─────────────────────────────────────────────────

type FulfillmentStep =
  | "order_validated"
  | "server_validated"
  | "provider_account_created"
  | "db_transaction_committed"
  | "post_commit_started";

interface StepEntry {
  step: FulfillmentStep;
  ts: number;
}

function createStepTracker(orderId: number, userId: number) {
  const steps: StepEntry[] = [];

  return {
    mark(step: FulfillmentStep) {
      steps.push({ step, ts: Date.now() });
      logger.debug({ orderId, userId, step }, "[dynamic-vpn] fulfillment step");
    },
    /** Logs all completed steps on failure for debugging / orphan recovery */
    logFailure(error: unknown) {
      logger.error(
        { orderId, userId, completedSteps: steps.map((s) => s.step), err: error },
        "[dynamic-vpn] fulfillment failed — completed steps listed for recovery",
      );
    },
  };
}

// ─── Main fulfillment function ────────────────────────────────────────────────

/**
 * Fulfills a dynamic VPN order.
 *
 * **Critical fix**: Balance deduction is now INSIDE the database transaction,
 * ensuring atomic rollback if any step fails. Previously, balance was deducted
 * outside the transaction, requiring a manual refund attempt that could fail
 * and cause money loss.
 *
 * Flow:
 * 1. Validate order + server
 * 2. Create VPN account on provider (NadiaVPN or local panel)
 * 3. Inside a single DB transaction:
 *    a. Deduct user balance (atomic WHERE balance >= amount)
 *    b. Insert VPN account record
 *    c. Update order status to "paid"
 *    d. Increment voucher usage (if applicable)
 * 4. If DB transaction fails → rollback panel account (best effort)
 * 5. Fire-and-forget: balance log, points, notifications
 */
export async function fulfillDynamicOrder(orderId: number, userId: number) {
  logger.info({ orderId, userId }, "[dynamic-vpn] Starting fulfillDynamicOrder");
  const tracker = createStepTracker(orderId, userId);

  const [order] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(and(eq(dynamicVpnOrdersTable.id, orderId), eq(dynamicVpnOrdersTable.userId, userId)))
    .limit(1);

  if (!order) throw new Error("Order tidak ditemukan");
  if (order.status !== "processing") throw new Error("Order tidak dalam status processing");
  tracker.mark("order_validated");

  let [server] = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.id, order.dynamicServerId!))
    .limit(1);

  if (!server || !server.isActive) throw new Error("Server tidak aktif");
  server = await refreshLocalDynamicServerCapacity(server);
  if (server.capacityIsFull) throw new Error("Server penuh atau sedang tidak tersedia");
  tracker.mark("server_validated");

  const amount = Number(order.amount);
  const [buyer] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!isDynamicDurationType(order.durationType)) throw new Error("Tipe durasi order tidak valid");
  calculateBaseQuote(server, order.durationType, order.duration);
  const fallbackExpiry = new Date(Date.now() + getDynamicDurationDays(order.durationType, order.duration) * 24 * 60 * 60 * 1000);

  // ─── Step 1: Create account on provider ────────────────────────────────

  let providerResponse: any;
  let accountProtocol = order.protocol;
  let accountUsername = order.username;
  let providerPassword: string | null = order.password ?? null;
  let providerUuid: string | null = null;
  let providerAccountId: string | null = null;
  let configLink: string | null = null;
  let allLinks: Record<string, string | null> | null = null;
  let localServerId: number;
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
    tracker.logFailure(error);
    logger.error({ err: error, orderId, userId }, "[dynamic-vpn] Provider order creation failed - no balance was deducted");
    throw error;
  }

  tracker.mark("provider_account_created");

  logger.info({ orderId, userId, amount, provider: server.provider }, "[dynamic-vpn] Provider creation successful, proceeding to atomic balance + DB commit");

  // ─── Step 2: ATOMIC transaction (balance deduction + DB records) ───────
  //
  // CRITICAL FIX: Balance deduction is now INSIDE the transaction.
  // If any step fails (insert vpn account, update order, voucher increment),
  // the entire transaction rolls back INCLUDING the balance deduction.
  // No manual refund needed, no risk of money loss.

  let balanceBefore: number;
  let balanceAfter: number;

  try {
    const result = await db.transaction(async (tx: any) => {
      // Deduct balance atomically — fails if insufficient
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`balance - ${amount}` })
        .where(and(eq(usersTable.id, userId), sql`balance >= ${amount}::numeric`))
        .returning({ balance: usersTable.balance });

      if (!updatedUser) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const bAfter = Number(updatedUser.balance);
      const bBefore = bAfter + amount;

      // Insert VPN account record
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

      // Update order to "paid"
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

      // Increment voucher usage
      if (order.voucherId) {
        await tx
          .update(vouchersTable)
          .set({ currentUses: sql`current_uses + 1`, updatedAt: new Date() })
          .where(eq(vouchersTable.id, order.voucherId));
      }

      return { balanceBefore: bBefore, balanceAfter: bAfter };
    });

    balanceBefore = result.balanceBefore;
    balanceAfter = result.balanceAfter;
    tracker.mark("db_transaction_committed");
  } catch (error) {
    // Transaction failed — balance was NOT deducted (atomic rollback).
    // Only need to clean up the provider-side account.
    if (rollbackPanelAccount) {
      await deletePanelAccountWithRetry(rollbackPanelAccount, {
        orderId,
        userId,
        reason: error instanceof Error ? error.message : "DB transaction failed",
      });
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      logger.warn({ orderId, userId, amount }, "[dynamic-vpn] Insufficient balance - rolling back panel account");
    } else {
      tracker.logFailure(error);
      logger.error({ err: error, orderId, userId, amount }, "[dynamic-vpn] DB transaction failed - balance NOT deducted (atomic rollback), panel account rolled back");
    }
    throw error;
  }

  logger.info({ orderId, userId, amount, balanceBefore, balanceAfter }, "[dynamic-vpn] Atomic transaction successful");
  tracker.mark("post_commit_started");

  // ─── Step 3: Post-commit side effects (fire-and-forget) ────────────────

  addBalanceLog({
    userId,
    type: "order",
    amount: -amount,
    balanceBefore,
    balanceAfter,
    description: `Dynamic VPN order: ${order.serverDisplayName} ${order.protocol.toUpperCase()} ${order.duration} ${order.durationType}`,
    relatedId: order.id,
  }).catch((err) => logger.error({ err, orderId: order.id }, "[dynamic-vpn] addBalanceLog failed after dynamic order"));

  // Award loyalty points
  try {
    const settings = await getPointsSettings();
    if (
      settings.enabled &&
      amount >= settings.pointsMinOrder &&
      settings.pointsRateOrder > 0
    ) {
      const points = Math.floor(amount / settings.pointsRateOrder);
      if (points > 0) {
        await addPoints(
          userId,
          points,
          "order",
          `Dynamic VPN #${order.id} — ${order.serverDisplayName}`,
          order.id,
        );
      }
    }
  } catch (err) {
    logger.error({ err, orderId: order.id }, "[dynamic-vpn] addPoints failed after dynamic order");
  }

  // Refresh local server capacity
  if (server.provider === "local_panel") {
    const refreshed = await refreshLocalDynamicServerCapacity(server).catch(() => null);
    if (refreshed) server = refreshed;
  }

  // Send notifications
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

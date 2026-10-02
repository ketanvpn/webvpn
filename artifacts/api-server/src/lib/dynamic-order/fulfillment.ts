import {
  db,
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  serversTable,
  usersTable,
  vouchersTable,
  vpnAccountsTable,
} from "@workspace/db";
import type { DynamicProviderServer, DynamicVpnOrder } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNadiaVpnOrder, getNadiaVpnAccountDetails } from "../nadiavpn";
import type { NadiaVpnOrderResponse, NadiaVpnAccountDetailResponse } from "../nadiavpn";
import { createPanelAccount } from "../vpn-panel";
import { deletePanelAccountWithRetry, deleteNadiaVpnAccountWithRetry } from "../fulfillment/retry-utils";
import { addBalanceLog } from "../../routes/balance-logs";
import { addPoints, getPointsSettings } from "../../routes/points";
import { notifyAdminDynamicOrderFulfilled, notifyUserDynamicVpnAccountCreated } from "../telegram";
import { logger } from "../logger";
import { getDynamicDurationDays, isDynamicDurationType } from "../dynamic-duration";
import type { DynamicDurationType } from "../dynamic-duration";
import { calculateBaseQuote } from "./pricing";
import { extractNadiaConnectionDetails, extractProviderAccountId } from "./connection-parser";
import { refreshLocalDynamicServerCapacity } from "./sync";
import { normalizeProtocol } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidatedOrderContext {
  order: DynamicVpnOrder;
  server: DynamicProviderServer;
  buyerUsername: string;
  amount: number;
  durationType: DynamicDurationType;
  fallbackExpiry: Date;
}

interface ProviderAccountResult {
  providerResponse: Record<string, unknown>;
  accountProtocol: string;
  accountUsername: string;
  providerPassword: string | null;
  providerUuid: string | null;
  providerAccountId: string | null;
  configLink: string | null;
  allLinks: Record<string, string | null> | null;
  localServerId: number;
  expiresAt: Date;
  rollbackPanelAccount: RollbackTarget | null;
}

interface RollbackTarget {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function parseNadiaExpireAt(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const normalized = value.replace(" ", "T") + "+07:00";
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
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

// ─── Phase 1: Validate order and server ───────────────────────────────────────

async function validateOrderAndServer(
  orderId: number,
  userId: number,
  tracker: ReturnType<typeof createStepTracker>,
): Promise<ValidatedOrderContext> {
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
  const durationType = order.durationType;
  calculateBaseQuote(server, durationType, order.duration);
  const fallbackExpiry = new Date(Date.now() + getDynamicDurationDays(durationType, order.duration) * 24 * 60 * 60 * 1000);

  return {
    order,
    server,
    buyerUsername: buyer?.username ?? `User #${userId}`,
    amount,
    durationType,
    fallbackExpiry,
  };
}

// ─── Phase 2: Create account on provider ──────────────────────────────────────

async function createLocalPanelAccount(
  order: DynamicVpnOrder,
  server: DynamicProviderServer,
  durationType: DynamicDurationType,
  fallbackExpiry: Date,
): Promise<ProviderAccountResult> {
  const localServerId = parseInt(server.providerServerId, 10);
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
    durationDays: getDynamicDurationDays(durationType, order.duration),
    uuid: randomUUID(),
    maxConnections: server.maxConnections ?? null,
  });

  return {
    providerResponse: {
      provider: "local_panel",
      serverId: localServer.id,
      username: panelResult.username,
      uuid: panelResult.uuid ?? null,
      hostname: panelResult.hostname ?? null,
      expiryInfo: panelResult.expiryInfo ?? null,
    },
    accountProtocol: order.protocol,
    accountUsername: panelResult.username,
    providerPassword: panelResult.password ?? order.password ?? null,
    providerUuid: panelResult.uuid ?? null,
    providerAccountId: panelResult.username,
    configLink: panelResult.configLink ?? null,
    allLinks: extractPanelConnectionDetails(panelResult),
    localServerId,
    expiresAt: fallbackExpiry,
    rollbackPanelAccount: {
      apiUrl: localServer.apiUrl,
      apiToken: localServer.apiToken,
      protocol: order.protocol,
      username: panelResult.username,
    },
  };
}

async function createNadiaVpnProviderAccount(
  order: DynamicVpnOrder,
  server: DynamicProviderServer,
  durationType: DynamicDurationType,
  fallbackExpiry: Date,
): Promise<ProviderAccountResult> {
  const orderResponse = await createNadiaVpnOrder({
    server_id: order.providerServerId,
    protocol: order.protocol,
    type: durationType,
    duration: order.duration,
    username: order.username,
    ...(order.password ? { password: order.password } : {}),
  });

  let providerResponse: Record<string, unknown> = orderResponse as unknown as Record<string, unknown>;
  let data = orderResponse.data;
  let connectionResponse: NadiaVpnOrderResponse | NadiaVpnAccountDetailResponse = orderResponse;
  let providerAccountId = extractProviderAccountId(data);

  if (providerAccountId) {
    try {
      const detailResponse = await getNadiaVpnAccountDetails(providerAccountId);
      if (detailResponse?.data) {
        providerResponse = { order: orderResponse, details: detailResponse };
        connectionResponse = detailResponse;
        data = detailResponse.data;
      }
    } catch (detailError) {
      logger.warn({ err: detailError, orderId: order.id, providerAccountId }, "[dynamic-vpn] failed to fetch Nadia account details after order");
    }
  }

  const accountProtocol = normalizeProtocol(data.protocol ?? order.protocol);
  let allLinks = extractNadiaConnectionDetails(connectionResponse, accountProtocol);
  const configLink = accountProtocol === "ssh" ? null : allLinks?.tls ?? Object.values(allLinks ?? {}).find(Boolean) ?? null;
  const providerPassword = (data.password ?? data.config?.password ?? data.config_data?.password ?? order.password ?? null) as string | null;
  const providerUuid = (data.uuid ?? data.config?.uuid ?? data.config_data?.uuid ?? null) as string | null;
  providerAccountId = providerAccountId ?? extractProviderAccountId(data);
  const accountUsername = (data.username ?? data.config?.username ?? data.config_data?.username ?? order.username) as string;
  const localServerId = await getKetantechProviderServerId();
  const expiresAt = parseNadiaExpireAt(data.expire_at, fallbackExpiry);

  // Inject CloudFront domain from server catalog if not present in account data
  if (allLinks && !allLinks.cloudfront && server.domainCloudfront) {
    allLinks.cloudfront = server.domainCloudfront;
  }

  return {
    providerResponse,
    accountProtocol,
    accountUsername,
    providerPassword,
    providerUuid,
    providerAccountId,
    configLink,
    allLinks,
    localServerId,
    expiresAt,
    rollbackPanelAccount: null,
  };
}

async function createProviderAccount(
  order: DynamicVpnOrder,
  server: DynamicProviderServer,
  durationType: DynamicDurationType,
  fallbackExpiry: Date,
): Promise<ProviderAccountResult> {
  if (server.provider === "local_panel") {
    return createLocalPanelAccount(order, server, durationType, fallbackExpiry);
  }
  return createNadiaVpnProviderAccount(order, server, durationType, fallbackExpiry);
}

// ─── Phase 3: Atomic DB transaction ───────────────────────────────────────────

interface CommitParams {
  orderId: number;
  userId: number;
  amount: number;
  order: DynamicVpnOrder;
  server: DynamicProviderServer;
  tracker: ReturnType<typeof createStepTracker>;
  account: ProviderAccountResult;
}

async function commitFulfillmentTransaction(params: CommitParams): Promise<{ balanceBefore: number; balanceAfter: number }> {
  const { orderId, userId, amount, order, server, tracker, account } = params;

  try {
    const result = await db.transaction(async (tx: any) => {
      // Deduct balance atomically — fails if insufficient
      const [updatedUser] = await (tx as typeof db)
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
      const [vpnAccount] = await (tx as typeof db)
        .insert(vpnAccountsTable)
        .values({
          userId,
          orderId: null,
          protocol: account.accountProtocol,
          username: account.accountUsername,
          password: account.providerPassword,
          uuid: account.providerUuid,
          serverId: account.localServerId,
          configLink: account.configLink,
          allLinks: account.allLinks,
          expiresAt: account.expiresAt,
          quota: null,
        })
        .returning();

      // Update order to "paid"
      await (tx as typeof db)
        .update(dynamicVpnOrdersTable)
        .set({
          status: "paid",
          vpnAccountId: vpnAccount.id,
          providerAccountId: account.providerAccountId,
          providerResponse: account.providerResponse,
          updatedAt: new Date(),
        })
        .where(eq(dynamicVpnOrdersTable.id, orderId));

      // Increment voucher usage (atomic guard against over-redemption)
      if (order.voucherId) {
        const [updatedVoucher] = await (tx as typeof db)
          .update(vouchersTable)
          .set({ currentUses: sql`current_uses + 1`, updatedAt: new Date() })
          .where(
            and(
              eq(vouchersTable.id, order.voucherId),
              sql`(max_uses IS NULL OR current_uses < max_uses)`,
            ),
          )
          .returning({ id: vouchersTable.id });

        if (!updatedVoucher) {
          throw new Error("Voucher sudah mencapai batas penggunaan");
        }
      }

      return { balanceBefore: bBefore, balanceAfter: bAfter };
    });

    tracker.mark("db_transaction_committed");
    return result;
  } catch (error) {
    // Transaction failed — balance was NOT deducted (atomic rollback).
    // Only need to clean up the provider-side account.
    const rollbackReason = error instanceof Error ? error.message : "DB transaction failed";

    if (account.rollbackPanelAccount) {
      await deletePanelAccountWithRetry(account.rollbackPanelAccount, {
        orderId,
        userId,
        reason: rollbackReason,
      });
    }

    if (server.provider === "nadiavpn" && account.providerAccountId) {
      await deleteNadiaVpnAccountWithRetry(account.providerAccountId, {
        orderId,
        userId,
        reason: rollbackReason,
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
}

// ─── Phase 4: Post-commit side effects ────────────────────────────────────────

function resolveNotificationHost(
  allLinks: Record<string, string | null> | null,
  serverDisplayName: string,
): string | null {
  const cfValue = allLinks?.cloudfront;
  const isCfServer = /cloudfront/i.test(serverDisplayName);
  const cfHasPriority = isCfServer && cfValue && cfValue.toLowerCase().endsWith(".cloudfront.net");

  if (cfHasPriority) return cfValue;
  if (allLinks?.domain) return allLinks.domain;
  if (isCfServer && cfValue) return cfValue;
  return allLinks?.host ?? allLinks?.server ?? allLinks?.sni
    ?? allLinks?.servername ?? allLinks?.hostname ?? null;
}

interface PostCommitParams {
  order: DynamicVpnOrder;
  userId: number;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  buyerUsername: string;
  server: DynamicProviderServer;
  account: ProviderAccountResult;
}

async function runPostCommitSideEffects(params: PostCommitParams): Promise<void> {
  const { order, userId, amount, balanceBefore, balanceAfter, buyerUsername, server, account } = params;
  const orderId = order.id;

  // Balance log
  addBalanceLog({
    userId,
    type: "order",
    amount: -amount,
    balanceBefore,
    balanceAfter,
    description: `Dynamic VPN order: ${order.serverDisplayName} ${order.protocol.toUpperCase()} ${order.duration} ${order.durationType}`,
    relatedId: orderId,
  }).catch((err) => logger.error({ err, orderId }, "[dynamic-vpn] addBalanceLog failed after dynamic order"));

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
          `Dynamic VPN #${orderId} — ${order.serverDisplayName}`,
          orderId,
        );
      }
    }
  } catch (err) {
    logger.error({ err, orderId }, "[dynamic-vpn] addPoints failed after dynamic order");
  }

  // Refresh local server capacity
  if (server.provider === "local_panel") {
    await refreshLocalDynamicServerCapacity(server).catch((err) => { logger.warn({ err }, "refreshLocalDynamicServerCapacity failed"); });
  }

  // Send notifications
  const host = resolveNotificationHost(account.allLinks, order.serverDisplayName);

  notifyUserDynamicVpnAccountCreated({
    userId,
    orderId,
    serverName: order.serverDisplayName,
    protocol: account.accountProtocol,
    username: account.accountUsername,
    password: account.providerPassword,
    host,
    configLink: account.configLink,
    expiresAt: account.expiresAt,
  }).catch((err) => logger.error({ err, orderId }, "notifyUserDynamicVpnAccountCreated failed"));

  notifyAdminDynamicOrderFulfilled({
    orderId,
    buyerUsername,
    serverName: order.serverDisplayName,
    protocol: account.accountProtocol,
    vpnUsername: account.accountUsername,
    amount,
    discountAmount: Number(order.discountAmount ?? 0),
    paymentMethod: order.paymentMethod,
    providerAccountId: account.providerAccountId,
  }).catch((err) => logger.error({ err, orderId }, "notifyAdminDynamicOrderFulfilled failed"));
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

  // Phase 1: Validate order, server, buyer
  const { order, server, buyerUsername, amount, durationType, fallbackExpiry } = await validateOrderAndServer(orderId, userId, tracker);

  // Phase 2: Create account on provider
  let account: ProviderAccountResult;
  try {
    account = await createProviderAccount(order, server, durationType, fallbackExpiry);
  } catch (error) {
    tracker.logFailure(error);
    logger.error({ err: error, orderId, userId }, "[dynamic-vpn] Provider order creation failed - no balance was deducted");
    throw error;
  }
  tracker.mark("provider_account_created");

  logger.info({ orderId, userId, amount, provider: server.provider }, "[dynamic-vpn] Provider creation successful, proceeding to atomic balance + DB commit");

  // Phase 3: Atomic DB transaction (balance + records)
  const { balanceBefore, balanceAfter } = await commitFulfillmentTransaction({
    orderId, userId, amount, order, server, tracker, account,
  });

  logger.info({ orderId, userId, amount, balanceBefore, balanceAfter }, "[dynamic-vpn] Atomic transaction successful");
  tracker.mark("post_commit_started");

  // Phase 4: Post-commit side effects (fire-and-forget)
  await runPostCommitSideEffects({
    order, userId, amount, balanceBefore, balanceAfter, buyerUsername, server, account,
  });
}

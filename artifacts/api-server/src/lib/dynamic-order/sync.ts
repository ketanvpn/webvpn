import {
  db,
  dynamicProviderServersTable,
  dynamicVpnOrdersTable,
  serversTable,
  vpnAccountsTable,
} from "@workspace/db";
import { and, asc, count, eq, gt, inArray, notInArray } from "drizzle-orm";
import { getNadiaVpnServers } from "../nadiavpn";
import { notifyAdminPriceChanged } from "../telegram";
import { logger } from "../logger";
import { applyMarkup, getDefaultMarkupPercent } from "./pricing";
import { normalizeProtocol, normalizeDurationType } from "./utils";
import type { DynamicDurationType } from "../dynamic-duration";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_PROTOCOLS = ["ssh", "vmess", "vless", "trojan"];
const VALID_TYPES: readonly string[] = ["day", "week", "month"];

/** Minimum interval (ms) between user-triggered syncs. */
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Throttle state (per sync kind) ──────────────────────────────────────────

let lastNadiaSyncAt = 0;
let lastLocalSyncAt = 0;

// ─── Local server capacity ────────────────────────────────────────────────────

export async function getLocalServerCapacity(localServerId: number) {
  const [{ activeCount }] = await db
    .select({ activeCount: count(vpnAccountsTable.id) })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.serverId, localServerId), eq(vpnAccountsTable.isActive, true), gt(vpnAccountsTable.expiresAt, new Date())));
  return Number(activeCount ?? 0);
}

export async function refreshLocalDynamicServerCapacity(server: typeof dynamicProviderServersTable.$inferSelect) {
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

// ─── NadiaVPN sync ────────────────────────────────────────────────────────────

export async function syncNadiaVpnServersFromProvider() {
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

  const defaultMarkup = await getDefaultMarkupPercent();

  // ── Batch preload: single query instead of N per-server SELECTs ──
  const allExisting = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.provider, "nadiavpn"));
  const existingByProviderId = new Map(
    allExisting.map((row) => [row.providerServerId, row]),
  );

  for (const srv of servers) {
    const providerServerId = String(srv.server_id);
    const existing = existingByProviderId.get(providerServerId) ?? null;

    const supportedProtocols = Array.isArray(srv.supported_protocols) ? srv.supported_protocols.map(normalizeProtocol).filter(Boolean) : [];
    const supportedTypes = Array.isArray(srv.supported_types) ? srv.supported_types.map(normalizeDurationType).filter((t: string) => VALID_TYPES.includes(t as DynamicDurationType)) : [];
    const costDay = Number(srv.pricing?.per_day ?? 0);
    const costWeek = Number(srv.pricing?.per_week ?? 0);
    const costMonth = Number(srv.pricing?.per_month ?? 0);

    const markupPercent = existing?.markupPercent ?? defaultMarkup;
    const pricingMode = existing?.pricingMode ?? "auto_markup";

    let sellDay: string;
    let sellWeek: string;
    let sellMonth: string;
    if (pricingMode === "auto_markup") {
      sellDay = String(applyMarkup(costDay, markupPercent));
      sellWeek = String(applyMarkup(costWeek, markupPercent));
      sellMonth = String(applyMarkup(costMonth, markupPercent));
    } else {
      sellDay = existing?.sellPricePerDay ?? String(Math.max(costDay, 1000));
      sellWeek = existing?.sellPricePerWeek ?? String(Math.max(costWeek, 1000));
      sellMonth = existing?.sellPricePerMonth ?? String(Math.max(costMonth, 10000));
    }

    const serverName = String(srv.name ?? providerServerId);

    const values = {
      providerName: serverName,
      displayName: serverName,
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

    // Detect provider cost changes
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
    synced.push(row);
  }

  // Deactivate or delete stale servers
  const upstreamServerIds = servers.map((s: any) => String(s.server_id)).filter(Boolean);
  if (upstreamServerIds.length > 0) {
    const staleServers = await db
      .select({ id: dynamicProviderServersTable.id, displayName: dynamicProviderServersTable.displayName })
      .from(dynamicProviderServersTable)
      .where(
        and(
          eq(dynamicProviderServersTable.provider, "nadiavpn"),
          notInArray(dynamicProviderServersTable.providerServerId, upstreamServerIds),
        ),
      );

    for (const stale of staleServers) {
      const [hasOrders] = await db
        .select({ id: dynamicVpnOrdersTable.id })
        .from(dynamicVpnOrdersTable)
        .where(eq(dynamicVpnOrdersTable.dynamicServerId, stale.id))
        .limit(1);

      if (hasOrders) {
        await db
          .update(dynamicProviderServersTable)
          .set({ isActive: false, capacityIsFull: true, updatedAt: now })
          .where(eq(dynamicProviderServersTable.id, stale.id));
      } else {
        await db
          .delete(dynamicProviderServersTable)
          .where(eq(dynamicProviderServersTable.id, stale.id));
      }
    }
  }

  // Notify admin if costs changed
  if (priceChanges.length > 0) {
    notifyAdminPriceChanged(priceChanges).catch((err) =>
      logger.error({ err }, "notifyAdminPriceChanged failed"),
    );
  }

  lastNadiaSyncAt = Date.now();
  return synced;
}

// ─── Local Panel sync ─────────────────────────────────────────────────────────

export async function syncLocalPanelServers() {
  const localServers = await db.select().from(serversTable).where(eq(serversTable.isActive, true)).orderBy(asc(serversTable.sortOrder), asc(serversTable.id));
  const now = new Date();
  const synced = [];

  // ── Batch preload: existing records + capacity counts ──
  const allExisting = await db
    .select()
    .from(dynamicProviderServersTable)
    .where(eq(dynamicProviderServersTable.provider, "local_panel"));
  const existingByProviderId = new Map(
    allExisting.map((row) => [row.providerServerId, row]),
  );

  const serverIds = localServers.map((s) => s.id);
  const capacityCounts = serverIds.length > 0
    ? await db
        .select({
          serverId: vpnAccountsTable.serverId,
          activeCount: count(vpnAccountsTable.id),
        })
        .from(vpnAccountsTable)
        .where(
          and(
            inArray(vpnAccountsTable.serverId, serverIds),
            eq(vpnAccountsTable.isActive, true),
            gt(vpnAccountsTable.expiresAt, new Date()),
          ),
        )
        .groupBy(vpnAccountsTable.serverId)
    : [];
  const capacityByServerId = new Map(
    capacityCounts.map((row) => [row.serverId, Number(row.activeCount)]),
  );

  for (const srv of localServers) {
    const providerServerId = String(srv.id);
    const existing = existingByProviderId.get(providerServerId) ?? null;

    const supportedProtocols = Array.isArray(srv.supportedProtocols)
      ? srv.supportedProtocols.map(normalizeProtocol).filter((p: string) => VALID_PROTOCOLS.includes(p))
      : [];
    const capacityUsed = capacityByServerId.get(srv.id) ?? 0;
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
    synced.push(row);
  }

  lastLocalSyncAt = Date.now();
  return synced;
}

// ─── Throttled sync (for user-facing routes) ──────────────────────────────────

/**
 * Sync both NadiaVPN and local panel servers, but only if enough time
 * has passed since the last sync (SYNC_THROTTLE_MS = 5 minutes).
 * This eliminates the N+1 problem of syncing on every user request.
 */
export async function syncAllServersThrottled() {
  const now = Date.now();

  if (now - lastNadiaSyncAt > SYNC_THROTTLE_MS) {
    try {
      await syncNadiaVpnServersFromProvider();
    } catch (error) {
      logger.warn({ err: error }, "[dynamic-vpn] throttled Nadia sync failed, using cached servers");
    }
  }

  if (now - lastLocalSyncAt > SYNC_THROTTLE_MS) {
    try {
      await syncLocalPanelServers();
    } catch (error) {
      logger.warn({ err: error }, "[dynamic-vpn] throttled local panel sync failed, using cached servers");
    }
  }
}

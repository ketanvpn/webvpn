import { Router } from "express";
import { db } from "@workspace/db";
import { vpnAccountsTable, serversTable, ordersTable, productsTable, usersTable, dynamicVpnOrdersTable, dynamicProviderServersTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { RenewAccountBody } from "@workspace/api-zod";
import { getResellerSettings } from "./settings";
import { renewPanelAccount, syncPanelAccount } from "../lib/vpn-panel";
import { getNadiaVpnAccountDetails, renewNadiaVpnAccount } from "../lib/nadiavpn";
import { sendWhatsapp } from "../lib/fonnte";
import { addBalanceLog } from "./balance-logs";
import { accountActionLimiter } from "../lib/rate-limit";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { notifyAdminDynamicOrderFulfilled } from "../lib/telegram";
import { logger } from "../lib/logger";

const router = Router();
const renewLocks = new Map<number, number>();
const RENEW_LOCK_TTL_MS = 30 * 1000;

function acquireRenewLock(accountId: number): boolean {
  const now = Date.now();

  for (const [id, ts] of renewLocks) {
    if (now - ts > RENEW_LOCK_TTL_MS) renewLocks.delete(id);
  }

  if (renewLocks.has(accountId)) return false;
  renewLocks.set(accountId, now);
  return true;
}

function releaseRenewLock(accountId: number): void {
  renewLocks.delete(accountId);
}

function pickDisplayHost(allLinks: Record<string, string | null | undefined> | null) {
  const values = [
    allLinks?.domain,
    allLinks?.cloudfront,
    allLinks?.host,
    allLinks?.server,
    allLinks?.sni,
    allLinks?.servername,
    allLinks?.hostname,
  ];
  return values.find((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized && !["no", "none", "null", "undefined", "-"].includes(normalized);
  }) ?? null;
}

function stringifyConfigValue(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function parseNadiaExpireAt(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = new Date(value.replace(" ", "T") + "+07:00");
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function extractNadiaAccountDetails(response: any): Record<string, string | null> | null {
  const data = response?.data ?? {};
  const config = data.config_data ?? data.config;
  if (!config || typeof config !== "object") return null;

  const serverInfo = data.server && typeof data.server === "object" ? data.server : {};
  const port = config.port && typeof config.port === "object" ? config.port : {};
  const payloadws = config.payloadws && typeof config.payloadws === "object" ? config.payloadws : {};
  const details: Record<string, string | null> = {
    hostname: stringifyConfigValue(config.hostname ?? data.hostname),
    servername: stringifyConfigValue(config.servername ?? data.servername),
    domain: stringifyConfigValue(serverInfo.domain ?? config.domain ?? data.domain),
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

function hasProviderDomain(allLinks: unknown) {
  const links = (allLinks ?? {}) as Record<string, string | null | undefined>;
  return !!pickDisplayHost({
    domain: links.domain,
    cloudfront: links.cloudfront,
  });
}

async function syncNadiaAccountDetails(account: typeof vpnAccountsTable.$inferSelect) {
  const [dynamicOrder] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.vpnAccountId, account.id))
    .limit(1);

  if (!dynamicOrder || dynamicOrder.provider !== "nadiavpn" || !dynamicOrder.providerAccountId) {
    return account;
  }

  const detailResponse: any = await getNadiaVpnAccountDetails(dynamicOrder.providerAccountId);
  const details = extractNadiaAccountDetails(detailResponse);
  if (!details) return account;

  const data = detailResponse?.data ?? {};
  const config = data.config_data ?? data.config ?? {};
  const mergedLinks = {
    ...((account.allLinks ?? {}) as Record<string, string | null>),
    ...details,
  };
  const expiresAt = parseNadiaExpireAt(data.expire_at, account.expiresAt);

  const [updated] = await db
    .update(vpnAccountsTable)
    .set({
      username: data.username ?? config.username ?? account.username,
      password: data.password ?? config.password ?? account.password,
      uuid: data.uuid ?? config.uuid ?? account.uuid,
      allLinks: mergedLinks,
      expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(vpnAccountsTable.id, account.id))
    .returning();

  await db
    .update(dynamicVpnOrdersTable)
    .set({
      providerResponse: {
        previous: dynamicOrder.providerResponse ?? null,
        syncedDetails: detailResponse,
      },
      updatedAt: new Date(),
    })
    .where(eq(dynamicVpnOrdersTable.id, dynamicOrder.id));

  return updated ?? account;
}

async function maybeAutoSyncProviderDetails(account: typeof vpnAccountsTable.$inferSelect) {
  if (hasProviderDomain(account.allLinks)) return account;
  try {
    return await syncNadiaAccountDetails(account);
  } catch {
    return account;
  }
}

async function calculateDynamicRenewAmount(params: {
  dynamicServerId: number | null;
  durationType: string;
  duration: number;
  userId: number;
}) {
  const { dynamicServerId, durationType, duration, userId } = params;
  if (!dynamicServerId) throw new Error("Dynamic server tidak ditemukan");
  const [server] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, dynamicServerId)).limit(1);
  if (!server || !server.isActive) throw new Error("Server dynamic tidak aktif");

  let unitPrice = 0;
  if (durationType === "day") {
    if (!server.supportedTypes.includes("day")) throw new Error("Server ini tidak mendukung renew harian");
    if (duration < server.minDays || duration > server.maxDays) throw new Error(`Durasi harian harus ${server.minDays}-${server.maxDays} hari`);
    unitPrice = Number(server.sellPricePerDay ?? 0);
  } else if (durationType === "month") {
    if (!server.supportedTypes.includes("month")) throw new Error("Server ini tidak mendukung renew bulanan");
    if (duration < server.minMonths || duration > server.maxMonths) throw new Error(`Durasi bulanan harus ${server.minMonths}-${server.maxMonths} bulan`);
    unitPrice = Number(server.sellPricePerMonth ?? 0);
  } else {
    throw new Error("Tipe durasi tidak valid");
  }

  if (unitPrice <= 0) throw new Error("Harga renew belum diatur admin");
  const baseAmount = unitPrice * duration;
  let amount = baseAmount;
  let resellerDiscountAmount = 0;

  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (user?.role === "reseller") {
    const settings = await getResellerSettings();
    if (settings.resellerEnabled && settings.resellerDiscountPercent > 0) {
      resellerDiscountAmount = Math.floor(baseAmount * (settings.resellerDiscountPercent / 100));
      amount = Math.max(0, baseAmount - resellerDiscountAmount);
    }
  }

  return { amount, baseAmount, resellerDiscountAmount, unitPrice };
}

async function formatAccount(a: typeof vpnAccountsTable.$inferSelect) {
  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, a.serverId))
    .limit(1);

  let productName: string | null = null;
  if (a.orderId) {
    const [row] = await db
      .select({ productName: productsTable.name })
      .from(ordersTable)
      .innerJoin(productsTable, eq(productsTable.id, ordersTable.productId))
      .where(eq(ordersTable.id, a.orderId))
      .limit(1);
    productName = row?.productName ?? null;
  }

  const [dynamicOrder] = await db
    .select({
      id: dynamicVpnOrdersTable.id,
      provider: dynamicVpnOrdersTable.provider,
      providerServerId: dynamicVpnOrdersTable.providerServerId,
      serverDisplayName: dynamicVpnOrdersTable.serverDisplayName,
      providerAccountId: dynamicVpnOrdersTable.providerAccountId,
      dynamicServerId: dynamicVpnOrdersTable.dynamicServerId,
    })
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.vpnAccountId, a.id))
    .limit(1);

  const allLinks = (a.allLinks ?? null) as Record<string, string | null | undefined> | null;
  const dynamicHost = pickDisplayHost(allLinks);

  return {
    id: a.id,
    userId: a.userId,
    orderId: a.orderId,
    dynamicOrder: dynamicOrder ?? null,
    protocol: a.protocol,
    username: a.username,
    password: a.password,
    uuid: a.uuid,
    serverId: a.serverId,
    server: server
      ? {
          id: server.id,
          name: dynamicOrder?.serverDisplayName ?? server.name,
          host: dynamicHost ?? server.host,
          location: server.location,
          flag: server.flag,
          isActive: server.isActive,
          originalName: server.name,
          originalHost: server.host,
        }
      : null,
    configLink: a.configLink,
    allLinks: a.allLinks ?? null,
    expiresAt: a.expiresAt,
    quota: a.quota != null ? Number(a.quota) : null,
    usedQuota: a.usedQuota != null ? Number(a.usedQuota) : null,
    productName: productName ?? (dynamicOrder ? "Order VPN Dynamic" : null),
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

router.get("/accounts", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const accounts = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.userId, userId))
    .orderBy(desc(vpnAccountsTable.createdAt));

  const formatted = await Promise.all(accounts.map(formatAccount));
  res.json(formatted);
});

router.get("/accounts/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.id, id), eq(vpnAccountsTable.userId, userId)))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const syncedAccount = await maybeAutoSyncProviderDetails(account);
  res.json(await formatAccount(syncedAccount));
});

router.post("/accounts/:id/sync-provider", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.id, id), eq(vpnAccountsTable.userId, userId)))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [dynamicOrder] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.vpnAccountId, account.id))
    .limit(1);

  if (!dynamicOrder || dynamicOrder.provider !== "nadiavpn") {
    res.status(400).json({ error: "Akun ini bukan akun dynamic NadiaVPN" });
    return;
  }

  if (!dynamicOrder.providerAccountId) {
    res.status(400).json({ error: "Account ID provider belum tersimpan untuk akun ini" });
    return;
  }

  const updated = await syncNadiaAccountDetails(account);
  res.json(await formatAccount(updated));
});

router.post("/accounts/:id/renew-dynamic/quote", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;
  const durationType = String(req.body?.durationType ?? "").trim().toLowerCase();
  const duration = parseInt(String(req.body?.duration ?? ""), 10);

  if (!["day", "month"].includes(durationType) || !Number.isInteger(duration) || duration < 1) {
    res.status(400).json({ error: "Durasi renew tidak valid" });
    return;
  }

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.id, id), eq(vpnAccountsTable.userId, userId)))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [dynamicOrder] = await db
    .select()
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.vpnAccountId, account.id))
    .limit(1);

  if (!dynamicOrder || !["nadiavpn", "local_panel"].includes(dynamicOrder.provider)) {
    res.status(400).json({ error: "Quote renew dynamic tidak tersedia untuk akun ini" });
    return;
  }

  try {
    const price = await calculateDynamicRenewAmount({ dynamicServerId: dynamicOrder.dynamicServerId, durationType, duration, userId });
    res.json({
      ...price,
      durationType,
      duration,
      durationLabel: `${duration} ${durationType === "day" ? "Hari" : "Bulan"}`,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Quote renew gagal" });
  }
});

router.post("/accounts/:id/renew-dynamic", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;
  const durationType = String(req.body?.durationType ?? "").trim().toLowerCase();
  const duration = parseInt(String(req.body?.duration ?? ""), 10);

  if (!acquireRenewLock(id)) {
    res.status(409).json({ error: "Akun ini sedang diproses renew. Coba lagi beberapa detik." });
    return;
  }

  try {
    if (!["day", "month"].includes(durationType) || !Number.isInteger(duration) || duration < 1) {
      res.status(400).json({ error: "Durasi renew tidak valid" });
      return;
    }

    const [account] = await db
      .select()
      .from(vpnAccountsTable)
      .where(and(eq(vpnAccountsTable.id, id), eq(vpnAccountsTable.userId, userId)))
      .limit(1);

    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const [dynamicOrder] = await db
      .select()
      .from(dynamicVpnOrdersTable)
      .where(eq(dynamicVpnOrdersTable.vpnAccountId, account.id))
      .limit(1);

    if (!dynamicOrder || !["nadiavpn", "local_panel"].includes(dynamicOrder.provider)) {
      res.status(400).json({ error: "Renew dynamic tidak tersedia untuk akun ini" });
      return;
    }
    if (dynamicOrder.provider === "nadiavpn" && !dynamicOrder.providerAccountId) {
      res.status(400).json({ error: "Account ID provider belum tersimpan untuk akun ini" });
      return;
    }

    const price = await calculateDynamicRenewAmount({ dynamicServerId: dynamicOrder.dynamicServerId, durationType, duration, userId });
    const [user] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user || Number(user.balance) < price.amount) {
      res.status(400).json({ error: "Saldo tidak cukup untuk melakukan renew" });
      return;
    }

    let synced = account;
    let finalExpiresAt = new Date(account.expiresAt.getTime() + (durationType === "day" ? duration : duration * 30) * 24 * 60 * 60 * 1000);

    if (dynamicOrder.provider === "nadiavpn") {
      await renewNadiaVpnAccount({ account_id: dynamicOrder.providerAccountId!, type: durationType, duration });
      synced = await syncNadiaAccountDetails(account);
      finalExpiresAt = synced.expiresAt ?? finalExpiresAt;
    } else {
      const [dynamicServer] = await db.select().from(dynamicProviderServersTable).where(eq(dynamicProviderServersTable.id, dynamicOrder.dynamicServerId!)).limit(1);
      const localServerId = parseInt(String(dynamicServer?.providerServerId ?? account.serverId), 10);
      const [localServer] = await db.select().from(serversTable).where(eq(serversTable.id, localServerId)).limit(1);
      if (!localServer || !localServer.isActive) throw new Error("Server sedang tidak aktif");
      if (!localServer.apiUrl || !localServer.apiToken) throw new Error("API panel server belum diatur");

      await renewPanelAccount({
        apiUrl: localServer.apiUrl,
        apiToken: localServer.apiToken,
        protocol: account.protocol,
        username: account.username,
        durationDays: durationType === "day" ? duration : duration * 30,
        quota: account.quota ? Number(account.quota) : null,
      });

      const panelInfo = await syncPanelAccount({
        apiUrl: localServer.apiUrl,
        apiToken: localServer.apiToken,
        protocol: account.protocol,
        username: account.username,
      }).catch(() => null);

      if (panelInfo) {
        const mergedLinks = {
          ...((account.allLinks ?? {}) as Record<string, string | null>),
          ...((panelInfo.allLinks ?? {}) as Record<string, string | null>),
          hostname: panelInfo.hostname ?? (account.allLinks as Record<string, string | null> | null)?.hostname ?? null,
        };
        const [updatedLocal] = await db
          .update(vpnAccountsTable)
          .set({
            uuid: panelInfo.uuid ?? account.uuid,
            configLink: panelInfo.configLink ?? account.configLink,
            allLinks: mergedLinks,
            updatedAt: new Date(),
          })
          .where(eq(vpnAccountsTable.id, account.id))
          .returning();
        synced = updatedLocal ?? account;
      }
    }

    let balanceBefore = 0;
    let balanceAfter = 0;
    await db.transaction(async (tx: any) => {
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`balance - ${price.amount}` })
        .where(and(eq(usersTable.id, userId), sql`balance >= ${price.amount}::numeric`))
        .returning({ balance: usersTable.balance });

      if (!updatedUser) throw new Error("INSUFFICIENT_BALANCE");
      balanceAfter = Number(updatedUser.balance);
      balanceBefore = balanceAfter + price.amount;

      await tx
        .update(vpnAccountsTable)
        .set({ expiresAt: finalExpiresAt, isActive: true, updatedAt: new Date() })
        .where(eq(vpnAccountsTable.id, account.id));
    });

    addBalanceLog({
      userId,
      type: "order",
      amount: -price.amount,
      balanceBefore,
      balanceAfter,
      description: `Renew dynamic VPN: ${account.username} (+${duration} ${durationType === "day" ? "hari" : "bulan"})`,
      relatedId: account.id,
    }).catch(() => {});

    const [buyer] = await db.select({ username: usersTable.username, whatsapp: usersTable.whatsapp }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const expiryFormatted = format(finalExpiresAt, "d MMM yyyy, HH:mm", { locale: idLocale });
    const providerLabel = dynamicOrder.provider === "local_panel" ? "Server Saya" : "Dynamic";

    if (buyer?.whatsapp) {
      const waMsg =
        `✅ *Renew Akun VPN Berhasil!*\n\n` +
        `Akun: *${account.username}*\n` +
        `Protokol: *${account.protocol.toUpperCase()}*\n` +
        `Paket: *${providerLabel}* (+${duration} ${durationType === "day" ? "hari" : "bulan"})\n` +
        `Aktif hingga: *${expiryFormatted}*\n` +
        `Harga: *Rp ${price.amount.toLocaleString("id-ID")}*\n\n` +
        `Terima kasih telah menggunakan KETANTECH VPN! 🚀`;
      sendWhatsapp(buyer.whatsapp, waMsg).catch(() => {});
    }

    notifyAdminDynamicOrderFulfilled({
      orderId: -dynamicOrder.id,
      buyerUsername: buyer?.username ?? `User #${userId}`,
      serverName: `Renew - ${dynamicOrder.serverDisplayName}`,
      protocol: account.protocol,
      vpnUsername: account.username,
      amount: price.amount,
      discountAmount: price.resellerDiscountAmount,
      paymentMethod: "balance",
      providerAccountId: dynamicOrder.providerAccountId,
    }).catch((err) => logger.error({ err, accountId: account.id }, "notifyAdminDynamicRenew failed"));

    const [updated] = await db.select().from(vpnAccountsTable).where(eq(vpnAccountsTable.id, account.id)).limit(1);
    res.json({ account: await formatAccount(updated), amount: price.amount, discountAmount: price.resellerDiscountAmount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal renew dynamic";
    if (message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Saldo tidak cukup untuk melakukan renew" });
      return;
    }
    res.status(500).json({ error: message });
  } finally {
    releaseRenewLock(id);
  }
});

router.post("/accounts/:id/renew", requireAuth, accountActionLimiter, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;
  const parsed = RenewAccountBody.safeParse(req.body);

  if (!acquireRenewLock(id)) {
    res.status(409).json({ error: "Akun ini sedang diproses renew. Coba lagi beberapa detik." });
    return;
  }

  try {
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.id, id), eq(vpnAccountsTable.userId, userId)))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  // Tolak perpanjangan jika akun sudah kedaluwarsa (panel akan menghapus akun expired secara otomatis)
  if (account.expiresAt <= new Date()) {
    res.status(400).json({ error: "Akun sudah kedaluwarsa dan tidak dapat diperpanjang. Silakan buat akun baru." });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, parsed.data.productId), eq(productsTable.isActive, true)))
    .limit(1);

  if (!product) {
    res.status(400).json({ error: "Product not found" });
    return;
  }

  if (product.protocol !== account.protocol) {
    res.status(400).json({ error: "Protokol produk tidak cocok dengan akun ini." });
    return;
  }

  if (product.durationDays === 0) {
    res.status(400).json({ error: "Akun tidak dapat diperpanjang menggunakan paket Trial." });
    return;
  }

  // Validasi server: produk yang di-pin ke server tertentu harus cocok dengan server akun
  if (product.serverId !== null && product.serverId !== account.serverId) {
    res.status(400).json({ error: "Produk ini tidak tersedia untuk server akun kamu." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  // Hitung harga efektif (reseller mendapat diskon jika fitur aktif)
  let price = Number(product.price);
  if (user!.role === "reseller") {
    const resellerSettings = await getResellerSettings();
    if (resellerSettings.resellerEnabled && resellerSettings.resellerDiscountPercent > 0) {
      price = Math.floor(price * (1 - resellerSettings.resellerDiscountPercent / 100));
    }
  }

  const baseDate = account.expiresAt > new Date() ? account.expiresAt : new Date();
  const newExpiresAt = new Date(baseDate.getTime() + product.durationDays * 24 * 60 * 60 * 1000);

  // 1. Cek saldo sebelum memanggil API eksternal
  if (Number(user!.balance) < price) {
    res.status(400).json({ error: "Saldo tidak cukup untuk melakukan renew" });
    return;
  }

  // 2. Dapatkan data server VPS
  const [server] = await db
    .select({ apiUrl: serversTable.apiUrl, apiToken: serversTable.apiToken, isActive: serversTable.isActive })
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (server && !server.isActive) {
    res.status(400).json({ error: "Server ini sedang maintenance atau offline. Tidak dapat melakukan perpanjangan." });
    return;
  }

  if (!server?.apiUrl || !server?.apiToken) {
    res.status(500).json({ error: "Konfigurasi server VPS tidak valid" });
    return;
  }

  // 3. Panggil API Panel VPS terlebih dahulu
  try {
    await renewPanelAccount({
      apiUrl: server.apiUrl,
      apiToken: server.apiToken,
      protocol: account.protocol,
      username: account.username,
      durationDays: product.durationDays,
      quota: account.quota ? Number(account.quota) : null,
    });
  } catch (err) {
    console.error("[renew] Panel error:", err);
    res.status(502).json({ error: err instanceof Error ? err.message : "Gagal memperpanjang akun di server VPS" });
    return;
  }

  // 4. Jika berhasil, jalankan transaksi database
  // ─── Atomic transaction: balance deduction + account update + order insert ──
  let balanceBefore: number;
  let balanceAfter: number;

  try {
    const txResult = await db.transaction(async (tx: any) => {
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`balance - ${price}` })
        .where(
          and(
            eq(usersTable.id, userId),
            gte(usersTable.balance, String(price))
          )
        )
        .returning({ balance: usersTable.balance });

      if (!updatedUser) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const newBalance = Number(updatedUser.balance);
      const prevBalance = newBalance + price;

      await tx
        .update(vpnAccountsTable)
        .set({ expiresAt: newExpiresAt, isActive: true, updatedAt: new Date() })
        .where(eq(vpnAccountsTable.id, id));

      await tx
        .insert(ordersTable)
        .values({
          userId,
          productId: product.id,
          status: "paid",
          amount: String(price),
          vpnAccountId: account.id,
          paymentMethod: "balance",
          notes: "renewal",
        });

      return { prevBalance, newBalance };
    });

    balanceBefore = txResult.prevBalance;
    balanceAfter = txResult.newBalance;
  } catch (err) {
    console.error("[renew] Transaction failed after panel sync:", err);
    res.status(500).json({ error: "Terjadi kesalahan internal saat mencatat transaksi, namun akun di VPS mungkin sudah diperpanjang." });
    return;
  }

  // Log balance deduction (fire-and-forget)
  addBalanceLog({
    userId,
    type: "order",
    amount: -price,
    balanceBefore,
    balanceAfter,
    description: `Renew akun VPN: ${account.username} (${product.name})`,
    relatedId: account.id,
  }).catch(() => {});

  const [updated] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  // Kirim notifikasi WhatsApp kepada user (best-effort)
  if (user!.whatsapp) {
    const expiryFormatted = format(newExpiresAt, "d MMM yyyy, HH:mm", { locale: idLocale });
    const waMsg =
      `✅ *Renew Akun VPN Berhasil!*\n\n` +
      `Akun: *${account.username}*\n` +
      `Protokol: *${account.protocol.toUpperCase()}*\n` +
      `Paket: *${product.name}* (+${product.durationDays} hari)\n` +
      `Aktif hingga: *${expiryFormatted}*\n` +
      `Harga: *Rp ${price.toLocaleString("id-ID")}*\n\n` +
      `Terima kasih telah menggunakan KETANTECH VPN! 🚀`;
    sendWhatsapp(user!.whatsapp, waMsg).catch(() => {});
  }

    res.json(await formatAccount(updated));
  } finally {
    releaseRenewLock(id);
  }
});

export { formatAccount };
export default router;

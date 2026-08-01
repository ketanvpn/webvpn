import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, usersTable, vpnAccountsTable, serversTable, vouchersTable, dynamicVpnOrdersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { formatProduct } from "./products";
import { randomUUID } from "crypto";
import { createPanelAccount, createTrialPanelAccount, sanitizeVpnUsername, deletePanelAccount } from "../lib/vpn-panel";
import { addBalanceLog } from "./balance-logs";
import { logger } from "../lib/logger";
import { notifyUserVpnAccountCreated, notifyAdminOrderFulfilled } from "../lib/telegram";
import { addPoints, getPointsSettings } from "./points";
import { getReferralSettings } from "../lib/scheduler";
import { createOrderLimiter } from "../lib/rate-limit";
import { retiredRouteResponse } from "../lib/retired-route";

const router = Router();

async function formatOrder(o: typeof ordersTable.$inferSelect) {
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, o.productId))
    .limit(1);

  return {
    id: o.id,
    userId: o.userId,
    productId: o.productId,
    product: product ? formatProduct(product) : null,
    status: o.status,
    amount: Number(o.amount),
    payableAmount: Number(o.payableAmount ?? o.amount),
    paymentProvider: o.paymentProvider ?? null,
    paymentChannel: o.paymentChannel ?? null,
    uniqueCode: o.uniqueCode ?? 0,
    vpnAccountId: o.vpnAccountId,
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    qrisUrl: o.qrisUrl ?? null,
    expiresAt: o.expiresAt ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Fulfill a QRIS/autogopay order: pick server, create VPN account on panel, atomic DB transaction.
 * Can be called from the webhook (after payment received) or from the pay endpoint (balance payment).
 * For balance payment, pass `deductBalance: true`.
 */
export async function fulfillOrder(orderId: number, opts: { deductBalance?: boolean } = {}): Promise<void> {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order || (order.status !== "pending" && order.status !== "processing")) {
    throw new Error("Order tidak ditemukan atau sudah diproses");
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, order.productId))
    .limit(1);

  if (!product) throw new Error("Product not found");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, order.userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  const amount = Number(order.amount);

  // ── Cek saldo SEBELUM buat akun panel — hindari akun "hantu" di server ──────
  if (opts.deductBalance) {
    const [userCheck] = await db
      .select({ balance: usersTable.balance })
      .from(usersTable)
      .where(eq(usersTable.id, order.userId))
      .limit(1);

    if (!userCheck || Number(userCheck.balance) < amount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }
  }

  const allServers = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.isActive, true));

  const supportsProtocol = (s: any) =>
    Array.isArray(s.supportedProtocols) && s.supportedProtocols.includes(product.protocol);

  let server: typeof allServers[0] | undefined;

  // Jika produk di-pin ke server tertentu
  if (product.serverId) {
    const pinnedServer = allServers.find((s: any) => s.id === product.serverId);
    if (!pinnedServer) {
      throw new Error(`Server untuk produk ini sedang offline atau penuh.`);
    }
    server = pinnedServer;
  } else {
    // Jika tidak di-pin, cari server aktif mana saja yang support protokol
    server = allServers.find((s: any) => supportsProtocol(s) && s.apiUrl && s.apiToken) ??
      allServers.find((s: any) => supportsProtocol(s)) ??
      allServers[0];
  }

  if (!server) throw new Error("Tidak ada server yang tersedia saat ini");

  // Jika durationDays = 0, anggap sebagai Trial 1 Jam
  const isTrial = product.durationDays === 0;
  const durationMs = isTrial
    ? 1 * 60 * 60 * 1000 // 1 jam
    : product.durationDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);
  const rawUsername = sanitizeVpnUsername(order.notes ?? user.username);
  const vpnPassword = randomUUID().replace(/-/g, "").slice(0, 12);
  const vpnUuid = randomUUID();

  let finalUsername = rawUsername;
  let finalPassword: string | null = vpnPassword;
  let finalUuid: string | null = vpnUuid;
  let configLink: string | null = null;
  let allLinks: Record<string, string | null> | null = null;

  const hasPanel = server.apiUrl && server.apiToken;
  logger.info(`[orders:fulfill] Server: "${server.name}", protocol: ${product.protocol}, hasPanel: ${!!hasPanel}, isTrial: ${isTrial}`);

  if (hasPanel) {
    let panelResult;

    if (isTrial) {
      // Gunakan endpoint trial khusus dari Panel — durasi dalam menit
      panelResult = await createTrialPanelAccount({
        apiUrl: server.apiUrl!,
        apiToken: server.apiToken!,
        protocol: product.protocol,
        timelimit: "60m", // 1 jam = 60 menit
      });
    } else {
      panelResult = await createPanelAccount({
        apiUrl: server.apiUrl!,
        apiToken: server.apiToken!,
        protocol: product.protocol,
        username: rawUsername,
        password: vpnPassword,
        durationDays: product.durationDays,
        quota: product.quota ? Number(product.quota) : null,
        maxConnections: product.maxConnections ?? null,
        uuid: vpnUuid,
      });
    }

    finalUsername = panelResult.username;
    finalPassword = panelResult.password ?? vpnPassword;
    finalUuid = panelResult.uuid ?? vpnUuid;
    configLink = panelResult.configLink ?? null;
    if (panelResult.allLinks || panelResult.hostname) {
      const links: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(panelResult.allLinks ?? {})) links[k] = v ?? null;
      if (panelResult.hostname) links.hostname = panelResult.hostname;
      allLinks = links;
    }
    logger.info(`[orders:fulfill] Panel account created: ${product.protocol}/${finalUsername}${isTrial ? " (TRIAL 60m)" : ""}`);
  } else {
    logger.warn(`[orders:fulfill] Server "${server.name}" has no apiUrl/apiToken. Using local credential generation.`);
    if (product.protocol === "vmess") {
      const config = Buffer.from(JSON.stringify({
        v: "2", ps: `KETANTECH-${server.name}`,
        add: server.host, port: 443, id: vpnUuid,
        aid: 0, net: "ws", type: "none", host: server.host,
        path: "/vmess", tls: "tls",
      })).toString("base64");
      configLink = `vmess://${config}`;
    } else if (product.protocol === "vless") {
      configLink = `vless://${vpnUuid}@${server.host}:443?security=tls&type=ws&path=/vless#KETANTECH-${server.name}`;
    } else if (product.protocol === "trojan") {
      configLink = `trojan://${vpnPassword}@${server.host}:443?security=tls#KETANTECH-${server.name}`;
    }
  }

  // DB Transaction: optionally deduct balance + insert VPN account + update order
  let balanceBefore: number | null = null;
  let balanceAfter: number | null = null;

  try {
    await db.transaction(async (tx: any) => {
      if (opts.deductBalance) {
        const [updatedUser] = await tx
          .update(usersTable)
          .set({ balance: sql`balance - ${amount}` })
          .where(and(eq(usersTable.id, order.userId), sql`balance >= ${amount}::numeric`))
          .returning({ balance: usersTable.balance });

        if (!updatedUser) throw new Error("INSUFFICIENT_BALANCE");
        balanceAfter = Number(updatedUser.balance);
        balanceBefore = balanceAfter + amount;
      }

      const [acc] = await tx
        .insert(vpnAccountsTable)
        .values({
          userId: order.userId,
          orderId: order.id,
          protocol: product.protocol,
          username: finalUsername,
          password: finalPassword,
          uuid: finalUuid,
          serverId: server.id,
          configLink,
          allLinks,
          expiresAt,
          quota: product.quota ?? null,
        })
        .returning();

      await tx
        .update(ordersTable)
        .set({ status: "paid", vpnAccountId: acc.id, updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));

      if (order.voucherId) {
        await tx
          .update(vouchersTable)
          .set({ currentUses: sql`current_uses + 1`, updatedAt: new Date() })
          .where(eq(vouchersTable.id, order.voucherId));
      }
    });
  } catch (dbError) {
    if (hasPanel && finalUsername) {
      logger.error({ err: dbError, username: finalUsername }, "[orders:fulfill] DB transaction failed! Rolling back (deleting) panel account.");
      await deletePanelAccount({
        apiUrl: server.apiUrl!,
        apiToken: server.apiToken!,
        protocol: product.protocol,
        username: finalUsername,
      }).catch(deleteErr => {
        logger.error({ err: deleteErr, username: finalUsername }, "[orders:fulfill] CRITICAL: Failed to rollback panel account. Orphaned account remains.");
      });
    }
    throw dbError;
  }

  if (opts.deductBalance && balanceBefore !== null && balanceAfter !== null) {
    addBalanceLog({
      userId: order.userId,
      type: "order",
      amount: -amount,
      balanceBefore,
      balanceAfter,
      description: `Pembelian produk: ${product.name} (Order #${order.id})`,
      relatedId: order.id,
    }).catch(() => {});
  }

  // Kirim notifikasi ke user & admin (fire and forget)
  notifyUserVpnAccountCreated({
    userId: order.userId,
    orderId: order.id,
    productName: product.name,
    protocol: product.protocol,
    username: finalUsername,
    password: finalPassword,
    configLink,
    serverName: server.name,
    expiresAt,
  }).catch((err) => logger.error({ err }, "notifyUserVpnAccountCreated failed"));

  notifyAdminOrderFulfilled({
    orderId: order.id,
    username: user.username,
    productName: product.name,
    protocol: product.protocol,
    amount,
    paymentMethod: order.paymentMethod ?? "balance",
  }).catch((err) => logger.error({ err }, "notifyAdminOrderFulfilled failed"));

  // Tambah poin jika sistem poin aktif
  getPointsSettings().then(async (pts) => {
    if (pts.enabled && amount >= pts.pointsMinOrder && pts.pointsRateOrder > 0) {
      const pointsEarned = Math.floor(amount / pts.pointsRateOrder);
      if (pointsEarned > 0) {
        await addPoints(order.userId, pointsEarned, "order", `Order #${order.id} — ${product.name}`, order.id);
      }
    }
  }).catch((err) => logger.error({ err }, "[orders] addPoints failed"));

  // Cek bonus referral jika ini order pertama
  (async () => {
    try {
      const referralSettings = await getReferralSettings();
      if (!referralSettings.enabled) return;

      const [buyer] = await db
        .select({
          referredBy: usersTable.referredBy,
          referralBonusClaimed: usersTable.referralBonusClaimed,
        })
        .from(usersTable)
        .where(eq(usersTable.id, order.userId))
        .limit(1);

      if (!buyer?.referredBy || buyer.referralBonusClaimed) return;

      const [referrer] = await db
        .select({ id: usersTable.id, balance: usersTable.balance, username: usersTable.username })
        .from(usersTable)
        .where(eq(usersTable.referralCode, buyer.referredBy))
        .limit(1);

      if (!referrer) return;

      const bonusAmount = referralSettings.bonusAmount;
      const refBalanceBefore = Number(referrer.balance);
      const refBalanceAfter = refBalanceBefore + bonusAmount;

      await db.transaction(async (tx) => {
        await tx
          .update(usersTable)
          .set({ balance: String(refBalanceAfter), updatedAt: new Date() })
          .where(eq(usersTable.id, referrer.id));

        await tx
          .update(usersTable)
          .set({ referralBonusClaimed: true, updatedAt: new Date() })
          .where(eq(usersTable.id, order.userId));
      });

      addBalanceLog({
        userId: referrer.id,
        type: "referral",
        amount: bonusAmount,
        balanceBefore: refBalanceBefore,
        balanceAfter: refBalanceAfter,
        description: `Bonus referral dari pembelian pertama user`,
        relatedId: order.id,
      }).catch(() => {});
    } catch (err) {
      logger.error({ err }, "[referral-bonus] fulfillOrder");
    }
  })();
}

router.get("/orders", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { status } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [eq(ordersTable.userId, userId)];
  if (status) conditions.push(eq(ordersTable.status, status));

  const dynamicConditions = [eq(dynamicVpnOrdersTable.userId, userId)];
  if (status) dynamicConditions.push(eq(dynamicVpnOrdersTable.status, status));

  const fetchCount = limit + offset;

  const [orders, dynamicOrders, staticTotalResult, dynamicTotalResult] = await Promise.all([
    db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(fetchCount),
    db.select().from(dynamicVpnOrdersTable).where(and(...dynamicConditions)).orderBy(desc(dynamicVpnOrdersTable.createdAt)).limit(fetchCount),
    db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(and(...conditions)),
    db.select({ count: sql<number>`count(*)::int` }).from(dynamicVpnOrdersTable).where(and(...dynamicConditions)),
  ]);

  const formattedStatic = await Promise.all(orders.map(formatOrder));
  const formattedDynamic = dynamicOrders.map((order) => ({
    id: order.id,
    userId: order.userId,
    productId: null,
    product: { name: `Order VPN Dynamic - ${order.serverDisplayName}` },
    status: order.status,
    amount: Number(order.amount),
    vpnAccountId: order.vpnAccountId,
    paymentMethod: order.paymentMethod,
    notes: order.username,
    qrisUrl: null,
    expiresAt: null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    isDynamic: true,
    dynamicProvider: order.provider,
    protocol: order.protocol,
    duration: order.duration,
    durationType: order.durationType,
  }));

  const merged = [...formattedStatic, ...formattedDynamic]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(offset, offset + limit);

  res.json({
    orders: merged,
    total: (staticTotalResult[0]?.count ?? 0) + (dynamicTotalResult[0]?.count ?? 0),
  });
});

router.post("/orders", requireAuth, createOrderLimiter, async (_req, res) => {
  const response = retiredRouteResponse("staticOrder");
  res.status(response.status).json(response);
});

router.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const userId = req.user!.userId;

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  res.json(await formatOrder(order));
});

router.post("/orders/:id/pay", requireAuth, createOrderLimiter, async (_req, res) => {
  const response = retiredRouteResponse("staticOrderPayment");
  res.status(response.status).json(response);
});

export { formatOrder };
export default router;

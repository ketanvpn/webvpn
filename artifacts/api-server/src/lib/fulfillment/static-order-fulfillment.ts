/**
 * Static order fulfillment service.
 *
 * Handles the two-phase fulfillment of static (product-based) VPN orders:
 *  1. Create VPN account on panel (external side-effect)
 *  2. Atomic DB transaction: balance deduction + VPN record + order update
 *
 * If the DB transaction fails after the panel account was created, we attempt
 * to delete the panel account with retries (via `deletePanelAccountWithRetry`)
 * to avoid orphaned accounts.
 *
 * Extracted from routes/orders.ts so that settlement.ts, reconciliation.ts,
 * and route handlers all import from a shared service rather than from the
 * route file.
 */

import { db } from "@workspace/db";
import {
  ordersTable,
  productsTable,
  usersTable,
  vpnAccountsTable,
  serversTable,
  vouchersTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  createPanelAccount,
  createTrialPanelAccount,
  sanitizeVpnUsername,
} from "../vpn-panel";
import { addBalanceLog } from "../../routes/balance-logs";
import { logger } from "../logger";
import {
  notifyUserVpnAccountCreated,
  notifyAdminOrderFulfilled,
} from "../telegram";
import { addPoints, getPointsSettings } from "../../routes/points";
import { getReferralSettings } from "../scheduler";
import { deletePanelAccountWithRetry } from "./retry-utils";

/**
 * Fulfill a QRIS/autogopay order: pick server, create VPN account on panel,
 * atomic DB transaction.
 *
 * Can be called from:
 *  - settlement.ts (webhook → after payment received, `deductBalance: false`)
 *  - reconciliation.ts (scheduler retry for paid-but-unfulfilled orders)
 *  - route handler (balance payment, `deductBalance: true`)
 */
export async function fulfillOrder(
  orderId: number,
  opts: { deductBalance?: boolean } = {},
): Promise<void> {
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

  // SECURITY: balance check lives inside the DB transaction (atomic WHERE balance >= amount)
  // to prevent TOCTOU race conditions on concurrent payments.

  const allServers = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.isActive, true));

  const supportsProtocol = (s: any) =>
    Array.isArray(s.supportedProtocols) &&
    s.supportedProtocols.includes(product.protocol);

  let server: (typeof allServers)[0] | undefined;

  // Jika produk di-pin ke server tertentu
  if (product.serverId) {
    const pinnedServer = allServers.find(
      (s: any) => s.id === product.serverId,
    );
    if (!pinnedServer) {
      throw new Error(`Server untuk produk ini sedang offline atau penuh.`);
    }
    server = pinnedServer;
  } else {
    // Jika tidak di-pin, cari server aktif mana saja yang support protokol
    server =
      allServers.find(
        (s: any) => supportsProtocol(s) && s.apiUrl && s.apiToken,
      ) ??
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
  logger.info(
    `[orders:fulfill] Server: "${server.name}", protocol: ${product.protocol}, hasPanel: ${!!hasPanel}, isTrial: ${isTrial}`,
  );

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
      for (const [k, v] of Object.entries(panelResult.allLinks ?? {}))
        links[k] = v ?? null;
      if (panelResult.hostname) links.hostname = panelResult.hostname;
      allLinks = links;
    }
    logger.info(
      `[orders:fulfill] Panel account created: ${product.protocol}/${finalUsername}${isTrial ? " (TRIAL 60m)" : ""}`,
    );
  } else {
    logger.warn(
      `[orders:fulfill] Server "${server.name}" has no apiUrl/apiToken. Using local credential generation.`,
    );
    if (product.protocol === "vmess") {
      const config = Buffer.from(
        JSON.stringify({
          v: "2",
          ps: `KETANTECH-${server.name}`,
          add: server.host,
          port: 443,
          id: vpnUuid,
          aid: 0,
          net: "ws",
          type: "none",
          host: server.host,
          path: "/vmess",
          tls: "tls",
        }),
      ).toString("base64");
      configLink = `vmess://${config}`;
    } else if (product.protocol === "vless") {
      configLink = `vless://${vpnUuid}@${server.host}:443?security=tls&type=ws&path=/vless#KETANTECH-${server.name}`;
    } else if (product.protocol === "trojan") {
      configLink = `trojan://${vpnPassword}@${server.host}:443?security=tls#KETANTECH-${server.name}`;
    }
  }

  // ─── DB Transaction: optionally deduct balance + insert VPN account + update order ───
  let balanceBefore: number | null = null;
  let balanceAfter: number | null = null;

  try {
    await db.transaction(async (tx: any) => {
      if (opts.deductBalance) {
        const [updatedUser] = await tx
          .update(usersTable)
          .set({ balance: sql`balance - ${amount}` })
          .where(
            and(
              eq(usersTable.id, order.userId),
              sql`balance >= ${amount}::numeric`,
            ),
          )
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
        .set({
          status: "paid",
          vpnAccountId: acc.id,
          updatedAt: new Date(),
        })
        .where(eq(ordersTable.id, orderId));

      if (order.voucherId) {
        await tx
          .update(vouchersTable)
          .set({
            currentUses: sql`current_uses + 1`,
            updatedAt: new Date(),
          })
          .where(eq(vouchersTable.id, order.voucherId));
      }
    });
  } catch (dbError) {
    // Transaction failed — attempt to rollback the panel account with retries
    if (hasPanel && finalUsername) {
      logger.error(
        { err: dbError, username: finalUsername },
        "[orders:fulfill] DB transaction failed! Attempting panel account rollback with retries.",
      );
      await deletePanelAccountWithRetry(
        {
          apiUrl: server.apiUrl!,
          apiToken: server.apiToken!,
          protocol: product.protocol,
          username: finalUsername,
        },
        {
          orderId,
          userId: order.userId,
          reason: "DB transaction failed after panel account creation",
        },
      );
    }
    throw dbError;
  }

  // ─── Post-commit side effects (fire-and-forget) ────────────────────────

  if (
    opts.deductBalance &&
    balanceBefore !== null &&
    balanceAfter !== null
  ) {
    addBalanceLog({
      userId: order.userId,
      type: "order",
      amount: -amount,
      balanceBefore,
      balanceAfter,
      description: `Pembelian produk: ${product.name} (Order #${order.id})`,
      relatedId: order.id,
    }).catch((err) =>
      logger.error(
        { err, orderId: order.id },
        "[orders:fulfill] addBalanceLog failed",
      ),
    );
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
  }).catch((err) =>
    logger.error({ err }, "notifyUserVpnAccountCreated failed"),
  );

  notifyAdminOrderFulfilled({
    orderId: order.id,
    username: user.username,
    productName: product.name,
    protocol: product.protocol,
    amount,
    paymentMethod: order.paymentMethod ?? "balance",
  }).catch((err) =>
    logger.error({ err }, "notifyAdminOrderFulfilled failed"),
  );

  try {
    const pts = await getPointsSettings();
    if (
      pts.enabled &&
      amount >= pts.pointsMinOrder &&
      pts.pointsRateOrder > 0
    ) {
      const pointsEarned = Math.floor(amount / pts.pointsRateOrder);
      if (pointsEarned > 0) {
        await addPoints(
          order.userId,
          pointsEarned,
          "order",
          `Order #${order.id} — ${product.name}`,
          order.id,
        );
      }
    }
  } catch (err) {
    logger.error(
      { err, orderId: order.id },
      "[orders:fulfill] addPoints failed",
    );
  }

  await processReferralBonus(order.userId, order.id).catch((err) =>
    logger.error(
      { err, orderId: order.id },
      "[referral-bonus] fulfillOrder",
    ),
  );
}

async function processReferralBonus(
  buyerUserId: number,
  orderId: number,
): Promise<void> {
  const referralSettings = await getReferralSettings();
  if (!referralSettings.enabled) return;

  const [buyer] = await db
    .select({
      referredBy: usersTable.referredBy,
      referralBonusClaimed: usersTable.referralBonusClaimed,
    })
    .from(usersTable)
    .where(eq(usersTable.id, buyerUserId))
    .limit(1);

  if (!buyer?.referredBy || buyer.referralBonusClaimed) return;

  const [referrer] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.referralCode, buyer.referredBy))
    .limit(1);

  if (!referrer) return;

  const bonusAmount = referralSettings.bonusAmount;

  await db.transaction(async (tx) => {
    const [updatedReferrer] = await tx
      .update(usersTable)
      .set({
        balance: sql`balance + ${bonusAmount}::numeric`,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, referrer.id))
      .returning({ balance: usersTable.balance });

    await tx
      .update(usersTable)
      .set({ referralBonusClaimed: true, updatedAt: new Date() })
      .where(eq(usersTable.id, buyerUserId));

    if (updatedReferrer) {
      const balanceAfter = Number(updatedReferrer.balance);
      const balanceBefore = balanceAfter - bonusAmount;

      await addBalanceLog({
        userId: referrer.id,
        type: "referral",
        amount: bonusAmount,
        balanceBefore,
        balanceAfter,
        description: `Bonus referral dari pembelian pertama user`,
        relatedId: orderId,
      });
    }
  });
}

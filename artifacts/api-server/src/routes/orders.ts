import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, usersTable, vpnAccountsTable, serversTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateOrderBody } from "@workspace/api-zod";
import { formatProduct } from "./products";
import { randomUUID } from "crypto";
import { createPanelAccount, sanitizeVpnUsername } from "../lib/vpn-panel";
import { addBalanceLog } from "./balance-logs";

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
    vpnAccountId: o.vpnAccountId,
    paymentMethod: o.paymentMethod,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

router.get("/orders", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { status } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [eq(ordersTable.userId, userId)];
  if (status) conditions.push(eq(ordersTable.status, status));

  const orders = await db
    .select()
    .from(ordersTable)
    .where(and(...conditions))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(and(...conditions));

  const formatted = await Promise.all(orders.map(formatOrder));

  res.json({
    orders: formatted,
    total: totalResult[0]?.count ?? 0,
  });
});

router.post("/orders", requireAuth, async (req, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { productId, paymentMethod = "balance", remarks } = parsed.data;
  const userId = req.user!.userId;

  const [product] = await db
    .select()
    .from(productsTable)
    .where(and(eq(productsTable.id, productId), eq(productsTable.isActive, true)))
    .limit(1);

  if (!product) {
    res.status(400).json({ error: "Product not found or not active" });
    return;
  }

  // ─── Deduplication: cegah order duplikat dalam 2 menit terakhir ───────────
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const [existingPending] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, userId),
        eq(ordersTable.productId, productId),
        eq(ordersTable.status, "pending"),
        gte(ordersTable.createdAt, twoMinutesAgo)
      )
    )
    .limit(1);

  if (existingPending) {
    res.status(409).json({
      error: "Kamu sudah punya order pending untuk produk ini. Selesaikan order sebelumnya atau tunggu 2 menit.",
      existingOrderId: existingPending.id,
    });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      productId,
      status: "pending",
      amount: product.price,
      paymentMethod,
      notes: remarks ?? null,
    })
    .returning();

  res.status(201).json(await formatOrder(order));
});

router.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
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

router.post("/orders/:id/pay", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;

  // ─── Step 1: Atomic order lock ─────────────────────────────────────────────
  // Atomically change status from 'pending' → 'processing'.
  // If 0 rows updated: another request already grabbed this order (race condition).
  const [lockedOrder] = await db
    .update(ordersTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(ordersTable.id, id),
        eq(ordersTable.userId, userId),
        eq(ordersTable.status, "pending")
      )
    )
    .returning();

  if (!lockedOrder) {
    // Check why it failed
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)))
      .limit(1);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
    } else if (order.status === "paid") {
      res.status(400).json({ error: "Order sudah dibayar" });
    } else if (order.status === "processing") {
      res.status(409).json({ error: "Order sedang diproses, harap tunggu sebentar" });
    } else {
      res.status(400).json({ error: `Order tidak dapat dibayar (status: ${order.status})` });
    }
    return;
  }

  const order = lockedOrder;
  const amount = Number(order.amount);

  // Helper to rollback order lock on failure
  const releaseOrderLock = () =>
    db.update(ordersTable)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .catch(() => {});

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, order.productId))
    .limit(1);

  if (!product) {
    await releaseOrderLock();
    res.status(400).json({ error: "Product not found" });
    return;
  }

  // Fetch user for username generation
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    await releaseOrderLock();
    res.status(400).json({ error: "User not found" });
    return;
  }

  // Pick a server that supports the ordered protocol
  const allServers = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.isActive, true));

  // Priority: 1) supports protocol + has panel configured, 2) supports protocol, 3) any active server
  const supportsProtocol = (s: typeof allServers[0]) =>
    Array.isArray(s.supportedProtocols) && s.supportedProtocols.includes(product.protocol);

  const server =
    allServers.find((s) => supportsProtocol(s) && s.apiUrl && s.apiToken) ??
    allServers.find((s) => supportsProtocol(s)) ??
    allServers[0];

  if (!server) {
    await releaseOrderLock();
    res.status(400).json({ error: "Tidak ada server yang tersedia saat ini" });
    return;
  }

  const expiresAt = new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000);

  // Use user-specified remarks as the VPN username, or auto-generate
  const remarksBase = order.notes ? sanitizeVpnUsername(order.notes) : null;
  const rawUsername = remarksBase && remarksBase.length >= 3
    ? `${remarksBase}${Date.now().toString().slice(-4)}`
    : `${sanitizeVpnUsername(user.username)}${Date.now()}`;
  const vpnPassword = randomUUID().replace(/-/g, "").slice(0, 12);
  const vpnUuid = randomUUID();

  let finalUsername = rawUsername;
  let finalPassword: string | null = vpnPassword;
  let finalUuid: string | null = vpnUuid;
  let configLink: string | null = null;
  let allLinks: Record<string, string | null> | null = null;

  // ─── Call VPN Panel API if server is configured ───────────────────────────
  const hasPanel = server.apiUrl && server.apiToken;
  console.log(`[orders] Selected server: "${server.name}" (id=${server.id}), protocol=${product.protocol}, hasPanel=${!!hasPanel}`);

  if (hasPanel) {
    try {
      const panelResult = await createPanelAccount({
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

      // Use credentials returned from panel
      finalUsername = panelResult.username;
      finalPassword = panelResult.password ?? vpnPassword;
      finalUuid = panelResult.uuid ?? vpnUuid;
      configLink = panelResult.configLink ?? null;
      if (panelResult.allLinks) {
        const links: Record<string, string | null> = {};
        for (const [k, v] of Object.entries(panelResult.allLinks)) {
          links[k] = v ?? null;
        }
        allLinks = links;
      }

      console.log(`[orders] Panel account created: ${product.protocol}/${finalUsername} on ${server.name}`);
    } catch (panelErr) {
      const msg = panelErr instanceof Error ? panelErr.message : String(panelErr);
      console.error(`[orders] Panel API error for ${product.protocol}: ${msg}`);
      // Reset order to pending so user can retry
      await releaseOrderLock();
      res.status(502).json({
        error: `Gagal membuat akun VPN di server: ${msg}`,
      });
      return;
    }
  } else {
    // No panel configured — generate credentials locally (offline mode / testing)
    console.warn(`[orders] Server "${server.name}" has no apiUrl/apiToken. Using local credential generation.`);
    if (product.protocol === "vmess") {
      const config = Buffer.from(
        JSON.stringify({
          v: "2", ps: `KETANTECH-${server.name}`,
          add: server.host, port: 443, id: vpnUuid,
          aid: 0, net: "ws", type: "none", host: server.host,
          path: "/vmess", tls: "tls",
        })
      ).toString("base64");
      configLink = `vmess://${config}`;
    } else if (product.protocol === "vless") {
      configLink = `vless://${vpnUuid}@${server.host}:443?security=tls&type=ws&path=/vless#KETANTECH-${server.name}`;
    } else if (product.protocol === "trojan") {
      configLink = `trojan://${vpnPassword}@${server.host}:443?security=tls#KETANTECH-${server.name}`;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ─── Step 3: DB Transaction — atomic balance + account + order ───────────
  let balanceBefore: number;
  let balanceAfter: number;

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic balance deduction: only succeeds if balance >= amount at DB level
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`(balance::numeric - ${amount})::text` })
        .where(
          and(
            eq(usersTable.id, userId),
            gte(sql`balance::numeric`, amount)
          )
        )
        .returning({ balance: usersTable.balance });

      if (!updatedUser) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const newBalance = Number(updatedUser.balance);
      const prevBalance = newBalance + amount;

      // Insert VPN account
      const [acc] = await tx
        .insert(vpnAccountsTable)
        .values({
          userId,
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

      // Mark order as paid
      await tx
        .update(ordersTable)
        .set({ status: "paid", vpnAccountId: acc.id, updatedAt: new Date() })
        .where(eq(ordersTable.id, order.id));

      return { acc, prevBalance, newBalance };
    });

    balanceBefore = result.prevBalance;
    balanceAfter = result.newBalance;
  } catch (err) {
    await releaseOrderLock();
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Saldo tidak cukup untuk membayar order ini" });
    } else {
      console.error("[orders] Transaction failed:", err);
      res.status(500).json({ error: "Gagal memproses pembayaran, silakan coba lagi" });
    }
    return;
  }

  // Log balance deduction (fire-and-forget)
  addBalanceLog({
    userId,
    type: "order",
    amount: -amount,
    balanceBefore,
    balanceAfter,
    description: `Pembelian produk: ${product.name} (Order #${order.id})`,
    relatedId: order.id,
  }).catch(() => {});

  const [updatedOrder] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, order.id))
    .limit(1);

  res.json(await formatOrder(updatedOrder));
});

export { formatOrder };
export default router;

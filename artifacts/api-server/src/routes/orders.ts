import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, usersTable, vpnAccountsTable, serversTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateOrderBody } from "@workspace/api-zod";
import { formatProduct } from "./products";
import { randomUUID } from "crypto";
import { createPanelAccount, sanitizeVpnUsername } from "../lib/vpn-panel";

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
  const { productId, paymentMethod = "balance" } = parsed.data;
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

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      productId,
      status: "pending",
      amount: product.price,
      paymentMethod,
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

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status !== "pending") {
    res.status(400).json({ error: "Order is not in pending state" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  const balance = Number(user.balance);
  const amount = Number(order.amount);

  if (balance < amount) {
    res.status(400).json({ error: "Insufficient balance" });
    return;
  }

  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, order.productId))
    .limit(1);

  if (!product) {
    res.status(400).json({ error: "Product not found" });
    return;
  }

  // Pick a server that supports the ordered protocol
  const allServers = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.isActive, true));

  // Prefer a server that supports the protocol; fall back to first active server
  const server =
    allServers.find((s) =>
      Array.isArray(s.supportedProtocols) &&
      s.supportedProtocols.includes(product.protocol)
    ) ?? allServers[0];

  if (!server) {
    res.status(400).json({ error: "Tidak ada server yang tersedia saat ini" });
    return;
  }

  const expiresAt = new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000);

  // Sanitize username for panel (alphanumeric only)
  const rawUsername = `${sanitizeVpnUsername(user.username)}${Date.now()}`;
  const vpnPassword = randomUUID().replace(/-/g, "").slice(0, 12);
  const vpnUuid = randomUUID();

  let finalUsername = rawUsername;
  let finalPassword: string | null = vpnPassword;
  let finalUuid: string | null = vpnUuid;
  let configLink: string | null = null;

  // ─── Call VPN Panel API if server is configured ───────────────────────────
  const hasPanel = server.apiUrl && server.apiToken;

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

      console.log(`[orders] Panel account created: ${product.protocol}/${finalUsername} on ${server.name}`);
    } catch (panelErr) {
      const msg = panelErr instanceof Error ? panelErr.message : String(panelErr);
      console.error(`[orders] Panel API error for ${product.protocol}: ${msg}`);
      // Refund and abort — do not create a "fake" account
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

  const [vpnAccount] = await db
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
      expiresAt,
      quota: product.quota ?? null,
    })
    .returning();

  await db
    .update(usersTable)
    .set({ balance: String(balance - amount) })
    .where(eq(usersTable.id, userId));

  await db
    .update(ordersTable)
    .set({ status: "paid", vpnAccountId: vpnAccount.id, updatedAt: new Date() })
    .where(eq(ordersTable.id, order.id));

  const [updatedOrder] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, order.id))
    .limit(1);

  res.json(await formatOrder(updatedOrder));
});

export { formatOrder };
export default router;

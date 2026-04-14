import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  productsTable,
  serversTable,
  ordersTable,
  vpnAccountsTable,
  topupsTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, asc, sql } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../lib/auth";
import { formatProduct } from "./products";
import { formatOrder } from "./orders";
import { formatAccount } from "./accounts";
import { formatTopup } from "./balance";
import { formatFullServer } from "./servers";
import { createPanelAccount, sanitizeVpnUsername } from "../lib/vpn-panel";
import { notifyUserTopupConfirmed, notifyUserTopupRejected } from "../lib/telegram";
import { addBalanceLog } from "./balance-logs";
import {
  AdminListUsersQueryParams,
  AdminUpdateUserBody,
  AdminCreateProductBody,
  AdminUpdateProductBody,
  AdminCreateServerBody,
  AdminUpdateServerBody,
  AdminListOrdersQueryParams,
  AdminListTopupsQueryParams,
} from "@workspace/api-zod";

const router = Router();

function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    balance: Number(u.balance),
    isActive: u.isActive,
    referralCode: u.referralCode,
    createdAt: u.createdAt,
  };
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

router.get("/admin/dashboard", requireAdmin, async (_req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [totalOrders] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable);

  const revenueResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "paid"));

  const revTodayResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "paid"), sql`created_at >= ${todayStart}`));

  const revMonthResult = await db
    .select({ total: sql<string>`coalesce(sum(amount), 0)` })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "paid"), sql`created_at >= ${monthStart}`));

  const [activeAccounts] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.isActive, true), sql`expires_at > now()`));

  const [pendingTopups] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(topupsTable)
    .where(eq(topupsTable.status, "pending"));

  const [pendingOrders] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.status, "pending"));

  const ordersByProtocol = await db
    .select({
      protocol: productsTable.protocol,
      count: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
    .where(eq(ordersTable.status, "paid"))
    .groupBy(productsTable.protocol);

  const recentOrders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(10);

  const recentTopups = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      qrisUrl: topupsTable.qrisUrl,
      status: topupsTable.status,
      confirmedBy: topupsTable.confirmedBy,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .orderBy(desc(topupsTable.createdAt))
    .limit(10);

  const formattedRecentOrders = await Promise.all(recentOrders.map(formatOrder));

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    totalOrders: totalOrders?.count ?? 0,
    totalRevenue: Number(revenueResult[0]?.total ?? 0),
    activeAccounts: activeAccounts?.count ?? 0,
    pendingTopups: pendingTopups?.count ?? 0,
    pendingOrders: pendingOrders?.count ?? 0,
    revenueToday: Number(revTodayResult[0]?.total ?? 0),
    revenueThisMonth: Number(revMonthResult[0]?.total ?? 0),
    ordersByProtocol,
    recentOrders: formattedRecentOrders,
    recentTopups: recentTopups.map((t) => formatTopup(t as typeof topupsTable.$inferSelect & { username?: string | null })),
  });
});

// ─── Admin: Users ─────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res) => {
  const { search, role } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (search) conditions.push(ilike(usersTable.username, `%${search}%`));
  if (role && ["user", "reseller", "admin"].includes(role)) {
    conditions.push(eq(usersTable.role, role));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const users = await db
    .select()
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(whereClause);

  res.json({
    users: users.map(formatUser),
    total: total?.count ?? 0,
  });
});

router.post("/admin/users", requireAdmin, async (req, res) => {
  const { username, password, email, fullName, whatsapp, role } = req.body ?? {};

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    res.status(400).json({ error: "Username minimal 3 karakter" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password minimal 6 karakter" });
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: "Username hanya boleh huruf, angka, dan underscore" });
    return;
  }
  const validRoles = ["user", "reseller", "admin"];
  const userRole = validRoles.includes(role) ? role : "user";

  const [existingUsername] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username.trim()))
    .limit(1);
  if (existingUsername) {
    res.status(409).json({ error: "Username sudah digunakan" });
    return;
  }

  if (email) {
    const [existingEmail] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, String(email)))
      .limit(1);
    if (existingEmail) {
      res.status(409).json({ error: "Email sudah digunakan" });
      return;
    }
  }

  const passwordHash = await bcrypt.hash(String(password), 12);
  const referralCode = randomBytes(4).toString("hex").toUpperCase();

  const [user] = await db
    .insert(usersTable)
    .values({
      username: username.trim(),
      email: email ? String(email) : null,
      passwordHash,
      fullName: fullName ? String(fullName) : null,
      whatsapp: whatsapp ? String(whatsapp) : null,
      isVerified: true,
      role: userRole,
      referralCode,
    })
    .returning();

  res.status(201).json(formatUser(user));
});

router.get("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, id))
    .orderBy(desc(ordersTable.createdAt))
    .limit(20);

  const accounts = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.userId, id))
    .orderBy(desc(vpnAccountsTable.createdAt))
    .limit(20);

  const topupHistory = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.userId, id))
    .orderBy(desc(topupsTable.createdAt))
    .limit(20);

  const formattedOrders = await Promise.all(orders.map(formatOrder));
  const formattedAccounts = await Promise.all(accounts.map(formatAccount));

  res.json({
    ...formatUser(user),
    orders: formattedOrders,
    accounts: formattedAccounts,
    topupHistory: topupHistory.map((t) => formatTopup(t)),
  });
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = AdminUpdateUserBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { balance, isActive, role, adjustBalance } = parsed.data;

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const updateData: Partial<typeof usersTable.$inferSelect> = {};

  if (balance !== undefined) updateData.balance = String(balance) as unknown as number & string;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (role !== undefined) updateData.role = role;

  let balanceAdjustLog: { balanceBefore: number; balanceAfter: number; amount: number } | null = null;
  if (adjustBalance !== undefined) {
    const balanceBefore = Number(existing.balance);
    const newBal = Math.max(0, balanceBefore + adjustBalance);
    updateData.balance = String(newBal) as unknown as number & string;
    balanceAdjustLog = { balanceBefore, balanceAfter: newBal, amount: adjustBalance };
  }

  const [updated] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, id))
    .returning();

  if (balanceAdjustLog) {
    addBalanceLog({
      userId: id,
      type: "adjustment",
      amount: balanceAdjustLog.amount,
      balanceBefore: balanceAdjustLog.balanceBefore,
      balanceAfter: balanceAdjustLog.balanceAfter,
      description: `Penyesuaian saldo oleh admin (${balanceAdjustLog.amount >= 0 ? "+" : ""}${balanceAdjustLog.amount})`,
    }).catch(() => {});
  }

  res.json(formatUser(updated));
});

// ─── Admin: Products ──────────────────────────────────────────────────────────

router.get("/admin/products", requireAdmin, async (_req, res) => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(asc(productsTable.sortOrder), asc(productsTable.id));
  res.json(products.map(formatProduct));
});

router.post("/admin/products", requireAdmin, async (req, res) => {
  const parsed = AdminCreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [product] = await db
    .insert(productsTable)
    .values({
      name: data.name,
      description: data.description ?? null,
      protocol: data.protocol,
      durationDays: data.durationDays,
      price: String(data.price),
      quota: data.quota != null ? String(data.quota) : null,
      maxConnections: data.maxConnections ?? null,
      isActive: data.isActive ?? true,
      category: data.category ?? null,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();
  res.status(201).json(formatProduct(product));
});

router.patch("/admin/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = AdminUpdateProductBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.quota !== undefined) updateData.quota = data.quota != null ? String(data.quota) : null;
  if (data.maxConnections !== undefined) updateData.maxConnections = data.maxConnections;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [product] = await db
    .update(productsTable)
    .set(updateData)
    .where(eq(productsTable.id, id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(formatProduct(product));
});

router.delete("/admin/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.update(productsTable).set({ isActive: false }).where(eq(productsTable.id, id));
  res.json({ message: "Product deleted" });
});

// ─── Admin: Servers ───────────────────────────────────────────────────────────

router.get("/admin/servers", requireAdmin, async (_req, res) => {
  const servers = await db
    .select()
    .from(serversTable)
    .orderBy(asc(serversTable.sortOrder));

  const result = await Promise.all(
    servers.map(async (s) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(and(eq(vpnAccountsTable.serverId, s.id), eq(vpnAccountsTable.isActive, true)));
      return { ...formatFullServer(s), activeAccounts: count ?? 0 };
    })
  );

  res.json(result);
});

router.post("/admin/servers", requireAdmin, async (req, res) => {
  const parsed = AdminCreateServerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [server] = await db
    .insert(serversTable)
    .values({
      name: data.name,
      location: data.location,
      flag: data.flag,
      host: data.host,
      apiUrl: data.apiUrl ?? null,
      apiToken: data.apiToken ?? null,
      supportedProtocols: data.supportedProtocols,
      isActive: data.isActive ?? true,
    })
    .returning();
  res.status(201).json(formatFullServer(server));
});

router.patch("/admin/servers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = AdminUpdateServerBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.flag !== undefined) updateData.flag = data.flag;
  if (data.host !== undefined) updateData.host = data.host;
  if (data.apiUrl !== undefined) updateData.apiUrl = data.apiUrl;
  if (data.apiToken !== undefined) updateData.apiToken = data.apiToken;
  if (data.supportedProtocols !== undefined) updateData.supportedProtocols = data.supportedProtocols;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [server] = await db
    .update(serversTable)
    .set(updateData)
    .where(eq(serversTable.id, id))
    .returning();

  if (!server) {
    res.status(404).json({ error: "Server not found" });
    return;
  }

  res.json(formatFullServer(server));
});

router.delete("/admin/servers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.update(serversTable).set({ isActive: false }).where(eq(serversTable.id, id));
  res.json({ message: "Server deleted" });
});

// ─── Admin: Orders ────────────────────────────────────────────────────────────

router.get("/admin/orders", requireAdmin, async (req, res) => {
  const { status, userId, search } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (userId) conditions.push(eq(ordersTable.userId, parseInt(userId, 10)));
  if (search) conditions.push(ilike(usersTable.username, `%${search}%`));

  const rows = await db
    .select({
      order: ordersTable,
      user: {
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        balance: usersTable.balance,
        isActive: usersTable.isActive,
        referralCode: usersTable.referralCode,
        createdAt: usersTable.createdAt,
      },
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const formatted = await Promise.all(
    rows.map(async ({ order, user }) => {
      const base = await formatOrder(order);
      return {
        ...base,
        user: user
          ? {
              id: user.id,
              username: user.username,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              balance: Number(user.balance),
              isActive: user.isActive,
              referralCode: user.referralCode,
              createdAt: user.createdAt,
            }
          : null,
      };
    })
  );

  res.json({ orders: formatted, total: total?.count ?? 0 });
});

router.post("/admin/orders/:id/confirm", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status === "paid") {
    res.json(await formatOrder(order));
    return;
  }

  // Provision VPN account if not already linked
  let vpnAccountId = order.vpnAccountId;

  if (!vpnAccountId) {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, order.productId))
      .limit(1);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, order.userId))
      .limit(1);

    const allServers = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.isActive, true));

    const supportsProtocol = (s: typeof allServers[0]) =>
      product
        ? Array.isArray(s.supportedProtocols) && s.supportedProtocols.includes(product.protocol)
        : false;

    const server =
      allServers.find((s) => supportsProtocol(s) && s.apiUrl && s.apiToken) ??
      allServers.find(supportsProtocol) ??
      allServers[0];

    if (product && user && server) {
      const expiresAt = new Date(Date.now() + product.durationDays * 24 * 60 * 60 * 1000);
      const rawUsername = `${sanitizeVpnUsername(user.username)}${Date.now()}`;
      const vpnPassword = randomUUID().replace(/-/g, "").slice(0, 12);
      const vpnUuid = randomUUID();

      let finalUsername = rawUsername;
      let finalPassword: string | null = vpnPassword;
      let finalUuid: string | null = vpnUuid;
      let configLink: string | null = null;

      if (server.apiUrl && server.apiToken) {
        try {
          const panelResult = await createPanelAccount({
            apiUrl: server.apiUrl,
            apiToken: server.apiToken,
            protocol: product.protocol,
            username: rawUsername,
            password: vpnPassword,
            durationDays: product.durationDays,
            quota: product.quota ? Number(product.quota) : null,
            maxConnections: product.maxConnections ?? null,
            uuid: vpnUuid,
          });
          finalUsername = panelResult.username;
          finalPassword = panelResult.password ?? vpnPassword;
          finalUuid = panelResult.uuid ?? vpnUuid;
          configLink = panelResult.configLink ?? null;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[admin/confirm] Panel API error: ${msg}`);
          // Continue — admin confirmation still marks order paid even if panel fails
        }
      }

      const [vpnAccount] = await db
        .insert(vpnAccountsTable)
        .values({
          userId: user.id,
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

      vpnAccountId = vpnAccount.id;
    }
  }

  const [updated] = await db
    .update(ordersTable)
    .set({ status: "paid", vpnAccountId: vpnAccountId ?? order.vpnAccountId, updatedAt: new Date() })
    .where(eq(ordersTable.id, id))
    .returning();

  res.json(await formatOrder(updated));
});

// ─── Admin: Topups ────────────────────────────────────────────────────────────

router.get("/admin/topups", requireAdmin, async (req, res) => {
  const { status } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const topups = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      qrisUrl: topupsTable.qrisUrl,
      status: topupsTable.status,
      confirmedBy: topupsTable.confirmedBy,
      rejectionNote: topupsTable.rejectionNote,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .where(status ? eq(topupsTable.status, status) : undefined)
    .orderBy(desc(topupsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(topups.map((t) => formatTopup(t as typeof topupsTable.$inferSelect & { username?: string | null })));
});

router.post("/admin/topups/:id/confirm", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const adminId = req.user!.userId;

  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, id))
    .limit(1);

  if (!topup) {
    res.status(404).json({ error: "Topup not found" });
    return;
  }

  if (topup.status !== "pending") {
    res.status(400).json({ error: "Topup is not pending" });
    return;
  }

  await db
    .update(usersTable)
    .set({
      balance: sql`balance + ${Number(topup.amount)}`,
    })
    .where(eq(usersTable.id, topup.userId));

  const [updated] = await db
    .update(topupsTable)
    .set({ status: "confirmed", confirmedBy: adminId, updatedAt: new Date() })
    .where(eq(topupsTable.id, id))
    .returning();

  // Fetch updated balance for notification and log
  const [updatedUser] = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.id, topup.userId))
    .limit(1);

  const balanceAfter = Number(updatedUser?.balance ?? 0);
  const balanceBefore = balanceAfter - Number(topup.amount);

  // Log balance change
  addBalanceLog({
    userId: topup.userId,
    type: "topup",
    amount: Number(topup.amount),
    balanceBefore,
    balanceAfter,
    description: `Topup dikonfirmasi (ID #${topup.id})`,
    relatedId: topup.id,
  }).catch(() => {});

  // Notify user via Telegram (fire and forget)
  notifyUserTopupConfirmed(topup.userId, Number(topup.amount), balanceAfter).catch(() => {});

  res.json(formatTopup(updated));
});

router.post("/admin/topups/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const adminId = req.user!.userId;
  const rejectionNote = req.body?.rejectionNote ? String(req.body.rejectionNote).slice(0, 200) : null;

  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, id))
    .limit(1);

  if (!topup) {
    res.status(404).json({ error: "Topup not found" });
    return;
  }

  const [updated] = await db
    .update(topupsTable)
    .set({ status: "rejected", confirmedBy: adminId, rejectionNote, updatedAt: new Date() })
    .where(eq(topupsTable.id, id))
    .returning();

  // Notify user via Telegram (fire and forget)
  notifyUserTopupRejected(topup.userId, Number(topup.amount), rejectionNote).catch(() => {});

  res.json(formatTopup(updated));
});

// ─── Admin: VPN Accounts ─────────────────────────────────────────────────────

router.get("/admin/accounts", requireAdmin, async (req, res) => {
  const { userId, protocol, isActive, search } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const conditions = [];
  if (userId) conditions.push(eq(vpnAccountsTable.userId, parseInt(userId, 10)));
  if (protocol) conditions.push(eq(vpnAccountsTable.protocol, protocol));
  if (isActive !== undefined) conditions.push(eq(vpnAccountsTable.isActive, isActive === "true"));
  if (search) {
    conditions.push(
      or(
        ilike(vpnAccountsTable.username, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
        ilike(usersTable.email, `%${search}%`)
      )!
    );
  }

  const accounts = await db
    .select({
      id: vpnAccountsTable.id,
      userId: vpnAccountsTable.userId,
      orderId: vpnAccountsTable.orderId,
      protocol: vpnAccountsTable.protocol,
      username: vpnAccountsTable.username,
      password: vpnAccountsTable.password,
      uuid: vpnAccountsTable.uuid,
      serverId: vpnAccountsTable.serverId,
      configLink: vpnAccountsTable.configLink,
      expiresAt: vpnAccountsTable.expiresAt,
      quota: vpnAccountsTable.quota,
      usedQuota: vpnAccountsTable.usedQuota,
      isActive: vpnAccountsTable.isActive,
      createdAt: vpnAccountsTable.createdAt,
      updatedAt: vpnAccountsTable.updatedAt,
      userUsername: usersTable.username,
      userEmail: usersTable.email,
      serverName: serversTable.name,
      serverLocation: serversTable.location,
      serverFlag: serversTable.flag,
      serverIsActive: serversTable.isActive,
    })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .leftJoin(serversTable, eq(vpnAccountsTable.serverId, serversTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(vpnAccountsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const formatted = accounts.map((a) => ({
    id: a.id,
    userId: a.userId,
    orderId: a.orderId,
    protocol: a.protocol,
    username: a.username,
    password: a.password,
    uuid: a.uuid,
    serverId: a.serverId,
    server: {
      id: a.serverId,
      name: a.serverName ?? "",
      location: a.serverLocation ?? "",
      flag: a.serverFlag ?? "🌐",
      isActive: a.serverIsActive ?? false,
    },
    configLink: a.configLink,
    expiresAt: a.expiresAt,
    quota: a.quota != null ? Number(a.quota) : null,
    usedQuota: a.usedQuota != null ? Number(a.usedQuota) : null,
    isActive: a.isActive,
    createdAt: a.createdAt,
    user: a.userUsername
      ? { id: a.userId, username: a.userUsername, email: a.userEmail ?? "" }
      : null,
  }));

  res.json({ accounts: formatted, total: total?.count ?? 0 });
});

router.post("/admin/accounts/:id/extend", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const days = parseInt(String(req.body?.days ?? "30"), 10);

  if (isNaN(days) || days < 1 || days > 365) {
    res.status(400).json({ error: "Jumlah hari tidak valid (1–365)" });
    return;
  }

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const base = account.expiresAt && new Date(account.expiresAt) > new Date()
    ? new Date(account.expiresAt)
    : new Date();

  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  const [updated] = await db
    .update(vpnAccountsTable)
    .set({ expiresAt: newExpiry, isActive: true, updatedAt: new Date() })
    .where(eq(vpnAccountsTable.id, id))
    .returning();

  res.json({ id: updated.id, expiresAt: updated.expiresAt, isActive: updated.isActive });
});

router.delete("/admin/accounts/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  await db.delete(vpnAccountsTable).where(eq(vpnAccountsTable.id, id));
  res.json({ success: true });
});

router.delete("/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, id))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  if (order.status === "paid") {
    res.status(400).json({ error: "Order yang sudah dibayar tidak bisa dihapus" });
    return;
  }

  await db.delete(ordersTable).where(eq(ordersTable.id, id));
  res.json({ success: true });
});

router.post("/admin/accounts/:id/toggle", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  const [account] = await db
    .select()
    .from(vpnAccountsTable)
    .where(eq(vpnAccountsTable.id, id))
    .limit(1);

  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }

  const [updated] = await db
    .update(vpnAccountsTable)
    .set({ isActive: !account.isActive, updatedAt: new Date() })
    .where(eq(vpnAccountsTable.id, id))
    .returning();

  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, updated.serverId))
    .limit(1);

  res.json({
    id: updated.id,
    userId: updated.userId,
    orderId: updated.orderId,
    protocol: updated.protocol,
    username: updated.username,
    password: updated.password,
    uuid: updated.uuid,
    serverId: updated.serverId,
    server: server
      ? { id: server.id, name: server.name, location: server.location, flag: server.flag, isActive: server.isActive }
      : null,
    configLink: updated.configLink,
    expiresAt: updated.expiresAt,
    quota: updated.quota != null ? Number(updated.quota) : null,
    usedQuota: updated.usedQuota != null ? Number(updated.usedQuota) : null,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
  });
});

export default router;

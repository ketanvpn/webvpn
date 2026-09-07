import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  vpnAccountsTable,
  topupsTable,
  dynamicVpnOrdersTable,
  ticketsTable,
  ticketMessagesTable,
  pointLogsTable,
  balanceLogsTable,
} from "@workspace/db";
import { eq, and, ilike, desc, sql, inArray } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { requireAdmin } from "../../lib/auth";
import { logger } from "../../lib/logger";
import { formatOrders } from "../../lib/fulfillment/format-order";
import { formatAccount } from "../accounts";
import { formatTopup } from "../balance";
import { addBalanceLog } from "../balance-logs";
import { logAdminAction } from "../admin-audit";
import { getClientIp } from "../../lib/request-ip";
import { AdminUpdateUserBody } from "@workspace/api-zod";
import { formatUser, getAdminId } from "./helpers";

const router = Router();

// ─── Admin: Users ─────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, asyncHandler(async (req, res) => {
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
}));

router.post("/admin/users", requireAdmin, asyncHandler(async (req, res) => {
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

  // Audit log
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "create_user",
    targetType: "user",
    targetId: user.id,
    details: { username: user.username, role: userRole, email, whatsapp },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "create_user" }, "Failed to log admin action"));

  res.status(201).json(formatUser(user));
}));

router.get("/admin/users/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);

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

  const formattedOrders = await formatOrders(orders);
  const formattedAccounts = await Promise.all(accounts.map(formatAccount));

  res.json({
    ...formatUser(user),
    orders: formattedOrders,
    accounts: formattedAccounts,
    topupHistory: topupHistory.map((t) => formatTopup(t)),
  });
}));

router.patch("/admin/users/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
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

  // Build non-balance update fields
  const updateData: Record<string, unknown> = {};
  if (isActive !== undefined) updateData.isActive = isActive;
  if (role !== undefined) updateData.role = role;

  let balanceAdjustLog: { balanceBefore: number; balanceAfter: number; amount: number } | null = null;

  // Handle balance updates atomically via SQL
  if (balance !== undefined) {
    updateData.balance = sql`${balance}::numeric`;
  }

  if (adjustBalance !== undefined) {
    const balanceBefore = Number(existing.balance);
    const newBal = Math.max(0, balanceBefore + adjustBalance);
    updateData.balance = sql`GREATEST(0, balance + ${adjustBalance}::numeric)`;
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
    }).catch((err) => logger.error({ err }, "Failed to add balance log"));
  }

  // Catat aksi admin
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "update_user",
    targetType: "user",
    targetId: id,
    details: {
      changes: parsed.data,
      balanceAdjusted: balanceAdjustLog ? balanceAdjustLog.amount : null,
    },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "update_user" }, "Failed to log admin action"));

  res.json(formatUser(updated));
}));

router.delete("/admin/users/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const currentUserId = getAdminId(req);

  if (currentUserId === id) {
    res.status(400).json({ error: "Tidak bisa menghapus akun sendiri" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "User tidak ditemukan" });
    return;
  }

  if (existing.role === "admin") {
    res.status(400).json({ error: "Tidak bisa menghapus akun Administrator" });
    return;
  }

  const countRows = async (table: any, column: any) => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(eq(column, id));
    return Number(row?.count ?? 0);
  };

  const [vpnCount, orderCount, topupCount, dynamicOrderCount, ticketCount, ticketMessageCount, pointLogCount, balanceLogCount] = await Promise.all([
    countRows(vpnAccountsTable, vpnAccountsTable.userId),
    countRows(ordersTable, ordersTable.userId),
    countRows(topupsTable, topupsTable.userId),
    countRows(dynamicVpnOrdersTable, dynamicVpnOrdersTable.userId),
    countRows(ticketsTable, ticketsTable.userId),
    countRows(ticketMessagesTable, ticketMessagesTable.userId),
    countRows(pointLogsTable, pointLogsTable.userId),
    countRows(balanceLogsTable, balanceLogsTable.userId),
  ]);

  const relationSummary = {
    vpnAccounts: vpnCount,
    orders: orderCount,
    topups: topupCount,
    dynamicOrders: dynamicOrderCount,
    tickets: ticketCount,
    ticketMessages: ticketMessageCount,
    pointLogs: pointLogCount,
    balanceLogs: balanceLogCount,
  };

  const hasRelatedData = Object.values(relationSummary).some((count) => count > 0);
  if (hasRelatedData) {
    res.status(409).json({
      error: "User memiliki riwayat transaksi/akun/tiket. Demi keamanan data, gunakan suspend/nonaktifkan akun daripada hapus permanen.",
      relations: relationSummary,
    });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(usersTable).where(eq(usersTable.id, id));
  });

  // Catat aksi admin
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "delete_user",
    targetType: "user",
    targetId: id,
    details: { username: existing.username, role: existing.role },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "delete_user" }, "Failed to log admin action"));

  res.json({ success: true });
}));

router.post("/admin/users/:id/reset-password", requireAdmin, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const { newPassword } = req.body ?? {};

  // Catat aksi admin
  const adminId = getAdminId(req);
  logAdminAction({
    adminUserId: adminId,
    action: "reset_user_password",
    targetType: "user",
    targetId: id,
    details: {},
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "reset_user_password" }, "Failed to log admin action"));

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "Password baru minimal 6 karakter" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db
    .update(usersTable)
    .set({ passwordHash, sessionVersion: sql`session_version + 1` })
    .where(eq(usersTable.id, id));

  res.json({ success: true });
}));

export default router;

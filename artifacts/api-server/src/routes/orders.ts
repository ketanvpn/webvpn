import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, productsTable, usersTable, vpnAccountsTable, serversTable, vouchersTable } from "@workspace/db";
import { eq, and, desc, sql, gte, count, gt, ne } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateOrderBody } from "@workspace/api-zod";
import { formatProduct } from "./products";
import { randomUUID } from "crypto";
import { createPanelAccount, sanitizeVpnUsername, deletePanelAccount } from "../lib/vpn-panel";
import { addBalanceLog } from "./balance-logs";
import { getPaymentSettingsMap, getResellerSettings } from "./settings";
import { logger } from "../lib/logger";
import { notifyUserVpnAccountCreated, notifyAdminOrderFulfilled } from "../lib/telegram";
import { addPoints, getPointsSettings } from "./points";
import { getReferralBonusAmount } from "../lib/scheduler";

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
    qrisUrl: o.qrisUrl ?? null,
    expiresAt: o.expiresAt ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/**
 * Generate a QRIS via AutoGoPay and return the QRIS data.
 * Returns null if AutoGoPay is not the active gateway or not configured.
 */
async function generateAutoGopayQris(amount: number): Promise<{
  transactionId: string;
  qrisUrl: string;
  expiresAt: Date;
} | null> {
  const settingsMap = await getPaymentSettingsMap();
  const activeGateway = settingsMap["activeGateway"] ?? "qris_static";

  if (activeGateway !== "autogopay") return null;

  const apiUrl = (settingsMap["autoGopayApiUrl"] ?? "https://v1-gateway.autogopay.site").replace(/\/$/, "");
  const apiKey = settingsMap["autoGopaySecretKey"];

  if (!apiKey) {
    logger.warn("AutoGoPay not configured — cannot generate QRIS for order");
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let resp: Response;
  try {
    resp = await fetch(`${apiUrl}/qris/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ amount }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await resp.json() as {
    success: boolean;
    data?: { transaction_id: string; qr_url: string; expiry_time: string };
    message?: string;
  };

  if (!data.success || !data.data) {
    logger.error({ data }, "AutoGoPay: generate QRIS for order failed");
    throw new Error(data.message ?? "Gagal membuat QRIS dari AutoGoPay");
  }

  return {
    transactionId: data.data.transaction_id,
    qrisUrl: data.data.qr_url,
    expiresAt: new Date(data.data.expiry_time.replace(" ", "T") + "+07:00"),
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

  const supportsProtocol = (s: typeof allServers[0]) =>
    Array.isArray(s.supportedProtocols) && s.supportedProtocols.includes(product.protocol);

  // Jika produk di-pin ke server tertentu
  if (product.serverId) {
    const pinnedServer = allServers.find((s) => s.id === product.serverId);
    if (!pinnedServer) {
      throw new Error(`Server untuk produk ini sedang offline atau penuh.`);
    }
    server = pinnedServer;
  } else {
    // Jika tidak di-pin, cari server aktif mana saja yang support protokol
    server = allServers.find((s) => supportsProtocol(s) && s.apiUrl && s.apiToken) ??
      allServers.find((s) => supportsProtocol(s)) ??
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
  logger.info(`[orders:fulfill] Server: "${server.name}", protocol: ${product.protocol}, hasPanel: ${!!hasPanel}`);

  if (hasPanel) {
    const panelResult = await createPanelAccount({
      apiUrl: server.apiUrl!,
      apiToken: server.apiToken!,
      protocol: product.protocol,
      username: rawUsername,
      password: vpnPassword,
      durationDays: isTrial ? 1 : product.durationDays, // VPN Panel butuh minimal 1 hari
      quota: product.quota ? Number(product.quota) : null,
      maxConnections: product.maxConnections ?? null,
      uuid: vpnUuid,
    });
    finalUsername = panelResult.username;
    finalPassword = panelResult.password ?? vpnPassword;
    finalUuid = panelResult.uuid ?? vpnUuid;
    configLink = panelResult.configLink ?? null;
    if (panelResult.allLinks) {
      const links: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(panelResult.allLinks)) links[k] = v ?? null;
      allLinks = links;
    }
    logger.info(`[orders:fulfill] Panel account created: ${product.protocol}/${finalUsername}`);
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
    await db.transaction(async (tx) => {
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

      const bonusAmount = await getReferralBonusAmount();
      const refBalanceBefore = Number(referrer.balance);
      const refBalanceAfter = refBalanceBefore + bonusAmount;

      await db
        .update(usersTable)
        .set({ balance: sql`balance + ${bonusAmount}` })
        .where(eq(usersTable.id, referrer.id));

      await db
        .update(usersTable)
        .set({ referralBonusClaimed: true })
        .where(eq(usersTable.id, order.userId));

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
    const remarksIssue = parsed.error.issues.find((i) => i.path.includes("remarks"));
    const errorMsg = remarksIssue
      ? "Nama akun tidak valid. Minimal 5 karakter, harus mengandung huruf dan minimal 2 angka. Contoh: daaw12"
      : "Input tidak valid";
    res.status(400).json({ error: errorMsg });
    return;
  }
  const { productId, paymentMethod = "balance", remarks } = parsed.data;
  const userId = req.user!.userId;

  // Normalisasi: pastikan lowercase karena Zod sudah memastikan hanya alphanumeric
  const normalizedRemarks = remarks.trim().toLowerCase();

  const [productRow] = await db
    .select({ product: productsTable, serverActive: serversTable.isActive })
    .from(productsTable)
    .leftJoin(serversTable, eq(productsTable.serverId, serversTable.id))
    .where(and(eq(productsTable.id, productId), eq(productsTable.isActive, true)))
    .limit(1);

  if (!productRow) {
    res.status(400).json({ error: "Product not found or not active" });
    return;
  }

  const product = productRow.product;
  if (product.serverId && productRow.serverActive === false) {
    res.status(400).json({ error: "Server untuk produk ini sedang offline/maintenance" });
    return;
  }

  // Cek apakah produk ini Trial 1 Jam (durationDays = 0)
  if (product.durationDays === 0) {
    const [existingTrial] = await db
      .select({ id: ordersTable.id })
      .from(ordersTable)
      .innerJoin(productsTable, eq(ordersTable.productId, productsTable.id))
      .where(
        and(
          eq(ordersTable.userId, userId),
          eq(productsTable.durationDays, 0),
          ne(ordersTable.status, "cancelled")
        )
      )
      .limit(1);

    if (existingTrial) {
      res.status(400).json({ error: "Kamu sudah pernah mengambil paket Trial 1 Jam. Trial hanya berlaku 1 kali per akun." });
      return;
    }
  }

  // ─── Cek ketersediaan stok ─────────────────────────────────────────────────
  const [{ activeCount }] = await db
    .select({ activeCount: count(vpnAccountsTable.id) })
    .from(vpnAccountsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, vpnAccountsTable.orderId))
    .where(and(eq(ordersTable.productId, productId), gt(vpnAccountsTable.expiresAt, new Date())));

  if (Number(activeCount) >= product.stock) {
    res.status(400).json({ error: "Stok produk ini sudah habis. Coba lagi nanti atau pilih produk lain." });
    return;
  }

  // Ambil role terkini dari DB (bukan JWT yang bisa basi setelah admin ubah role)
  const [dbUser] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const userRole = dbUser?.role ?? req.user!.role;

  let amount = Number(product.price);
  if (userRole === "reseller") {
    const resellerSettings = await getResellerSettings();
    if (resellerSettings.resellerEnabled && resellerSettings.resellerDiscountPercent > 0) {
      amount = Math.floor(amount * (1 - resellerSettings.resellerDiscountPercent / 100));
    }
  }

  let appliedVoucherId: number | null = null;
  let appliedDiscountAmount = 0;

  if (parsed.data.voucherCode) {
    const [voucher] = await db
      .select()
      .from(vouchersTable)
      .where(eq(vouchersTable.code, parsed.data.voucherCode))
      .limit(1);

    if (!voucher || !voucher.isActive) {
      res.status(400).json({ error: "Voucher tidak valid atau sudah tidak aktif" });
      return;
    }

    if (voucher.maxUses && voucher.currentUses >= voucher.maxUses) {
      res.status(400).json({ error: "Voucher telah mencapai batas maksimal penggunaan" });
      return;
    }

    if (voucher.expiresAt && new Date() > voucher.expiresAt) {
      res.status(400).json({ error: "Voucher sudah kedaluwarsa" });
      return;
    }

    if (voucher.discountType === "percent") {
      appliedDiscountAmount = Math.floor(amount * (Number(voucher.discountValue) / 100));
    } else if (voucher.discountType === "fixed") {
      appliedDiscountAmount = Number(voucher.discountValue);
    }
    
    appliedDiscountAmount = Math.min(appliedDiscountAmount, amount);
    amount = amount - appliedDiscountAmount;
    appliedVoucherId = voucher.id;
  }

  // ─── Cek duplikat nama akun: cegah bentrok username di server VPN ─────────
  const [existingAccount] = await db
    .select({ id: vpnAccountsTable.id })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.username, normalizedRemarks), eq(vpnAccountsTable.isActive, true)))
    .limit(1);

  if (existingAccount) {
    res.status(409).json({
      error: `Nama akun "${normalizedRemarks}" sudah dipakai. Pilih nama lain.`,
    });
    return;
  }

  // Cek juga di order pending/processing yang belum jadi akun (supaya tidak race condition)
  const [existingOrderWithSameName] = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(
      and(
        sql`lower(notes) = ${normalizedRemarks}`,
        sql`status IN ('pending', 'processing')`
      )
    )
    .limit(1);

  if (existingOrderWithSameName) {
    res.status(409).json({
      error: `Nama akun "${normalizedRemarks}" sedang digunakan di order lain yang belum selesai. Tunggu sebentar atau pilih nama lain.`,
    });
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

  // ─── Generate QRIS via AutoGoPay jika paymentMethod = "qris" ─────────────
  let qrisData: { transactionId: string; qrisUrl: string; expiresAt: Date } | null = null;
  if (paymentMethod === "qris") {
    try {
      qrisData = await generateAutoGopayQris(amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: `Gagal membuat QRIS: ${msg}` });
      return;
    }
    if (!qrisData) {
      res.status(400).json({ error: "Pembayaran QRIS via AutoGoPay belum dikonfigurasi. Hubungi admin." });
      return;
    }
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      productId,
      status: "pending",
      amount: String(amount),
      paymentMethod,
      notes: normalizedRemarks,
      voucherId: appliedVoucherId,
      discountAmount: String(appliedDiscountAmount),
      autogopayTransactionId: qrisData?.transactionId ?? null,
      qrisUrl: qrisData?.qrisUrl ?? null,
      expiresAt: qrisData?.expiresAt ?? null,
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
    res.status(404).json({ error: "Order tidak ditemukan" });
    return;
  }

  if (order.status === "paid") {
    res.status(400).json({ error: "Order sudah dibayar" });
    return;
  }

  if (order.status !== "pending") {
    res.status(400).json({ error: `Order tidak dapat dibayar (status: ${order.status})` });
    return;
  }

  // QRIS orders: payment is automatic via webhook. Just return current QRIS data.
  if (order.paymentMethod === "qris") {
    res.json(await formatOrder(order));
    return;
  }

  // Balance payment: lock order then fulfill
  const [lockedOrder] = await db
    .update(ordersTable)
    .set({ status: "processing", updatedAt: new Date() })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.userId, userId), eq(ordersTable.status, "pending")))
    .returning();

  if (!lockedOrder) {
    res.status(409).json({ error: "Order sedang diproses, harap tunggu sebentar" });
    return;
  }

  try {
    await fulfillOrder(id, { deductBalance: true });
  } catch (err) {
    // Release lock on failure
    await db.update(ordersTable).set({ status: "pending", updatedAt: new Date() }).where(eq(ordersTable.id, id)).catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Saldo tidak cukup untuk membayar order ini" });
    } else {
      logger.error({ err }, "[orders:pay] fulfillOrder failed");
      res.status(500).json({ error: `Gagal memproses pembayaran: ${msg}` });
    }
    return;
  }

  const [updatedOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
  res.json(await formatOrder(updatedOrder));
});

export { formatOrder };
export default router;

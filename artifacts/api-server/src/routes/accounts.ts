import { Router } from "express";
import { db } from "@workspace/db";
import { vpnAccountsTable, serversTable, ordersTable, productsTable, usersTable, dynamicVpnOrdersTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { RenewAccountBody } from "@workspace/api-zod";
import { getResellerSettings } from "./settings";
import { renewPanelAccount } from "../lib/vpn-panel";
import { sendWhatsapp } from "../lib/fonnte";
import { addBalanceLog } from "./balance-logs";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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
    })
    .from(dynamicVpnOrdersTable)
    .where(eq(dynamicVpnOrdersTable.vpnAccountId, a.id))
    .limit(1);

  const allLinks = (a.allLinks ?? null) as Record<string, string | null | undefined> | null;
  const dynamicHost = allLinks?.domain ?? allLinks?.cloudfront ?? allLinks?.host ?? allLinks?.server ?? allLinks?.sni ?? allLinks?.servername ?? allLinks?.hostname ?? null;

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

  res.json(await formatAccount(account));
});

router.post("/accounts/:id/renew", requireAuth, async (req, res) => {
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

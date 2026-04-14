import { Router } from "express";
import { db } from "@workspace/db";
import { vpnAccountsTable, serversTable, ordersTable, productsTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { RenewAccountBody } from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { renewPanelAccount } from "../lib/vpn-panel";
import { sendWhatsapp } from "../lib/fonnte";
import { addBalanceLog } from "./balance-logs";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const router = Router();

async function formatAccount(a: typeof vpnAccountsTable.$inferSelect) {
  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, a.serverId))
    .limit(1);

  return {
    id: a.id,
    userId: a.userId,
    orderId: a.orderId,
    protocol: a.protocol,
    username: a.username,
    password: a.password,
    uuid: a.uuid,
    serverId: a.serverId,
    server: server
      ? { id: server.id, name: server.name, host: server.host, location: server.location, flag: server.flag, isActive: server.isActive }
      : null,
    configLink: a.configLink,
    allLinks: a.allLinks ?? null,
    expiresAt: a.expiresAt,
    quota: a.quota != null ? Number(a.quota) : null,
    usedQuota: a.usedQuota != null ? Number(a.usedQuota) : null,
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
  const id = parseInt(req.params.id, 10);
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
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.userId;
  const parsed = RenewAccountBody.safeParse(req.body);

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
    res.status(400).json({ error: "Product protocol does not match account protocol" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const price = Number(product.price);

  const baseDate = account.expiresAt > new Date() ? account.expiresAt : new Date();
  const newExpiresAt = new Date(baseDate.getTime() + product.durationDays * 24 * 60 * 60 * 1000);

  // ─── Atomic transaction: balance deduction + account update + order insert ──
  let balanceBefore: number;
  let balanceAfter: number;

  try {
    const txResult = await db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`(balance::numeric - ${price})::text` })
        .where(
          and(
            eq(usersTable.id, userId),
            gte(sql`balance::numeric`, price)
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
          amount: product.price,
          vpnAccountId: account.id,
          paymentMethod: "balance",
          notes: "renewal",
        });

      return { prevBalance, newBalance };
    });

    balanceBefore = txResult.prevBalance;
    balanceAfter = txResult.newBalance;
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      res.status(400).json({ error: "Saldo tidak cukup untuk melakukan renew" });
    } else {
      console.error("[renew] Transaction failed:", err);
      res.status(500).json({ error: "Gagal memproses renew, silakan coba lagi" });
    }
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

  // Notify VPS panel to extend the account on the actual server (best-effort)
  const [server] = await db
    .select({ apiUrl: serversTable.apiUrl, apiToken: serversTable.apiToken })
    .from(serversTable)
    .where(eq(serversTable.id, account.serverId))
    .limit(1);

  if (server?.apiUrl && server?.apiToken) {
    renewPanelAccount({
      apiUrl: server.apiUrl,
      apiToken: server.apiToken,
      protocol: account.protocol,
      username: account.username,
      durationDays: product.durationDays,
      quota: account.quota,
    }).catch(() => {});
  }

  // Kirim notifikasi WhatsApp kepada user (best-effort)
  if (user!.whatsapp) {
    const expiryFormatted = format(newExpiresAt, "d MMM yyyy, HH:mm", { locale: idLocale });
    const waMsg =
      `✅ *Renew Akun VPN Berhasil!*\n\n` +
      `Akun: *${account.username}*\n` +
      `Protokol: *${account.protocol.toUpperCase()}*\n` +
      `Paket: *${product.name}* (+${product.durationDays} hari)\n` +
      `Aktif hingga: *${expiryFormatted}*\n` +
      `Harga: *Rp ${Number(product.price).toLocaleString("id-ID")}*\n\n` +
      `Terima kasih telah menggunakan KETANTECH VPN! 🚀`;
    sendWhatsapp(user!.whatsapp, waMsg).catch(() => {});
  }

  res.json(await formatAccount(updated));
});

export { formatAccount };
export default router;

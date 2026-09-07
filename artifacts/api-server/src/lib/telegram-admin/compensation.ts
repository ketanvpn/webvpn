import { db } from "@workspace/db";
import {
  usersTable,
  vpnAccountsTable,
  serversTable,
  balanceLogsTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { sendMessage } from "../telegram";
import { renewPanelAccount } from "../vpn-panel";
import { logger } from "../logger";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_GIFT_AMOUNT = 10_000_000;
const MAX_EXTEND_DAYS = 365;
const MAX_EXTEND_DELAY_SEC = 30;

// ─── Shared Helpers ──────────────────────────────────────────────────────────

export function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Gift Saldo ──────────────────────────────────────────────────────────────

export async function handleGiftSaldo(chatId: number, username: string, amount: number) {
  if (amount <= 0 || isNaN(amount)) {
    await sendMessage(chatId, `❌ Nominal harus berupa angka lebih dari 0.`);
    return;
  }

  if (amount > MAX_GIFT_AMOUNT) {
    await sendMessage(chatId, `❌ Nominal maksimal ${formatRupiah(MAX_GIFT_AMOUNT)}.`);
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    await sendMessage(chatId, `❌ User dengan username <b>${username}</b> tidak ditemukan.`);
    return;
  }

  const balanceBefore = Number(user.balance);

  await db.transaction(async (tx: any) => {
    const [updated] = await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${amount}` })
      .where(eq(usersTable.id, user.id))
      .returning({ balance: usersTable.balance });

    const balanceAfter = Number(updated.balance);

    await tx.insert(balanceLogsTable).values({
      userId: user.id,
      amount: amount.toString(),
      type: "compensation",
      description: `Kompensasi saldo dari Admin`,
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfter.toString(),
    });
  });

  const newBalance = balanceBefore + amount;
  await sendMessage(
    chatId,
    `✅ <b>Kompensasi Berhasil</b>\n\nSaldo sebesar <b>${formatRupiah(amount)}</b> telah ditambahkan ke akun <b>${username}</b>.\nSaldo saat ini: <b>${formatRupiah(newBalance)}</b>`,
  );

  if (user.telegramId) {
    const userMsg =
      `🎁 <b>Kompensasi Saldo Masuk!</b>\n\n` +
      `Mohon maaf atas ketidaknyamanannya. Admin telah memberikan kompensasi saldo sebesar <b>${formatRupiah(amount)}</b> ke akun kamu.\n\n` +
      `Saldo kamu sekarang: <b>${formatRupiah(newBalance)}</b>\n\n` +
      `Terima kasih telah menggunakan layanan KETANTECH VPN!`;
    await sendMessage(Number(user.telegramId), userMsg).catch(() => {});
  }
}

// ─── Extend Server (Mass Compensation) ───────────────────────────────────────

export async function handleExtendServer(
  chatId: number,
  serverId: number,
  days: number,
  delaySec: number,
) {
  if (days <= 0) {
    await sendMessage(chatId, `❌ Jumlah hari perpanjangan harus lebih dari 0.`);
    return;
  }

  if (days > MAX_EXTEND_DAYS) {
    await sendMessage(chatId, `❌ Maksimal perpanjangan ${MAX_EXTEND_DAYS} hari.`);
    return;
  }

  const boundedDelay = Math.min(Math.max(delaySec, 1), MAX_EXTEND_DELAY_SEC);

  const [server] = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.id, serverId))
    .limit(1);
  if (!server) {
    await sendMessage(chatId, `❌ Server dengan ID <b>${serverId}</b> tidak ditemukan.`);
    return;
  }

  const activeAccounts = await db
    .select({
      id: vpnAccountsTable.id,
      userId: vpnAccountsTable.userId,
      username: vpnAccountsTable.username,
      protocol: vpnAccountsTable.protocol,
      uuid: vpnAccountsTable.uuid,
      expiresAt: vpnAccountsTable.expiresAt,
    })
    .from(vpnAccountsTable)
    .where(and(eq(vpnAccountsTable.serverId, serverId), eq(vpnAccountsTable.isActive, true)));

  if (activeAccounts.length === 0) {
    await sendMessage(
      chatId,
      `ℹ️ Tidak ada akun VPN yang aktif di server <b>${server.name}</b>.`,
    );
    return;
  }

  await sendMessage(
    chatId,
    `⏳ <b>Memulai Kompensasi Massal</b>\n\n` +
      `Ditemukan <b>${activeAccounts.length}</b> akun aktif di server <b>${server.name}</b>.\n` +
      `Sistem akan memproses penambahan <b>${days} hari</b> dengan jeda <b>${boundedDelay} detik</b> per akun agar tidak terblokir (Anti-Spam).\n\n` +
      `<i>Mohon tunggu, laporan akhir akan dikirim otomatis setelah selesai.</i>`,
  );

  let successCount = 0;
  let failedCount = 0;
  const failedUsers: string[] = [];

  for (let i = 0; i < activeAccounts.length; i++) {
    const account = activeAccounts[i];
    try {
      const newExpiresAt = new Date(account.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);

      if (server.apiUrl && server.apiToken) {
        await renewPanelAccount({
          apiUrl: server.apiUrl,
          apiToken: server.apiToken,
          protocol: account.protocol,
          username: account.username,
          durationDays: days,
        });
      }

      await db
        .update(vpnAccountsTable)
        .set({ expiresAt: newExpiresAt })
        .where(eq(vpnAccountsTable.id, account.id));

      successCount++;
    } catch (e) {
      logger.error({ err: e, accountUsername: account.username }, "Gagal extend akun");
      failedCount++;
      failedUsers.push(account.username);
    }

    // Delay between accounts (except last)
    if (i < activeAccounts.length - 1) {
      await delay(boundedDelay * 1000);
    }
  }

  let finalReport = `✅ <b>Proses Kompensasi Selesai</b>\n\n`;
  finalReport += `Server: <b>${server.name}</b>\n`;
  finalReport += `Durasi Ditambah: <b>${days} Hari</b>\n`;
  finalReport += `Total Akun: <b>${activeAccounts.length}</b>\n`;
  finalReport += `Berhasil: <b>${successCount}</b>\n`;
  finalReport += `Gagal: <b>${failedCount}</b>\n`;

  if (failedCount > 0) {
    finalReport += `\n⚠️ <i>Akun yang gagal: ${failedUsers.join(", ")}</i>`;
  }

  await sendMessage(chatId, finalReport);
}

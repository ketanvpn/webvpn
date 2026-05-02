import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  topupsTable,
  ticketsTable,
  ticketMessagesTable,
  serversTable,
  settingsTable,
  vpnAccountsTable,
  balanceLogsTable,
} from "@workspace/db";
import { eq, sql, sum, and, gte } from "drizzle-orm";
import {
  sendMessage,
  sendMessageWithButtons,
  editMessageReplyMarkup,
  answerCallbackQuery,
  editMessageText,
  getBotInfo,
} from "./telegram";
import { performBackup } from "./backup";
import { renewPanelAccount, checkPanelHealth } from "./vpn-panel";
import { logger } from "./logger";
import os from "os";
import { exec } from "child_process";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

function buildAdminMenuButtons() {
  return [
    [
      { text: "🖥️ Status Server", callback_data: "admin_servers" },
      { text: "📊 Statistik", callback_data: "admin_stats" },
    ],
    [
      { text: "💸 Antrean Topup", callback_data: "admin_topups" },
      { text: "📩 Tiket Terbuka", callback_data: "admin_tickets" },
    ],
    [
      { text: "🔍 Cari User", callback_data: "admin_search_prompt" },
      { text: "📢 Broadcast", callback_data: "admin_broadcast_prompt" },
    ],
    [
      { text: "🎁 Kompensasi", callback_data: "admin_compensation_prompt" },
      { text: "💾 Force Backup", callback_data: "admin_backup" },
    ],
    [
      { text: "🔧 System Test", callback_data: "admin_diagnostics" },
      { text: "📊 VPS Monitor", callback_data: "admin_vps_monitor" },
    ],
    [
      { text: "❌ Tutup", callback_data: "admin_close" }
    ],
  ];
}

export async function showAdminMenu(chatId: number) {
  const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
  await sendMessageWithButtons(chatId, text, buildAdminMenuButtons());
}

export async function handleAdminCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string
) {
  if (data === "admin_menu") {
    const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
    await answerCallbackQuery(callbackId);
    await editMessageText(chatId, messageId, text, buildAdminMenuButtons());
    return;
  }

  if (data === "admin_close") {
    await answerCallbackQuery(callbackId, "Menu ditutup");
    await editMessageText(chatId, messageId, "Menu admin ditutup. Ketik /admin untuk membuka kembali.");
    return;
  }

  if (data === "admin_stats") {
    await handleStats(chatId, messageId, callbackId);
    return;
  }

  if (data === "admin_servers") {
    await handleServersList(chatId, messageId, callbackId);
    return;
  }

  if (data.startsWith("admin_server_toggle_")) {
    const serverId = parseInt(data.replace("admin_server_toggle_", ""), 10);
    await handleServerToggle(serverId, chatId, messageId, callbackId);
    return;
  }

  if (data === "admin_backup") {
    await answerCallbackQuery(callbackId, "Memulai backup database...");
    await sendMessage(chatId, "⏳ Sedang memproses backup database...");
    try {
      const result = await performBackup();
      if (result.success) {
        await sendMessage(chatId, "✅ Backup berhasil dikirim ke chat ini.");
      } else {
        await sendMessage(chatId, `❌ Gagal melakukan backup database.\nError: ${result.error}`);
      }
    } catch (error) {
      await sendMessage(chatId, "❌ Gagal melakukan backup database.");
    }
    return;
  }

  if (data === "admin_topups") {
    await handlePendingTopups(chatId, messageId, callbackId);
    return;
  }

  if (data === "admin_tickets") {
    await handleOpenTickets(chatId, messageId, callbackId);
    return;
  }

  if (data === "admin_search_prompt") {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "🔍 <b>Mode Cari User Aktif</b>\n\nSilakan kirim <b>username</b> langsung di chat ini (tanpa <code>/cek</code>).\n\nContoh: <code>budi123</code>\n\nKetik <b>batal</b> untuk keluar dari mode ini.",
      [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]]
    );
    return;
  }

  if (data === "admin_broadcast_prompt") {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "📢 <b>Broadcast Interaktif</b>\n\nPilih metode broadcast di bawah:\n- Template siap pakai\n- Custom message\n\nSetelah memilih, bot akan pandu langkah berikutnya.",
      [
        [{ text: "📣 Template Pengumuman", callback_data: "admin_broadcast_tpl_announcement" }],
        [{ text: "ℹ️ Template Informasi", callback_data: "admin_broadcast_tpl_info" }],
        [{ text: "🚨 Template Server Down", callback_data: "admin_broadcast_tpl_down" }],
        [{ text: "✅ Template Server Pulih", callback_data: "admin_broadcast_tpl_up" }],
        [{ text: "🛠️ Template Maintenance", callback_data: "admin_broadcast_tpl_maintenance" }],
        [{ text: "🎉 Template Perbaikan Selesai", callback_data: "admin_broadcast_tpl_fixed" }],
        [{ text: "✍️ Custom Message", callback_data: "admin_broadcast_custom_prompt" }],
        [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
      ]
    );
    return;
  }

  if (data === "admin_compensation_prompt") {
    await answerCallbackQuery(callbackId);
    const text =
      `🎁 <b>Menu Kompensasi Interaktif</b>\n\n` +
      `Pilih mode di bawah. Setelah mode aktif, kamu tinggal kirim input biasa di chat (tanpa slash command).\n\n` +
      `Ketik <b>batal</b> kapan saja untuk keluar dari mode input.`;

    await editMessageText(
      chatId,
      messageId,
      text,
      [
        [{ text: "🎁 Gift Saldo", callback_data: "admin_comp_gift_prompt" }],
        [{ text: "⏱ Extend Massal", callback_data: "admin_comp_extend_prompt" }],
        [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
      ]
    );
    return;
  }

  if (data === "admin_comp_gift_prompt") {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "🎁 <b>Mode Gift Saldo Aktif</b>\n\nKirim format berikut di chat:\n<code>username nominal</code>\nContoh: <code>user1 5000</code>\n\nKetik <b>batal</b> untuk keluar.",
      [[{ text: "🔙 Kembali", callback_data: "admin_compensation_prompt" }]],
    );
    return;
  }

  if (data === "admin_comp_extend_prompt") {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "⏱ <b>Mode Extend Massal Aktif</b>\n\nKirim format berikut di chat:\n<code>id_server jumlah_hari [jeda_detik]</code>\nContoh: <code>1 2 3</code>\n\nKetik <b>batal</b> untuk keluar.",
      [[{ text: "🔙 Kembali", callback_data: "admin_compensation_prompt" }]],
    );
    return;
  }

  // ─── System Diagnostics ──────────────────────────────────────────────────────
  if (data === "admin_diagnostics") {
    await answerCallbackQuery(callbackId, "Menjalankan diagnostik...");
    await editMessageText(chatId, messageId, "⏳ <b>Menjalankan System Test...</b>\n\nMengecek semua integrasi, mohon tunggu...");
    const report = await runSystemDiagnostics();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Tes Ulang", callback_data: "admin_diagnostics" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
    return;
  }

  // ─── VPS Resource Monitor ───────────────────────────────────────────────────
  if (data === "admin_vps_monitor") {
    await answerCallbackQuery(callbackId, "Mengecek resource VPS...");
    await editMessageText(chatId, messageId, "⏳ <b>Membaca resource VPS...</b>");
    const report = await getVpsResourceReport();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Refresh", callback_data: "admin_vps_monitor" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
    return;
  }
}

async function handleStats(chatId: number, messageId: number, callbackId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pendapatan hari ini
  const [revenueRow] = await db
    .select({ total: sum(ordersTable.amount) })
    .from(ordersTable)
    .where(and(eq(ordersTable.status, "paid"), gte(ordersTable.createdAt, today)));
  const revenue = Number(revenueRow?.total ?? 0);

  // User baru hari ini
  const [{ count: newUsers }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(gte(usersTable.createdAt, today));

  // Topup pending
  const [{ count: pendingTopups }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(topupsTable)
    .where(eq(topupsTable.status, "pending"));

  // Tiket Aktif
  const [{ count: openTickets }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ticketsTable)
    .where(eq(ticketsTable.status, "open"));

  const text =
    `📊 <b>Statistik Hari Ini</b>\n\n` +
    `💰 Pendapatan: <b>${formatRupiah(revenue)}</b>\n` +
    `👥 User Baru: <b>${newUsers}</b>\n\n` +
    `⏳ Topup Pending: <b>${pendingTopups}</b>\n` +
    `🎫 Tiket Terbuka: <b>${openTickets}</b>`;

  const buttons = [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]];

  await answerCallbackQuery(callbackId);
  await editMessageText(chatId, messageId, text, buttons);
}

async function handleServersList(chatId: number, messageId: number, callbackId: string) {
  const servers = await db.select().from(serversTable);

  if (servers.length === 0) {
    await answerCallbackQuery(callbackId, "Belum ada server");
    return;
  }

  let text = `🖥️ <b>Daftar Server VPN</b>\n\nKlik tombol di bawah untuk menyalakan (✅) atau mematikan (⛔) server:\n\n`;
  const buttons: any[][] = [];

  for (const server of servers) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(
        and(
          eq(vpnAccountsTable.serverId, server.id),
          eq(vpnAccountsTable.isActive, true)
        )
      );

    const activeCount = count ?? 0;
    const statusIcon = server.isActive ? "✅" : "⛔";
    
    text += `${statusIcon} <b>[ID: ${server.id}] ${server.name}</b>\n`;
    text += `   Akun: ${activeCount} / ${server.maxAccounts}\n\n`;

    buttons.push([
      {
        text: `${statusIcon} ${server.name}`,
        callback_data: `admin_server_toggle_${server.id}`,
      },
    ]);
  }

  buttons.push([{ text: "🔙 Kembali", callback_data: "admin_menu" }]);

  await answerCallbackQuery(callbackId);
  await editMessageText(chatId, messageId, text, buttons);
}

async function handleServerToggle(serverId: number, chatId: number, messageId: number, callbackId: string) {
  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId)).limit(1);
  if (!server) {
    await answerCallbackQuery(callbackId, "Server tidak ditemukan");
    return;
  }

  const newStatus = !server.isActive;
  await db.update(serversTable).set({ isActive: newStatus, updatedAt: new Date() }).where(eq(serversTable.id, serverId));

  await answerCallbackQuery(callbackId, `Server ${server.name} kini ${newStatus ? 'AKTIF ✅' : 'NONAKTIF ⛔'}`);
  await handleServersList(chatId, messageId, callbackId); // refresh the list
}

async function handlePendingTopups(chatId: number, messageId: number, callbackId: string) {
  const pending = await db
    .select({
      id: topupsTable.id,
      amount: topupsTable.amount,
      username: usersTable.username,
      createdAt: topupsTable.createdAt,
    })
    .from(topupsTable)
    .innerJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .where(eq(topupsTable.status, "pending"))
    .orderBy(sql`${topupsTable.createdAt} ASC`)
    .limit(5);

  if (pending.length === 0) {
    await answerCallbackQuery(callbackId, "Tidak ada antrean topup 🎉");
    return;
  }

  let text = `💸 <b>Antrean Topup (5 Terlama)</b>\n\n`;
  const buttons: any[][] = [];

  for (const t of pending) {
    const waktu = new Date(t.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    text += `🆔 #${t.id} - <b>${t.username}</b>\n`;
    text += `💰 ${formatRupiah(Number(t.amount))} (Jam ${waktu} WIB)\n\n`;

    buttons.push([
      { text: `✅ #${t.id}`, callback_data: `confirm_topup_${t.id}` },
      { text: `❌ #${t.id}`, callback_data: `reject_topup_${t.id}` },
    ]);
  }

  buttons.push([{ text: "🔙 Kembali", callback_data: "admin_menu" }]);

  await answerCallbackQuery(callbackId);
  await editMessageText(chatId, messageId, text, buttons);
}

async function handleOpenTickets(chatId: number, messageId: number, callbackId: string) {
  const openTickets = await db
    .select({
      id: ticketsTable.id,
      subject: ticketsTable.subject,
      username: usersTable.username,
      createdAt: ticketsTable.createdAt,
    })
    .from(ticketsTable)
    .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
    .where(eq(ticketsTable.status, "open"))
    .orderBy(sql`${ticketsTable.createdAt} ASC`)
    .limit(5);

  if (openTickets.length === 0) {
    await answerCallbackQuery(callbackId, "Semua tiket sudah beres!");
    await editMessageText(chatId, messageId, "✨ <b>Tiket Kosong</b>\n\nTidak ada tiket support yang terbuka saat ini.", [
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
    return;
  }

  let text = `📩 <b>TIKET TERBUKA (5 Terlama)</b>\n\n`;
  for (const t of openTickets) {
    const [latestMessage] = await db
      .select({ message: ticketMessagesTable.message, isAdmin: ticketMessagesTable.isAdmin })
      .from(ticketMessagesTable)
      .where(eq(ticketMessagesTable.ticketId, t.id))
      .orderBy(sql`${ticketMessagesTable.createdAt} DESC`)
      .limit(1);

    text += `<b>#${t.id} - ${t.username}</b>\n`;
    text += `Subjek: ${t.subject}\n`;
    
    if (latestMessage) {
      const sender = latestMessage.isAdmin ? "👨‍💻 Admin" : "👤 User";
      let shortMsg = latestMessage.message.length > 50 
        ? latestMessage.message.substring(0, 50) + "..." 
        : latestMessage.message;
      text += `Pesan terakhir (${sender}): <i>"${shortMsg}"</i>\n`;
    } else {
      text += `Pesan terakhir: <i>(Belum ada pesan)</i>\n`;
    }

    text += `👉 Balas: <code>/reply_${t.id} pesan balasan kamu</code>\n`;
    text += `--------------------------\n`;
  }

  const buttons = [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]];
  await answerCallbackQuery(callbackId);
  await editMessageText(chatId, messageId, text, buttons);
}

export async function handleCekUser(chatId: number, username: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

  if (!user) {
    await sendMessage(chatId, `❌ User dengan username <b>${username}</b> tidak ditemukan.`);
    return;
  }

  // Get active vpn accounts
  const activeVpns = await db
    .select({ serverName: serversTable.name, expiresAt: vpnAccountsTable.expiresAt })
    .from(vpnAccountsTable)
    .innerJoin(serversTable, eq(vpnAccountsTable.serverId, serversTable.id))
    .where(and(eq(vpnAccountsTable.userId, user.id), eq(vpnAccountsTable.isActive, true)));

  let text = `👤 <b>Profil User</b>\n\n`;
  text += `📛 Username: <b>${user.username}</b>\n`;
  text += `📧 Email: ${user.email || "-"}\n`;
  text += `📱 WhatsApp: ${user.whatsapp || "-"}\n`;
  text += `💳 Saldo: <b>${formatRupiah(Number(user.balance || 0))}</b>\n`;
  text += `🎁 Poin: <b>${user.points || 0}</b>\n`;
  text += `👑 Role: <b>${user.role.toUpperCase()}</b>\n\n`;

  if (activeVpns.length > 0) {
    text += `🔌 <b>Akun VPN Aktif (${activeVpns.length}):</b>\n`;
    for (const vpn of activeVpns) {
      const exp = new Date(vpn.expiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      text += `- ${vpn.serverName} (Exp: ${exp})\n`;
    }
  } else {
    text += `🔌 <b>Akun VPN Aktif:</b> Tidak ada\n`;
  }

  text += `\n<i>Gunakan /gift ${user.username} nominal untuk memberi kompensasi saldo.</i>`;
  await sendMessage(chatId, text);
}

export async function handleGiftSaldo(chatId: number, username: string, amount: number) {
  if (amount <= 0 || isNaN(amount)) {
    await sendMessage(chatId, `❌ Nominal harus berupa angka lebih dari 0.`);
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);

  if (!user) {
    await sendMessage(chatId, `❌ User dengan username <b>${username}</b> tidak ditemukan.`);
    return;
  }

  const newBalance = Number(user.balance) + amount;

  await db.transaction(async (tx: any) => {
    // 1. Update user balance
    await tx.update(usersTable)
      .set({ balance: newBalance.toString() })
      .where(eq(usersTable.id, user.id));

    // 2. Insert to balance_logs
    await tx.insert(balanceLogsTable).values({
      userId: user.id,
      amount: amount.toString(),
      type: "compensation",
      description: `Kompensasi saldo dari Admin`,
      balanceBefore: user.balance ? user.balance.toString() : "0",
      balanceAfter: newBalance.toString(),
    });
  });

  await sendMessage(chatId, `✅ <b>Kompensasi Berhasil</b>\n\nSaldo sebesar <b>${formatRupiah(amount)}</b> telah ditambahkan ke akun <b>${username}</b>.\nSaldo saat ini: <b>${formatRupiah(newBalance)}</b>`);

  // Kirim notifikasi ke user (jika telegramnya terhubung)
  if (user.telegramId) {
    const userMsg = `🎁 <b>Kompensasi Saldo Masuk!</b>\n\nMohon maaf atas ketidaknyamanannya. Admin telah memberikan kompensasi saldo sebesar <b>${formatRupiah(amount)}</b> ke akun kamu.\n\nSaldo kamu sekarang: <b>${formatRupiah(newBalance)}</b>\n\nTerima kasih telah menggunakan layanan KETANTECH VPN!`;
    await sendMessage(Number(user.telegramId), userMsg).catch(() => {});
  }
}

export async function handleExtendServer(chatId: number, serverId: number, days: number, delaySec: number) {
  if (days <= 0) {
    await sendMessage(chatId, `❌ Jumlah hari perpanjangan harus lebih dari 0.`);
    return;
  }

  const [server] = await db.select().from(serversTable).where(eq(serversTable.id, serverId)).limit(1);
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
    await sendMessage(chatId, `ℹ️ Tidak ada akun VPN yang aktif di server <b>${server.name}</b>.`);
    return;
  }

  await sendMessage(chatId, `⏳ <b>Memulai Kompensasi Massal</b>\n\nDitemukan <b>${activeAccounts.length}</b> akun aktif di server <b>${server.name}</b>.\nSistem akan memproses penambahan <b>${days} hari</b> dengan jeda <b>${delaySec} detik</b> per akun agar tidak terblokir (Anti-Spam).\n\n<i>Mohon tunggu, laporan akhir akan dikirim otomatis setelah selesai.</i>`);

  let successCount = 0;
  let failedCount = 0;
  let failedUsers: string[] = [];

  for (let i = 0; i < activeAccounts.length; i++) {
    const account = activeAccounts[i];
    try {
      const newExpiresAt = new Date(account.expiresAt.getTime() + days * 24 * 60 * 60 * 1000);

      if (server.apiUrl && server.apiToken) {
        // Renew di panel (tambahkan durasi dalam hari ke panel)
        await renewPanelAccount({
          apiUrl: server.apiUrl,
          apiToken: server.apiToken,
          protocol: account.protocol,
          username: account.username,
          durationDays: days,
        });
      }

      // Update database lokal
      await db.update(vpnAccountsTable)
        .set({ expiresAt: newExpiresAt })
        .where(eq(vpnAccountsTable.id, account.id));

      successCount++;
    } catch (e) {
      console.error(`Gagal extend akun ${account.username}:`, e);
      failedCount++;
      failedUsers.push(account.username);
    }

    // Jeda delaySec detik sebelum lanjut ke akun berikutnya (kecuali akun terakhir)
    if (i < activeAccounts.length - 1) {
      await delay(delaySec * 1000);
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

// ─── System Diagnostics ──────────────────────────────────────────────────────

interface DiagnosticResult {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
  latencyMs?: number;
}

async function testDatabase(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const [row] = await db.select({ val: sql<number>`1` }).from(settingsTable).limit(1);
    return {
      name: "💾 Database (PostgreSQL)",
      status: "ok",
      detail: "Koneksi aktif",
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: "💾 Database (PostgreSQL)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Tidak dapat terhubung",
      latencyMs: Date.now() - start,
    };
  }
}

async function testTelegramBot(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const info = await getBotInfo();
    if (info?.ok && info?.result?.username) {
      return {
        name: "🤖 Telegram Bot",
        status: "ok",
        detail: `@${info.result.username} aktif`,
        latencyMs: Date.now() - start,
      };
    }
    return {
      name: "🤖 Telegram Bot",
      status: "error",
      detail: info?.description ?? "Token tidak valid atau bot tidak responsif",
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: "🤖 Telegram Bot",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Gagal terhubung",
      latencyMs: Date.now() - start,
    };
  }
}

async function testWhatsappFonnte(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    // Get fonnte token from settings
    const [tokenRow] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "fonnteToken"))
      .limit(1);

    const token = tokenRow?.value;
    if (!token) {
      return {
        name: "📱 WhatsApp (Fonnte)",
        status: "warn",
        detail: "Token Fonnte belum diatur",
        latencyMs: Date.now() - start,
      };
    }

    // Check device status via Fonnte API
    const resp = await fetch("https://api.fonnte.com/device", {
      method: "POST",
      headers: { Authorization: token },
    });
    const data = await resp.json() as {
      status?: boolean;
      device_status?: string;
      reason?: string;
      detail?: string;
      quota?: number;
      expired?: string;
      device?: string;
    };

    const latency = Date.now() - start;

    if (data.status === true || data.device_status === "connect") {
      let detail = "Device terhubung ✅";
      if (data.device) detail += ` (${data.device})`;
      if (data.quota !== undefined) detail += `\nSisa kuota: ${data.quota}`;
      if (data.expired) detail += `\nExpired: ${data.expired}`;
      return { name: "📱 WhatsApp (Fonnte)", status: "ok", detail, latencyMs: latency };
    }

    if (data.device_status === "disconnect") {
      return {
        name: "📱 WhatsApp (Fonnte)",
        status: "error",
        detail: `Device TERPUTUS ❌${data.reason ? `\nAlasan: ${data.reason}` : ""}\n\n⚠️ Segera login ulang di dashboard Fonnte!`,
        latencyMs: latency,
      };
    }

    return {
      name: "📱 WhatsApp (Fonnte)",
      status: "warn",
      detail: data.reason ?? data.detail ?? `Status tidak diketahui (${JSON.stringify(data).substring(0, 60)})`,
      latencyMs: latency,
    };
  } catch (e: any) {
    return {
      name: "📱 WhatsApp (Fonnte)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Gagal terhubung ke API Fonnte",
      latencyMs: Date.now() - start,
    };
  }
}

async function testPaymentGateway(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));

    const enabled = map["autoGopayEnabled"] === "true";
    const apiUrl = map["autoGopayApiUrl"];
    const secretKey = map["autoGopaySecretKey"];

    if (!enabled) {
      return {
        name: "💳 Payment Gateway (AutoGoPay)",
        status: "warn",
        detail: "AutoGoPay dinonaktifkan di pengaturan",
        latencyMs: Date.now() - start,
      };
    }

    if (!apiUrl) {
      return {
        name: "💳 Payment Gateway (AutoGoPay)",
        status: "error",
        detail: "API URL belum diatur",
        latencyMs: Date.now() - start,
      };
    }

    if (!secretKey) {
      return {
        name: "💳 Payment Gateway (AutoGoPay)",
        status: "warn",
        detail: `API URL: ✅ ${apiUrl}\nSecret Key: ❌ Belum diatur`,
        latencyMs: Date.now() - start,
      };
    }

    // Ping the API URL to check if it's reachable
    const baseUrl = apiUrl.replace(/\/+$/, "");
    const pingResp = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    const latency = Date.now() - start;

    if (pingResp) {
      return {
        name: "💳 Payment Gateway (AutoGoPay)",
        status: "ok",
        detail: `API reachable (HTTP ${pingResp.status})\nAPI URL: ✅\nSecret Key: ✅`,
        latencyMs: latency,
      };
    }

    return {
      name: "💳 Payment Gateway (AutoGoPay)",
      status: "error",
      detail: `Tidak dapat terhubung ke ${baseUrl}\nPastikan URL API benar di pengaturan.`,
      latencyMs: latency,
    };
  } catch (e: any) {
    return {
      name: "💳 Payment Gateway (AutoGoPay)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Error tidak diketahui",
      latencyMs: Date.now() - start,
    };
  }
}

async function testVpnPanels(): Promise<DiagnosticResult[]> {
  const servers = await db.select().from(serversTable);

  if (servers.length === 0) {
    return [{
      name: "🖥️ VPN Panel",
      status: "warn",
      detail: "Belum ada server terdaftar",
    }];
  }

  const results: DiagnosticResult[] = [];

  for (const server of servers) {
    if (!server.apiUrl || !server.apiToken) {
      results.push({
        name: `🖥️ ${server.name}`,
        status: "warn",
        detail: "API URL atau Token belum diatur",
      });
      continue;
    }

    try {
      const health = await checkPanelHealth({
        apiUrl: server.apiUrl,
        apiToken: server.apiToken,
      });

      if (health.online) {
        results.push({
          name: `🖥️ ${server.name}`,
          status: "ok",
          detail: `Panel online`,
          latencyMs: health.latencyMs,
        });
      } else {
        results.push({
          name: `🖥️ ${server.name}`,
          status: "error",
          detail: health.error ?? "Panel tidak merespons",
        });
      }
    } catch (e: any) {
      results.push({
        name: `🖥️ ${server.name}`,
        status: "error",
        detail: e.message?.substring(0, 80) ?? "Gagal terhubung ke panel",
      });
    }
  }

  return results;
}

async function runSystemDiagnostics(): Promise<string> {
  const startTime = Date.now();

  // Run all tests concurrently
  const [dbResult, tgResult, waResult, pgResult, panelResults] = await Promise.all([
    testDatabase(),
    testTelegramBot(),
    testWhatsappFonnte(),
    testPaymentGateway(),
    testVpnPanels(),
  ]);

  const allResults: DiagnosticResult[] = [dbResult, tgResult, waResult, pgResult, ...panelResults];

  const statusIcon = (s: DiagnosticResult["status"]) => {
    if (s === "ok") return "✅";
    if (s === "warn") return "⚠️";
    return "❌";
  };

  const totalTime = Date.now() - startTime;
  const okCount = allResults.filter((r) => r.status === "ok").length;
  const warnCount = allResults.filter((r) => r.status === "warn").length;
  const errorCount = allResults.filter((r) => r.status === "error").length;

  let overallIcon = "✅";
  if (errorCount > 0) overallIcon = "🔴";
  else if (warnCount > 0) overallIcon = "🟡";

  let text = `🔧 <b>System Diagnostics Report</b>\n`;
  text += `${overallIcon} Status: <b>${errorCount > 0 ? "ADA MASALAH" : warnCount > 0 ? "PERLU PERHATIAN" : "SEMUA NORMAL"}</b>\n`;
  text += `⏱ Waktu tes: ${totalTime}ms\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const result of allResults) {
    const icon = statusIcon(result.status);
    const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : "";
    text += `${icon} <b>${result.name}</b>${latency}\n`;
    text += `${result.detail}\n\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 Summary: ✅ ${okCount} OK | ⚠️ ${warnCount} Warning | ❌ ${errorCount} Error\n`;

  const now = new Date().toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
  text += `🕐 Dijalankan: ${now} WIB`;

  return text;
}

// ─── VPS Resource Monitor ────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  return parts.join(", ") || "< 1 menit";
}

function progressBar(percent: number, length = 12): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function statusLevel(percent: number): { icon: string; label: string } {
  if (percent >= 90) return { icon: "🔴", label: "KRITIS" };
  if (percent >= 80) return { icon: "🟡", label: "Warning" };
  return { icon: "🟢", label: "Normal" };
}

function getDiskUsage(): Promise<{ total: string; used: string; free: string; percent: number } | null> {
  return new Promise((resolve) => {
    // Linux: df for root partition
    exec("df -B1 / | tail -1", { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      // Output format: Filesystem 1B-blocks Used Available Use% Mounted
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 5) {
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const free = parseInt(parts[3], 10);
        const percent = Math.round((used / total) * 100);
        resolve({
          total: formatBytes(total),
          used: formatBytes(used),
          free: formatBytes(free),
          percent,
        });
      } else {
        resolve(null);
      }
    });
  });
}

async function getVpsResourceReport(): Promise<string> {
  try {
    // ── CPU ──
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg();
    // CPU usage % estimate based on 1-min load average vs core count
    const cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));
    const cpuStatus = statusLevel(cpuPercent);
    const cpuModel = cpus[0]?.model?.replace(/\s+/g, " ").trim() ?? "Unknown";

    // ── RAM ──
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const memStatus = statusLevel(memPercent);

    // ── Disk ──
    const disk = await getDiskUsage();

    // ── Uptime ──
    const vpsUptime = os.uptime();
    const appUptime = process.uptime();

    // ── Node.js Process ──
    const memUsage = process.memoryUsage();

    // ── Build Report ──
    let text = `🖥️ <b>VPS Resource Monitor</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    // CPU
    text += `💻 <b>CPU</b> ${cpuStatus.icon}\n`;
    text += `   Load: <b>${loadAvg[0].toFixed(2)}</b> / ${loadAvg[1].toFixed(2)} / ${loadAvg[2].toFixed(2)} (1/5/15 min)\n`;
    text += `   Cores: <b>${cpuCount} vCPU</b>\n`;
    text += `   Usage: ${progressBar(cpuPercent)} <b>${cpuPercent}%</b>\n`;
    text += `   Model: ${cpuModel.substring(0, 40)}\n`;
    text += `   Status: ${cpuStatus.icon} ${cpuStatus.label}\n\n`;

    // RAM
    text += `🧠 <b>RAM</b> ${memStatus.icon}\n`;
    text += `   Terpakai: <b>${formatBytes(usedMem)}</b> / ${formatBytes(totalMem)}\n`;
    text += `   ${progressBar(memPercent)} <b>${memPercent}%</b>\n`;
    text += `   Free: ${formatBytes(freeMem)}\n`;
    text += `   Status: ${memStatus.icon} ${memStatus.label}\n\n`;

    // Disk
    if (disk) {
      const diskStatus = statusLevel(disk.percent);
      text += `💾 <b>Disk</b> ${diskStatus.icon}\n`;
      text += `   Terpakai: <b>${disk.used}</b> / ${disk.total}\n`;
      text += `   ${progressBar(disk.percent)} <b>${disk.percent}%</b>\n`;
      text += `   Free: ${disk.free}\n`;
      text += `   Status: ${diskStatus.icon} ${diskStatus.label}\n\n`;
    } else {
      text += `💾 <b>Disk</b>\n   ⚠️ Tidak dapat membaca info disk\n\n`;
    }

    // Uptime
    text += `⏱ <b>Uptime</b>\n`;
    text += `   VPS: <b>${formatUptime(vpsUptime)}</b>\n`;
    text += `   App: <b>${formatUptime(appUptime)}</b>\n\n`;

    // Node.js Process
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    text += `📊 <b>Node.js Process</b>\n`;
    text += `   Heap: <b>${formatBytes(memUsage.heapUsed)}</b> / ${formatBytes(memUsage.heapTotal)} (${heapPercent}%)\n`;
    text += `   RSS: <b>${formatBytes(memUsage.rss)}</b>\n`;
    text += `   External: ${formatBytes(memUsage.external)}\n\n`;

    // Overall status
    const allPercents = [cpuPercent, memPercent, ...(disk ? [disk.percent] : [])];
    const worstPercent = Math.max(...allPercents);
    const overall = statusLevel(worstPercent);

    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `${overall.icon} Overall: <b>${overall.label.toUpperCase()}</b>\n`;

    const now = new Date().toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Asia/Jakarta",
    });
    text += `🕐 ${now} WIB`;

    return text;
  } catch (e: any) {
    return `🖥️ <b>VPS Resource Monitor</b>\n\n❌ Gagal membaca resource VPS.\nError: ${e.message?.substring(0, 100) ?? "Unknown error"}`;
  }
}

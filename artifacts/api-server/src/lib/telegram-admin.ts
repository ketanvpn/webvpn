import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  topupsTable,
  ticketsTable,
  ticketMessagesTable,
  serversTable,
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
} from "./telegram";
import { performBackup } from "./backup";
import { renewPanelAccount } from "./vpn-panel";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export async function showAdminMenu(chatId: number) {
  const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
  const buttons = [
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
      { text: "❌ Tutup", callback_data: "admin_close" }
    ],
  ];
  await sendMessageWithButtons(chatId, text, buttons);
}

export async function handleAdminCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string
) {
  if (data === "admin_menu") {
    const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
    const buttons = [
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
        { text: "💾 Force Backup", callback_data: "admin_backup" },
        { text: "❌ Tutup", callback_data: "admin_close" }
      ],
    ];
    await answerCallbackQuery(callbackId);
    await editMessageText(chatId, messageId, text, buttons);
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
      "🔍 <b>Fitur Cari User</b>\n\nUntuk mengecek detail user (saldo, status, dll), ketik perintah berikut di chat:\n\n<code>/cek [username]</code>\n\nContoh:\n<code>/cek budi123</code>",
      [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]]
    );
    return;
  }

  if (data === "admin_broadcast_prompt") {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "📢 <b>Fitur Broadcast</b>\n\nUntuk mengirim pesan massal ke semua user, ketik pesanmu dengan format berikut:\n\n<code>/broadcast [isi pesan kamu]</code>\n\nContoh:\n<code>/broadcast Server SG 1 sedang maintenance. Mohon maaf atas ketidaknyamanannya.</code>",
      [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]]
    );
    return;
  }

  if (data === "admin_compensation_prompt") {
    await answerCallbackQuery(callbackId);
    const text = `🎁 <b>Menu Kompensasi</b>\n\nPilih metode kompensasi dengan mengetik salah satu perintah berikut di chat:\n\n` +
      `<b>1. Kompensasi Saldo (Personal)</b>\n` +
      `Memberikan saldo ke spesifik user.\n` +
      `👉 <code>/gift [username] [nominal]</code>\n` +
      `<i>Contoh: /gift user1 5000</i>\n\n` +
      `<b>2. Kompensasi Masa Aktif (Massal)</b>\n` +
      `Menambah masa aktif semua akun VPN di suatu server.\n` +
      `👉 <code>/extend [id_server] [jumlah_hari] [jeda_detik]</code>\n` +
      `<i>Contoh: /extend 1 2 3</i>\n(Menambah 2 hari ke Server 1, dengan jeda 3 detik/akun)`;

    await editMessageText(
      chatId,
      messageId,
      text,
      [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]]
    );
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
    
    text += `${statusIcon} <b>${server.name}</b>\n`;
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

  await db.transaction(async (tx) => {
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
          uuid: account.uuid,
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

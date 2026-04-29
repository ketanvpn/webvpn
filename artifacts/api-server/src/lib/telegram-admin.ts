import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  topupsTable,
  ticketsTable,
  ticketMessagesTable,
  serversTable,
  vpnAccountsTable,
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
      { text: "💾 Force Backup", callback_data: "admin_backup" },
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

  await sendMessage(chatId, text);
}

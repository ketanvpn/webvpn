import { db } from "@workspace/db";
import {
  usersTable,
  ordersTable,
  topupsTable,
  ticketsTable,
  serversTable,
  vpnAccountsTable,
} from "@workspace/db";
import { eq, sql, sum, and, gte } from "drizzle-orm";
import {
  sendMessage,
  sendMessageWithButtons,
  editMessageReplyMarkup,
  answerCallbackQuery,
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
      { text: "📊 Statistik Hari Ini", callback_data: "admin_stats" },
    ],
    [
      { text: "💾 Force Backup", callback_data: "admin_backup" },
      { text: "📢 Broadcast", callback_data: "admin_broadcast_prompt" },
    ],
    [{ text: "❌ Tutup", callback_data: "admin_close" }],
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
        { text: "📊 Statistik Hari Ini", callback_data: "admin_stats" },
      ],
      [
        { text: "💾 Force Backup", callback_data: "admin_backup" },
        { text: "📢 Broadcast", callback_data: "admin_broadcast_prompt" },
      ],
      [{ text: "❌ Tutup", callback_data: "admin_close" }],
    ];
    await editMessageReplyMarkup(chatId, messageId, buttons);
    // Kita harus edit text juga kalau perlu, tapi lib kita editMessageReplyMarkup hanya ubah button.
    // Jika perlu edit text, kita bisa gunakan fungsi baru editMessageText.
    await answerCallbackQuery(callbackId);
    return;
  }

  if (data === "admin_close") {
    await editMessageReplyMarkup(chatId, messageId, null);
    await answerCallbackQuery(callbackId, "Menu ditutup");
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

  if (data === "admin_broadcast_prompt") {
    await answerCallbackQuery(callbackId);
    await sendMessage(
      chatId,
      "📢 <b>Fitur Broadcast</b>\n\nUntuk mengirim pesan massal ke semua user, ketik pesanmu dengan format berikut:\n\n<code>/broadcast [isi pesan kamu]</code>\n\nContoh:\n<code>/broadcast Server SG 1 sedang maintenance. Mohon maaf atas ketidaknyamanannya.</code>"
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

  // Mengirim pesan baru karena kita tidak punya fungsi editMessageText (hanya edit markup)
  await answerCallbackQuery(callbackId);
  await sendMessageWithButtons(chatId, text, buttons);
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
          eq(vpnAccountsTable.isActive, true),
          gte(vpnAccountsTable.expiresAt, new Date())
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
  await sendMessageWithButtons(chatId, text, buttons);
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

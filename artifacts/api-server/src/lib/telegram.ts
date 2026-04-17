import { db } from "@workspace/db";
import { usersTable, topupsTable, settingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { logger } from "./logger";

// In-memory map: Telegram message_id → ticket_id
// Allows native Telegram reply (swipe) to be linked back to a ticket
const ticketMessageMap = new Map<number, number>();

export function registerTicketMessage(telegramMsgId: number, ticketId: number): void {
  ticketMessageMap.set(telegramMsgId, ticketId);
}

export function lookupTicketByMessage(telegramMsgId: number): number | null {
  return ticketMessageMap.get(telegramMsgId) ?? null;
}

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

async function getTelegramConfig(): Promise<{ token: string | null; adminChatId: string | null }> {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    token: map["telegramBotToken"] ?? null,
    adminChatId: map["telegramAdminChatId"] ?? null,
  };
}

export async function callTelegramApi(token: string, method: string, body: object): Promise<any> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    logger.error({ err, method }, "Telegram API call failed");
    return null;
  }
}

export async function sendMessage(chatId: number | string, text: string, extra?: object): Promise<number | null> {
  const { token } = await getTelegramConfig();
  if (!token) return null;
  const result = await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
  return result?.result?.message_id ?? null;
}

export async function sendMessageWithButtons(
  chatId: number | string,
  text: string,
  buttons: { text: string; callback_data: string }[][],
) {
  const { token } = await getTelegramConfig();
  if (!token) return;
  await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function editMessageReplyMarkup(
  chatId: number | string,
  messageId: number,
  buttons: { text: string; callback_data: string }[][] | null,
) {
  const { token } = await getTelegramConfig();
  if (!token) return;
  await callTelegramApi(token, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: buttons ? { inline_keyboard: buttons } : {},
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const { token } = await getTelegramConfig();
  if (!token) return;
  await callTelegramApi(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "",
  });
}

export async function registerWebhook(webhookUrl: string) {
  const { token } = await getTelegramConfig();
  if (!token) return;
  const result = await callTelegramApi(token, "setWebhook", { url: webhookUrl });
  logger.info({ result }, "Telegram webhook registered");
}

export async function deleteWebhook() {
  const { token } = await getTelegramConfig();
  if (!token) return;
  await callTelegramApi(token, "deleteWebhook", {});
}

export async function getBotInfo() {
  const { token } = await getTelegramConfig();
  if (!token) return null;
  return callTelegramApi(token, "getMe", {});
}

export async function notifyAdminNewTopup(
  topupId: number,
  amount: number,
  username: string,
  email: string,
) {
  const { adminChatId } = await getTelegramConfig();
  if (!adminChatId) return;

  const text =
    `📥 <b>Topup Baru!</b>\n\n` +
    `👤 User: <b>${username}</b> (${email})\n` +
    `💰 Nominal: <b>${formatRupiah(amount)}</b>\n` +
    `🆔 ID: #${topupId}`;

  await sendMessageWithButtons(adminChatId, text, [
    [
      { text: "✅ Konfirmasi", callback_data: `confirm_topup_${topupId}` },
      { text: "❌ Tolak", callback_data: `reject_topup_${topupId}` },
    ],
  ]);
}

export async function notifyAdminTopupAutoConfirmed(
  topupId: number,
  amount: number,
  username: string,
  newBalance: number,
) {
  const { adminChatId } = await getTelegramConfig();
  if (!adminChatId) return;

  const text =
    `✅ <b>Topup Auto-Konfirmasi (AutoGoPay)</b>\n\n` +
    `👤 User: <b>${username}</b>\n` +
    `💰 Nominal: <b>${formatRupiah(amount)}</b>\n` +
    `💳 Saldo baru: <b>${formatRupiah(newBalance)}</b>\n` +
    `🆔 ID: #${topupId}`;

  await sendMessage(adminChatId, text);
}

export async function notifyAdminNewOrder(
  orderId: number,
  amount: number,
  username: string,
  productName: string,
) {
  const { adminChatId } = await getTelegramConfig();
  if (!adminChatId) return;

  const text =
    `🛒 <b>Order Baru!</b>\n\n` +
    `👤 User: <b>${username}</b>\n` +
    `📦 Produk: <b>${productName}</b>\n` +
    `💰 Total: <b>${formatRupiah(amount)}</b>\n` +
    `🆔 ID: #${orderId}`;

  await sendMessage(adminChatId, text);
}

export async function notifyUserTopupConfirmed(
  userId: number,
  amount: number,
  newBalance: number,
) {
  const [user] = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.telegramId) return;

  const text =
    `✅ <b>Topup Dikonfirmasi!</b>\n\n` +
    `Saldo <b>${formatRupiah(amount)}</b> berhasil ditambahkan.\n` +
    `💰 Saldo sekarang: <b>${formatRupiah(newBalance)}</b>`;

  await sendMessage(user.telegramId, text);
}

export async function notifyUserTopupRejected(
  userId: number,
  amount: number,
  note: string | null,
) {
  const [user] = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user?.telegramId) return;

  const text =
    `❌ <b>Topup Ditolak</b>\n\n` +
    `Topup sebesar <b>${formatRupiah(amount)}</b> ditolak.\n` +
    (note ? `📝 Alasan: ${note}` : "");

  await sendMessage(user.telegramId, text);
}

export async function notifyUserVpnAccountCreated(opts: {
  userId: number;
  orderId: number;
  productName: string;
  protocol: string;
  username: string;
  password: string | null;
  configLink: string | null;
  serverName: string;
  expiresAt: Date;
}) {
  const [user] = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.id, opts.userId))
    .limit(1);

  if (!user?.telegramId) return;

  const expiry = opts.expiresAt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let text =
    `🎉 <b>Akun VPN Kamu Sudah Siap!</b>\n\n` +
    `📦 Produk: <b>${opts.productName}</b>\n` +
    `🔌 Protokol: <b>${opts.protocol.toUpperCase()}</b>\n` +
    `🖥️ Server: <b>${opts.serverName}</b>\n` +
    `👤 Username: <code>${opts.username}</code>\n`;

  if (opts.password) {
    text += `🔑 Password: <code>${opts.password}</code>\n`;
  }

  text += `📅 Aktif sampai: <b>${expiry}</b>\n`;

  if (opts.configLink) {
    text += `\n🔗 <b>Config Link:</b>\n<code>${opts.configLink}</code>\n`;
  }

  text += `\n🆔 Order #${opts.orderId}`;

  await sendMessage(user.telegramId, text);
}

export async function notifyAdminOrderFulfilled(opts: {
  orderId: number;
  username: string;
  productName: string;
  protocol: string;
  amount: number;
  paymentMethod: string;
}) {
  const { adminChatId } = await getTelegramConfig();
  if (!adminChatId) return;

  const payLabel = opts.paymentMethod === "qris" ? "QRIS" : "Saldo Akun";

  const text =
    `✅ <b>Order Selesai!</b>\n\n` +
    `👤 User: <b>${opts.username}</b>\n` +
    `📦 Produk: <b>${opts.productName}</b>\n` +
    `🔌 Protokol: <b>${opts.protocol.toUpperCase()}</b>\n` +
    `💰 Pembayaran: <b>${formatRupiah(opts.amount)}</b> via ${payLabel}\n` +
    `🆔 Order #${opts.orderId}`;

  await sendMessage(adminChatId, text);
}

export async function notifyAdminNewUser(opts: {
  username: string;
  fullName: string | null;
  email: string | null;
  whatsapp: string | null;
  referredBy: string | null;
  createdAt: Date;
}): Promise<void> {
  const { adminChatId } = await getTelegramConfig();
  if (!adminChatId) return;

  const [totalRow] = await db.select({ total: count() }).from(usersTable);
  const total = totalRow?.total ?? 0;

  const waktu = opts.createdAt.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });

  let text =
    `🆕 <b>User Baru Mendaftar!</b>\n\n` +
    `👤 Username: <b>${opts.username}</b>\n`;

  if (opts.fullName) text += `📛 Nama: <b>${opts.fullName}</b>\n`;
  if (opts.email) text += `📧 Email: <b>${opts.email}</b>\n`;
  if (opts.whatsapp) text += `📱 WA: <b>${opts.whatsapp}</b>\n`;
  if (opts.referredBy) text += `🔗 Dari referral: <b>${opts.referredBy}</b>\n`;

  text +=
    `📅 ${waktu} WIB\n\n` +
    `👥 Total user sekarang: <b>${total}</b>`;

  await sendMessage(adminChatId, text);
}

export async function broadcastMessage(message: string): Promise<{ sent: number; failed: number }> {
  const users = await db
    .select({ telegramId: usersTable.telegramId })
    .from(usersTable)
    .where(eq(usersTable.isActive, true));

  const linked = users.filter((u) => u.telegramId != null);
  let sent = 0;
  let failed = 0;

  for (const user of linked) {
    try {
      await sendMessage(user.telegramId!, `📢 <b>Pesan dari Admin:</b>\n\n${message}`);
      sent++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  return { sent, failed };
}

export async function notifyAdminNewTicket(ticketId: number, username: string, subject: string, priority: string): Promise<void> {
  const { token, adminChatId } = await getTelegramConfig();
  if (!token || !adminChatId) return;

  const priorityEmoji: Record<string, string> = { low: "🟢", normal: "🟡", high: "🔴" };
  const emoji = priorityEmoji[priority] ?? "🟡";
  const siteUrl = process.env.SITE_URL ?? "";

  const text =
    `🎫 <b>Tiket Bantuan Baru</b>\n\n` +
    `#${ticketId} — ${emoji} <b>${priority.toUpperCase()}</b>\n` +
    `👤 User: <b>${username}</b>\n` +
    `📝 Subjek: <b>${subject}</b>\n\n` +
    `↩️ Geser pesan ini untuk balas`;

  const extra: Record<string, unknown> = {};
  if (siteUrl) {
    extra.reply_markup = {
      inline_keyboard: [[
        { text: "🔗 Buka di Panel Admin", url: `${siteUrl}/admin/tickets/${ticketId}` },
      ]],
    };
  }

  const msgId = await sendMessage(adminChatId, text, extra);
  if (msgId) registerTicketMessage(msgId, ticketId);
}

export async function notifyAdminTicketReply(ticketId: number, username: string, subject: string, message: string): Promise<void> {
  const { token, adminChatId } = await getTelegramConfig();
  if (!token || !adminChatId) return;

  const preview = message.length > 120 ? message.slice(0, 120) + "…" : message;
  const siteUrl = process.env.SITE_URL ?? "";

  const text =
    `💬 <b>Balasan Baru di Tiket #${ticketId}</b>\n\n` +
    `👤 User: <b>${username}</b>\n` +
    `📝 Subjek: <b>${subject}</b>\n\n` +
    `🗨 Pesan:\n${preview}\n\n` +
    `↩️ Geser pesan ini untuk balas`;

  const extra: Record<string, unknown> = {};
  if (siteUrl) {
    extra.reply_markup = {
      inline_keyboard: [[
        { text: "🔗 Buka Tiket", url: `${siteUrl}/admin/tickets/${ticketId}` },
      ]],
    };
  }

  const msgId = await sendMessage(adminChatId, text, extra);
  if (msgId) registerTicketMessage(msgId, ticketId);
}

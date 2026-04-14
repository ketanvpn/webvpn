import { db } from "@workspace/db";
import { usersTable, topupsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

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

export async function sendMessage(chatId: number | string, text: string, extra?: object) {
  const { token } = await getTelegramConfig();
  if (!token) return;
  await callTelegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra,
  });
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

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable, settingsTable, ticketsTable, ticketMessagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { randomBytes } from "crypto";
import {
  callTelegramApi,
  sendMessage,
  answerCallbackQuery,
  editMessageReplyMarkup,
  getBotInfo,
  registerWebhook,
} from "../lib/telegram";

const router = Router();

// ─── User: Generate Telegram Link Token ──────────────────────────────────────

router.get("/telegram/link", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const token = randomBytes(24).toString("hex");

  await db
    .update(usersTable)
    .set({ telegramLinkToken: token, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  const botInfo = await getBotInfo();
  const botUsername = botInfo?.result?.username ?? null;
  const url = botUsername ? `https://t.me/${botUsername}?start=link_${token}` : null;

  res.json({ token, botUsername, url });
});

// ─── User: Unlink Telegram ────────────────────────────────────────────────────

router.delete("/telegram/link", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  await db
    .update(usersTable)
    .set({ telegramId: null, telegramLinkToken: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

// ─── Admin: Register Webhook ──────────────────────────────────────────────────

router.post("/admin/telegram/register-webhook", requireAuth, async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  await registerWebhook(url);
  res.json({ success: true });
});

// ─── Telegram Webhook Handler ─────────────────────────────────────────────────

router.post("/telegram/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;
  if (!update) return;

  try {
    // Handle inline button callbacks
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return;
    }

    // Handle messages
    if (update.message?.text) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error("[telegram-webhook] error:", err);
  }
});

// ─── Handlers ────────────────────────────────────────────────────────────────

async function getAdminChatId(): Promise<string | null> {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return map["telegramAdminChatId"] ?? null;
}

async function handleMessage(message: any) {
  const text: string = message.text ?? "";
  const chatId: number = message.chat.id;
  const telegramId: number = message.from?.id ?? chatId;

  if (text.startsWith("/start link_")) {
    const token = text.replace("/start link_", "").trim();
    await handleLinkToken(token, telegramId, chatId);
    return;
  }

  if (text === "/start") {
    await sendMessage(
      chatId,
      "👋 Halo! Saya bot KETANTECH VPN.\n\nUntuk menghubungkan akun, klik link dari halaman profil di aplikasi.",
    );
    return;
  }

  // /reply_<ticketId> <message> — hanya dari admin chat
  const replyMatch = text.match(/^\/reply_(\d+)\s+([\s\S]+)$/);
  if (replyMatch) {
    const adminChatId = await getAdminChatId();
    if (!adminChatId || String(chatId) !== String(adminChatId)) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    await handleReplyTicket(parseInt(replyMatch[1], 10), replyMatch[2].trim(), chatId);
    return;
  }
}

async function handleReplyTicket(ticketId: number, replyText: string, chatId: number) {
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, ticketId))
    .limit(1);

  if (!ticket) {
    await sendMessage(chatId, `❌ Tiket #${ticketId} tidak ditemukan.`);
    return;
  }
  if (ticket.status === "closed") {
    await sendMessage(chatId, `❌ Tiket #${ticketId} sudah ditutup.`);
    return;
  }

  const [adminUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .limit(1);

  if (!adminUser) {
    await sendMessage(chatId, "❌ Akun admin tidak ditemukan di sistem.");
    return;
  }

  await db.insert(ticketMessagesTable).values({
    ticketId,
    userId: adminUser.id,
    isAdmin: true,
    message: replyText,
  });

  await db
    .update(ticketsTable)
    .set({ status: "answered", updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId));

  await sendMessage(chatId, `✅ Balasan untuk tiket <b>#${ticketId}</b> berhasil dikirim!`);
}

async function handleLinkToken(token: string, telegramId: number, chatId: number) {
  const [user] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.telegramLinkToken, token))
    .limit(1);

  if (!user) {
    await sendMessage(chatId, "❌ Link tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman profil.");
    return;
  }

  await db
    .update(usersTable)
    .set({ telegramId, telegramLinkToken: null, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  await sendMessage(
    chatId,
    `✅ <b>Berhasil terhubung!</b>\n\nAkun <b>${user.username}</b> sudah dihubungkan dengan Telegram kamu.\n\nKamu akan menerima notifikasi topup dan info terbaru dari kami.`,
  );
}

async function handleCallbackQuery(callbackQuery: any) {
  const data: string = callbackQuery.data ?? "";
  const chatId: number = callbackQuery.message?.chat?.id;
  const messageId: number = callbackQuery.message?.message_id;
  const callbackId: string = callbackQuery.id;

  if (data.startsWith("confirm_topup_")) {
    const topupId = parseInt(data.replace("confirm_topup_", ""), 10);
    await handleConfirmTopup(topupId, chatId, messageId, callbackId);
    return;
  }

  if (data.startsWith("reject_topup_")) {
    const topupId = parseInt(data.replace("reject_topup_", ""), 10);
    await handleRejectTopup(topupId, chatId, messageId, callbackId);
  }
}

async function handleConfirmTopup(
  topupId: number,
  chatId: number,
  messageId: number,
  callbackId: string,
) {
  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, topupId))
    .limit(1);

  if (!topup) {
    await answerCallbackQuery(callbackId, "❌ Topup tidak ditemukan.");
    return;
  }

  if (topup.status !== "pending") {
    await answerCallbackQuery(callbackId, `ℹ️ Topup sudah ${topup.status}.`);
    await editMessageReplyMarkup(chatId, messageId, null);
    return;
  }

  // Add balance
  await db
    .update(usersTable)
    .set({ balance: sql`balance + ${Number(topup.amount)}`, updatedAt: new Date() })
    .where(eq(usersTable.id, topup.userId));

  // Update topup status
  await db
    .update(topupsTable)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(topupsTable.id, topupId));

  // Get new balance and user Telegram
  const [user] = await db
    .select({ telegramId: usersTable.telegramId, balance: usersTable.balance, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, topup.userId))
    .limit(1);

  await answerCallbackQuery(callbackId, "✅ Topup dikonfirmasi!");
  await editMessageReplyMarkup(chatId, messageId, null);
  await sendMessage(
    chatId,
    `✅ <b>Topup #${topupId} dikonfirmasi</b>\nUser: ${user?.username ?? "-"}\nSaldo baru: Rp ${Number(user?.balance ?? 0).toLocaleString("id-ID")}`,
  );

  // Notify user
  if (user?.telegramId) {
    const amount = Number(topup.amount);
    const newBalance = Number(user.balance ?? 0);
    await sendMessage(
      user.telegramId,
      `✅ <b>Topup Dikonfirmasi!</b>\n\nSaldo <b>Rp ${amount.toLocaleString("id-ID")}</b> berhasil ditambahkan.\n💰 Saldo sekarang: <b>Rp ${newBalance.toLocaleString("id-ID")}</b>`,
    );
  }
}

async function handleRejectTopup(
  topupId: number,
  chatId: number,
  messageId: number,
  callbackId: string,
) {
  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, topupId))
    .limit(1);

  if (!topup) {
    await answerCallbackQuery(callbackId, "❌ Topup tidak ditemukan.");
    return;
  }

  if (topup.status !== "pending") {
    await answerCallbackQuery(callbackId, `ℹ️ Topup sudah ${topup.status}.`);
    await editMessageReplyMarkup(chatId, messageId, null);
    return;
  }

  await db
    .update(topupsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(topupsTable.id, topupId));

  const [user] = await db
    .select({ telegramId: usersTable.telegramId, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, topup.userId))
    .limit(1);

  await answerCallbackQuery(callbackId, "❌ Topup ditolak.");
  await editMessageReplyMarkup(chatId, messageId, null);
  await sendMessage(chatId, `❌ <b>Topup #${topupId} ditolak</b>\nUser: ${user?.username ?? "-"}`);

  // Notify user
  if (user?.telegramId) {
    const amount = Number(topup.amount);
    await sendMessage(
      user.telegramId,
      `❌ <b>Topup Ditolak</b>\n\nTopup sebesar <b>Rp ${amount.toLocaleString("id-ID")}</b> ditolak oleh admin.`,
    );
  }
}

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable, settingsTable, ticketsTable, ticketMessagesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { randomBytes } from "crypto";
import {
  callTelegramApi,
  sendMessage,
  sendMessageWithButtons,
  answerCallbackQuery,
  editMessageReplyMarkup,
  getBotInfo,
  registerWebhook,
  lookupTicketByMessage,
  broadcastMessage,
} from "../lib/telegram";
import { showAdminMenu, handleAdminCallback, handleCekUser, handleGiftSaldo, handleExtendServer } from "../lib/telegram-admin";

const router = Router();
const pendingBroadcasts = new Map<string, { chatId: number; message: string; createdAt: number }>();
const PENDING_BROADCAST_TTL_MS = 5 * 60 * 1000;
type AdminInputSession = {
  mode: "cek_user" | "gift" | "extend" | "broadcast_custom" | "broadcast_template";
  createdAt: number;
  templateKey?: string;
  step?: number;
  values?: string[];
};

const adminInputSessions = new Map<number, AdminInputSession>();
const ADMIN_INPUT_SESSION_TTL_MS = 10 * 60 * 1000;

const broadcastTemplates: Record<string, {
  name: string;
  fields: string[];
  build: (values: string[]) => string;
}> = {
  announcement: {
    name: "Pengumuman Umum",
    fields: ["Judul pengumuman", "Isi pengumuman"],
    build: ([title, body]) => `📣 <b>${title}</b>\n\n${body}\n\n— Tim KETANTECH VPN`,
  },
  info: {
    name: "Informasi",
    fields: ["Judul informasi", "Detail informasi"],
    build: ([title, body]) => `ℹ️ <b>${title}</b>\n\n${body}\n\n— Tim KETANTECH VPN`,
  },
  down: {
    name: "Server Down",
    fields: ["Nama server", "Estimasi normal (contoh: 30 menit)", "Catatan tambahan (opsional, isi '-' jika kosong)"],
    build: ([server, eta, note]) =>
      `🚨 <b>Gangguan Server ${server}</b>\n\nSaat ini server sedang mengalami gangguan. Tim kami sedang melakukan penanganan.\nEstimasi normal: <b>${eta}</b>.` +
      `${note && note !== "-" ? `\nCatatan: ${note}` : ""}` +
      `\n\nMohon maaf atas ketidaknyamanannya 🙏\n\n— Tim KETANTECH VPN`,
  },
  up: {
    name: "Server Pulih",
    fields: ["Nama server", "Waktu pulih (contoh: 14:35 WIB)"],
    build: ([server, time]) =>
      `✅ <b>Server ${server} Sudah Normal</b>\n\nLayanan telah kembali stabil per <b>${time}</b>. Silakan dicoba kembali.\n\nTerima kasih atas kesabarannya 🙌\n\n— Tim KETANTECH VPN`,
  },
  maintenance: {
    name: "Maintenance",
    fields: ["Nama server/layanan", "Waktu mulai", "Estimasi durasi"],
    build: ([target, start, duration]) =>
      `🛠️ <b>Maintenance Terjadwal</b>\n\nTarget: <b>${target}</b>\nMulai: <b>${start}</b>\nEstimasi durasi: <b>${duration}</b>.\n\nTerima kasih atas pengertiannya 🙏\n\n— Tim KETANTECH VPN`,
  },
  fixed: {
    name: "Perbaikan Selesai",
    fields: ["Nama server/layanan", "Ringkasan perbaikan"],
    build: ([target, summary]) =>
      `🎉 <b>Perbaikan Selesai</b>\n\nTarget: <b>${target}</b>\n${summary}\n\nLayanan sudah kembali normal. Terima kasih atas kesabarannya 🙌\n\n— Tim KETANTECH VPN`,
  },
};

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

router.post("/admin/telegram/register-webhook", requireAdmin, async (req, res) => {
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
    logger.error({ err }, "[telegram-webhook] error processing update");
  }
});

// ─── Handlers ────────────────────────────────────────────────────────────────

async function getAdminChatId(): Promise<string | null> {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return map["telegramAdminChatId"] ?? null;
}

async function isAdminChat(chatId: number): Promise<boolean> {
  const adminChatId = await getAdminChatId();
  return Boolean(adminChatId && String(chatId) === String(adminChatId));
}

function cleanupPendingBroadcasts(): void {
  const now = Date.now();
  for (const [token, item] of pendingBroadcasts) {
    if (now - item.createdAt > PENDING_BROADCAST_TTL_MS) {
      pendingBroadcasts.delete(token);
    }
  }
}

function cleanupAdminInputSessions(): void {
  const now = Date.now();
  for (const [chatId, session] of adminInputSessions) {
    if (now - session.createdAt > ADMIN_INPUT_SESSION_TTL_MS) {
      adminInputSessions.delete(chatId);
    }
  }
}

function setAdminInputSession(chatId: number, session: AdminInputSession): void {
  cleanupAdminInputSessions();
  adminInputSessions.set(chatId, { ...session, createdAt: Date.now() });
}

function clearAdminInputSession(chatId: number): void {
  adminInputSessions.delete(chatId);
}

async function handleMessage(message: any) {
  const text: string = message.text ?? "";
  const chatId: number = message.chat.id;
  const telegramId: number = message.from?.id ?? chatId;
  const adminChat = await isAdminChat(chatId);

  cleanupAdminInputSessions();

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

  if (adminChat) {
    const normalized = text.trim().toLowerCase();
    if (normalized === "batal" || normalized === "/batal") {
      clearAdminInputSession(chatId);
      await sendMessage(chatId, "✅ Mode input interaktif dibatalkan.");
      return;
    }

    const pending = adminInputSessions.get(chatId);
    if (pending && !text.trim().startsWith("/")) {
      if (pending.mode === "cek_user") {
        const username = text.trim();
        if (!username) {
          await sendMessage(chatId, "❌ Username tidak boleh kosong. Ketik username, atau <b>batal</b>.");
          return;
        }
        await handleCekUser(chatId, username);
        clearAdminInputSession(chatId);
        return;
      }

      if (pending.mode === "gift") {
        const args = text.trim().split(/\s+/);
        if (args.length !== 2) {
          await sendMessage(chatId, "❌ Format salah. Kirim: <code>username nominal</code>\nContoh: <code>daaw12 5000</code>\nAtau ketik <b>batal</b>.");
          return;
        }
        const username = args[0];
        const amount = parseInt(args[1], 10);
        if (isNaN(amount)) {
          await sendMessage(chatId, "❌ Nominal harus berupa angka. Contoh: <code>daaw12 5000</code>");
          return;
        }
        await handleGiftSaldo(chatId, username, amount);
        clearAdminInputSession(chatId);
        return;
      }

      if (pending.mode === "extend") {
        const args = text.trim().split(/\s+/);
        if (args.length < 2) {
          await sendMessage(chatId, "❌ Format salah. Kirim: <code>id_server jumlah_hari [jeda_detik]</code>\nContoh: <code>1 2 3</code>\nAtau ketik <b>batal</b>.");
          return;
        }
        const serverId = parseInt(args[0], 10);
        const days = parseInt(args[1], 10);
        const delaySec = args[2] ? parseInt(args[2], 10) : 3;
        if (isNaN(serverId) || isNaN(days) || isNaN(delaySec)) {
          await sendMessage(chatId, "❌ Semua parameter harus angka. Contoh: <code>1 2 3</code>");
          return;
        }
        handleExtendServer(chatId, serverId, days, delaySec).catch(console.error);
        clearAdminInputSession(chatId);
        return;
      }

      if (pending.mode === "broadcast_custom") {
        const content = text.trim();
        if (!content) {
          await sendMessage(chatId, "❌ Pesan tidak boleh kosong. Ketik isi broadcast, atau <b>batal</b>.");
          return;
        }
        cleanupPendingBroadcasts();
        const token = randomBytes(10).toString("hex");
        pendingBroadcasts.set(token, { chatId, message: `${content}\n\n— Tim KETANTECH VPN`, createdAt: Date.now() });
        await sendMessageWithButtons(
          chatId,
          `📢 <b>Konfirmasi Broadcast (Custom)</b>\n\n${content}\n\nLanjut kirim?`,
          [[
            { text: "✅ Ya, kirim", callback_data: `broadcast_confirm_${token}` },
            { text: "❌ Batal", callback_data: `broadcast_cancel_${token}` },
          ]],
        );
        clearAdminInputSession(chatId);
        return;
      }

      if (pending.mode === "broadcast_template") {
        const templateKey = pending.templateKey ?? "";
        const template = broadcastTemplates[templateKey];
        if (!template) {
          clearAdminInputSession(chatId);
          await sendMessage(chatId, "❌ Template tidak ditemukan. Silakan ulangi dari menu Broadcast.");
          return;
        }

        const values = [...(pending.values ?? [])];
        values.push(text.trim());
        const nextStep = (pending.step ?? 0) + 1;

        if (nextStep < template.fields.length) {
          setAdminInputSession(chatId, {
            mode: "broadcast_template",
            templateKey,
            step: nextStep,
            values,
            createdAt: Date.now(),
          });
          await sendMessage(chatId, `✍️ ${template.fields[nextStep]}:`);
          return;
        }

        const finalMessage = template.build(values);
        cleanupPendingBroadcasts();
        const token = randomBytes(10).toString("hex");
        pendingBroadcasts.set(token, { chatId, message: finalMessage, createdAt: Date.now() });

        await sendMessageWithButtons(
          chatId,
          `📢 <b>Preview Broadcast (${template.name})</b>\n\n${finalMessage}\n\nLanjut kirim?`,
          [[
            { text: "✅ Ya, kirim", callback_data: `broadcast_confirm_${token}` },
            { text: "❌ Batal", callback_data: `broadcast_cancel_${token}` },
          ]],
        );
        clearAdminInputSession(chatId);
        return;
      }
    }
  }

  if (text === "/admin") {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    await showAdminMenu(chatId);
    return;
  }

  if (text.startsWith("/broadcast ")) {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }

    const message = text.replace("/broadcast ", "").trim();
    if (!message) return;

    cleanupPendingBroadcasts();
    const token = randomBytes(10).toString("hex");
    pendingBroadcasts.set(token, { chatId, message, createdAt: Date.now() });

    await sendMessageWithButtons(
      chatId,
      `📢 <b>Konfirmasi Broadcast</b>\n\nPesan berikut akan dikirim ke semua user Telegram terhubung:\n\n${message}\n\nLanjut kirim?`,
      [[
        { text: "✅ Ya, kirim", callback_data: `broadcast_confirm_${token}` },
        { text: "❌ Batal", callback_data: `broadcast_cancel_${token}` },
      ]],
    );
    return;
  }

  if (text.startsWith("/cek ")) {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    const username = text.replace("/cek ", "").trim();
    if (!username) return;
    await handleCekUser(chatId, username);
    return;
  }

  if (text.startsWith("/gift ")) {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    const args = text.replace("/gift ", "").trim().split(/\s+/);
    if (args.length !== 2) {
      await sendMessage(chatId, "ℹ️ <b>Cara penggunaan:</b>\n<code>/gift username nominal</code>\nContoh: <code>/gift daaw12 5000</code>");
      return;
    }
    const username = args[0];
    const amount = parseInt(args[1], 10);
    await handleGiftSaldo(chatId, username, amount);
    return;
  }

  if (text.startsWith("/extend ")) {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    const args = text.replace("/extend ", "").trim().split(/\s+/);
    if (args.length < 2) {
      await sendMessage(chatId, "ℹ️ <b>Cara penggunaan:</b>\n<code>/extend id_server jumlah_hari [jeda_detik]</code>\nContoh: <code>/extend 1 2</code> (menambah 2 hari ke server ID 1 dengan jeda default 3 detik)\nContoh: <code>/extend 1 2 5</code> (jeda 5 detik)");
      return;
    }
    const serverId = parseInt(args[0], 10);
    const days = parseInt(args[1], 10);
    const delaySec = args[2] ? parseInt(args[2], 10) : 3;

    if (isNaN(serverId) || isNaN(days) || isNaN(delaySec)) {
      await sendMessage(chatId, "❌ Parameter harus berupa angka.");
      return;
    }

    handleExtendServer(chatId, serverId, days, delaySec).catch(console.error);
    return;
  }

  const replyMatch = text.match(/^\/reply_(\d+)\s+([\s\S]+)$/);
  if (replyMatch) {
    if (!adminChat) {
      await sendMessage(chatId, "⛔ Perintah ini hanya untuk admin.");
      return;
    }
    await handleReplyTicket(parseInt(replyMatch[1], 10), replyMatch[2].trim(), chatId);
    return;
  }

  if (message.reply_to_message && text.trim()) {
    if (adminChat) {
      const replyToMsgId: number = message.reply_to_message.message_id;
      const ticketId = lookupTicketByMessage(replyToMsgId);
      if (ticketId) {
        await handleReplyTicket(ticketId, text.trim(), chatId);
        return;
      }
    }
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
    .select({ id: usersTable.id, username: usersTable.username, updatedAt: usersTable.updatedAt })
    .from(usersTable)
    .where(eq(usersTable.telegramLinkToken, token))
    .limit(1);

  if (!user) {
    await sendMessage(chatId, "❌ Link tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman profil.");
    return;
  }

  // Token expire setelah 30 menit sejak dibuat (updatedAt diset saat generate token)
  const TOKEN_TTL_MS = 30 * 60 * 1000;
  if (user.updatedAt && Date.now() - new Date(user.updatedAt).getTime() > TOKEN_TTL_MS) {
    await db.update(usersTable).set({ telegramLinkToken: null }).where(eq(usersTable.id, user.id));
    await sendMessage(chatId, "❌ Link sudah kedaluwarsa (>30 menit). Minta link baru dari halaman profil.");
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
    if (!await isAdminChat(chatId)) {
      await answerCallbackQuery(callbackId, "⛔ Hanya admin yang dapat melakukan aksi ini.");
      return;
    }
    const topupId = parseInt(data.replace("confirm_topup_", ""), 10);
    await handleConfirmTopup(topupId, chatId, messageId, callbackId);
    return;
  }

  if (data.startsWith("reject_topup_")) {
    if (!await isAdminChat(chatId)) {
      await answerCallbackQuery(callbackId, "⛔ Hanya admin yang dapat melakukan aksi ini.");
      return;
    }
    const topupId = parseInt(data.replace("reject_topup_", ""), 10);
    await handleRejectTopup(topupId, chatId, messageId, callbackId);
    return;
  }

  if (data.startsWith("broadcast_confirm_")) {
    if (!await isAdminChat(chatId)) {
      await answerCallbackQuery(callbackId, "⛔ Hanya admin yang dapat melakukan aksi ini.");
      return;
    }

    cleanupPendingBroadcasts();
    const token = data.replace("broadcast_confirm_", "");
    const pending = pendingBroadcasts.get(token);
    if (!pending || pending.chatId !== chatId) {
      await answerCallbackQuery(callbackId, "❌ Draft broadcast tidak ditemukan/expired.");
      return;
    }

    pendingBroadcasts.delete(token);
    await answerCallbackQuery(callbackId, "Broadcast diproses...");
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendMessage(chatId, "⏳ Sedang mengirim broadcast...");
    const { sent, failed } = await broadcastMessage(pending.message);
    await sendMessage(chatId, `✅ <b>Broadcast Selesai</b>\n\nBerhasil terkirim: ${sent}\nGagal: ${failed}`);
    return;
  }

  if (data.startsWith("broadcast_cancel_")) {
    if (!await isAdminChat(chatId)) {
      await answerCallbackQuery(callbackId, "⛔ Hanya admin yang dapat melakukan aksi ini.");
      return;
    }

    cleanupPendingBroadcasts();
    const token = data.replace("broadcast_cancel_", "");
    pendingBroadcasts.delete(token);
    await answerCallbackQuery(callbackId, "Broadcast dibatalkan.");
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendMessage(chatId, "❌ Broadcast dibatalkan.");
    return;
  }

  if (data.startsWith("admin_")) {
    const adminChatId = await getAdminChatId();
    if (adminChatId && String(chatId) === String(adminChatId)) {
      if (data === "admin_search_prompt") setAdminInputSession(chatId, { mode: "cek_user", createdAt: Date.now() });
      if (data === "admin_comp_gift_prompt") setAdminInputSession(chatId, { mode: "gift", createdAt: Date.now() });
      if (data === "admin_comp_extend_prompt") setAdminInputSession(chatId, { mode: "extend", createdAt: Date.now() });
      if (data === "admin_broadcast_custom_prompt") {
        setAdminInputSession(chatId, { mode: "broadcast_custom", createdAt: Date.now() });
      }
      if (data.startsWith("admin_broadcast_tpl_")) {
        const templateKey = data.replace("admin_broadcast_tpl_", "");
        const template = broadcastTemplates[templateKey];
        if (!template) {
          await answerCallbackQuery(callbackId, "Template tidak ditemukan");
          return;
        }
        setAdminInputSession(chatId, {
          mode: "broadcast_template",
          templateKey,
          step: 0,
          values: [],
          createdAt: Date.now(),
        });
        await answerCallbackQuery(callbackId, `Template: ${template.name}`);
        await sendMessage(chatId, `🧩 <b>Template ${template.name}</b>\nSilakan isi data berikut satu per satu.\n\n✍️ ${template.fields[0]}:`);
      }
      if (data === "admin_menu" || data === "admin_close" || data === "admin_broadcast_prompt") clearAdminInputSession(chatId);
      await handleAdminCallback(data, chatId, messageId, callbackId);
    }
    return;
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

  // Atomic: update status HANYA jika masih pending.
  // Ini mencegah double-credit jika admin double-click tombol di Telegram.
  const [confirmed] = await db
    .update(topupsTable)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(topupsTable.id, topupId), eq(topupsTable.status, "pending")))
    .returning();

  if (!confirmed) {
    await answerCallbackQuery(callbackId, "ℹ️ Topup sudah diproses.");
    await editMessageReplyMarkup(chatId, messageId, null);
    return;
  }

  // Credit balance — aman, hanya berjalan 1x karena guard atomic di atas
  await db
    .update(usersTable)
    .set({ balance: sql`balance + ${Number(topup.amount)}`, updatedAt: new Date() })
    .where(eq(usersTable.id, topup.userId));

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

  // Atomic: update HANYA jika masih pending (mencegah overwrite confirmed → rejected saat double-click)
  const [rejected] = await db
    .update(topupsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(and(eq(topupsTable.id, topupId), eq(topupsTable.status, "pending")))
    .returning();

  if (!rejected) {
    await answerCallbackQuery(callbackId, "ℹ️ Topup sudah diproses.");
    await editMessageReplyMarkup(chatId, messageId, null);
    return;
  }

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

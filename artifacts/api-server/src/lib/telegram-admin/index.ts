import {
  sendMessageWithButtons,
  answerCallbackQuery,
  editMessageText,
} from "../telegram";
import { performBackup } from "../backup";
import { sendMessage } from "../telegram";

// ─── Sub-module imports ──────────────────────────────────────────────────────

import { runSystemDiagnostics, getStatusNowReport, getRecentErrorDigest } from "./diagnostics";
import { getVpsResourceReport } from "./vps-monitor";
import {
  handleStats,
  handleServersList,
  handleServerToggle,
  handlePendingTopups,
  handleOpenTickets,
  handleCekUser,
} from "./handlers";
import { handleGiftSaldo, handleExtendServer } from "./compensation";

// ─── Re-export public API for telegram-bot.ts ────────────────────────────────

export { handleCekUser, handleGiftSaldo, handleExtendServer };

// ─── Admin Menu ──────────────────────────────────────────────────────────────

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
      { text: "🚦 Status Sekarang", callback_data: "admin_status_now" },
      { text: "🧯 Error Terakhir", callback_data: "admin_recent_errors" },
    ],
    [{ text: "❌ Tutup", callback_data: "admin_close" }],
  ];
}

export async function showAdminMenu(chatId: number) {
  const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
  await sendMessageWithButtons(chatId, text, buildAdminMenuButtons());
}

// ─── Callback Command Map ────────────────────────────────────────────────────
//
// Instead of a long if/else chain, each callback_data prefix is mapped to a
// handler function. This makes it easy to add new commands and reduces
// cognitive load when reading/maintaining the dispatcher.

type CallbackHandler = (
  chatId: number,
  messageId: number,
  callbackId: string,
  data: string,
) => Promise<void>;

const CALLBACK_HANDLERS: Record<string, CallbackHandler> = {
  admin_menu: async (chatId, messageId, callbackId) => {
    const text = `👨‍💻 <b>Menu Admin KETANTECH VPN</b>\n\nSilakan pilih menu di bawah ini:`;
    await answerCallbackQuery(callbackId);
    await editMessageText(chatId, messageId, text, buildAdminMenuButtons());
  },

  admin_close: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Menu ditutup");
    await editMessageText(
      chatId,
      messageId,
      "Menu admin ditutup. Ketik /admin untuk membuka kembali.",
    );
  },

  admin_stats: async (chatId, messageId, callbackId) => {
    await handleStats(chatId, messageId, callbackId);
  },

  admin_servers: async (chatId, messageId, callbackId) => {
    await handleServersList(chatId, messageId, callbackId);
  },

  admin_backup: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Memulai backup database...");
    await sendMessage(chatId, "⏳ Sedang memproses backup database...");
    try {
      const result = await performBackup();
      if (result.success) {
        await sendMessage(chatId, "✅ Backup berhasil dikirim ke chat ini.");
      } else {
        await sendMessage(chatId, `❌ Gagal melakukan backup database.\nError: ${result.error}`);
      }
    } catch {
      await sendMessage(chatId, "❌ Gagal melakukan backup database.");
    }
  },

  admin_topups: async (chatId, messageId, callbackId) => {
    await handlePendingTopups(chatId, messageId, callbackId);
  },

  admin_tickets: async (chatId, messageId, callbackId) => {
    await handleOpenTickets(chatId, messageId, callbackId);
  },

  admin_search_prompt: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "🔍 <b>Mode Cari User Aktif</b>\n\nSilakan kirim <b>username</b> langsung di chat ini (tanpa <code>/cek</code>).\n\nContoh: <code>budi123</code>\n\nKetik <b>batal</b> untuk keluar dari mode ini.",
      [[{ text: "🔙 Kembali", callback_data: "admin_menu" }]],
    );
  },

  admin_broadcast_prompt: async (chatId, messageId, callbackId) => {
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
      ],
    );
  },

  admin_compensation_prompt: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      `🎁 <b>Menu Kompensasi Interaktif</b>\n\n` +
        `Pilih mode di bawah. Setelah mode aktif, kamu tinggal kirim input biasa di chat (tanpa slash command).\n\n` +
        `Ketik <b>batal</b> kapan saja untuk keluar dari mode input.`,
      [
        [{ text: "🎁 Gift Saldo", callback_data: "admin_comp_gift_prompt" }],
        [{ text: "⏱ Extend Massal", callback_data: "admin_comp_extend_prompt" }],
        [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
      ],
    );
  },

  admin_comp_gift_prompt: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "🎁 <b>Mode Gift Saldo Aktif</b>\n\nKirim format berikut di chat:\n<code>username nominal</code>\nContoh: <code>user1 5000</code>\n\nKetik <b>batal</b> untuk keluar.",
      [[{ text: "🔙 Kembali", callback_data: "admin_compensation_prompt" }]],
    );
  },

  admin_comp_extend_prompt: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId);
    await editMessageText(
      chatId,
      messageId,
      "⏱ <b>Mode Extend Massal Aktif</b>\n\nKirim format berikut di chat:\n<code>id_server jumlah_hari [jeda_detik]</code>\nContoh: <code>1 2 3</code>\n\nKetik <b>batal</b> untuk keluar.",
      [[{ text: "🔙 Kembali", callback_data: "admin_compensation_prompt" }]],
    );
  },

  admin_diagnostics: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Menjalankan diagnostik...");
    await editMessageText(
      chatId,
      messageId,
      "⏳ <b>Menjalankan System Test...</b>\n\nMengecek semua integrasi, mohon tunggu...",
    );
    const report = await runSystemDiagnostics();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Tes Ulang", callback_data: "admin_diagnostics" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
  },

  admin_vps_monitor: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Mengecek resource VPS...");
    await editMessageText(chatId, messageId, "⏳ <b>Membaca resource VPS...</b>");
    const report = await getVpsResourceReport();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Refresh", callback_data: "admin_vps_monitor" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
  },

  admin_status_now: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Mengumpulkan status...");
    await editMessageText(chatId, messageId, "⏳ <b>Mengambil status sekarang...</b>");
    const report = await getStatusNowReport();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Refresh", callback_data: "admin_status_now" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
  },

  admin_recent_errors: async (chatId, messageId, callbackId) => {
    await answerCallbackQuery(callbackId, "Membaca error terakhir...");
    await editMessageText(chatId, messageId, "⏳ <b>Mengambil ringkasan error terakhir...</b>");
    const report = await getRecentErrorDigest();
    await editMessageText(chatId, messageId, report, [
      [{ text: "🔄 Refresh", callback_data: "admin_recent_errors" }],
      [{ text: "🔙 Kembali", callback_data: "admin_menu" }],
    ]);
  },
};

// Prefix-based handlers (for dynamic callback_data like "admin_server_toggle_123")
const PREFIX_HANDLERS: Array<{
  prefix: string;
  handler: (chatId: number, messageId: number, callbackId: string, data: string) => Promise<void>;
}> = [
  {
    prefix: "admin_server_toggle_",
    handler: async (chatId, messageId, callbackId, data) => {
      const serverId = parseInt(data.replace("admin_server_toggle_", ""), 10);
      await handleServerToggle(serverId, chatId, messageId, callbackId);
    },
  },
];

/**
 * Main callback dispatcher. Routes Telegram inline-keyboard callbacks
 * to the appropriate handler.
 *
 * Uses a two-tier lookup:
 * 1. Exact match in CALLBACK_HANDLERS map
 * 2. Prefix match in PREFIX_HANDLERS array (for dynamic IDs)
 */
export async function handleAdminCallback(
  data: string,
  chatId: number,
  messageId: number,
  callbackId: string,
) {
  // Exact match first
  const exactHandler = CALLBACK_HANDLERS[data];
  if (exactHandler) {
    await exactHandler(chatId, messageId, callbackId, data);
    return;
  }

  // Prefix match for dynamic callback data
  for (const { prefix, handler } of PREFIX_HANDLERS) {
    if (data.startsWith(prefix)) {
      await handler(chatId, messageId, callbackId, data);
      return;
    }
  }

  // Unknown callback — no-op (avoid crashing on stale inline keyboards)
}

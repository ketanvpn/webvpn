import { db } from "@workspace/db";
import { vpnAccountsTable, usersTable, settingsTable, ordersTable, serversTable, topupsTable } from "@workspace/db";
import { eq, and, lte, gte, lt, sql, sum, ne } from "drizzle-orm";
import { logger } from "./logger";
import { sendWhatsapp } from "./fonnte";
import { sendMessage } from "./telegram";

async function getReferralBonusAmount(): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "referralBonusAmount"))
    .limit(1);
  const v = row?.value ? parseInt(row.value, 10) : 5000;
  return isNaN(v) ? 5000 : v;
}

function formatTanggal(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Simple in-memory lock to prevent overlapping tasks ──────────────────────
const runningTasks = new Set<string>();

async function runSafely(name: string, fn: () => Promise<void>) {
  if (runningTasks.has(name)) {
    logger.warn(`[scheduler] ${name} still running, skipping this tick to prevent overlap`);
    return;
  }
  runningTasks.add(name);
  const start = Date.now();
  try {
    logger.info(`[scheduler] ${name} started`);
    await fn();
    logger.info(`[scheduler] ${name} completed in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error({ err }, `[scheduler] ${name} failed`);
  } finally {
    runningTasks.delete(name);
  }
}

async function notifyExpiring(daysBefore: 1 | 3): Promise<void> {
  const now = new Date();
  const rangeStart = new Date(now.getTime() + (daysBefore - 1) * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);

  const notifiedField = daysBefore === 3 ? vpnAccountsTable.notified3Days : vpnAccountsTable.notified1Day;

  const accounts = await db
    .select({
      id: vpnAccountsTable.id,
      userId: vpnAccountsTable.userId,
      username: vpnAccountsTable.username,
      expiresAt: vpnAccountsTable.expiresAt,
      userWhatsapp: usersTable.whatsapp,
      userTelegramId: usersTable.telegramId,
      userFullName: usersTable.fullName,
    })
    .from(vpnAccountsTable)
    .leftJoin(usersTable, eq(vpnAccountsTable.userId, usersTable.id))
    .where(
      and(
        eq(vpnAccountsTable.isActive, true),
        eq(notifiedField, false),
        gte(vpnAccountsTable.expiresAt, rangeStart),
        lte(vpnAccountsTable.expiresAt, rangeEnd),
      )
    );

  if (accounts.length === 0) return;
  logger.info({ count: accounts.length, daysBefore }, "Mengirim notifikasi kedaluwarsa akun VPN");

  for (const acc of accounts) {
    const namaUser = acc.userFullName ?? `User #${acc.userId}`;
    const tanggal = formatTanggal(new Date(acc.expiresAt));
    const hariText = daysBefore === 1 ? "1 hari lagi" : "3 hari lagi";

    const waMsg =
      `⚠️ *Notifikasi KETANTECH VPN*\n\n` +
      `Halo *${namaUser}*,\n\n` +
      `Akun VPN kamu dengan username *${acc.username}* akan habis masa berlakunya *${hariText}* (${tanggal}).\n\n` +
      `Segera perpanjang agar koneksi kamu tidak terputus. Login di website kami dan pilih menu _Akun VPN_ → _Perpanjang_.\n\n` +
      `Terima kasih sudah menggunakan KETANTECH VPN 🙏`;

    const tgMsg =
      `⚠️ <b>Akun VPN Hampir Habis</b>\n\n` +
      `Halo <b>${namaUser}</b>,\n\n` +
      `Akun VPN <code>${acc.username}</code> akan habis <b>${hariText}</b> (${tanggal}).\n\n` +
      `Segera perpanjang melalui website agar tidak terputus.`;

    if (acc.userWhatsapp) {
      sendWhatsapp(acc.userWhatsapp, waMsg).catch(() => {});
    }
    if (acc.userTelegramId) {
      sendMessage(acc.userTelegramId, tgMsg).catch(() => {});
    }

    const updateSet = daysBefore === 3
      ? { notified3Days: true, updatedAt: new Date() }
      : { notified1Day: true, updatedAt: new Date() };

    await db
      .update(vpnAccountsTable)
      .set(updateSet)
      .where(eq(vpnAccountsTable.id, acc.id));

    await new Promise((r) => setTimeout(r, 200));
  }
}

async function getExpiryNotifSettings(): Promise<{
  enabled: boolean;
  notif3Days: boolean;
  notif1Day: boolean;
  sendHour: number;
}> {
  const allRows = await db.select().from(settingsTable);
  const map = Object.fromEntries(allRows.map((r: any) => [r.key, r.value]));
  const parse = (v: string | null | undefined, def = true) =>
    v === undefined || v === null ? def : v === "true";
  const rawHour = parseInt(map["expiryNotifSendHour"] ?? "8", 10);

  return {
    enabled: parse(map["expiryNotifEnabled"], true),
    notif3Days: parse(map["expiryNotif3DaysEnabled"], true),
    notif1Day: parse(map["expiryNotif1DayEnabled"], true),
    sendHour: isNaN(rawHour) ? 8 : Math.min(23, Math.max(0, rawHour)),
  };
}

export async function checkExpiringAccounts(): Promise<void> {
  try {
    const cfg = await getExpiryNotifSettings();
    if (!cfg.enabled) {
      return;
    }

    // Cek jam sekarang dalam zona WIB (UTC+7)
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const currentHourWIB = nowWIB.getUTCHours();

    if (currentHourWIB !== cfg.sendHour) {
      return; // Belum waktunya kirim
    }

    logger.info({ sendHour: cfg.sendHour }, "Waktunya kirim notifikasi kedaluwarsa");
    if (cfg.notif3Days) await notifyExpiring(3);
    if (cfg.notif1Day) await notifyExpiring(1);
  } catch (err) {
    logger.error({ err }, "Error saat cek akun VPN kedaluwarsa");
  }
}

/**
 * Auto-cancel order QRIS yang sudah lewat waktu bayar (expiresAt < now, status masih pending).
 * Dijalankan setiap 5 menit.
 */
async function cancelExpiredQrisOrders(): Promise<void> {
  try {
    const now = new Date();
    const result = await db
      .update(ordersTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(ordersTable.status, "pending"),
          eq(ordersTable.paymentMethod, "qris"),
          lt(ordersTable.expiresAt, now)
        )
      )
      .returning({ id: ordersTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-expire: order QRIS melewati batas waktu pembayaran");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel order QRIS expired");
  }
}

/**
 * Auto-cancel topup manual (Bank/E-Wallet) yang sudah lewat 24 jam tapi masih pending.
 * Dijalankan setiap jam.
 */
async function cancelExpiredTopups(): Promise<void> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .update(topupsTable)
      .set({ 
        status: "rejected", 
        rejectionNote: "Auto-cleanup: Melewati batas waktu 24 jam", 
        updatedAt: new Date() 
      })
      .where(
        and(
          eq(topupsTable.status, "pending"),
          lt(topupsTable.createdAt, twentyFourHoursAgo)
        )
      )
      .returning({ id: topupsTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-expire: topup manual melewati batas waktu 24 jam");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cancel topup manual expired");
  }
}

async function checkResellerTargets(): Promise<void> {
  try {
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dateWib = nowWib.getUTCDate();
    const hourWib = nowWib.getUTCHours();

    if (dateWib !== 1 || hourWib !== 7) return;

    const [enabledRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerTargetEnabled")).limit(1);
    if (enabledRow?.value !== "true") return;

    const [targetRow] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "resellerMonthlyTarget")).limit(1);
    const target = targetRow?.value ? parseInt(targetRow.value, 10) : 500000;

    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const resellers = await db.select({ id: usersTable.id, username: usersTable.username, whatsapp: usersTable.whatsapp, telegramId: usersTable.telegramId }).from(usersTable).where(eq(usersTable.role, "reseller"));

    for (const reseller of resellers) {
      const [result] = await db
        .select({ total: sum(ordersTable.amount) })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.userId, reseller.id),
          eq(ordersTable.status, "paid"),
          gte(ordersTable.createdAt, prevMonthStart),
          lt(ordersTable.createdAt, prevMonthEnd),
        ));

      const totalSales = Number(result?.total ?? 0);

      if (totalSales < target) {
        await db.update(usersTable).set({ role: "user" }).where(eq(usersTable.id, reseller.id));
        logger.info({ resellerId: reseller.id, totalSales, target }, "Reseller didowngrade karena tidak capai target bulanan");

        const msg = `⚠️ *Status Reseller Dinonaktifkan*\n\nHai *${reseller.username}*, status reseller kamu bulan ini telah dinonaktifkan karena total penjualan (Rp ${totalSales.toLocaleString("id-ID")}) belum mencapai target minimum (Rp ${target.toLocaleString("id-ID")}).\n\nHubungi admin untuk mengaktifkan kembali.`;

        if (reseller.whatsapp) sendWhatsapp(reseller.whatsapp, msg).catch(() => {});
        if (reseller.telegramId) sendMessage(String(reseller.telegramId), msg).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek target reseller bulanan");
  }
}

async function checkAndAutoDisableServers(): Promise<void> {
  try {
    const servers = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.isActive, true));

    for (const server of servers) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(
          and(
            eq(vpnAccountsTable.serverId, server.id),
            eq(vpnAccountsTable.isActive, true),
            gte(vpnAccountsTable.expiresAt, new Date()),
          ),
        );

      if ((count ?? 0) >= server.maxAccounts) {
        await db
          .update(serversTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(serversTable.id, server.id));
        logger.info(`[scheduler] Server "${server.name}" (id: ${server.id}) di-disable otomatis — ${count}/${server.maxAccounts} akun aktif`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek auto-disable server");
  }
}

async function cleanupGhostAccounts(): Promise<void> {
  try {
    const now = new Date();
    // Cari akun yang expired lebih dari 7 hari lalu
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(vpnAccountsTable)
      .where(lt(vpnAccountsTable.expiresAt, sevenDaysAgo))
      .returning({ id: vpnAccountsTable.id, username: vpnAccountsTable.username });

    if (result.length > 0) {
      logger.info({ count: result.length, accounts: result.map((r: any) => r.username) }, "Auto-cleanup: menghapus akun VPN hantu yang sudah lama expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cleanup akun hantu");
  }
}

export function startScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const FIVE_MIN = 5 * 60 * 1000;
  const FIFTEEN_MIN = 15 * 60 * 1000;

  runSafely("initial-checkExpiringAccounts", checkExpiringAccounts);
  runSafely("initial-cancelExpiredQrisOrders", cancelExpiredQrisOrders);
  runSafely("initial-cancelExpiredTopups", cancelExpiredTopups);
  runSafely("initial-checkResellerTargets", checkResellerTargets);
  runSafely("initial-checkAndAutoDisableServers", checkAndAutoDisableServers);
  runSafely("initial-cleanupGhostAccounts", cleanupGhostAccounts);

  setInterval(() => {
    runSafely("checkExpiringAccounts", checkExpiringAccounts);
    runSafely("cancelExpiredTopups", cancelExpiredTopups);
    runSafely("sendDailyReport", sendDailyReport);
  }, ONE_HOUR);

  setInterval(() => {
    runSafely("cancelExpiredQrisOrders", cancelExpiredQrisOrders);
  }, FIVE_MIN);

  setInterval(() => {
    runSafely("checkResellerTargets", checkResellerTargets);
  }, ONE_HOUR);

  setInterval(() => {
    runSafely("checkAndAutoDisableServers", checkAndAutoDisableServers);
  }, FIVE_MIN);

  // Auto-cleanup jalan setiap 3 jam
  setInterval(() => {
    runSafely("cleanupGhostAccounts", cleanupGhostAccounts);
  }, THREE_HOURS);

  // Proactive alert setiap 15 menit
  setTimeout(() => runSafely("runProactiveAlerts", runProactiveAlerts), 2 * 60 * 1000);
  setInterval(() => {
    runSafely("runProactiveAlerts", runProactiveAlerts);
  }, FIFTEEN_MIN);

  logger.info("Scheduler notifikasi kedaluwarsa aktif (cek setiap jam, kirim sesuai jam WIB yang dikonfigurasi)");
  logger.info("Scheduler auto-cancel QRIS expired aktif (interval: 5 menit)");
  logger.info("Scheduler cek target reseller aktif (cek setiap jam, eksekusi tanggal 1 jam 07.00 WIB)");
  logger.info("Scheduler auto-disable server penuh aktif (interval: 5 menit)");
  logger.info("Scheduler auto-cleanup akun hantu aktif (cek setiap 3 jam)");
  logger.info("Scheduler proactive alerts aktif (interval: 15 menit)");
  logger.info("Scheduler laporan harian aktif (cek setiap jam, kirim jam 08.00 WIB)");

  // Auto-backup: cek setiap jam apakah sudah waktunya backup
  import("./backup").then(({ isBackupDue, performBackup }) => {
    const runBackupIfDue = async () => {
      runSafely("runBackupIfDue", async () => {
        const due = await isBackupDue();
        if (due) {
          logger.info("Auto-backup terjadwal dimulai...");
          await performBackup();
        }
      });
    };

    // Cek pertama kali 1 menit setelah start
    setTimeout(() => runBackupIfDue(), 60 * 1000);

    // Lalu cek setiap jam
    setInterval(() => runBackupIfDue(), ONE_HOUR);

    logger.info("Scheduler auto-backup aktif (cek setiap jam)");
  }).catch((err) => {
    logger.error({ err }, "Failed to load backup module for scheduler");
  });
}

// ─── Laporan Harian Otomatis ─────────────────────────────────────────────────

let lastDailyReportDate = "";

async function sendDailyReport(): Promise<void> {
  try {
    const nowWIB = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const hourWIB = nowWIB.getUTCHours();

    // Kirim jam 8 pagi WIB saja
    if (hourWIB !== 8) return;

    // Cegah kirim ganda di jam yang sama
    const todayKey = nowWIB.toISOString().slice(0, 10);
    if (lastDailyReportDate === todayKey) return;
    lastDailyReportDate = todayKey;

    const [adminChatRow] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "telegramAdminChatId"))
      .limit(1);
    const adminChatId = adminChatRow?.value;
    if (!adminChatId) return;

    // Hitung data kemarin
    const yesterday = new Date(nowWIB);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(nowWIB);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Revenue kemarin
    const [revRow] = await db
      .select({ total: sum(ordersTable.amount) })
      .from(ordersTable)
      .where(and(eq(ordersTable.status, "paid"), gte(ordersTable.createdAt, yesterday), lt(ordersTable.createdAt, todayStart)));
    const revenue = Number(revRow?.total ?? 0);

    // User baru kemarin
    const [newUserRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(and(gte(usersTable.createdAt, yesterday), lt(usersTable.createdAt, todayStart)));
    const newUsers = newUserRow?.count ?? 0;

    // Total user
    const [totalUserRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    const totalUsers = totalUserRow?.count ?? 0;

    // Akun VPN akan expired hari ini
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
    const [expTodayRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(and(eq(vpnAccountsTable.isActive, true), gte(vpnAccountsTable.expiresAt, todayStart), lt(vpnAccountsTable.expiresAt, todayEnd)));
    const expiringToday = expTodayRow?.count ?? 0;

    // Akun expired dalam 3 hari ke depan
    const threeDaysLater = new Date(todayStart);
    threeDaysLater.setUTCDate(threeDaysLater.getUTCDate() + 3);
    const [exp3Row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(and(eq(vpnAccountsTable.isActive, true), gte(vpnAccountsTable.expiresAt, todayStart), lt(vpnAccountsTable.expiresAt, threeDaysLater)));
    const expiring3Days = exp3Row?.count ?? 0;

    // Topup pending
    const [pendingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(topupsTable)
      .where(eq(topupsTable.status, "pending"));
    const pendingTopups = pendingRow?.count ?? 0;

    // Total akun VPN aktif
    const [activeVpnRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vpnAccountsTable)
      .where(eq(vpnAccountsTable.isActive, true));
    const activeVpn = activeVpnRow?.count ?? 0;

    const tanggal = nowWIB.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");

    let text = `📋 <b>Laporan Harian KETANTECH VPN</b>\n`;
    text += `📅 ${tanggal}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    text += `💰 <b>Revenue Kemarin:</b> <b>${fmtRp(revenue)}</b>\n`;
    text += `👥 <b>User Baru Kemarin:</b> ${newUsers}\n`;
    text += `👤 <b>Total User:</b> ${totalUsers}\n\n`;

    text += `🔌 <b>Akun VPN Aktif:</b> ${activeVpn}\n`;
    text += `⚠️ <b>Expired Hari Ini:</b> ${expiringToday}\n`;
    text += `📆 <b>Expired 3 Hari Ke Depan:</b> ${expiring3Days}\n\n`;

    if (pendingTopups > 0) {
      text += `💸 <b>Topup Pending:</b> ${pendingTopups} ⚠️\n\n`;
    }

    text += `<i>Selamat pagi, semoga harinya produktif! 💪</i>`;

    await sendMessage(adminChatId, text);
    logger.info("Laporan harian terkirim ke admin");
  } catch (err) {
    logger.error({ err }, "Error saat mengirim laporan harian");
  }
}

// ─── Proactive Alert Monitoring ──────────────────────────────────────────────

import os from "os";
import { exec as execCb } from "child_process";
import { checkPanelHealth } from "./vpn-panel";

// Cooldown: jangan spam alert yang sama berulang kali
const alertCooldowns = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit cooldown per alert

function shouldAlert(key: string): boolean {
  const last = alertCooldowns.get(key);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false;
  alertCooldowns.set(key, Date.now());
  return true;
}

async function getAdminChatIdForAlert(): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "telegramAdminChatId"))
    .limit(1);
  return row?.value ?? null;
}

async function runProactiveAlerts(): Promise<void> {
  try {
    const adminChatId = await getAdminChatIdForAlert();
    if (!adminChatId) return;

    const alerts: string[] = [];

    // 1. Cek RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    if (memPercent >= 90 && shouldAlert("ram_critical")) {
      alerts.push(`🔴 <b>RAM KRITIS: ${memPercent}%</b> terpakai!\nFree: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`);
    } else if (memPercent >= 80 && shouldAlert("ram_warning")) {
      alerts.push(`🟡 <b>RAM Warning: ${memPercent}%</b> terpakai`);
    }

    // 2. Cek CPU
    const cpuCount = os.cpus().length;
    const load1m = os.loadavg()[0];
    const cpuPercent = Math.min(100, Math.round((load1m / cpuCount) * 100));
    if (cpuPercent >= 90 && shouldAlert("cpu_critical")) {
      alerts.push(`🔴 <b>CPU KRITIS: Load ${load1m.toFixed(2)}</b> (${cpuPercent}% dari ${cpuCount} core)`);
    }

    // 3. Cek Disk
    try {
      const diskPercent = await new Promise<number | null>((resolve) => {
        execCb("df / | tail -1 | awk '{print $5}'", { timeout: 5000 }, (err, stdout) => {
          if (err) { resolve(null); return; }
          const p = parseInt(stdout.trim().replace("%", ""), 10);
          resolve(isNaN(p) ? null : p);
        });
      });
      if (diskPercent !== null && diskPercent >= 90 && shouldAlert("disk_critical")) {
        alerts.push(`🔴 <b>DISK KRITIS: ${diskPercent}%</b> terpakai!\nSegera bersihkan log/backup lama.`);
      } else if (diskPercent !== null && diskPercent >= 80 && shouldAlert("disk_warning")) {
        alerts.push(`🟡 <b>Disk Warning: ${diskPercent}%</b> terpakai`);
      }
    } catch { /* skip disk check */ }

    // 4. Cek Fonnte (WhatsApp)
    try {
      const [tokenRow] = await db
        .select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, "fonnteToken"))
        .limit(1);
      const fonnteToken = tokenRow?.value;
      if (fonnteToken) {
        const resp = await fetch("https://api.fonnte.com/device", {
          method: "POST",
          headers: { Authorization: fonnteToken },
        });
        const data = await resp.json() as { status?: boolean; device_status?: string };
        if (data.device_status === "disconnect" && shouldAlert("fonnte_disconnect")) {
          alerts.push(`🔴 <b>WhatsApp (Fonnte) TERPUTUS!</b>\nDevice tidak terhubung. Segera login ulang di dashboard Fonnte.`);
        }
      }
    } catch { /* skip fonnte check */ }

    // 5. Cek VPN Panel
    try {
      const servers = await db.select().from(serversTable).where(eq(serversTable.isActive, true));
      for (const server of servers) {
        if (!server.apiUrl || !server.apiToken) continue;
        const health = await checkPanelHealth({ apiUrl: server.apiUrl, apiToken: server.apiToken });
        if (!health.online && shouldAlert(`panel_down_${server.id}`)) {
          alerts.push(`🔴 <b>VPN Panel "${server.name}" DOWN!</b>\nTidak dapat terhubung ke panel server.`);
        }
      }
    } catch { /* skip panel check */ }

    // Kirim alert jika ada
    if (alerts.length > 0) {
      let text = `🚨 <b>ALERT — KETANTECH VPN</b>\n━━━━━━━━━━━━━━━━━━\n\n`;
      text += alerts.join("\n\n");
      const now = new Date().toLocaleString("id-ID", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
      });
      text += `\n\n🕐 ${now} WIB`;
      await sendMessage(adminChatId, text);
      logger.info({ alertCount: alerts.length }, "Proactive alerts sent to admin");
    }
  } catch (err) {
    logger.error({ err }, "Error saat proactive alert monitoring");
  }
}

export { getReferralBonusAmount };

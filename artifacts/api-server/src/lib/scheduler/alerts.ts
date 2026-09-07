import os from "os";
import { exec as execCb } from "child_process";
import { db } from "@workspace/db";
import { settingsTable, serversTable, ordersTable } from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "../logger";
import { sendMessage } from "../telegram";
import { checkPanelHealth } from "../vpn-panel";
import { shouldAlert, getAdminChatIdForAlert } from "./helpers";

const FONNTE_TIMEOUT_MS = 8_000;

export async function runProactiveAlerts(): Promise<void> {
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
          signal: AbortSignal.timeout(FONNTE_TIMEOUT_MS),
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

// ─── Stuck Order Health Check ────────────────────────────────────────────────

/**
 * Health check untuk order yang stuck pending terlalu lama (> 1 jam).
 * Alert ke admin jika ada anomali.
 */
const STUCK_ORDER_THRESHOLD_HOURS = 1;

export async function checkStuckOrders(): Promise<void> {
  try {
    const adminChatId = await getAdminChatIdForAlert();
    if (!adminChatId) return;

    const threshold = new Date(Date.now() - STUCK_ORDER_THRESHOLD_HOURS * 60 * 60 * 1000);

    // Cari order pending yang sudah > 1 jam
    const stuckOrders = await db
      .select({
        id: ordersTable.id,
        paymentMethod: ordersTable.paymentMethod,
        createdAt: ordersTable.createdAt,
        expiresAt: ordersTable.expiresAt,
      })
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.status, "pending"),
          lt(ordersTable.createdAt, threshold)
        )
      );

    if (stuckOrders.length === 0) return;

    // Group by payment method untuk insight
    const byMethod: Record<string, number> = {};
    let nullExpiresCount = 0;

    for (const order of stuckOrders) {
      const method = order.paymentMethod ?? "unknown";
      byMethod[method] = (byMethod[method] ?? 0) + 1;
      if (order.expiresAt === null) nullExpiresCount++;
    }

    // Alert dengan cooldown 1 jam
    if (!shouldAlert("stuck_orders")) return;

    const lines = [
      `⚠️ <b>ORDER PENDING TERLALU LAMA</b>`,
      `━━━━━━━━━━━━━━━━━━`,
      ``,
      `Ditemukan <b>${stuckOrders.length} order</b> pending > ${STUCK_ORDER_THRESHOLD_HOURS} jam:`,
    ];

    for (const [method, count] of Object.entries(byMethod)) {
      lines.push(`  • ${method}: ${count} order`);
    }

    if (nullExpiresCount > 0) {
      lines.push(``);
      lines.push(`🔴 <b>${nullExpiresCount} order tanpa expiresAt</b> (indikasi bug)`);
    }

    lines.push(``);
    lines.push(`Cek dashboard admin → Orders untuk detail.`);
    lines.push(``);
    lines.push(`🕐 ${new Date().toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB`);

    await sendMessage(adminChatId, lines.join("\n"));
    logger.info({ count: stuckOrders.length, byMethod, nullExpiresCount }, "Stuck orders alert sent to admin");
  } catch (err) {
    logger.error({ err }, "Error saat check stuck orders");
  }
}

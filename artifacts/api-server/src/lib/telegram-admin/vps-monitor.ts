import os from "os";
import { exec } from "child_process";

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  return parts.join(", ") || "< 1 menit";
}

function progressBar(percent: number, length = 12): string {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function statusLevel(percent: number): { icon: string; label: string } {
  if (percent >= 90) return { icon: "🔴", label: "KRITIS" };
  if (percent >= 80) return { icon: "🟡", label: "Warning" };
  return { icon: "🟢", label: "Normal" };
}

// ─── Disk Usage (Linux only, hardcoded command) ──────────────────────────────

/**
 * Reads disk usage via `df -B1 /`.
 *
 * Security: The command is fully hardcoded — no user input is interpolated.
 * `exec` is acceptable here because the string is a constant.
 */
function getDiskUsage(): Promise<{
  total: string;
  used: string;
  free: string;
  percent: number;
} | null> {
  return new Promise((resolve) => {
    exec("df -B1 / | tail -1", { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 5) {
        const total = parseInt(parts[1], 10);
        const used = parseInt(parts[2], 10);
        const free = parseInt(parts[3], 10);
        const percent = Math.round((used / total) * 100);
        resolve({
          total: formatBytes(total),
          used: formatBytes(used),
          free: formatBytes(free),
          percent,
        });
      } else {
        resolve(null);
      }
    });
  });
}

// ─── VPS Resource Report ─────────────────────────────────────────────────────

export async function getVpsResourceReport(): Promise<string> {
  try {
    // ── CPU ──
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg();
    const cpuPercent = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100));
    const cpuStatus = statusLevel(cpuPercent);
    const cpuModel = cpus[0]?.model?.replace(/\s+/g, " ").trim() ?? "Unknown";

    // ── RAM ──
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const memStatus = statusLevel(memPercent);

    // ── Disk ──
    const disk = await getDiskUsage();

    // ── Uptime ──
    const vpsUptime = os.uptime();
    const appUptime = process.uptime();

    // ── Node.js Process ──
    const memUsage = process.memoryUsage();

    // ── Build Report ──
    let text = `🖥️ <b>VPS Resource Monitor</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    // CPU
    text += `💻 <b>CPU</b> ${cpuStatus.icon}\n`;
    text += `   Load: <b>${loadAvg[0].toFixed(2)}</b> / ${loadAvg[1].toFixed(2)} / ${loadAvg[2].toFixed(2)} (1/5/15 min)\n`;
    text += `   Cores: <b>${cpuCount} vCPU</b>\n`;
    text += `   Usage: ${progressBar(cpuPercent)} <b>${cpuPercent}%</b>\n`;
    text += `   Model: ${cpuModel.substring(0, 40)}\n`;
    text += `   Status: ${cpuStatus.icon} ${cpuStatus.label}\n\n`;

    // RAM
    text += `🧠 <b>RAM</b> ${memStatus.icon}\n`;
    text += `   Terpakai: <b>${formatBytes(usedMem)}</b> / ${formatBytes(totalMem)}\n`;
    text += `   ${progressBar(memPercent)} <b>${memPercent}%</b>\n`;
    text += `   Free: ${formatBytes(freeMem)}\n`;
    text += `   Status: ${memStatus.icon} ${memStatus.label}\n\n`;

    // Disk
    if (disk) {
      const diskStatus = statusLevel(disk.percent);
      text += `💾 <b>Disk</b> ${diskStatus.icon}\n`;
      text += `   Terpakai: <b>${disk.used}</b> / ${disk.total}\n`;
      text += `   ${progressBar(disk.percent)} <b>${disk.percent}%</b>\n`;
      text += `   Free: ${disk.free}\n`;
      text += `   Status: ${diskStatus.icon} ${diskStatus.label}\n\n`;
    } else {
      text += `💾 <b>Disk</b>\n   ⚠️ Tidak dapat membaca info disk\n\n`;
    }

    // Uptime
    text += `⏱ <b>Uptime</b>\n`;
    text += `   VPS: <b>${formatUptime(vpsUptime)}</b>\n`;
    text += `   App: <b>${formatUptime(appUptime)}</b>\n\n`;

    // Node.js Process
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    text += `📊 <b>Node.js Process</b>\n`;
    text += `   Heap: <b>${formatBytes(memUsage.heapUsed)}</b> / ${formatBytes(memUsage.heapTotal)} (${heapPercent}%)\n`;
    text += `   RSS: <b>${formatBytes(memUsage.rss)}</b>\n`;
    text += `   External: ${formatBytes(memUsage.external)}\n\n`;

    // Overall status
    const allPercents = [cpuPercent, memPercent, ...(disk ? [disk.percent] : [])];
    const worstPercent = Math.max(...allPercents);
    const overall = statusLevel(worstPercent);

    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `${overall.icon} Overall: <b>${overall.label.toUpperCase()}</b>\n`;

    const now = new Date().toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    });
    text += `🕐 ${now} WIB`;

    return text;
  } catch (e: any) {
    return `🖥️ <b>VPS Resource Monitor</b>\n\n❌ Gagal membaca resource VPS.\nError: ${e.message?.substring(0, 100) ?? "Unknown error"}`;
  }
}

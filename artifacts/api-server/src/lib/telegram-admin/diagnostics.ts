import { db } from "@workspace/db";
import {
  settingsTable,
  ordersTable,
  topupsTable,
  ticketsTable,
  serversTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { getBotInfo } from "../telegram";
import { checkPanelHealth } from "../vpn-panel";
import { execFile } from "child_process";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiagnosticResult {
  name: string;
  status: "ok" | "warn" | "error";
  detail: string;
  latencyMs?: number;
}

// ─── Timeout for external API checks ─────────────────────────────────────────

const FONNTE_TIMEOUT_MS = 8_000;

// ─── Individual Test Functions ───────────────────────────────────────────────

async function testDatabase(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    await db.select({ val: sql<number>`1` }).from(settingsTable).limit(1);
    return {
      name: "Database (PostgreSQL)",
      status: "ok",
      detail: "Koneksi aktif",
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: "Database (PostgreSQL)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Tidak dapat terhubung",
      latencyMs: Date.now() - start,
    };
  }
}

async function testTelegramBot(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const info = await getBotInfo();
    if (info?.ok && info?.result?.username) {
      return {
        name: "Telegram Bot",
        status: "ok",
        detail: `@${info.result.username} aktif`,
        latencyMs: Date.now() - start,
      };
    }
    return {
      name: "Telegram Bot",
      status: "error",
      detail: info?.description ?? "Token tidak valid atau bot tidak responsif",
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: "Telegram Bot",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Gagal terhubung",
      latencyMs: Date.now() - start,
    };
  }
}

async function testWhatsappFonnte(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const [tokenRow] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "fonnteToken"))
      .limit(1);

    const token = tokenRow?.value;
    if (!token) {
      return {
        name: "WhatsApp (Fonnte)",
        status: "warn",
        detail: "Token Fonnte belum diatur",
        latencyMs: Date.now() - start,
      };
    }

    const resp = await fetch("https://api.fonnte.com/device", {
      method: "POST",
      headers: { Authorization: token },
      signal: AbortSignal.timeout(FONNTE_TIMEOUT_MS),
    });
    const data = (await resp.json()) as {
      status?: boolean;
      device_status?: string;
      reason?: string;
      detail?: string;
      quota?: number;
      expired?: string;
      device?: string;
    };

    const latency = Date.now() - start;

    if (data.status === true || data.device_status === "connect") {
      let detail = "Device terhubung";
      if (data.device) detail += ` (${data.device})`;
      if (data.quota !== undefined) detail += `\nSisa kuota: ${data.quota}`;
      if (data.expired) detail += `\nExpired: ${data.expired}`;
      return { name: "WhatsApp (Fonnte)", status: "ok", detail, latencyMs: latency };
    }

    if (data.device_status === "disconnect") {
      return {
        name: "WhatsApp (Fonnte)",
        status: "error",
        detail: `Device TERPUTUS${data.reason ? `\nAlasan: ${data.reason}` : ""}\n\nSegera login ulang di dashboard Fonnte!`,
        latencyMs: latency,
      };
    }

    return {
      name: "WhatsApp (Fonnte)",
      status: "warn",
      detail:
        data.reason ??
        data.detail ??
        `Status tidak diketahui (${JSON.stringify(data).substring(0, 60)})`,
      latencyMs: latency,
    };
  } catch (e: any) {
    return {
      name: "WhatsApp (Fonnte)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Gagal terhubung ke API Fonnte",
      latencyMs: Date.now() - start,
    };
  }
}

async function testPaymentGateway(): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));

    const enabled = map["autoGopayEnabled"] === "true";
    const apiUrl = map["autoGopayApiUrl"];
    const secretKey = map["autoGopaySecretKey"];

    if (!enabled) {
      return {
        name: "Payment Gateway (AutoGoPay)",
        status: "warn",
        detail: "AutoGoPay dinonaktifkan di pengaturan",
        latencyMs: Date.now() - start,
      };
    }

    if (!apiUrl) {
      return {
        name: "Payment Gateway (AutoGoPay)",
        status: "error",
        detail: "API URL belum diatur",
        latencyMs: Date.now() - start,
      };
    }

    if (!secretKey) {
      return {
        name: "Payment Gateway (AutoGoPay)",
        status: "warn",
        detail: `API URL: OK ${apiUrl}\nSecret Key: Belum diatur`,
        latencyMs: Date.now() - start,
      };
    }

    const baseUrl = apiUrl.replace(/\/+$/, "");
    const pingResp = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);

    const latency = Date.now() - start;

    if (pingResp) {
      return {
        name: "Payment Gateway (AutoGoPay)",
        status: "ok",
        detail: `API reachable (HTTP ${pingResp.status})\nAPI URL: OK\nSecret Key: OK`,
        latencyMs: latency,
      };
    }

    return {
      name: "Payment Gateway (AutoGoPay)",
      status: "error",
      detail: `Tidak dapat terhubung ke ${baseUrl}\nPastikan URL API benar di pengaturan.`,
      latencyMs: latency,
    };
  } catch (e: any) {
    return {
      name: "Payment Gateway (AutoGoPay)",
      status: "error",
      detail: e.message?.substring(0, 80) ?? "Error tidak diketahui",
      latencyMs: Date.now() - start,
    };
  }
}

async function testVpnPanels(): Promise<DiagnosticResult[]> {
  const servers = await db.select().from(serversTable);

  if (servers.length === 0) {
    return [
      {
        name: "VPN Panel",
        status: "warn",
        detail: "Belum ada server terdaftar",
      },
    ];
  }

  const results: DiagnosticResult[] = [];

  for (const server of servers) {
    if (!server.apiUrl || !server.apiToken) {
      results.push({
        name: server.name,
        status: "warn",
        detail: "API URL atau Token belum diatur",
      });
      continue;
    }

    try {
      const health = await checkPanelHealth({
        apiUrl: server.apiUrl,
        apiToken: server.apiToken,
      });

      results.push(
        health.online
          ? { name: server.name, status: "ok", detail: "Panel online", latencyMs: health.latencyMs }
          : { name: server.name, status: "error", detail: health.error ?? "Panel tidak merespons" },
      );
    } catch (e: any) {
      results.push({
        name: server.name,
        status: "error",
        detail: e.message?.substring(0, 80) ?? "Gagal terhubung ke panel",
      });
    }
  }

  return results;
}

// ─── Report Composers ────────────────────────────────────────────────────────

function statusIcon(s: DiagnosticResult["status"]): string {
  if (s === "ok") return "✅";
  if (s === "warn") return "⚠️";
  return "❌";
}

function formatTimestamp(): string {
  return new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

export async function runSystemDiagnostics(): Promise<string> {
  const startTime = Date.now();

  const [dbResult, tgResult, waResult, pgResult, panelResults] = await Promise.all([
    testDatabase(),
    testTelegramBot(),
    testWhatsappFonnte(),
    testPaymentGateway(),
    testVpnPanels(),
  ]);

  const allResults: DiagnosticResult[] = [dbResult, tgResult, waResult, pgResult, ...panelResults];

  const totalTime = Date.now() - startTime;
  const okCount = allResults.filter((r) => r.status === "ok").length;
  const warnCount = allResults.filter((r) => r.status === "warn").length;
  const errorCount = allResults.filter((r) => r.status === "error").length;

  let overallIcon = "✅";
  if (errorCount > 0) overallIcon = "🔴";
  else if (warnCount > 0) overallIcon = "🟡";

  let text = `🔧 <b>System Diagnostics Report</b>\n`;
  text += `${overallIcon} Status: <b>${errorCount > 0 ? "ADA MASALAH" : warnCount > 0 ? "PERLU PERHATIAN" : "SEMUA NORMAL"}</b>\n`;
  text += `⏱ Waktu tes: ${totalTime}ms\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;

  for (const result of allResults) {
    const icon = statusIcon(result.status);
    const latency = result.latencyMs ? ` (${result.latencyMs}ms)` : "";
    text += `${icon} <b>${result.name}</b>${latency}\n`;
    text += `${result.detail}\n\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━\n`;
  text += `📋 Summary: ✅ ${okCount} OK | ⚠️ ${warnCount} Warning | ❌ ${errorCount} Error\n`;
  text += `🕐 Dijalankan: ${formatTimestamp()} WIB`;

  return text;
}

export async function getStatusNowReport(): Promise<string> {
  const start = Date.now();

  const [dbResult, pgResult, panelResults, qrisPendingCount, topupPendingCount, ticketOpenCount] =
    await Promise.all([
      testDatabase(),
      testPaymentGateway(),
      testVpnPanels(),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(and(eq(ordersTable.status, "pending"), eq(ordersTable.paymentMethod, "qris"))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(topupsTable)
        .where(eq(topupsTable.status, "pending")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ticketsTable)
        .where(eq(ticketsTable.status, "open")),
    ]);

  const panelsDown = panelResults.filter((r) => r.status === "error").length;
  const warnCount = [dbResult, pgResult, ...panelResults].filter((r) => r.status === "warn").length;
  const errorCount = [dbResult, pgResult, ...panelResults].filter(
    (r) => r.status === "error",
  ).length;

  const overall =
    errorCount > 0 ? "🔴 ADA MASALAH" : warnCount > 0 ? "🟡 PERLU PERHATIAN" : "🟢 NORMAL";

  let text = `🚦 <b>Status Sekarang</b>\n`;
  text += `━━━━━━━━━━━━━━━━━━\n\n`;
  text += `Overall: <b>${overall}</b>\n`;
  text += `💾 Database: ${statusIcon(dbResult.status)} ${dbResult.detail}\n`;
  text += `💳 Payment: ${statusIcon(pgResult.status)} ${pgResult.detail}\n`;
  text += `🖥️ Panel VPN: ${panelsDown > 0 ? `❌ ${panelsDown} down` : "✅ semua online"}\n\n`;

  text += `📦 QRIS pending: <b>${qrisPendingCount[0]?.count ?? 0}</b>\n`;
  text += `💸 Topup pending: <b>${topupPendingCount[0]?.count ?? 0}</b>\n`;
  text += `🎫 Tiket terbuka: <b>${ticketOpenCount[0]?.count ?? 0}</b>\n\n`;

  text += `📋 Ringkas panel:\n`;
  for (const p of panelResults.slice(0, 6)) {
    const icon = statusIcon(p.status);
    text += `${icon} ${p.name} - ${p.detail}\n`;
  }

  text += `\n⏱ Disusun dalam ${Date.now() - start}ms`;
  return text;
}

/**
 * Reads recent PM2 logs and extracts error-like lines.
 *
 * Security: PM2_APP_NAME is validated against /^[\w-]+$/ before use
 * in execFile (no shell interpolation). Only `pm2 logs` with hardcoded
 * flags is executed — no user-controlled input reaches the command.
 */
export async function getRecentErrorDigest(): Promise<string> {
  try {
    const appName = process.env.PM2_APP_NAME || "ketantech-api";
    if (!/^[\w-]+$/.test(appName)) {
      return `🧯 <b>Error Terakhir</b>\n\n⚠️ PM2_APP_NAME tidak valid.`;
    }
    const raw = await new Promise<string>((resolve, reject) => {
      execFile(
        "pm2",
        ["logs", appName, "--lines", "250", "--nostream"],
        { timeout: 12000 },
        (err, stdout, stderr) => {
          if (err) {
            reject(err);
            return;
          }
          resolve((stdout || stderr || "").toString());
        },
      );
    });
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const interesting = lines.filter((l) =>
      /\berror\b|\bfailed\b|\bexception\b|\btimeout\b|\bdenied\b|\binvalid\b/i.test(l),
    );
    const latest = interesting.slice(-10);

    let text = `🧯 <b>Error Terakhir</b>\n`;
    text += `━━━━━━━━━━━━━━━━━━\n\n`;

    if (latest.length === 0) {
      text += `✅ Tidak ada baris error yang terdeteksi pada 250 log terakhir.\n`;
      text += `ℹ️ Sumber: PM2 app <b>${appName}</b>`;
      return text;
    }

    latest.forEach((line, idx) => {
      const clipped = line.length > 180 ? `${line.slice(0, 177)}...` : line;
      text += `${idx + 1}. ${clipped}\n\n`;
    });

    text += `ℹ️ Sumber: PM2 app <b>${appName}</b>`;
    return text;
  } catch (e: any) {
    return (
      `🧯 <b>Error Terakhir</b>\n\n⚠️ Gagal membaca log PM2.\nError: ${e?.message?.substring(0, 120) ?? "Unknown"}\n\n` +
      `Pastikan PM2 terpasang dan app name benar (env <code>PM2_APP_NAME</code>).`
    );
  }
}

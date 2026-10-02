import type { Server } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultAdmin, seedEasyInjectPresets, seedTutorials } from "./lib/seed";
import { startScheduler } from "./lib/scheduler";
import { sendMessage } from "./lib/telegram";
import { getAdminChatIdForAlert } from "./lib/scheduler/helpers";

// ─── Referensi server & state ─────────────────────────────────────────────────
let server: Server | null = null;
let isShuttingDown = false;

// ─── Validasi konfigurasi kritis saat startup ────────────────────────────────
function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL wajib diset.");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (isProduction) {
      errors.push("SESSION_SECRET wajib diset di production.");
    } else {
      warnings.push("SESSION_SECRET tidak diset — JWT akan menggunakan nilai default yang tidak aman (dev only).");
    }
  } else if (sessionSecret.length < 32) {
    warnings.push(`SESSION_SECRET terlalu pendek (${sessionSecret.length} karakter) — minimal 32 karakter untuk keamanan.`);
  }

  if (isProduction && !process.env.CORS_ORIGIN) {
    warnings.push("CORS_ORIGIN tidak diset di production — server akan menerima request dari semua domain. Set ke domain Anda (misal: https://ketantech.id).");
  }

  if (isProduction && !process.env.TRUSTED_PROXIES) {
    warnings.push("TRUSTED_PROXIES tidak diset di production. Disarankan set '127.0.0.1,::1' jika di belakang Nginx.");
  }

  if (isProduction && process.env.ALLOW_INSECURE_PANEL_TLS === "true") {
    warnings.push("ALLOW_INSECURE_PANEL_TLS=true di production — sangat tidak disarankan (risiko MITM ke VPN panel).");
  }

  if (errors.length > 0) {
    for (const e of errors) {
      logger.error(`[CONFIG] ${e}`);
    }
    throw new Error(`Konfigurasi kritis tidak valid:\n${errors.map(e => " - " + e).join("\n")}`);
  }

  if (warnings.length > 0) {
    for (const w of warnings) {
      logger.warn(`[CONFIG] ${w}`);
    }
  } else {
    logger.info("[CONFIG] Semua konfigurasi kritis tersedia.");
  }
}

// ─── Telegram crash alert (best-effort) ───────────────────────────────────────
async function alertCrash(label: string, error: unknown): Promise<void> {
  try {
    const adminChatId = await getAdminChatIdForAlert();
    if (!adminChatId) return;

    const errMsg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.slice(0, 300) ?? "" : "";

    await sendMessage(
      adminChatId,
      `🚨 <b>SERVER CRASH — ${label}</b>\n\n` +
      `<b>Error:</b> <code>${errMsg.slice(0, 200)}</code>\n` +
      (stack ? `<b>Stack:</b>\n<code>${stack}</code>\n\n` : "\n") +
      `Server akan restart via PM2. Jika error terus berulang, cek log segera.`,
      { parse_mode: "HTML" },
    );
  } catch {
    // Best-effort: jika Telegram gagal, jangan tambah masalah
    logger.error("[crash-alert] Gagal mengirim alert ke Telegram");
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const SHUTDOWN_TIMEOUT_MS = 15_000; // 15 detik max drain time

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Menerima signal shutdown — mulai graceful shutdown...");

  // 1. Stop accepting new connections
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed — semua koneksi aktif selesai");
    });
  }

  // 2. Force exit jika drain terlalu lama
  const forceTimer = setTimeout(() => {
    logger.error("Graceful shutdown timeout — force exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Jangan biarkan timer mencegah exit
  forceTimer.unref();

  // 3. Flush logger dan exit clean
  try {
    // Beri waktu koneksi selesai (server.close callback di atas)
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.on("close", resolve);
      // Fallback jika close event sudah terjadi
      setTimeout(resolve, 5000);
    });
  } finally {
    logger.info("Shutdown selesai — bye!");
    // pino final flush
    logger.flush?.();
    process.exit(0);
  }
}

// ─── Process-level crash handlers ─────────────────────────────────────────────
// HARUS didaftarkan SEBELUM server start agar tangkap semua error dari awal.

process.on("uncaughtException", async (err: Error) => {
  logger.fatal({ err }, "UNCAUGHT EXCEPTION — server akan crash");

  await alertCrash("Uncaught Exception", err);

  // uncaughtException: state tidak bisa dipercaya, harus exit
  logger.flush?.();
  process.exit(1);
});

process.on("unhandledRejection", async (reason: unknown) => {
  logger.fatal({ reason }, "UNHANDLED PROMISE REJECTION — server akan crash");

  await alertCrash("Unhandled Rejection", reason);

  // unhandledRejection: bisa jadi state korup, exit untuk safety
  logger.flush?.();
  process.exit(1);
});

// ─── Graceful shutdown signals ────────────────────────────────────────────────
// PM2 kirim SIGINT, lalu SIGTERM jika tidak mati dalam timeout
process.on("SIGTERM", () => { gracefulShutdown("SIGTERM"); });
process.on("SIGINT", () => { gracefulShutdown("SIGINT"); });

// ─── Port validation ─────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

validateEnv();

// ─── Server startup ──────────────────────────────────────────────────────────
async function startServer() {
  await seedDefaultAdmin();
  await seedEasyInjectPresets();
  await seedTutorials();

  server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    startScheduler();
  });

  // Express: error saat listen (port in use, permission denied, dll)
  // HARUS listen via event, bukan callback param (Express !== Fastify)
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      logger.fatal({ port }, `Port ${port} sudah digunakan oleh proses lain`);
    } else if (err.code === "EACCES") {
      logger.fatal({ port }, `Tidak punya izin untuk listen di port ${port}`);
    } else {
      logger.fatal({ err, port }, "Gagal start HTTP server");
    }
    process.exit(1);
  });
}

startServer().catch(async (err) => {
  logger.fatal({ err }, "Failed to initialize server");
  await alertCrash("Startup Failure", err);
  process.exit(1);
});

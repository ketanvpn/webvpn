import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultAdmin, seedEasyInjectPresets } from "./lib/seed";
import { startScheduler } from "./lib/scheduler";

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

  // Security-sensitive: warn if using insecure panel TLS in prod
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

async function startServer() {
  await seedDefaultAdmin();
  await seedEasyInjectPresets();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startScheduler();
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to initialize server");
  process.exit(1);
});

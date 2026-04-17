import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultAdmin } from "./lib/seed";
import { startScheduler } from "./lib/scheduler";

// ─── Validasi konfigurasi kritis saat startup ────────────────────────────────
function validateEnv() {
  const isProduction = process.env.NODE_ENV === "production";
  const warnings: string[] = [];

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    warnings.push("SESSION_SECRET tidak diset — JWT akan menggunakan nilai default yang tidak aman.");
  } else if (sessionSecret.length < 32) {
    warnings.push(`SESSION_SECRET terlalu pendek (${sessionSecret.length} karakter) — minimal 32 karakter untuk keamanan.`);
  }

  if (isProduction && !process.env.CORS_ORIGIN) {
    warnings.push("CORS_ORIGIN tidak diset di production — server akan menerima request dari semua domain. Set ke domain Anda (misal: https://ketantech.id).");
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

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await seedDefaultAdmin();
  startScheduler();
});

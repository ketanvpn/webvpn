/**
 * Database Backup & Restore
 * - pg_dump → gzip → Telegram Bot sendDocument
 * - Restore: gunzip → psql via stdin
 */

import { spawn } from "child_process";
import { gzipSync, gunzipSync } from "zlib";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

const TEMP_BACKUP_DIR = "/tmp";
let lastBackupFilePath: string | null = null;

export interface BackupSettings {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupLastAt: string | null;
  backupLastStatus: "success" | "failed" | null;
  backupLastError: string | null;
  backupLastFilename: string | null;
  backupLastSizeBytes: number | null;
}

export async function getBackupSettings(): Promise<BackupSettings> {
  const rows = await db.select().from(settingsTable);
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  return {
    backupEnabled: map["backupEnabled"] === "true",
    backupIntervalHours: parseInt(map["backupIntervalHours"] ?? "24", 10) || 24,
    backupLastAt: map["backupLastAt"] ?? null,
    backupLastStatus: (map["backupLastStatus"] as "success" | "failed") ?? null,
    backupLastError: map["backupLastError"] ?? null,
    backupLastFilename: map["backupLastFilename"] ?? null,
    backupLastSizeBytes: map["backupLastSizeBytes"] ? parseInt(map["backupLastSizeBytes"], 10) : null,
  };
}

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export async function saveBackupSettings(enabled: boolean, intervalHours: number) {
  await upsertSetting("backupEnabled", String(enabled));
  await upsertSetting("backupIntervalHours", String(intervalHours));
}

async function updateBackupStatus(
  status: "success" | "failed",
  filename: string | null,
  sizeBytes: number | null,
  error: string | null
) {
  await upsertSetting("backupLastAt", new Date().toISOString());
  await upsertSetting("backupLastStatus", status);
  await upsertSetting("backupLastFilename", filename ?? "");
  await upsertSetting("backupLastSizeBytes", String(sizeBytes ?? 0));
  await upsertSetting("backupLastError", error ?? "");
}

/**
 * Run pg_dump and return gzipped buffer + filename.
 * Requires pg_dump to be installed on the server.
 */
export async function runPgDump(): Promise<{ buffer: Buffer; filename: string }> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tidak dikonfigurasi");

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];

    const proc = spawn("pg_dump", ["--clean", "--if-exists", databaseUrl], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errors.push(chunk));

    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("pg_dump tidak ditemukan. Pastikan PostgreSQL client tools terinstall di server."));
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errors).toString("utf8").slice(0, 500);
        reject(new Error(`pg_dump gagal (exit ${code}): ${errMsg}`));
        return;
      }

      const raw = Buffer.concat(chunks);
      const compressed = gzipSync(raw);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const filename = `ketantech-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.sql.gz`;

      resolve({ buffer: compressed, filename });
    });
  });
}

/**
 * Save backup buffer to /tmp and update lastBackupFilePath.
 */
export function saveBackupToTemp(buffer: Buffer, filename: string): string {
  const filePath = path.join(TEMP_BACKUP_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  lastBackupFilePath = filePath;
  return filePath;
}

export function getLastBackupFilePath(): string | null {
  return lastBackupFilePath;
}

/**
 * Send backup file to Telegram via sendDocument.
 */
export async function sendBackupToTelegram(
  buffer: Buffer,
  filename: string,
  token: string,
  chatId: string
): Promise<boolean> {
  try {
    const sizeKb = (buffer.length / 1024).toFixed(1);
    const caption =
      `🗄️ <b>Database Backup KETANTECH VPN</b>\n` +
      `📅 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB\n` +
      `📦 Ukuran: ${sizeKb} KB\n` +
      `📂 Format: .sql.gz (dikompresi dengan gzip, BUKAN dienkripsi — simpan di tempat aman)\n\n` +
      `Untuk restore:\n` +
      `<code>gunzip -c backup.sql.gz | psql "$DATABASE_URL"</code>`;

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([new Uint8Array(buffer)]), filename);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: form,
    });

    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) {
      logger.warn({ description: data.description }, "Telegram sendDocument failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send backup to Telegram");
    return false;
  }
}

/**
 * Full backup flow: pg_dump → gzip → save temp → send Telegram → update DB status.
 */
export async function performBackup(): Promise<{
  success: boolean;
  filename: string | null;
  sizeBytes: number | null;
  sentToTelegram: boolean;
  error: string | null;
}> {
  let filename: string | null = null;
  let sizeBytes: number | null = null;
  let sentToTelegram = false;

  try {
    const { buffer, filename: fn } = await runPgDump();
    filename = fn;
    sizeBytes = buffer.length;

    saveBackupToTemp(buffer, filename);

    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    const token = map["telegramBotToken"] ?? null;
    const chatId = map["telegramAdminChatId"] ?? null;

    if (token && chatId) {
      sentToTelegram = await sendBackupToTelegram(buffer, filename, token, chatId);
    }

    await updateBackupStatus("success", filename, sizeBytes, null);
    logger.info({ filename, sizeBytes, sentToTelegram }, "Database backup berhasil");

    return { success: true, filename, sizeBytes, sentToTelegram, error: null };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Database backup gagal");
    await updateBackupStatus("failed", filename, sizeBytes, errMsg).catch(() => {});
    return { success: false, filename, sizeBytes, sentToTelegram, error: errMsg };
  }
}

/**
 * Restore database from gzipped SQL buffer via psql.
 * Automatically creates a safety backup of the current database before restoring.
 */
export async function performRestore(gzippedBuffer: Buffer): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tidak dikonfigurasi");

  let sqlBuffer: Buffer;
  try {
    sqlBuffer = gunzipSync(gzippedBuffer);
  } catch {
    throw new Error("File bukan format .sql.gz yang valid atau rusak");
  }

  // Safety backup: simpan kondisi database saat ini sebelum restore
  logger.info("Membuat safety backup sebelum restore...");
  try {
    const { buffer: safetyBuffer, filename: safetyFilename } = await runPgDump();
    const safetyName = safetyFilename.replace("ketantech-backup-", "pre-restore-");
    const safetyPath = saveBackupToTemp(safetyBuffer, safetyName);
    logger.info({ safetyPath }, "Safety backup sebelum restore berhasil dibuat");

    // Kirim safety backup ke Telegram jika dikonfigurasi
    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    const token = map["telegramBotToken"] ?? null;
    const chatId = map["telegramAdminChatId"] ?? null;
    if (token && chatId) {
      await sendBackupToTelegram(safetyBuffer, safetyName, token, chatId);
    }
  } catch (err) {
    logger.error({ err }, "Safety backup gagal — restore dibatalkan untuk keamanan data");
    throw new Error(
      `Restore dibatalkan: gagal membuat safety backup terlebih dahulu. ` +
      `Detail: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return new Promise((resolve, reject) => {
    const errors: Buffer[] = [];

    const proc = spawn("psql", [databaseUrl], {
      stdio: ["pipe", "ignore", "pipe"],
    });

    proc.stderr.on("data", (chunk: Buffer) => errors.push(chunk));

    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error("psql tidak ditemukan. Pastikan PostgreSQL client tools terinstall di server."));
      } else {
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        const errMsg = Buffer.concat(errors).toString("utf8").slice(0, 500);
        reject(new Error(`psql restore gagal (exit ${code}): ${errMsg}`));
        return;
      }
      logger.info("Restore database berhasil");
      resolve();
    });

    proc.stdin.write(sqlBuffer);
    proc.stdin.end();
  });
}

/**
 * Check if auto-backup is due based on lastBackupAt + intervalHours.
 */
export async function isBackupDue(): Promise<boolean> {
  const cfg = await getBackupSettings();
  if (!cfg.backupEnabled) return false;

  if (!cfg.backupLastAt) return true;

  const lastAt = new Date(cfg.backupLastAt).getTime();
  const intervalMs = cfg.backupIntervalHours * 60 * 60 * 1000;
  return Date.now() - lastAt >= intervalMs;
}

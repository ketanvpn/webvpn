/**
 * Database Backup & Restore
 * - pg_dump → gzip → Telegram Bot sendDocument
 * - Restore: gunzip → psql via stdin
 */

import { spawn } from "child_process";
import { gzipSync, gunzipSync } from "zlib";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import fs from "fs";
import path from "path";

const BACKUP_RETENTION = 10;
let lastBackupFilePath: string | null = null;
let operationInProgress: "backup" | "restore" | null = null;

function getProjectRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, ".env")) || fs.existsSync(path.join(cwd, "package.json"))) {
    return cwd;
  }
  const fromDist = path.resolve(__dirname, "..", "..", "..", "..");
  if (fs.existsSync(path.join(fromDist, ".env")) || fs.existsSync(path.join(fromDist, "package.json"))) {
    return fromDist;
  }
  return cwd;
}

// ─── Checksum ────────────────────────────────────────────────────────────────

/** Compute SHA-256 hex digest of a buffer. */
export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

// ─── AES-256-GCM Encryption ─────────────────────────────────────────────────

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_MAGIC = Buffer.from("KTENC1"); // Magic header to identify encrypted backups

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!keyHex) return null;
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    logger.warn("BACKUP_ENCRYPTION_KEY harus 64 karakter hex (32 bytes). Enkripsi dinonaktifkan.");
    return null;
  }
  return key;
}

/**
 * Encrypt buffer with AES-256-GCM.
 * Output format: KTENC1 (6B) | IV (12B) | authTag (16B) | ciphertext
 * Returns original buffer if no encryption key is configured.
 */
export function encryptBackup(buffer: Buffer): { encrypted: Buffer; isEncrypted: boolean } {
  const key = getEncryptionKey();
  if (!key) return { encrypted: buffer, isEncrypted: false };

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const encrypted = Buffer.concat([ENCRYPTED_MAGIC, iv, authTag, ciphertext]);
  return { encrypted, isEncrypted: true };
}

/**
 * Decrypt AES-256-GCM encrypted buffer.
 * Auto-detects: if buffer doesn't start with KTENC1 magic, returns as-is (plaintext backup).
 */
export function decryptBackup(buffer: Buffer): Buffer {
  // Check magic header — if absent, assume plaintext (backward compatible)
  if (!buffer.subarray(0, ENCRYPTED_MAGIC.length).equals(ENCRYPTED_MAGIC)) {
    return buffer;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "File backup terenkripsi tetapi BACKUP_ENCRYPTION_KEY tidak dikonfigurasi. " +
      "Set env var BACKUP_ENCRYPTION_KEY untuk mendekripsi."
    );
  }

  let offset = ENCRYPTED_MAGIC.length;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const authTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
  offset += AUTH_TAG_LENGTH;
  const ciphertext = buffer.subarray(offset);

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Dekripsi gagal — kemungkinan BACKUP_ENCRYPTION_KEY salah atau file rusak.");
  }
}

// ─── Operation Lock ──────────────────────────────────────────────────────────

export function isOperationLocked(): string | null {
  return operationInProgress;
}

function acquireLock(op: "backup" | "restore"): void {
  if (operationInProgress) {
    throw new Error(`Operasi ${operationInProgress} sedang berjalan. Tunggu hingga selesai.`);
  }
  operationInProgress = op;
}

function releaseLock(): void {
  operationInProgress = null;
}

/**
 * Direktori simpan backup. Default ./backups (persisten, tetap setelah restart).
 * Override via env BACKUP_DIR. Future: opsi bundle env ter-encrypt.
 */
export function getBackupDir(): string {
  const dir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Hapus backup lama, simpan hanya N terbaru (prevents unbounded growth). */
function pruneOldBackups(dir: string): void {
  try {
    const entries = fs.readdirSync(dir)
      .filter((f) => f.endsWith(".sql.gz"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const item of entries.slice(BACKUP_RETENTION)) {
      fs.unlinkSync(path.join(dir, item.f));
    }
  } catch {
    // non-fatal
  }
}

export interface BackupSettings {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupLastAt: string | null;
  backupLastStatus: "success" | "failed" | null;
  backupLastError: string | null;
  backupLastFilename: string | null;
  backupLastSizeBytes: number | null;
  backupLastChecksum: string | null;
  backupLastEncrypted: boolean;
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
    backupLastChecksum: map["backupLastChecksum"] ?? null,
    backupLastEncrypted: map["backupLastEncrypted"] === "true",
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
  error: string | null,
  checksum: string | null,
  encrypted: boolean
) {
  await upsertSetting("backupLastAt", new Date().toISOString());
  await upsertSetting("backupLastStatus", status);
  await upsertSetting("backupLastFilename", filename ?? "");
  await upsertSetting("backupLastSizeBytes", String(sizeBytes ?? 0));
  await upsertSetting("backupLastError", error ?? "");
  await upsertSetting("backupLastChecksum", checksum ?? "");
  await upsertSetting("backupLastEncrypted", String(encrypted));
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
 * Save backup buffer to persistent dir (getBackupDir) and update lastBackupFilePath.
 */
export function saveBackupFile(buffer: Buffer, filename: string): string {
  const filePath = path.join(getBackupDir(), filename);
  fs.writeFileSync(filePath, buffer);
  lastBackupFilePath = filePath;
  // Persist to DB so download survives server restart
  upsertSetting("backupLastFilePath", filePath).catch(() => {});
  pruneOldBackups(getBackupDir());
  return filePath;
}

/**
 * Get last backup file path. Tries in-memory first (fast path),
 * falls back to DB-persisted value (survives restart).
 */
export async function getLastBackupFilePath(): Promise<string | null> {
  if (lastBackupFilePath && fs.existsSync(lastBackupFilePath)) {
    return lastBackupFilePath;
  }
  const rows = await db.select().from(settingsTable).where(eq(settingsTable.key, "backupLastFilePath"));
  const dbPath = rows[0]?.value ?? null;
  if (dbPath && fs.existsSync(dbPath)) {
    lastBackupFilePath = dbPath;
    return dbPath;
  }
  return null;
}

/**
 * Send backup file to Telegram via sendDocument.
 */
export async function sendBackupToTelegram(
  buffer: Buffer,
  filename: string,
  token: string,
  chatId: string,
  isEncrypted: boolean = false,
  checksum: string | null = null
): Promise<boolean> {
  try {
    const sizeKb = (buffer.length / 1024).toFixed(1);
    const encStatus = isEncrypted
      ? "🔒 Terenkripsi AES-256-GCM"
      : "⚠️ TIDAK dienkripsi — simpan di tempat aman";
    const checksumLine = checksum ? `🔑 SHA-256: <code>${checksum.slice(0, 16)}...</code>\n` : "";
    const caption =
      `🗄️ <b>Database Backup KETANTECH VPN</b>\n` +
      `📅 ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB\n` +
      `📦 Ukuran: ${sizeKb} KB\n` +
      `📂 Format: ${isEncrypted ? ".sql.gz.enc (AES-256-GCM)" : ".sql.gz (gzip)"}\n` +
      `${checksumLine}` +
      `${encStatus}\n\n` +
      (isEncrypted
        ? `Untuk restore: upload via panel admin (dekripsi otomatis)`
        : `Untuk restore:\n<code>gunzip -c backup.sql.gz | psql "$DATABASE_URL"</code>`);

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
 * Full backup flow: pg_dump → gzip → save file → send Telegram → update DB status.
 */
export async function performBackup(): Promise<{
  success: boolean;
  filename: string | null;
  sizeBytes: number | null;
  sentToTelegram: boolean;
  error: string | null;
  checksum: string | null;
  encrypted: boolean;
}> {
  acquireLock("backup");
  let filename: string | null = null;
  let sizeBytes: number | null = null;
  let sentToTelegram = false;
  let checksum: string | null = null;
  let isEncrypted = false;

  try {
    const { buffer: gzippedBuffer, filename: fn } = await runPgDump();
    filename = fn;
    checksum = computeChecksum(gzippedBuffer);

    const { encrypted: finalBuffer, isEncrypted: enc } = encryptBackup(gzippedBuffer);
    isEncrypted = enc;
    sizeBytes = finalBuffer.length;

    if (isEncrypted) {
      filename = filename.replace(".sql.gz", ".sql.gz.enc");
    }

    saveBackupFile(finalBuffer, filename);

    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    const token = map["telegramBotToken"] ?? null;
    const chatId = map["telegramAdminChatId"] ?? null;

    if (token && chatId) {
      sentToTelegram = await sendBackupToTelegram(finalBuffer, filename, token, chatId, isEncrypted, checksum);
    }

    await updateBackupStatus("success", filename, sizeBytes, null, checksum, isEncrypted);
    logger.info({ filename, sizeBytes, sentToTelegram, checksum, encrypted: isEncrypted }, "Database backup berhasil");

    return { success: true, filename, sizeBytes, sentToTelegram, error: null, checksum, encrypted: isEncrypted };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Database backup gagal");
    await updateBackupStatus("failed", filename, sizeBytes, errMsg, null, false).catch(() => {});
    return { success: false, filename, sizeBytes, sentToTelegram, error: errMsg, checksum: null, encrypted: false };
  } finally {
    releaseLock();
  }
}

/**
 * Restore database from gzipped SQL buffer via psql.
 * Automatically creates a safety backup of the current database before restoring.
 */
export async function performRestore(rawBuffer: Buffer): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL tidak dikonfigurasi");

  acquireLock("restore");

  try {
    const gzippedBuffer = decryptBackup(rawBuffer);

    let sqlBuffer: Buffer;
    try {
      sqlBuffer = gunzipSync(gzippedBuffer);
    } catch {
      throw new Error("File bukan format .sql.gz yang valid atau rusak");
    }

    const header = sqlBuffer.subarray(0, 512).toString("utf8");
    if (!header.includes("PostgreSQL database dump") && !header.includes("pg_dump") && !header.includes("SET ")) {
      throw new Error(
        "File tidak terdeteksi sebagai dump PostgreSQL yang valid. " +
        "Pastikan file berasal dari pg_dump."
      );
    }

    logger.info("Membuat safety backup sebelum restore...");
    try {
      const { buffer: safetyBuffer, filename: safetyFilename } = await runPgDump();
      const safetyName = safetyFilename.replace("ketantech-backup-", "pre-restore-");
      const safetyPath = saveBackupFile(safetyBuffer, safetyName);
      logger.info({ safetyPath }, "Safety backup sebelum restore berhasil dibuat");

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

    await new Promise<void>((resolve, reject) => {
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
  } finally {
    releaseLock();
  }
}

// ─── Full Backup Bundle ──────────────────────────────────────────────────────

interface BundleFile {
  name: string;
  sourcePath: string;
}

const BUNDLE_FILES: BundleFile[] = [
  { name: ".env", sourcePath: ".env" },
  { name: "ecosystem.config.cjs", sourcePath: "ecosystem.config.cjs" },
  { name: "botvpn-fixed/sellvpn.db", sourcePath: "botvpn-fixed/sellvpn.db" },
  { name: "botvpn-fixed/.vars.json", sourcePath: "botvpn-fixed/.vars.json" },
  { name: "artifacts/vpn-web/.env.production", sourcePath: "artifacts/vpn-web/.env.production" },
];

/**
 * Full backup bundle: SQL dump + config files.
 * Bundle format: KTBUNDLE1 (9B) | manifest length (4B LE) | JSON manifest | [file data...]
 * The entire bundle is gzipped and optionally encrypted.
 */
export async function performFullBackup(): Promise<{
  success: boolean;
  filename: string | null;
  sizeBytes: number | null;
  sentToTelegram: boolean;
  error: string | null;
  checksum: string | null;
  encrypted: boolean;
  includedFiles: string[];
}> {
  acquireLock("backup");

  const includedFiles: string[] = [];
  let filename: string | null = null;
  let sizeBytes: number | null = null;
  let sentToTelegram = false;
  let checksum: string | null = null;
  let isEncrypted = false;

  try {
    const { buffer: sqlGz, filename: sqlFilename } = await runPgDump();
    includedFiles.push(sqlFilename);

    const projectRoot = getProjectRoot();
    const fileParts: { name: string; data: Buffer }[] = [
      { name: sqlFilename, data: sqlGz },
    ];

    for (const bf of BUNDLE_FILES) {
      const fullPath = path.resolve(projectRoot, bf.sourcePath);
      if (fs.existsSync(fullPath)) {
        fileParts.push({ name: bf.name, data: fs.readFileSync(fullPath) });
        includedFiles.push(bf.name);
      } else {
        logger.warn({ path: bf.sourcePath }, "Bundle file not found, skipping");
      }
    }

    const MAGIC = Buffer.from("KTBUNDLE1");
    let dataOffset = 0;
    const manifest = fileParts.map((fp) => {
      const entry = { name: fp.name, offset: dataOffset, length: fp.data.length };
      dataOffset += fp.data.length;
      return entry;
    });
    const manifestJson = Buffer.from(JSON.stringify(manifest), "utf8");
    const manifestLenBuf = Buffer.alloc(4);
    manifestLenBuf.writeUInt32LE(manifestJson.length, 0);

    const rawBundle = Buffer.concat([MAGIC, manifestLenBuf, manifestJson, ...fileParts.map((fp) => fp.data)]);
    const gzipped = gzipSync(rawBundle);
    checksum = computeChecksum(gzipped);

    const { encrypted: finalBuffer, isEncrypted: enc } = encryptBackup(gzipped);
    isEncrypted = enc;
    sizeBytes = finalBuffer.length;

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const ext = isEncrypted ? ".bundle.gz.enc" : ".bundle.gz";
    filename = `ketantech-fullbackup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${ext}`;

    saveBackupFile(finalBuffer, filename);

    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
    const token = map["telegramBotToken"] ?? null;
    const chatId = map["telegramAdminChatId"] ?? null;

    if (token && chatId) {
      sentToTelegram = await sendBackupToTelegram(finalBuffer, filename, token, chatId, isEncrypted, checksum);
    }

    await updateBackupStatus("success", filename, sizeBytes, null, checksum, isEncrypted);
    logger.info({ filename, sizeBytes, includedFiles, encrypted: isEncrypted }, "Full backup bundle berhasil");

    return { success: true, filename, sizeBytes, sentToTelegram, error: null, checksum, encrypted: isEncrypted, includedFiles };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error({ err }, "Full backup bundle gagal");
    await updateBackupStatus("failed", filename, sizeBytes, errMsg, null, false).catch(() => {});
    return { success: false, filename, sizeBytes, sentToTelegram, error: errMsg, checksum: null, encrypted: false, includedFiles };
  } finally {
    releaseLock();
  }
}
export async function isBackupDue(): Promise<boolean> {
  const cfg = await getBackupSettings();
  if (!cfg.backupEnabled) return false;

  if (!cfg.backupLastAt) return true;

  const lastAt = new Date(cfg.backupLastAt).getTime();
  const intervalMs = cfg.backupIntervalHours * 60 * 60 * 1000;
  return Date.now() - lastAt >= intervalMs;
}

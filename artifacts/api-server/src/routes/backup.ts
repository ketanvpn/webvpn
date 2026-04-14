import { Router } from "express";
import express from "express";
import { requireAdmin } from "../lib/auth";
import {
  getBackupSettings,
  saveBackupSettings,
  performBackup,
  performRestore,
  getLastBackupFilePath,
} from "../lib/backup";
import fs from "fs";

const router = Router();

// GET /api/admin/backup/settings
router.get("/admin/backup/settings", requireAdmin, async (_req, res) => {
  const settings = await getBackupSettings();
  res.json(settings);
});

// PUT /api/admin/backup/settings
router.put("/admin/backup/settings", requireAdmin, async (req, res) => {
  const { backupEnabled, backupIntervalHours } = req.body as {
    backupEnabled?: unknown;
    backupIntervalHours?: unknown;
  };
  if (typeof backupEnabled !== "boolean") {
    res.status(400).json({ error: "backupEnabled harus boolean" });
    return;
  }
  const interval = Number(backupIntervalHours);
  if (!Number.isInteger(interval) || interval < 1 || interval > 168) {
    res.status(400).json({ error: "backupIntervalHours harus angka antara 1-168" });
    return;
  }
  await saveBackupSettings(backupEnabled, interval);
  res.json({ success: true });
});

// POST /api/admin/backup/now — trigger manual backup
router.post("/admin/backup/now", requireAdmin, async (_req, res) => {
  const result = await performBackup();
  if (!result.success) {
    res.status(500).json({ error: result.error ?? "Backup gagal" });
    return;
  }
  res.json({
    success: true,
    filename: result.filename,
    sizeBytes: result.sizeBytes,
    sentToTelegram: result.sentToTelegram,
  });
});

// GET /api/admin/backup/download — download last backup file
router.get("/admin/backup/download", requireAdmin, (_req, res) => {
  const filePath = getLastBackupFilePath();
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: "Tidak ada backup yang tersedia. Lakukan backup terlebih dahulu." });
    return;
  }
  const filename = filePath.split("/").pop() ?? "backup.sql.gz";
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// POST /api/admin/backup/restore — restore from uploaded .sql.gz file
router.post(
  "/admin/backup/restore",
  requireAdmin,
  express.raw({ type: ["application/gzip", "application/octet-stream", "application/x-gzip"], limit: "100mb" }),
  async (req, res) => {
    const body = req.body as Buffer;
    if (!body || body.length === 0) {
      res.status(400).json({ error: "File backup tidak ditemukan dalam request" });
      return;
    }
    try {
      await performRestore(body);
      res.json({ success: true, message: "Database berhasil di-restore" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore gagal";
      res.status(500).json({ error: msg });
    }
  }
);

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import {
  appTutorialsTable,
  createTutorialSchema,
  updateTutorialSchema,
  type TutorialStep,
} from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/auth";
import { logAdminAction } from "./admin-audit";
import { getClientIp } from "../lib/request-ip";
import { uploadTutorialImage, TUTORIAL_UPLOAD_DIR } from "../lib/upload";
import fs from "fs/promises";
import path from "path";
import type { Request, Response, NextFunction } from "express";

const router = Router();

function handleMulterUpload(req: Request, res: Response, next: NextFunction) {
  uploadTutorialImage(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof Error && "code" in err) {
        const multerErr = err as { code: string; message: string };
        if (multerErr.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "Ukuran file maksimal 2MB" });
          return;
        }
        if (multerErr.code === "LIMIT_UNEXPECTED_FILE") {
          res.status(400).json({ error: multerErr.message });
          return;
        }
      }
      next(err);
      return;
    }
    next();
  });
}

async function safeUnlinkImage(imageUrl: string): Promise<void> {
  if (!imageUrl.startsWith("/api/uploads/tutorials/")) return;

  const filename = path.basename(imageUrl);
  const filePath = path.join(TUTORIAL_UPLOAD_DIR, filename);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(TUTORIAL_UPLOAD_DIR))) return;

  try {
    await fs.unlink(resolved);
  } catch {
    // Ignore ENOENT — file may already be deleted
  }
}

async function cleanupTutorialImages(steps: TutorialStep[]): Promise<void> {
  for (const step of steps) {
    if (step.imageUrl) {
      await safeUnlinkImage(step.imageUrl);
    }
  }
}

// ─── Admin: CRUD ──────────────────────────────────────────────────────────────

router.get("/admin/tutorials", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(appTutorialsTable)
    .orderBy(asc(appTutorialsTable.sortOrder), asc(appTutorialsTable.id));
  res.json(rows);
});

router.get("/admin/tutorials/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const [row] = await db
    .select()
    .from(appTutorialsTable)
    .where(eq(appTutorialsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Tutorial tidak ditemukan" });
    return;
  }
  res.json(row);
});

router.post("/admin/tutorials", requireAdmin, async (req, res) => {
  const parsed = createTutorialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.issues });
    return;
  }

  const [row] = await db
    .insert(appTutorialsTable)
    .values(parsed.data)
    .returning();

  logAdminAction({
    adminUserId: req.user!.userId,
    action: "create_tutorial",
    targetType: "tutorial",
    targetId: row.id,
    details: { appSlug: row.appSlug, appName: row.appName },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.status(201).json(row);
});

router.put("/admin/tutorials/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const parsed = updateTutorialSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Data tidak valid", details: parsed.error.issues });
    return;
  }

  const [existing] = await db
    .select()
    .from(appTutorialsTable)
    .where(eq(appTutorialsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Tutorial tidak ditemukan" });
    return;
  }

  if (parsed.data.steps && existing.steps) {
    const oldUrls = new Set(
      existing.steps
        .map((s) => s.imageUrl)
        .filter((url): url is string => url !== null),
    );
    const newUrls = new Set(
      parsed.data.steps
        .map((s) => s.imageUrl)
        .filter((url): url is string => url !== null),
    );
    for (const url of oldUrls) {
      if (!newUrls.has(url)) {
        await safeUnlinkImage(url);
      }
    }
  }

  const [row] = await db
    .update(appTutorialsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(appTutorialsTable.id, id))
    .returning();

  logAdminAction({
    adminUserId: req.user!.userId,
    action: "update_tutorial",
    targetType: "tutorial",
    targetId: id,
    details: { changes: Object.keys(parsed.data) },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.json(row);
});

router.delete("/admin/tutorials/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const [deleted] = await db
    .delete(appTutorialsTable)
    .where(eq(appTutorialsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Tutorial tidak ditemukan" });
    return;
  }

  await cleanupTutorialImages(deleted.steps);

  logAdminAction({
    adminUserId: req.user!.userId,
    action: "delete_tutorial",
    targetType: "tutorial",
    targetId: id,
    details: { appSlug: deleted.appSlug, appName: deleted.appName },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.json({ message: "Tutorial berhasil dihapus" });
});

// ─── Admin: Image Upload ──────────────────────────────────────────────────────

router.post(
  "/admin/tutorials/upload-image",
  requireAdmin,
  handleMulterUpload,
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Tidak ada file yang diupload" });
      return;
    }

    const url = `/api/uploads/tutorials/${req.file.filename}`;

    logAdminAction({
      adminUserId: req.user!.userId,
      action: "upload_tutorial_image",
      targetType: "tutorial",
      details: { filename: req.file.filename, size: req.file.size },
      ipAddress: getClientIp(req as any),
    }).catch(() => {});

    res.json({ url });
  },
);

router.delete("/admin/tutorials/delete-image", requireAdmin, async (req, res) => {
  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "URL gambar wajib diisi" });
    return;
  }

  await safeUnlinkImage(url);

  logAdminAction({
    adminUserId: req.user!.userId,
    action: "delete_tutorial_image",
    targetType: "tutorial",
    details: { url },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.json({ message: "Gambar berhasil dihapus" });
});

// ─── User: Public endpoints ───────────────────────────────────────────────────

router.get("/tutorials", requireAuth, async (_req, res) => {
  const rows = await db
    .select()
    .from(appTutorialsTable)
    .where(eq(appTutorialsTable.isActive, true))
    .orderBy(asc(appTutorialsTable.sortOrder), asc(appTutorialsTable.id));
  res.json(rows);
});

router.get("/tutorials/:slug", requireAuth, async (req, res) => {
  const slug = req.params.slug as string;
  const [row] = await db
    .select()
    .from(appTutorialsTable)
    .where(eq(appTutorialsTable.appSlug, slug));

  if (!row || !row.isActive) {
    res.status(404).json({ error: "Tutorial tidak ditemukan" });
    return;
  }
  res.json(row);
});

export default router;

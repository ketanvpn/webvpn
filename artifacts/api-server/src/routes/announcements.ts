import { Router } from "express";
import { db } from "@workspace/db";
import { announcementsTable } from "@workspace/db";
import { eq, and, lte, gte, or, isNull, desc } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";

const router = Router();

const VALID_TYPES = ["info", "warning", "success", "error"] as const;

// ─── Admin: CRUD ──────────────────────────────────────────────────────────────

router.get("/admin/announcements", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(announcementsTable)
    .orderBy(desc(announcementsTable.createdAt));
  res.json(rows);
});

router.post("/admin/announcements", requireAdmin, async (req, res) => {
  const { title, content, type, isActive, startAt, endAt } = req.body ?? {};
  if (!title || typeof title !== "string" || title.trim().length < 1) {
    res.status(400).json({ error: "Judul wajib diisi" });
    return;
  }
  if (!content || typeof content !== "string") {
    res.status(400).json({ error: "Isi pengumuman wajib diisi" });
    return;
  }
  const finalType = VALID_TYPES.includes(type) ? type : "info";
  const parseDate = (d: any) => {
    if (!d) return null;
    const p = new Date(d);
    return isNaN(p.getTime()) ? null : p;
  };

  const [row] = await db
    .insert(announcementsTable)
    .values({
      title: title.trim(),
      content: content.trim(),
      type: finalType,
      isActive: isActive !== false,
      startAt: parseDate(startAt),
      endAt: parseDate(endAt),
    })
    .returning();
  res.status(201).json(row);
});

router.put("/admin/announcements/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, content, type, isActive, startAt, endAt } = req.body ?? {};
  const updateData: Partial<typeof announcementsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (title !== undefined) updateData.title = String(title).trim();
  if (content !== undefined) updateData.content = String(content).trim();
  if (type !== undefined && VALID_TYPES.includes(type)) updateData.type = type;
  if (isActive !== undefined) updateData.isActive = Boolean(isActive);
  
  if ("startAt" in req.body) {
    if (!startAt) {
      updateData.startAt = null;
    } else {
      const d = new Date(startAt);
      updateData.startAt = isNaN(d.getTime()) ? null : d;
    }
  }
  if ("endAt" in req.body) {
    if (!endAt) {
      updateData.endAt = null;
    } else {
      const d = new Date(endAt);
      updateData.endAt = isNaN(d.getTime()) ? null : d;
    }
  }

  const [row] = await db
    .update(announcementsTable)
    .set(updateData)
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Pengumuman tidak ditemukan" });
    return;
  }
  res.json(row);
});

router.delete("/admin/announcements/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db
    .delete(announcementsTable)
    .where(eq(announcementsTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Pengumuman tidak ditemukan" });
    return;
  }
  res.json({ message: "Pengumuman berhasil dihapus" });
});

// ─── User: Ambil pengumuman aktif ─────────────────────────────────────────────

router.get("/announcements/active", requireAuth, async (_req, res) => {
  const now = new Date();
  const rows = await db
    .select()
    .from(announcementsTable)
    .where(
      and(
        eq(announcementsTable.isActive, true),
        or(isNull(announcementsTable.startAt), lte(announcementsTable.startAt, now)),
        or(isNull(announcementsTable.endAt), gte(announcementsTable.endAt, now)),
      ),
    )
    .orderBy(desc(announcementsTable.createdAt));
  res.json(rows);
});

export default router;

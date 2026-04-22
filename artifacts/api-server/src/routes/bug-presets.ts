import { Router } from "express";
import { db } from "@workspace/db";
import { bugPresetsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { AdminCreateBugPresetBody, AdminUpdateBugPresetBody } from "@workspace/api-zod";

const router = Router();

// Public: List all active bug presets
router.get("/bug-presets", async (_req, res) => {
  try {
    const presets = await db
      .select()
      .from(bugPresetsTable)
      .where(eq(bugPresetsTable.isActive, true))
      .orderBy(desc(bugPresetsTable.createdAt));
      
    res.json(presets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bug presets" });
  }
});

// Admin: List all bug presets
router.get("/admin/bug-presets", requireAdmin, async (_req, res) => {
  try {
    const presets = await db
      .select()
      .from(bugPresetsTable)
      .orderBy(desc(bugPresetsTable.createdAt));
      
    res.json(presets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bug presets" });
  }
});

// Admin: Create bug preset
router.post("/admin/bug-presets", requireAdmin, async (req, res) => {
  const parsed = AdminCreateBugPresetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  
  try {
    const [preset] = await db
      .insert(bugPresetsTable)
      .values({
        name: parsed.data.name,
        bugDomain: parsed.data.bugDomain,
        mode: parsed.data.mode,
        isActive: parsed.data.isActive ?? true,
      })
      .returning();
      
    res.status(201).json(preset);
  } catch (error) {
    res.status(500).json({ error: "Failed to create bug preset" });
  }
});

// Admin: Update bug preset
router.put("/admin/bug-presets/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = AdminUpdateBugPresetBody.safeParse(req.body);
  
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  
  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.bugDomain !== undefined) updateData.bugDomain = parsed.data.bugDomain;
    if (parsed.data.mode !== undefined) updateData.mode = parsed.data.mode;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const [updated] = await db
      .update(bugPresetsTable)
      .set(updateData)
      .where(eq(bugPresetsTable.id, id))
      .returning();
      
    if (!updated) {
      res.status(404).json({ error: "Bug preset not found" });
      return;
    }
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bug preset" });
  }
});

// Admin: Delete bug preset
router.delete("/admin/bug-presets/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  
  try {
    const [deleted] = await db
      .delete(bugPresetsTable)
      .where(eq(bugPresetsTable.id, id))
      .returning();
      
    if (!deleted) {
      res.status(404).json({ error: "Bug preset not found" });
      return;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bug preset" });
  }
});

export default router;

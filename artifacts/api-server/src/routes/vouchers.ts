import { Router } from "express";
import { db } from "@workspace/db";
import { vouchersTable, productsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { AdminCreateVoucherBody as CreateVoucherBody, AdminUpdateVoucherBody as UpdateVoucherBody, ValidateVoucherBody } from "@workspace/api-zod";

const router = Router();

// ─── Admin: Vouchers ───────────────────────────────────────────────────────

router.get("/admin/vouchers", requireAdmin, async (_req, res) => {
  const vouchers = await db
    .select()
    .from(vouchersTable)
    .orderBy(desc(vouchersTable.createdAt));
  res.json(vouchers);
});

router.post("/admin/vouchers", requireAdmin, async (req, res) => {
  const parsed = CreateVoucherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  
  const { code, discountType, discountValue, maxUses, isActive, expiresAt } = parsed.data;

  // Cek apakah kode voucher sudah ada
  const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code)).limit(1);
  if (existing) {
    res.status(400).json({ error: "Kode voucher sudah digunakan" });
    return;
  }

  const [voucher] = await db
    .insert(vouchersTable)
    .values({
      code,
      discountType,
      discountValue: String(discountValue),
      maxUses,
      isActive: isActive ?? true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  res.status(201).json(voucher);
});

router.put("/admin/vouchers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = UpdateVoucherBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const data = parsed.data;
  const updateData: Partial<typeof vouchersTable.$inferInsert> = {};

  if (data.code !== undefined) {
    const [existing] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, data.code)).limit(1);
    if (existing && existing.id !== id) {
      res.status(400).json({ error: "Kode voucher sudah digunakan oleh voucher lain" });
      return;
    }
    updateData.code = data.code;
  }

  if (data.discountType !== undefined) updateData.discountType = data.discountType;
  if (data.discountValue !== undefined) updateData.discountValue = String(data.discountValue);
  if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  updateData.updatedAt = new Date();

  const [voucher] = await db
    .update(vouchersTable)
    .set(updateData)
    .where(eq(vouchersTable.id, id))
    .returning();

  if (!voucher) {
    res.status(404).json({ error: "Voucher tidak ditemukan" });
    return;
  }

  res.json(voucher);
});

router.delete("/admin/vouchers/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db.delete(vouchersTable).where(eq(vouchersTable.id, id)).returning();
  
  if (!deleted) {
    res.status(404).json({ error: "Voucher tidak ditemukan" });
    return;
  }
  
  res.json({ message: "Voucher berhasil dihapus" });
});

// ─── User: Validate Voucher ────────────────────────────────────────────────

router.post("/vouchers/validate", requireAuth, async (req, res) => {
  const parsed = ValidateVoucherBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { code, productId } = parsed.data;

  const [voucher] = await db.select().from(vouchersTable).where(eq(vouchersTable.code, code)).limit(1);
  
  if (!voucher || !voucher.isActive) {
    res.status(400).json({ error: "Voucher tidak valid atau sudah tidak aktif" });
    return;
  }

  if (voucher.maxUses && voucher.currentUses >= voucher.maxUses) {
    res.status(400).json({ error: "Voucher telah mencapai batas maksimal penggunaan" });
    return;
  }

  if (voucher.expiresAt && new Date() > voucher.expiresAt) {
    res.status(400).json({ error: "Voucher sudah kedaluwarsa" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Produk tidak ditemukan" });
    return;
  }

  // Kalkulasi Harga (Diskon)
  let basePrice = Number(product.price);

  const currentUser = (req as any).user;
  if (currentUser?.role === "reseller" && product.resellerPrice != null) {
    basePrice = Number(product.resellerPrice);
  }

  let discountAmount = 0;
  if (voucher.discountType === "percent") {
    discountAmount = Math.floor(basePrice * (Number(voucher.discountValue) / 100));
  } else if (voucher.discountType === "fixed") {
    discountAmount = Number(voucher.discountValue);
  }

  // Cek kalau voucher bernilai lebih dari harga produk
  discountAmount = Math.min(discountAmount, basePrice);
  
  const finalPrice = basePrice - discountAmount;

  res.json({
    valid: true,
    discountAmount,
    finalPrice,
    message: "Voucher berhasil diaplikasikan",
  });
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable, balanceLogsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";
import { logger } from "../../lib/logger";
import { formatTopup } from "../balance";
import { logAdminAction } from "../admin-audit";
import { getClientIp } from "../../lib/request-ip";
import { notifyUserTopupConfirmed, notifyUserTopupRejected } from "../../lib/telegram";
import { tryAutoUpgradeReseller } from "../../lib/reseller-upgrade";
import { addPoints, getPointsSettings } from "../points";
import { manualTopupCredit } from "../../lib/payment/manual-topup-policy";
import { getAdminId } from "./helpers";

const router = Router();

// ─── Admin: Topups ────────────────────────────────────────────────────────────

router.get("/admin/topups", requireAdmin, async (req, res) => {
  const { status } = req.query as Record<string, string | undefined>;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const topups = await db
    .select({
      id: topupsTable.id,
      userId: topupsTable.userId,
      username: usersTable.username,
      amount: topupsTable.amount,
      paymentProvider: topupsTable.paymentProvider,
      paymentChannel: topupsTable.paymentChannel,
      payableAmount: topupsTable.payableAmount,
      uniqueCode: topupsTable.uniqueCode,
      qrisUrl: topupsTable.qrisUrl,
      status: topupsTable.status,
      confirmedBy: topupsTable.confirmedBy,
      rejectionNote: topupsTable.rejectionNote,
      expiresAt: topupsTable.expiresAt,
      autogopayTransactionId: topupsTable.autogopayTransactionId,
      createdAt: topupsTable.createdAt,
      updatedAt: topupsTable.updatedAt,
    })
    .from(topupsTable)
    .leftJoin(usersTable, eq(topupsTable.userId, usersTable.id))
    .where(status ? eq(topupsTable.status, status) : undefined)
    .orderBy(desc(topupsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(topups.map((t) => formatTopup(t as typeof topupsTable.$inferSelect & { username?: string | null })));
});

router.post("/admin/topups/:id/confirm", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const adminId = getAdminId(req);

  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, id))
    .limit(1);

  if (!topup) {
    res.status(404).json({ error: "Topup not found" });
    return;
  }

  const creditedAmount = manualTopupCredit(topup);
  let confirmed: typeof topupsTable.$inferSelect | null = null;
  let balanceAfter = 0;

  try {
    const result = await db.transaction(async (tx) => {
      // Atomic: update status HANYA jika masih pending.
      // Ini mencegah double-credit jika admin double-click atau webhook masuk bersamaan.
      const [confirmedTopup] = await tx
        .update(topupsTable)
        .set({ status: "confirmed", confirmedBy: adminId, updatedAt: new Date() })
        .where(and(eq(topupsTable.id, id), eq(topupsTable.status, "pending")))
        .returning();

      if (!confirmedTopup) {
        throw new Error(`Topup sudah ${topup.status} (tidak bisa dikonfirmasi ulang)`);
      }

      const [updatedUser] = await tx
        .update(usersTable)
        .set({ balance: sql`balance + ${creditedAmount}` })
        .where(eq(usersTable.id, topup.userId))
        .returning({ balance: usersTable.balance });

      if (!updatedUser) {
        throw new Error("User topup tidak ditemukan");
      }

      const after = Number(updatedUser.balance);
      const before = after - creditedAmount;

      await tx.insert(balanceLogsTable).values({
        userId: topup.userId,
        type: "topup",
        amount: String(creditedAmount),
        balanceBefore: String(before),
        balanceAfter: String(after),
        description: `Topup dikonfirmasi (ID #${topup.id})`,
        relatedId: topup.id,
      });

      return { confirmedTopup, balanceAfter: after };
    });

    confirmed = result.confirmedTopup;
    balanceAfter = result.balanceAfter;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal mengonfirmasi topup";
    res.status(400).json({ error: message });
    return;
  }

  if (!confirmed) {
    res.status(500).json({ error: "Topup gagal dikonfirmasi" });
    return;
  }

  // Audit log for admin action
  logAdminAction({
    adminUserId: adminId,
    action: "approve_topup",
    targetType: "topup",
    targetId: topup.id,
    details: { amount: creditedAmount, userId: topup.userId },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "approve_topup" }, "Failed to log admin action"));

  // Notify user via Telegram (fire and forget)
  notifyUserTopupConfirmed(topup.userId, creditedAmount, balanceAfter)
    .catch((err) => logger.error({ err }, "Failed to send topup confirmation notification"));

  // Cek apakah user layak auto-upgrade jadi reseller
  tryAutoUpgradeReseller(topup.userId, creditedAmount)
    .catch((err) => logger.error({ err }, "Failed to auto-upgrade reseller"));

  // Tambah poin jika sistem poin aktif
  try {
    const pts = await getPointsSettings();
    if (pts.enabled && creditedAmount >= pts.pointsMinTopup && pts.pointsRateTopup > 0) {
      const pointsEarned = Math.floor(creditedAmount / pts.pointsRateTopup);
      if (pointsEarned > 0) {
        await addPoints(topup.userId, pointsEarned, "topup", `Topup dikonfirmasi #${topup.id}`, topup.id);
      }
    }
  } catch (err) {
    logger.error({ err, topupId: topup.id }, "[admin topup] addPoints failed");
  }

  res.json(formatTopup(confirmed));
});

router.post("/admin/topups/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  const adminId = getAdminId(req);
  const rejectionNote = req.body?.rejectionNote ? String(req.body.rejectionNote).slice(0, 200) : null;

  const [topup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, id))
    .limit(1);

  if (!topup) {
    res.status(404).json({ error: "Topup not found" });
    return;
  }

  if (topup.status !== "pending") {
    res.status(400).json({ error: `Topup tidak bisa ditolak (status saat ini: ${topup.status})` });
    return;
  }

  const [updated] = await db
    .update(topupsTable)
    .set({ status: "rejected", confirmedBy: adminId, rejectionNote, updatedAt: new Date() })
    .where(eq(topupsTable.id, id))
    .returning();

  // Audit log for admin action
  logAdminAction({
    adminUserId: adminId,
    action: "reject_topup",
    targetType: "topup",
    targetId: topup.id,
    details: { amount: Number(topup.amount), userId: topup.userId, rejectionNote },
    ipAddress: getClientIp(req),
  }).catch((err) => logger.error({ err, action: "reject_topup" }, "Failed to log admin action"));

  // Notify user via Telegram (fire and forget)
  notifyUserTopupRejected(topup.userId, Number(topup.amount), rejectionNote)
    .catch((err) => logger.error({ err }, "Failed to send topup rejection notification"));

  res.json(formatTopup(updated));
});

export default router;

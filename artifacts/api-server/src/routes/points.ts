import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pointLogsTable, balanceLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { getSettingValue, setSettingValue } from "./settings";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Add points to user with transaction-safe atomic update.
 * Prevents race condition when multiple operations happen simultaneously.
 */
export async function addPoints(userId: number, amount: number, type: string, description: string, relatedId?: number) {
  try {
    await db.transaction(async (tx) => {
      // Get current points within transaction
      const [user] = await tx
        .select({ points: usersTable.points })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      
      if (!user) return;
      
      const before = user.points;
      const after = before + amount;
      
      // Atomic update
      await tx
        .update(usersTable)
        .set({ points: after, updatedAt: new Date() })
        .where(eq(usersTable.id, userId));
      
      // Insert log
      await tx.insert(pointLogsTable).values({
        userId,
        type,
        amount,
        pointsBefore: before,
        pointsAfter: after,
        description,
        relatedId: relatedId ?? null,
      });
    });
  } catch (err) {
    logger.error({ err, userId, amount, type }, "[addPoints] Failed to add points");
    throw err;
  }
}

export async function getPointsSettings(): Promise<{ enabled: boolean; pointsRateOrder: number; pointsMinOrder: number; pointsRateTopup: number; pointsMinTopup: number; redeemRate: number; minRedeem: number }> {
  const [enabled, pointsRateOrder, pointsMinOrder, pointsRateTopup, pointsMinTopup, redeemRate, minRedeem] = await Promise.all([
    getSettingValue("pointsEnabled"),
    getSettingValue("pointsRateOrder"),
    getSettingValue("pointsMinOrder"),
    getSettingValue("pointsRateTopup"),
    getSettingValue("pointsMinTopup"),
    getSettingValue("pointsRedeemRate"),
    getSettingValue("pointsMinRedeem"),
  ]);
  return {
    enabled: enabled === "true",
    pointsRateOrder: parseInt(pointsRateOrder ?? "10000") || 10000,
    pointsMinOrder: parseInt(pointsMinOrder ?? "20000") || 20000,
    pointsRateTopup: parseInt(pointsRateTopup ?? "10000") || 10000,
    pointsMinTopup: parseInt(pointsMinTopup ?? "20000") || 20000,
    redeemRate: parseInt(redeemRate ?? "100") || 100,
    minRedeem: parseInt(minRedeem ?? "100") || 100,
  };
}

// ─── User routes ──────────────────────────────────────────────────────────────

router.get("/points", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [user] = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const settings = await getPointsSettings();
  res.json({ points: user?.points ?? 0, settings });
});

router.get("/points/logs", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const logs = await db
    .select()
    .from(pointLogsTable)
    .where(eq(pointLogsTable.userId, userId))
    .orderBy(desc(pointLogsTable.createdAt))
    .limit(50);
  res.json(logs);
});

router.post("/points/redeem", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const amount = parseInt(req.body?.amount, 10);
  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Jumlah poin tidak valid" });
    return;
  }

  const settings = await getPointsSettings();
  if (!settings.enabled) {
    res.status(400).json({ error: "Sistem poin tidak aktif" });
    return;
  }
  if (amount < settings.minRedeem) {
    res.status(400).json({ error: `Minimal penukaran ${settings.minRedeem} poin` });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ points: usersTable.points, balance: usersTable.balance })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .for("update")
        .limit(1);
      
      if (!user || user.points < amount) {
        return { error: "Poin tidak cukup" };
      }

      const balanceCredit = amount * settings.redeemRate;
      const pointsBefore = user.points;
      const pointsAfter = pointsBefore - amount;
      const balanceBefore = Number(user.balance);
      const balanceAfter = balanceBefore + balanceCredit;

      await tx
        .update(usersTable)
        .set({ points: pointsAfter, balance: String(balanceAfter), updatedAt: new Date() })
        .where(eq(usersTable.id, userId));

      await tx.insert(pointLogsTable).values({
        userId,
        type: "redeem",
        amount: -amount,
        pointsBefore,
        pointsAfter,
        description: `Tukar ${amount} poin → Rp ${balanceCredit.toLocaleString("id-ID")}`,
      });

      await tx.insert(balanceLogsTable).values({
        userId,
        type: "redeem",
        amount: balanceCredit,
        balanceBefore,
        balanceAfter,
        description: `Penukaran ${amount} poin`,
      });

      return { balanceCredit, pointsAfter, balanceAfter };
    });

    if (typeof result === "object" && "error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ 
      message: `Berhasil menukar ${amount} poin menjadi saldo Rp ${result.balanceCredit!.toLocaleString("id-ID")}`, 
      balanceAdded: result.balanceCredit 
    });
  } catch (err) {
    logger.error({ err, userId, amount }, "[points redeem] Transaction failed");
    res.status(500).json({ error: "Terjadi kesalahan saat memproses penukaran poin" });
  }
});

// ─── Admin: Settings ──────────────────────────────────────────────────────────

router.get("/admin/settings/points", requireAdmin, async (_req, res) => {
  res.json(await getPointsSettings());
});

router.put("/admin/settings/points", requireAdmin, async (req, res) => {
  const { enabled, pointsRateOrder, pointsMinOrder, pointsRateTopup, pointsMinTopup, redeemRate, minRedeem } = req.body ?? {};
  await Promise.all([
    setSettingValue("pointsEnabled", String(!!enabled)),
    setSettingValue("pointsRateOrder", String(parseInt(pointsRateOrder ?? "10000") || 10000)),
    setSettingValue("pointsMinOrder", String(parseInt(pointsMinOrder ?? "20000") || 20000)),
    setSettingValue("pointsRateTopup", String(parseInt(pointsRateTopup ?? "10000") || 10000)),
    setSettingValue("pointsMinTopup", String(parseInt(pointsMinTopup ?? "20000") || 20000)),
    setSettingValue("pointsRedeemRate", String(parseInt(redeemRate ?? "100") || 100)),
    setSettingValue("pointsMinRedeem", String(parseInt(minRedeem ?? "100") || 100)),
  ]);
  res.json({ message: "Pengaturan poin disimpan" });
});

export default router;

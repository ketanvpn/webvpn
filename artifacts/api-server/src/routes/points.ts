import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, pointLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { getSettingValue, setSettingValue } from "./settings";

const router = Router();

// ─── Helper ───────────────────────────────────────────────────────────────────

export async function addPoints(userId: number, amount: number, type: string, description: string, relatedId?: number) {
  const [user] = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return;

  const before = user.points;
  const after = before + amount;

  await db.update(usersTable).set({ points: after }).where(eq(usersTable.id, userId));
  await db.insert(pointLogsTable).values({
    userId,
    type,
    amount,
    pointsBefore: before,
    pointsAfter: after,
    description,
    relatedId: relatedId ?? null,
  });
}

export async function getPointsSettings(): Promise<{ enabled: boolean; pointsPerOrder: number; pointsPerTopup: number; redeemRate: number; minRedeem: number }> {
  const [enabled, pointsPerOrder, pointsPerTopup, redeemRate, minRedeem] = await Promise.all([
    getSettingValue("pointsEnabled"),
    getSettingValue("pointsPerOrder"),
    getSettingValue("pointsPerTopup"),
    getSettingValue("pointsRedeemRate"),
    getSettingValue("pointsMinRedeem"),
  ]);
  return {
    enabled: enabled === "true",
    pointsPerOrder: parseInt(pointsPerOrder ?? "10") || 10,
    pointsPerTopup: parseInt(pointsPerTopup ?? "5") || 5,
    redeemRate: parseInt(redeemRate ?? "100") || 100,
    minRedeem: parseInt(minRedeem ?? "100") || 100,
  };
}

// ─── User routes ──────────────────────────────────────────────────────────────

router.get("/points", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const [user] = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const settings = await getPointsSettings();
  res.json({ points: user?.points ?? 0, settings });
});

router.get("/points/logs", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const logs = await db
    .select()
    .from(pointLogsTable)
    .where(eq(pointLogsTable.userId, userId))
    .orderBy(desc(pointLogsTable.createdAt))
    .limit(50);
  res.json(logs);
});

router.post("/points/redeem", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
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

  const [user] = await db.select({ points: usersTable.points, balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.points < amount) {
    res.status(400).json({ error: "Poin tidak cukup" });
    return;
  }

  const balanceCredit = amount * settings.redeemRate;
  const before = user.points;
  const after = before - amount;
  const balanceBefore = Number(user.balance);
  const balanceAfter = balanceBefore + balanceCredit;

  await db.update(usersTable).set({ points: after, balance: String(balanceAfter) }).where(eq(usersTable.id, userId));
  await db.insert(pointLogsTable).values({
    userId,
    type: "redeem",
    amount: -amount,
    pointsBefore: before,
    pointsAfter: after,
    description: `Tukar ${amount} poin → Rp ${balanceCredit.toLocaleString("id-ID")}`,
  });

  import("../routes/balance-logs").then(({ addBalanceLog }) => {
    addBalanceLog({
      userId,
      type: "redeem",
      amount: balanceCredit,
      balanceBefore,
      balanceAfter,
      description: `Penukaran ${amount} poin`,
    }).catch(() => {});
  }).catch(() => {});

  res.json({ message: `Berhasil menukar ${amount} poin menjadi saldo Rp ${balanceCredit.toLocaleString("id-ID")}`, balanceAdded: balanceCredit });
});

// ─── Admin: Settings ──────────────────────────────────────────────────────────

router.get("/admin/settings/points", requireAdmin, async (_req, res) => {
  res.json(await getPointsSettings());
});

router.put("/admin/settings/points", requireAdmin, async (req, res) => {
  const { enabled, pointsPerOrder, pointsPerTopup, redeemRate, minRedeem } = req.body ?? {};
  await Promise.all([
    setSettingValue("pointsEnabled", String(!!enabled)),
    setSettingValue("pointsPerOrder", String(parseInt(pointsPerOrder ?? "10") || 10)),
    setSettingValue("pointsPerTopup", String(parseInt(pointsPerTopup ?? "5") || 5)),
    setSettingValue("pointsRedeemRate", String(parseInt(redeemRate ?? "100") || 100)),
    setSettingValue("pointsMinRedeem", String(parseInt(minRedeem ?? "100") || 100)),
  ]);
  res.json({ message: "Pengaturan poin disimpan" });
});

export default router;

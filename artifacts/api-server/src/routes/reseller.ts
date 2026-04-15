import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable } from "@workspace/db/schema";
import { and, eq, gte, lt, sum } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getResellerSettings } from "./settings";

const router = Router();

router.get("/reseller/status", requireAuth, async (req, res) => {
  if (req.user!.role !== "reseller") {
    res.status(403).json({ error: "Hanya reseller yang bisa mengakses ini." });
    return;
  }

  const settings = await getResellerSettings();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [result] = await db
    .select({ total: sum(ordersTable.amount) })
    .from(ordersTable)
    .where(
      and(
        eq(ordersTable.userId, req.user!.userId),
        eq(ordersTable.status, "paid"),
        gte(ordersTable.createdAt, monthStart),
        lt(ordersTable.createdAt, monthEnd),
      )
    );

  const currentMonthSales = Number(result?.total ?? 0);
  const progressPercent = settings.resellerTargetEnabled && settings.resellerMonthlyTarget > 0
    ? Math.min(100, Math.round((currentMonthSales / settings.resellerMonthlyTarget) * 100))
    : null;

  res.json({
    resellerEnabled: settings.resellerEnabled,
    discountPercent: settings.resellerDiscountPercent,
    targetEnabled: settings.resellerTargetEnabled,
    monthlyTarget: settings.resellerMonthlyTarget,
    currentMonthSales,
    progressPercent,
    currentMonth: `${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
  });
});

export default router;

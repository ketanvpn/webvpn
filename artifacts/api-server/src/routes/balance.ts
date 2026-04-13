import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { TopupBalanceBody } from "@workspace/api-zod";
import { getPaymentSettingsMap } from "./settings";

const router = Router();

function formatTopup(t: typeof topupsTable.$inferSelect & { username?: string | null }) {
  return {
    id: t.id,
    userId: t.userId,
    username: (t as { username?: string | null }).username ?? null,
    amount: Number(t.amount),
    qrisUrl: t.qrisUrl,
    status: t.status,
    confirmedBy: t.confirmedBy,
    rejectionNote: t.rejectionNote ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

router.get("/balance", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const [user] = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const pendingTopups = await db
    .select({ amount: topupsTable.amount })
    .from(topupsTable)
    .where(and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")));

  const pendingAmount = pendingTopups.reduce((sum, t) => sum + Number(t.amount), 0);

  res.json({
    balance: Number(user?.balance ?? 0),
    pendingTopup: pendingAmount,
  });
});

router.post("/balance/topup", requireAuth, async (req, res) => {
  const parsed = TopupBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input. Minimum topup is Rp 10,000" });
    return;
  }
  const { amount } = parsed.data;
  const userId = req.user!.userId;

  const settingsMap = await getPaymentSettingsMap();
  const activeGateway = settingsMap["activeGateway"] ?? "qris_static";
  let qrisUrl: string | null = null;

  if (activeGateway === "qris_static") {
    qrisUrl = settingsMap["qrisStaticUrl"] ?? null;
  }

  const [topup] = await db
    .insert(topupsTable)
    .values({
      userId,
      amount: String(amount),
      status: "pending",
      qrisUrl,
    })
    .returning();

  res.status(201).json({
    id: topup.id,
    amount: Number(topup.amount),
    qrisUrl: topup.qrisUrl,
    status: topup.status,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
});

router.get("/balance/topup/history", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const topups = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.userId, userId))
    .orderBy(desc(topupsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(topups.map((t) => formatTopup(t)));
});

export { formatTopup };
export default router;

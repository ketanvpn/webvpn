import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { TopupBalanceBody } from "@workspace/api-zod";
import { getPaymentSettingsMap } from "./settings";
import { logger } from "../lib/logger";
import { notifyAdminNewTopup } from "../lib/telegram";
import { topupLimiter } from "../lib/rate-limit";
import {
  createEntityQrPayment,
  isPaymentProviderError,
  markEntityQrCreationFailed,
} from "../lib/payment";

const router = Router();

function formatTopup(t: typeof topupsTable.$inferSelect & { username?: string | null }) {
  return {
    id: t.id,
    userId: t.userId,
    username: (t as { username?: string | null }).username ?? null,
    amount: Number(t.amount),
    payableAmount: Number(t.payableAmount ?? t.amount),
    paymentProvider: t.paymentProvider ?? null,
    paymentChannel: t.paymentChannel ?? null,
    uniqueCode: t.uniqueCode ?? 0,
    qrisUrl: t.qrisUrl,
    status: t.status,
    confirmedBy: t.confirmedBy,
    rejectionNote: t.rejectionNote ?? null,
    expiresAt: t.expiresAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

router.get("/balance", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  res.setHeader("Cache-Control", "no-store");

  const [user] = await db
    .select({ balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const pendingTopups = await db
    .select({ amount: topupsTable.amount })
    .from(topupsTable)
    .where(and(eq(topupsTable.userId, userId), eq(topupsTable.status, "pending")));

  const pendingAmount = pendingTopups.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  res.json({
    balance: Number(user?.balance ?? 0),
    pendingTopup: pendingAmount,
  });
});

router.post("/balance/topup", requireAuth, topupLimiter, async (req, res) => {
  const parsed = TopupBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input. Minimum topup is Rp 10,000" });
    return;
  }
  const { amount } = parsed.data;
  const userId = req.user!.userId;

  const [userInfo] = await db
    .select({ username: usersTable.username, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const settingsMap = await getPaymentSettingsMap();
  const activeGateway = settingsMap["activeGateway"] ?? "qris_static";
  const expiryMinutes = settingsMap["qrisExpiryMinutes"]
    ? parseInt(settingsMap["qrisExpiryMinutes"], 10)
    : 15;

  // Persist the local entity before any provider call so references and
  // idempotency keys remain stable across provider retries/timeouts.
  const [topup] = await db
    .insert(topupsTable)
    .values({
      userId,
      amount: String(amount),
      payableAmount: String(amount),
      status: "pending",
    })
    .returning();

  if (activeGateway === "qris_static") {
    const qrisUrl = settingsMap["qrisStaticUrl"]?.trim() || null;
    if (!qrisUrl) {
      await markEntityQrCreationFailed(
        { kind: "topup", id: topup.id },
        new Error("Static QRIS image is not configured"),
      );
      res.status(400).json({
        error: "QRIS statis belum dikonfigurasi. Hubungi admin.",
        topupId: topup.id,
      });
      return;
    }
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
    const [updatedTopup] = await db
      .update(topupsTable)
      .set({ qrisUrl, expiresAt, updatedAt: new Date() })
      .where(eq(topupsTable.id, topup.id))
      .returning();

    notifyAdminNewTopup(
      topup.id,
      amount,
      userInfo?.username ?? `User#${userId}`,
      userInfo?.email ?? "",
    ).catch((err) => logger.error({ err }, "notifyAdminNewTopup failed"));

    res.status(201).json({
      ...formatTopup(updatedTopup ?? topup),
      gateway: activeGateway,
    });
    return;
  }

  try {
    await createEntityQrPayment({
      entity: { kind: "topup", id: topup.id },
      baseAmount: amount,
      settings: settingsMap,
      customer: {
        name: userInfo?.username ?? `User#${userId}`,
        email: userInfo?.email ?? "webvpn@local.invalid",
      },
      description: `Topup saldo user ${userInfo?.username ?? userId}`,
    });
  } catch (err) {
    await markEntityQrCreationFailed({ kind: "topup", id: topup.id }, err);
    const ambiguous =
      isPaymentProviderError(err) && err.category === "ambiguous";
    logger.error(
      {
        err,
        topupId: topup.id,
        paymentOutcome: ambiguous ? "unknown" : "failed",
      },
      "Topup QRIS creation failed",
    );
    res.status(ambiguous ? 503 : 502).json({
      error: ambiguous
        ? "Status pembuatan QRIS belum dapat dipastikan. Jangan ulangi pembayaran; hubungi admin."
        : "Gagal membuat QRIS. Coba lagi.",
      topupId: topup.id,
      paymentStatus: ambiguous ? "unknown" : "failed",
    });
    return;
  }

  const [updatedTopup] = await db
    .select()
    .from(topupsTable)
    .where(eq(topupsTable.id, topup.id))
    .limit(1);
  res.status(201).json({
    ...formatTopup(updatedTopup ?? topup),
    gateway: updatedTopup?.paymentProvider ?? activeGateway,
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

  res.json(topups.map((t: any) => formatTopup(t)));
});

export { formatTopup };
export default router;

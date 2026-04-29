import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, topupsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { TopupBalanceBody } from "@workspace/api-zod";
import { getPaymentSettingsMap } from "./settings";
import { logger } from "../lib/logger";
import { notifyAdminNewTopup } from "../lib/telegram";

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

router.post("/balance/topup", requireAuth, async (req, res) => {
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

  let qrisUrl: string | null = null;
  let autogopayTransactionId: string | null = null;
  let expiresAt: Date | null = null;

  if (activeGateway === "qris_static") {
    qrisUrl = settingsMap["qrisStaticUrl"] ?? null;
    const expiryMinutes = settingsMap["qrisExpiryMinutes"] ? parseInt(settingsMap["qrisExpiryMinutes"], 10) : 15;
    expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  } else if (activeGateway === "autogopay") {
    const apiUrl = (settingsMap["autoGopayApiUrl"] ?? "https://v1-gateway.autogopay.site").replace(/\/$/, "");
    const apiKey = settingsMap["autoGopaySecretKey"];

    if (!apiKey) {
      res.status(503).json({ error: "AutoGoPay belum dikonfigurasi. Hubungi admin." });
      return;
    }

    let agpResponse: Response;
    try {
      agpResponse = await fetch(`${apiUrl}/qris/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ amount }),
      });
    } catch (err) {
      logger.error({ err }, "AutoGoPay: fetch error saat generate QRIS");
      res.status(503).json({ error: "Gagal menghubungi AutoGoPay. Coba lagi." });
      return;
    }

    let agpData: {
      success: boolean;
      data?: { transaction_id: string; qr_url: string; expiry_time: string };
      message?: string;
    };
    try {
      agpData = await agpResponse.json() as any;
    } catch {
      res.status(503).json({ error: "Response tidak valid dari AutoGoPay." });
      return;
    }

    if (!agpData.success || !agpData.data) {
      logger.error({ agpData }, "AutoGoPay: generate QRIS gagal");
      res.status(502).json({ error: agpData.message ?? "Gagal membuat QRIS. Coba lagi." });
      return;
    }

    autogopayTransactionId = agpData.data.transaction_id;
    qrisUrl = agpData.data.qr_url;
    expiresAt = new Date(agpData.data.expiry_time.replace(" ", "T") + "+07:00");
  }

  const [topup] = await db
    .insert(topupsTable)
    .values({
      userId,
      amount: String(amount),
      status: "pending",
      qrisUrl,
      autogopayTransactionId,
      expiresAt,
    })
    .returning();

  // Untuk QRIS manual, kirim notif ke admin untuk dikonfirmasi manual
  // Untuk AutoGoPay, notif admin dikirim dari webhook setelah auto-konfirmasi
  if (activeGateway !== "autogopay") {
    notifyAdminNewTopup(
      topup.id,
      amount,
      userInfo?.username ?? `User#${userId}`,
      userInfo?.email ?? "",
    ).catch((err) => logger.error({ err }, "notifyAdminNewTopup failed"));
  }

  res.status(201).json({
    id: topup.id,
    amount: Number(topup.amount),
    qrisUrl: topup.qrisUrl,
    status: topup.status,
    expiresAt: topup.expiresAt,
    gateway: activeGateway,
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

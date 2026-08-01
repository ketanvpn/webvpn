import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, usersTable, dynamicVpnOrdersTable } from "@workspace/db/schema";
import { and, eq, gte, lt, sum } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getResellerSettings } from "./settings";
import { sendMessage } from "../lib/telegram";
import { getSettingValue } from "./settings";

const router = Router();

// ── GET /reseller/status — untuk reseller: lihat progres penjualan bulan ini
router.get("/reseller/status", requireAuth, async (req, res) => {
  if (req.user!.role !== "reseller") {
    res.status(403).json({ error: "Hanya reseller yang bisa mengakses ini." });
    return;
  }

  const settings = await getResellerSettings();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [regularResult] = await db
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

  const [dynamicResult] = await db
    .select({ total: sum(dynamicVpnOrdersTable.amount) })
    .from(dynamicVpnOrdersTable)
    .where(
      and(
        eq(dynamicVpnOrdersTable.userId, req.user!.userId),
        eq(dynamicVpnOrdersTable.status, "paid"),
        gte(dynamicVpnOrdersTable.createdAt, monthStart),
        lt(dynamicVpnOrdersTable.createdAt, monthEnd),
      )
    );

  const regularSales = Number(regularResult?.total ?? 0);
  const dynamicSales = Number(dynamicResult?.total ?? 0);
  const currentMonthSales = regularSales + dynamicSales;
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

// ── GET /reseller/promo — info promosi untuk user biasa (bukan reseller)
router.get("/reseller/promo", requireAuth, async (req, res) => {
  const settings = await getResellerSettings();
  res.json({
    promoEnabled: settings.resellerPromoEnabled,
    promoTitle: settings.resellerPromoTitle,
    promoText: settings.resellerPromoText,
    requestEnabled: settings.resellerRequestEnabled,
    discountPercent: settings.resellerDiscountPercent,
    autoUpgradeEnabled: settings.resellerAutoUpgradeEnabled,
    autoUpgradeMinTopup: settings.resellerAutoUpgradeMinTopup,
    targetEnabled: settings.resellerTargetEnabled,
    monthlyTarget: settings.resellerMonthlyTarget,
  });
});

// ── POST /reseller/request — user biasa ajukan permintaan jadi reseller
router.post("/reseller/request", requireAuth, async (req, res) => {
  if (req.user!.role !== "user") {
    res.status(400).json({ error: "Kamu sudah reseller atau admin." });
    return;
  }

  const settings = await getResellerSettings();
  if (!settings.resellerRequestEnabled) {
    res.status(403).json({ error: "Pengajuan reseller sedang tidak dibuka." });
    return;
  }

  // Ambil info user
  const [user] = await db
    .select({ username: usersTable.username, whatsapp: usersTable.whatsapp })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId));

  // Kirim notifikasi ke admin via Telegram
  const adminChatId = await getSettingValue("telegramAdminChatId");
  if (adminChatId) {
    const wa = user?.whatsapp ? `\nWA: ${user.whatsapp}` : "";
    const text = `📋 *Permintaan Jadi Reseller*\n\nUser *${user?.username ?? "-"}* (ID: ${req.user!.userId}) mengajukan permintaan untuk menjadi reseller.${wa}\n\nSegera review di panel admin → Pengguna.`;
    try {
      await sendMessage(adminChatId, text, { parse_mode: "Markdown" });
    } catch {}
  }

  res.json({ success: true, message: "Permintaan kamu sudah dikirim ke admin. Tunggu konfirmasi ya!" });
});

export default router;

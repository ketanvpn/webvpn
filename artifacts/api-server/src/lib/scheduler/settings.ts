import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getReferralBonusAmount(): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "referralBonusAmount"))
    .limit(1);
  const v = row?.value ? parseInt(row.value, 10) : 5000;
  return isNaN(v) ? 5000 : v;
}

export async function getReferralSettings(): Promise<{ enabled: boolean; bonusAmount: number }> {
  const [enabledRow, bonusRow] = await Promise.all([
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "referralEnabled"))
      .limit(1),
    db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "referralBonusAmount"))
      .limit(1),
  ]);
  
  const enabled = enabledRow[0]?.value !== "false";
  const bonusAmount = bonusRow[0]?.value ? parseInt(bonusRow[0].value, 10) : 5000;
  
  return {
    enabled,
    bonusAmount: isNaN(bonusAmount) ? 5000 : bonusAmount,
  };
}

export async function getExpiryNotifSettings(): Promise<{
  enabled: boolean;
  notif3Days: boolean;
  notif1Day: boolean;
  sendHour: number;
}> {
  const allRows = await db.select().from(settingsTable);
  const map = Object.fromEntries(allRows.map((r) => [r.key, r.value]));
  const parse = (v: string | null | undefined, def = true) =>
    v === undefined || v === null ? def : v === "true";
  const rawHour = parseInt(map["expiryNotifSendHour"] ?? "8", 10);

  return {
    enabled: parse(map["expiryNotifEnabled"], true),
    notif3Days: parse(map["expiryNotif3DaysEnabled"], true),
    notif1Day: parse(map["expiryNotif1DayEnabled"], true),
    sendHour: isNaN(rawHour) ? 8 : Math.min(23, Math.max(0, rawHour)),
  };
}

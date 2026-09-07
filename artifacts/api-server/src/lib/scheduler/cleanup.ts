import { db } from "@workspace/db";
import { vpnAccountsTable, dynamicVpnOrdersTable, waVerificationsTable } from "@workspace/db";
import { lt, inArray } from "drizzle-orm";
import { logger } from "../logger";

export async function cleanupGhostAccounts(): Promise<void> {
  try {
    const now = new Date();
    // Cari akun yang expired lebih dari 7 hari lalu
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Cari ID akun yang akan dihapus
    const toDelete = await db
      .select({ id: vpnAccountsTable.id, username: vpnAccountsTable.username })
      .from(vpnAccountsTable)
      .where(lt(vpnAccountsTable.expiresAt, sevenDaysAgo));

    if (toDelete.length === 0) return;

    const ids = toDelete.map((r) => r.id);

    // Nullify FK reference di dynamic_vpn_orders dulu agar tidak violate constraint
    await db
      .update(dynamicVpnOrdersTable)
      .set({ vpnAccountId: null })
      .where(inArray(dynamicVpnOrdersTable.vpnAccountId, ids));

    // Baru hapus akun
    const result = await db
      .delete(vpnAccountsTable)
      .where(inArray(vpnAccountsTable.id, ids))
      .returning({ id: vpnAccountsTable.id, username: vpnAccountsTable.username });

    if (result.length > 0) {
      logger.info({ count: result.length, accounts: result.map((r) => r.username) }, "Auto-cleanup: menghapus akun VPN hantu yang sudah lama expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat auto-cleanup akun hantu");
  }
}

/**
 * Cleanup expired wa_verifications records.
 * Menghapus record yang expiresAt < NOW() - 1 day.
 * Dijalankan setiap 6 jam.
 */
export async function cleanupExpiredWaVerifications(): Promise<void> {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .delete(waVerificationsTable)
      .where(lt(waVerificationsTable.expiresAt, oneDayAgo))
      .returning({ id: waVerificationsTable.id });

    if (result.length > 0) {
      logger.info({ count: result.length }, "Auto-cleanup: menghapus wa_verifications expired");
    }
  } catch (err) {
    logger.error({ err }, "Error saat cleanup wa_verifications expired");
  }
}

import { db } from "@workspace/db";
import { vpnAccountsTable, serversTable } from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../logger";

export async function checkAndAutoDisableServers(): Promise<void> {
  try {
    const servers = await db
      .select()
      .from(serversTable)
      .where(eq(serversTable.isActive, true));

    for (const server of servers) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(vpnAccountsTable)
        .where(
          and(
            eq(vpnAccountsTable.serverId, server.id),
            eq(vpnAccountsTable.isActive, true),
            gte(vpnAccountsTable.expiresAt, new Date()),
          ),
        );

      if ((count ?? 0) >= server.maxAccounts) {
        await db
          .update(serversTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(serversTable.id, server.id));
        logger.info(`[scheduler] Server "${server.name}" (id: ${server.id}) di-disable otomatis — ${count}/${server.maxAccounts} akun aktif`);
      }
    }
  } catch (err) {
    logger.error({ err }, "Error saat cek auto-disable server");
  }
}

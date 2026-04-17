import { Router } from "express";
import { db } from "@workspace/db";
import { serversTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router = Router();

function formatPublicServer(s: typeof serversTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    flag: s.flag,
    isActive: s.isActive,
  };
}

function formatFullServer(s: typeof serversTable.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    flag: s.flag,
    host: s.host,
    apiUrl: s.apiUrl,
    apiToken: s.apiToken,
    supportedProtocols: s.supportedProtocols,
    isActive: s.isActive,
    maxAccounts: s.maxAccounts,
    activeAccounts: null,
  };
}

router.get("/servers", async (_req, res) => {
  const servers = await db
    .select()
    .from(serversTable)
    .where(eq(serversTable.isActive, true))
    .orderBy(asc(serversTable.sortOrder));

  res.json(servers.map(formatPublicServer));
});

export { formatPublicServer, formatFullServer };
export default router;

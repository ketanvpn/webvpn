import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { db } from "@workspace/db";
import { usersTable, adminAuditLogsTable } from "@workspace/db";
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../lib/auth";

const router = Router();

// --- Admin Audit Logs (view history of admin actions) ---
router.get("/admin/audit-logs", requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 200);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const { action, adminUserId, targetType, q } = req.query as Record<string, string | undefined>;

  const conditions = [];
  if (action) conditions.push(eq(adminAuditLogsTable.action, action));
  if (adminUserId) conditions.push(eq(adminAuditLogsTable.adminUserId, parseInt(adminUserId, 10)));
  if (targetType) conditions.push(eq(adminAuditLogsTable.targetType, targetType));
  if (q) {
    // simple search in details or username
    conditions.push(
      or(
        ilike(usersTable.username, `%${q}%`),
        sql`${adminAuditLogsTable.details}::text ILIKE ${'%' + q + '%'}`
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db
    .select({
      id: adminAuditLogsTable.id,
      adminUserId: adminAuditLogsTable.adminUserId,
      adminUsername: usersTable.username,
      action: adminAuditLogsTable.action,
      targetType: adminAuditLogsTable.targetType,
      targetId: adminAuditLogsTable.targetId,
      details: adminAuditLogsTable.details,
      ipAddress: adminAuditLogsTable.ipAddress,
      createdAt: adminAuditLogsTable.createdAt,
    })
    .from(adminAuditLogsTable)
    .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(adminAuditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const countQuery = db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminAuditLogsTable)
    .leftJoin(usersTable, eq(adminAuditLogsTable.adminUserId, usersTable.id))
    .where(whereClause);

  const [countResult] = await countQuery;

  res.json({
    data: logs,
    total: countResult.count,
    limit,
    offset,
  });
}));

export default router;

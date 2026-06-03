import { db } from "@workspace/db";
import { adminAuditLogsTable } from "@workspace/db";
import { logger } from "../lib/logger";

export async function logAdminAction(params: {
  adminUserId: number;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(adminAuditLogsTable).values({
      adminUserId: params.adminUserId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? null,
    });
  } catch (err) {
    logger.error({ err, params }, "Failed to insert admin audit log");
  }
}

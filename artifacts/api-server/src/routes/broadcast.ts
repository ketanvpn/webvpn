import { Router } from "express";
import { requireAdmin } from "../lib/auth";
import { broadcastMessage } from "../lib/telegram";
import { logAdminAction } from "./admin-audit";
import { getClientIp } from "../lib/request-ip";

const router = Router();

router.post("/admin/broadcast", requireAdmin, async (req, res) => {
  const { message } = req.body as { message?: string };

  if (!message || message.trim().length === 0) {
    res.status(400).json({ error: "Pesan tidak boleh kosong" });
    return;
  }

  if (message.length > 4000) {
    res.status(400).json({ error: "Pesan terlalu panjang (maks 4000 karakter)" });
    return;
  }

  const { sent, failed } = await broadcastMessage(message.trim());

  // Audit log
  const adminIdBroadcast = req.user!.userId;
  logAdminAction({
    adminUserId: adminIdBroadcast,
    action: "broadcast_message",
    targetType: "broadcast",
    targetId: null,
    details: { message: message.trim().substring(0, 200), sent, failed },
    ipAddress: getClientIp(req as any),
  }).catch(() => {});

  res.json({ success: true, sent, failed });
});

export default router;

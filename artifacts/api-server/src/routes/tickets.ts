import { Router } from "express";
import { db } from "@workspace/db";
import { ticketsTable, ticketMessagesTable, usersTable } from "@workspace/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../lib/auth";
import { notifyAdminNewTicket, notifyAdminTicketReply } from "../lib/telegram";

const router = Router();

function formatTicket(t: typeof ticketsTable.$inferSelect, messageCount?: number) {
  return {
    id: t.id,
    userId: t.userId,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    closedAt: t.closedAt,
    messageCount: messageCount ?? 0,
  };
}

// ─── User routes ──────────────────────────────────────────────────────────────

router.get("/tickets", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.userId, userId))
    .orderBy(desc(ticketsTable.updatedAt));
  res.json(rows.map((t: any) => formatTicket(t)));
});

router.post("/tickets", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const { subject, message, priority } = req.body ?? {};
  if (!subject || typeof subject !== "string" || subject.trim().length < 5) {
    res.status(400).json({ error: "Subjek minimal 5 karakter" });
    return;
  }
  if (!message || typeof message !== "string" || message.trim().length < 10) {
    res.status(400).json({ error: "Pesan minimal 10 karakter" });
    return;
  }
  const validPriority = ["low", "normal", "high"].includes(priority) ? priority : "normal";

  const [ticket] = await db
    .insert(ticketsTable)
    .values({ userId, subject: subject.trim(), priority: validPriority })
    .returning();

  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    userId,
    isAdmin: false,
    message: message.trim(),
  });

  const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  notifyAdminNewTicket(ticket.id, user?.username ?? "unknown", subject.trim(), validPriority).catch(() => {});

  res.status(201).json(formatTicket(ticket));
});

router.get("/tickets/:id", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const ticketId = parseInt(req.params.id as string, 10);

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.id, ticketId), eq(ticketsTable.userId, userId)))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }

  const messages = await db
    .select()
    .from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(ticketMessagesTable.createdAt);

  res.json({ ...formatTicket(ticket, messages.length), messages });
});

router.post("/tickets/:id/reply", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const ticketId = parseInt(req.params.id as string, 10);
  const message = req.body?.message;
  if (!message || typeof message !== "string" || message.trim().length < 1) {
    res.status(400).json({ error: "Pesan tidak boleh kosong" });
    return;
  }

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.id, ticketId), eq(ticketsTable.userId, userId)))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }
  if (ticket.status === "closed") {
    res.status(400).json({ error: "Tiket sudah ditutup" });
    return;
  }

  const [msg] = await db
    .insert(ticketMessagesTable)
    .values({ ticketId, userId, isAdmin: false, message: message.trim() })
    .returning();

  await db
    .update(ticketsTable)
    .set({ status: "open", updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId));

  const [user] = await db.select({ username: usersTable.username }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  notifyAdminTicketReply(ticketId, user?.username ?? "user", ticket.subject, message.trim()).catch(() => {});

  res.status(201).json(msg);
});

router.post("/tickets/:id/close", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const ticketId = parseInt(req.params.id as string, 10);

  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.id, ticketId), eq(ticketsTable.userId, userId)))
    .limit(1);

  if (!ticket) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }

  const [updated] = await db
    .update(ticketsTable)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId))
    .returning();

  res.json(formatTicket(updated));
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

router.get("/admin/tickets/pending-count", requireAdmin, async (_req, res) => {
  const openTickets = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(eq(ticketsTable.status, "open"));

  if (openTickets.length === 0) {
    res.json({ count: 0 });
    return;
  }

  const openTicketIds = openTickets.map((t: any) => t.id);
  const messages = await db
    .select({ ticketId: ticketMessagesTable.ticketId, isAdmin: ticketMessagesTable.isAdmin })
    .from(ticketMessagesTable)
    .where(inArray(ticketMessagesTable.ticketId, openTicketIds))
    .orderBy(desc(ticketMessagesTable.createdAt));

  const latestByTicket = new Map<number, boolean>();
  for (const msg of messages as Array<{ ticketId: number; isAdmin: boolean }>) {
    if (!latestByTicket.has(msg.ticketId)) latestByTicket.set(msg.ticketId, msg.isAdmin);
  }

  const pendingCount = openTicketIds.filter((id) => latestByTicket.get(id) === false).length;
  res.json({ count: pendingCount });
});

router.get("/admin/tickets", requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;

  const rows = await db
    .select({
      ticket: ticketsTable,
      username: usersTable.username,
    })
    .from(ticketsTable)
    .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
    .orderBy(desc(ticketsTable.updatedAt));

  const filtered = status && status !== "all" ? rows.filter((r: any) => r.ticket.status === status) : rows;

  res.json(
    filtered.map((r: any) => ({
      ...formatTicket(r.ticket),
      username: r.username,
    })),
  );
});

router.get("/admin/tickets/:id", requireAdmin, async (req, res) => {
  const ticketId = parseInt(req.params.id as string, 10);

  const [row] = await db
    .select({ ticket: ticketsTable, username: usersTable.username })
    .from(ticketsTable)
    .innerJoin(usersTable, eq(ticketsTable.userId, usersTable.id))
    .where(eq(ticketsTable.id, ticketId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }

  const messages = await db
    .select({
      msg: ticketMessagesTable,
      username: usersTable.username,
    })
    .from(ticketMessagesTable)
    .innerJoin(usersTable, eq(ticketMessagesTable.userId, usersTable.id))
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(ticketMessagesTable.createdAt);

  res.json({
    ...formatTicket(row.ticket, messages.length),
    username: row.username,
    messages: messages.map((m: any) => ({ ...m.msg, username: m.username })),
  });
});

router.post("/admin/tickets/:id/reply", requireAdmin, async (req, res) => {
  const adminId = (req as any).user.userId;
  const ticketId = parseInt(req.params.id as string, 10);
  const message = req.body?.message;
  if (!message || typeof message !== "string" || message.trim().length < 1) {
    res.status(400).json({ error: "Pesan tidak boleh kosong" });
    return;
  }

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }
  if (ticket.status === "closed") {
    res.status(400).json({ error: "Tiket sudah ditutup" });
    return;
  }

  const [msg] = await db
    .insert(ticketMessagesTable)
    .values({ ticketId, userId: adminId, isAdmin: true, message: message.trim() })
    .returning();

  await db
    .update(ticketsTable)
    .set({ status: "answered", updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId));

  res.status(201).json(msg);
});

router.post("/admin/tickets/:id/close", requireAdmin, async (req, res) => {
  const ticketId = parseInt(req.params.id as string, 10);
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId)).limit(1);
  if (!ticket) {
    res.status(404).json({ error: "Tiket tidak ditemukan" });
    return;
  }
  const [updated] = await db
    .update(ticketsTable)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId))
    .returning();
  res.json(formatTicket(updated));
});

export default router;

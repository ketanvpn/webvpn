import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

// ─── Simple in-memory lock to prevent overlapping tasks ──────────────────────
const runningTasks = new Set<string>();

export async function runSafely(name: string, fn: () => Promise<void>): Promise<void> {
  if (runningTasks.has(name)) {
    logger.warn(`[scheduler] ${name} still running, skipping this tick to prevent overlap`);
    return;
  }
  runningTasks.add(name);
  const start = Date.now();
  try {
    logger.info(`[scheduler] ${name} started`);
    await fn();
    logger.info(`[scheduler] ${name} completed in ${Date.now() - start}ms`);
  } catch (err) {
    logger.error({ err }, `[scheduler] ${name} failed`);
  } finally {
    runningTasks.delete(name);
  }
}

export function formatTanggal(d: Date): string {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Scheduler flag persistence (DB-backed) ─────────────────────────────────

export async function getSchedulerFlag(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSchedulerFlag(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

// ─── Alert cooldown (in-memory) ─────────────────────────────────────────────
// Cooldown: jangan spam alert yang sama berulang kali
const alertCooldowns = new Map<string, number>();
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 menit cooldown per alert

export function shouldAlert(key: string): boolean {
  const last = alertCooldowns.get(key);
  if (last && Date.now() - last < ALERT_COOLDOWN_MS) return false;
  alertCooldowns.set(key, Date.now());
  return true;
}

export async function getAdminChatIdForAlert(): Promise<string | null> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "telegramAdminChatId"))
    .limit(1);
  return row?.value ?? null;
}

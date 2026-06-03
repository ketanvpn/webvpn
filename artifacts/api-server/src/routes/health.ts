import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * Basic liveness check.
 * Used by load balancers / uptime monitors / PM2.
 * Should be fast and not depend on external services.
 */
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Readiness check — more thorough.
 * Returns 200 only if the app is ready to serve traffic (DB reachable, etc).
 * Useful for Kubernetes / advanced PM2 setups or manual checks.
 */
router.get("/readyz", async (_req, res) => {
  const checks: Record<string, unknown> = {
    database: "unknown",
    timestamp: new Date().toISOString(),
  };

  try {
    // Light DB check — must respond quickly. Using pool.query for reliability.
    await pool.query("SELECT 1");
    checks.database = "ok";
  } catch (err) {
    logger.error({ err }, "Readiness: database check failed");
    checks.database = "error";
    res.status(503).json({
      status: "not_ready",
      checks,
      error: "Database unreachable",
    });
    return;
  }

  // Optional: could add quick checks for critical settings here in the future
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    checks,
  });
});

export default router;

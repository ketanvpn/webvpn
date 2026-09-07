/**
 * Shared retry utilities for VPN fulfillment rollback operations.
 *
 * When a DB transaction fails after a VPN account was already created on the
 * panel, we need to delete that panel account to avoid orphans.
 * `deletePanelAccountWithRetry` retries up to MAX_RETRIES times with
 * exponential backoff before logging CRITICAL with full rollback context.
 */

import { deletePanelAccount } from "../vpn-panel";
import { logger } from "../logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500; // 500ms, 1s, 2s

interface RollbackTarget {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}

/**
 * Attempt to delete a panel account with exponential backoff retries.
 *
 * Returns `true` if the account was successfully deleted (or the panel
 * confirmed it didn't exist). Returns `false` if all retries were exhausted,
 * in which case a CRITICAL log is emitted with full context so the orphaned
 * account can be manually cleaned up.
 */
export async function deletePanelAccountWithRetry(
  target: RollbackTarget,
  context: { orderId: number; userId?: number; reason: string },
): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await deletePanelAccount({ ...target, bestEffort: false });
      logger.info(
        { orderId: context.orderId, username: target.username, attempt },
        `[fulfillment-rollback] Panel account deleted successfully on attempt ${attempt}`,
      );
      return true;
    } catch (err) {
      logger.warn(
        { err, orderId: context.orderId, username: target.username, attempt, maxRetries: MAX_RETRIES },
        `[fulfillment-rollback] Delete attempt ${attempt}/${MAX_RETRIES} failed`,
      );

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted — log CRITICAL with full context for manual recovery.
  // Intentionally includes protocol + username (NOT apiToken) for manual cleanup.
  logger.error(
    {
      orderId: context.orderId,
      userId: context.userId,
      reason: context.reason,
      panelUrl: target.apiUrl,
      protocol: target.protocol,
      username: target.username,
      retriesExhausted: MAX_RETRIES,
    },
    "[fulfillment-rollback] CRITICAL: Failed to delete orphaned panel account after all retries. Manual cleanup required.",
  );

  return false;
}

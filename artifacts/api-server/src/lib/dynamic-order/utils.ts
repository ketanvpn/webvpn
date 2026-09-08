// Shared utilities for dynamic order module.
// Single source of truth — imported by fulfillment.ts, sync.ts, and routes/dynamic-vpn.ts.

/**
 * Normalizes a protocol value to lowercase trimmed string.
 * e.g. " VLess " → "vless", undefined → ""
 */
export function normalizeProtocol(protocol: unknown): string {
  return String(protocol ?? "").trim().toLowerCase();
}

/**
 * Normalizes a duration type value to lowercase trimmed string.
 * e.g. " Month " → "month", undefined → ""
 */
export function normalizeDurationType(type: unknown): string {
  return String(type ?? "").trim().toLowerCase();
}

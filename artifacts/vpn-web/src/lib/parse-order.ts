import type { OrderStatus } from "@/lib/dynamic-order-policy";

export function parseOrderStatus(value: unknown): OrderStatus | null {
  if (value === "pending" || value === "processing" || value === "paid" || value === "failed" || value === "expired") {
    return value;
  }
  return null;
}

export function parseIsDynamicFlag(value: unknown): boolean {
  return typeof value === "boolean" && value === true;
}

export function extractIsDynamicFromOrder(order: unknown): boolean {
  if (typeof order !== "object" || order === null) return false;
  if (!("isDynamic" in order)) return false;
  return parseIsDynamicFlag(order.isDynamic);
}

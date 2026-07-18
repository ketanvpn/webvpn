export const DYNAMIC_DURATION_TYPES = ["day", "week", "month"] as const;

export type DynamicDurationType = (typeof DYNAMIC_DURATION_TYPES)[number];

export function isDynamicDurationType(value: string): value is DynamicDurationType {
  return DYNAMIC_DURATION_TYPES.includes(value as DynamicDurationType);
}

export function getDynamicDurationDays(type: DynamicDurationType, duration: number): number {
  switch (type) {
    case "day":
      return duration;
    case "week":
      return duration * 7;
    case "month":
      return duration * 30;
  }
}

export function getDynamicDurationUnit(type: DynamicDurationType, capitalize = false): string {
  const unit = type === "day" ? "hari" : type === "week" ? "minggu" : "bulan";
  return capitalize ? unit.charAt(0).toUpperCase() + unit.slice(1) : unit;
}

export function getDynamicDurationLabel(type: DynamicDurationType, duration: number): string {
  return `${duration} ${getDynamicDurationUnit(type, true)}`;
}

export function getDynamicSellPrice(
  server: { sellPricePerDay: string | null; sellPricePerWeek: string | null; sellPricePerMonth: string | null },
  type: DynamicDurationType,
): number {
  switch (type) {
    case "day":
      return Number(server.sellPricePerDay ?? 0);
    case "week":
      return Number(server.sellPricePerWeek ?? 0);
    case "month":
      return Number(server.sellPricePerMonth ?? 0);
  }
}

export function getDynamicCost(
  server: { costPerDay: string | null; costPerWeek: string | null; costPerMonth: string | null },
  type: string,
): number {
  switch (type) {
    case "day":
      return Number(server.costPerDay ?? 0);
    case "week":
      return Number(server.costPerWeek ?? 0);
    case "month":
      return Number(server.costPerMonth ?? 0);
    default:
      return 0;
  }
}

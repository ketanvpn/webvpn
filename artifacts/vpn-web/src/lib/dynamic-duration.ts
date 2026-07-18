export const DYNAMIC_DURATION_TYPES = ["day", "week", "month"] as const;

export type DynamicDurationType = (typeof DYNAMIC_DURATION_TYPES)[number];

export function isDynamicDurationType(value: string): value is DynamicDurationType {
  return DYNAMIC_DURATION_TYPES.includes(value as DynamicDurationType);
}

export function dynamicDurationUnit(type: string, capitalize = false): string {
  const unit = type === "day" ? "hari" : type === "week" ? "minggu" : type === "month" ? "bulan" : type;
  return capitalize ? unit.charAt(0).toUpperCase() + unit.slice(1) : unit;
}

export function dynamicDurationOptionLabel(type: DynamicDurationType): string {
  return type === "day" ? "Harian" : type === "week" ? "Mingguan" : "Bulanan";
}

export function dynamicDurationLabel(type: string, duration: number): string {
  return `${duration} ${dynamicDurationUnit(type, true)}`;
}

export function getDynamicSellPrice(
  server: { sellPricePerDay: number; sellPricePerWeek: number; sellPricePerMonth: number },
  type: DynamicDurationType,
): number {
  return type === "day" ? server.sellPricePerDay : type === "week" ? server.sellPricePerWeek : server.sellPricePerMonth;
}

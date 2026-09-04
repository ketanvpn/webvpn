export function formatRupiah(amount: number | null | undefined): string {
  const numericAmount = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

export type ExpiryLabelVariant = "default" | "short";

export function getExpiryStatus(daysLeft: number, isActive: boolean) {
  const isExpired = !isActive || daysLeft < 0;
  if (isExpired) {
    return { isExpired: true, isToday: false, label: "Kedaluwarsa", daysLeft } as const;
  }
  if (daysLeft === 0) {
    return { isExpired: false, isToday: true, label: "Kedaluwarsa hari ini", daysLeft } as const;
  }
  return { isExpired: false, isToday: false, label: `${daysLeft} hari lagi`, daysLeft } as const;
}

export function formatExpiryLabel(daysLeft: number, isActive: boolean, variant: ExpiryLabelVariant = "default"): string {
  if (!isActive || daysLeft < 0) return "Kedaluwarsa";
  if (daysLeft === 0) return variant === "short" ? "Habis hari ini" : "Kedaluwarsa hari ini";
  return `${daysLeft} hari lagi`;
}

export function getExpiryColorClass(daysLeft: number, isActive: boolean): string {
  if (!isActive || daysLeft < 0) return "text-destructive";
  if (daysLeft <= 3) return "text-destructive";
  if (daysLeft <= 7) return "text-yellow-600";
  return "text-green-600";
}

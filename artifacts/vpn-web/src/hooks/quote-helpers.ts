import { dynamicDurationLabel, getDynamicSellPrice, type DynamicDurationType } from "@/lib/dynamic-duration";
import type { DynamicServer, Quote } from "@/components/dynamic-order/types";

export function computeLocalQuote(
  server: DynamicServer,
  durationType: DynamicDurationType,
  durationNum: number
): Quote | null {
  if (!server || !durationNum || durationNum < 1) return null;
  const unitPrice = getDynamicSellPrice(server, durationType);
  const baseAmount = unitPrice * durationNum;
  return {
    unitPrice,
    baseAmount,
    amount: baseAmount,
    durationLabel: dynamicDurationLabel(durationType, durationNum),
    resellerDiscountAmount: 0,
    voucherDiscountAmount: 0,
    discountAmount: 0,
    voucherCode: null,
  };
}

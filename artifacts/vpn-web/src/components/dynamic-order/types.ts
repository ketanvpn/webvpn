import type { DynamicDurationType } from "@/lib/dynamic-duration";

export type DynamicServer = {
  readonly id: number;
  readonly provider: string;
  readonly displayName: string;
  readonly location: string | null;
  readonly enabledProtocols: readonly string[];
  readonly supportedTypes: readonly DynamicDurationType[];
  readonly sellPricePerDay: number;
  readonly sellPricePerWeek: number;
  readonly sellPricePerMonth: number;
  readonly minDays: number;
  readonly maxDays: number;
  readonly minMonths: number;
  readonly maxMonths: number;
  readonly capacityLimit: string | null;
  readonly capacityUsed: number;
  readonly capacityIsFull: boolean;
  readonly maxConnections: number;
  readonly isCloudfrontCapable?: boolean;
};

export type Quote = {
  readonly unitPrice: number;
  readonly baseAmount: number;
  readonly amount: number;
  readonly durationLabel: string;
  readonly resellerDiscountAmount: number;
  readonly voucherDiscountAmount: number;
  readonly discountAmount: number;
  readonly voucherCode: string | null;
};

export type OrderFormData = {
  readonly serverId: number;
  readonly protocol: string;
  readonly durationType: DynamicDurationType;
  readonly duration: number;
  readonly username: string;
  readonly password: string;
  readonly voucherCode: string | null;
};

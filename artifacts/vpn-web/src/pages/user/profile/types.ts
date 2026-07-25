export type ResellerStatus = {
  resellerEnabled: boolean;
  discountPercent: number;
  targetEnabled: boolean;
  monthlyTarget: number;
  currentMonthSales: number;
  progressPercent: number | null;
  currentMonth: string;
};

export type PromoData = {
  promoEnabled: boolean;
  promoTitle: string;
  promoText: string;
  requestEnabled: boolean;
  discountPercent: number;
  autoUpgradeEnabled: boolean;
  autoUpgradeMinTopup: number;
  targetEnabled: boolean;
  monthlyTarget: number;
};

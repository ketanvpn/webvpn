import { creditedTopupAmount } from "./settlement-policy";

export interface ManualTopupPaymentAmounts {
  paymentChannel?: string | null;
  amount: string | number;
  payableAmount?: string | number | null;
}

export const manualTopupCredit = (
  topup: ManualTopupPaymentAmounts,
): number => {
  const baseAmount = Number(topup.amount);
  const payableAmount = Number(topup.payableAmount ?? topup.amount);
  return creditedTopupAmount(
    topup.paymentChannel ?? "legacy",
    baseAmount,
    payableAmount,
  );
};

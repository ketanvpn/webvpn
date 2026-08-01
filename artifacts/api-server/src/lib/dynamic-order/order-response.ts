export type DynamicOrderUserResponseInput = {
  readonly amount: string;
  readonly discountAmount: string | null;
  readonly password: string | null;
  readonly providerResponse: Record<string, unknown> | null;
};

export const formatDynamicOrderForUser = <
  T extends DynamicOrderUserResponseInput,
>(
  order: T,
): Omit<T, "amount" | "discountAmount" | "password" | "providerResponse"> & {
  readonly amount: number;
  readonly discountAmount: number;
} => {
  const { amount, discountAmount, password: _password, providerResponse: _providerResponse, ...safeOrder } = order;
  return {
    ...safeOrder,
    amount: Number(amount),
    discountAmount: Number(discountAmount ?? 0),
  };
};

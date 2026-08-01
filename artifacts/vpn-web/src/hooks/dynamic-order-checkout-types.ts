import type { DynamicDurationType } from "@/lib/dynamic-duration";
import type { CheckoutRequirement } from "@/lib/dynamic-order-policy";
import type { DynamicServer, Quote } from "@/components/dynamic-order/types";

export type DynamicOrderState = {
  readonly selectedServer: DynamicServer | null;
  readonly protocol: string;
  readonly durationType: DynamicDurationType;
  readonly duration: string;
  readonly username: string;
  readonly password: string;
  readonly voucherInput: string;
  readonly appliedVoucher: string;
  readonly voucherError: string;
  readonly paidOrderId: number | null;
  readonly payConfirmOpen: boolean;
};

export type DynamicOrderActions = {
  readonly openOrder: (server: DynamicServer) => void;
  readonly closeOrder: () => void;
  readonly setProtocol: (value: string) => void;
  readonly setDurationType: (value: DynamicDurationType) => void;
  readonly setDuration: (value: string) => void;
  readonly setUsername: (value: string) => void;
  readonly setPassword: (value: string) => void;
  readonly setVoucherInput: (value: string) => void;
  readonly applyVoucher: () => void;
  readonly removeVoucher: () => void;
  readonly openPayConfirm: () => void;
  readonly closePayConfirm: () => void;
  readonly submitOrder: () => void;
};

export type DynamicOrderData = {
  readonly servers: readonly DynamicServer[];
  readonly serversLoading: boolean;
  readonly quote: Quote | null;
  readonly quoteFetching: boolean;
  readonly balance: number;
  readonly unmetRequirements: readonly CheckoutRequirement[];
  readonly isSubmitting: boolean;
  readonly durationNum: number;
};

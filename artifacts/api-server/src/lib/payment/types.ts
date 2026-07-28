export const PAYMENT_CHANNELS = [
  "ketantechpay",
  "autogopay_gopay",
  "autogopay_shopeepay",
] as const;

export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];
export type PaymentProvider = "ketantechpay" | "autogopay";
export type PaymentProviderErrorCategory =
  | "definitive"
  | "configuration"
  | "ambiguous";

export type PaymentFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface PaymentCustomer {
  name?: string;
  email?: string;
}

export interface CreatePaymentInput {
  /** Stable application reference. Reuse it when retrying the same payment. */
  localReference: string;
  /** Stable idempotency key. Reuse it when retrying the same payment. */
  idempotencyKey: string;
  baseAmount: number;
  /** ShopeePay total after applying a unique code, if allocated by the caller. */
  payableAmount?: number;
  /** ShopeePay unique amount suffix, if allocated by the caller. */
  uniqueCode?: number;
  customer?: PaymentCustomer;
  description?: string;
  signal?: AbortSignal;
}

export interface NormalizedPayment {
  transactionId?: string;
  qrisUrl: string;
  qrString?: string;
  checkoutUrl?: string;
  expiry: Date;
  provider: PaymentProvider;
  channel: PaymentChannel;
  baseAmount: number;
  payableAmount: number;
  uniqueCode: number;
}

export interface PaymentStatus {
  transactionId?: string;
  status: string;
  paid: boolean;
  amount?: number;
  provider: PaymentProvider;
  channel: PaymentChannel;
}

export interface PaymentCancellation {
  transactionId?: string;
  status: string;
  cancelled: boolean;
  provider: PaymentProvider;
  channel: PaymentChannel;
}

export interface PaymentAdapter {
  readonly provider: PaymentProvider;
  readonly channel: PaymentChannel;
  create(input: CreatePaymentInput): Promise<NormalizedPayment>;
}

export interface PaymentRuntimeOptions {
  fetch?: PaymentFetch;
  now?: () => Date;
}

import type {
  PaymentChannel,
  PaymentProvider,
  PaymentProviderErrorCategory,
} from "./types";

export interface PaymentProviderErrorOptions {
  category: PaymentProviderErrorCategory;
  provider?: PaymentProvider;
  channel?: PaymentChannel;
  code?: string;
  status?: number;
  cause?: unknown;
}

export class PaymentProviderError extends Error {
  readonly category: PaymentProviderErrorCategory;
  readonly provider?: PaymentProvider;
  readonly channel?: PaymentChannel;
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, options: PaymentProviderErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "PaymentProviderError";
    this.category = options.category;
    this.provider = options.provider;
    this.channel = options.channel;
    this.code = options.code;
    this.status = options.status;
  }
}

export const isPaymentProviderError = (
  error: unknown,
): error is PaymentProviderError => error instanceof PaymentProviderError;

export const canFallbackFromPaymentError = (error: unknown): boolean =>
  error instanceof PaymentProviderError &&
  (error.category === "definitive" || error.category === "configuration");

export const configurationError = (
  message: string,
  options: Omit<PaymentProviderErrorOptions, "category"> = {},
): PaymentProviderError =>
  new PaymentProviderError(message, { ...options, category: "configuration" });

export const definitiveError = (
  message: string,
  options: Omit<PaymentProviderErrorOptions, "category"> = {},
): PaymentProviderError =>
  new PaymentProviderError(message, { ...options, category: "definitive" });

export const ambiguousError = (
  message: string,
  options: Omit<PaymentProviderErrorOptions, "category"> = {},
): PaymentProviderError =>
  new PaymentProviderError(message, { ...options, category: "ambiguous" });

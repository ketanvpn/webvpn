import { createAutoGoPayGoPayAdapter } from "./autogopay-gopay";
import { createAutoGoPayShopeePayAdapter } from "./autogopay-shopeepay";
import { canFallbackFromPaymentError, configurationError } from "./errors";
import { createKetantechPayAdapter } from "./ketantechpay";
import { parsePaymentSettings, type PaymentSettingsSource } from "./settings";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentAdapter,
  PaymentChannel,
  PaymentRuntimeOptions,
} from "./types";

export interface PaymentOrchestrator {
  readonly channelOrder: readonly PaymentChannel[];
  create(input: CreatePaymentInput): Promise<NormalizedPayment>;
}

export interface PaymentAttemptLifecycleContext {
  channel: PaymentChannel;
  adapter: PaymentAdapter;
  input: CreatePaymentInput;
}

export interface PaymentAttemptFailureContext
  extends PaymentAttemptLifecycleContext {
  error: unknown;
  willFallback: boolean;
}

export interface PaymentOrchestratorLifecycle {
  /** Runs only when the channel is next in line to be attempted. */
  prepareInput?(
    context: PaymentAttemptLifecycleContext,
  ): Promise<CreatePaymentInput> | CreatePaymentInput;
  succeeded?(
    context: PaymentAttemptLifecycleContext & { payment: NormalizedPayment },
  ): Promise<void> | void;
  failed?(context: PaymentAttemptFailureContext): Promise<void> | void;
}

export interface PaymentOrchestratorOptions extends PaymentRuntimeOptions {
  adapters?: Partial<Record<PaymentChannel, PaymentAdapter>>;
  lifecycle?: PaymentOrchestratorLifecycle;
}

const validateStableInput = (input: CreatePaymentInput): void => {
  if (!input.localReference.trim()) {
    throw configurationError("localReference is required", {
      code: "missing_local_reference",
    });
  }
  if (!input.idempotencyKey.trim()) {
    throw configurationError("idempotencyKey is required", {
      code: "missing_idempotency_key",
    });
  }
};

export const createPaymentOrchestrator = (
  source: PaymentSettingsSource,
  options: PaymentOrchestratorOptions = {},
): PaymentOrchestrator => {
  const settings = parsePaymentSettings(source);
  const adapters: Record<PaymentChannel, PaymentAdapter> = {
    ketantechpay: createKetantechPayAdapter(
      {
        ...settings.ketantechpay,
        timeoutMs: settings.timeoutMs,
        expiryMinutes: settings.expiryMinutes,
      },
      options,
    ),
    autogopay_gopay: createAutoGoPayGoPayAdapter(
      {
        ...settings.autoGopayGoPay,
        timeoutMs: settings.timeoutMs,
        expiryMinutes: settings.expiryMinutes,
      },
      options,
    ),
    autogopay_shopeepay: createAutoGoPayShopeePayAdapter(
      {
        ...settings.autoGopayShopeePay,
        timeoutMs: settings.timeoutMs,
        expiryMinutes: settings.expiryMinutes,
      },
      options,
    ),
    ...options.adapters,
  };

  return {
    channelOrder: settings.channelOrder,
    async create(input: CreatePaymentInput): Promise<NormalizedPayment> {
      validateStableInput(input);
      if (settings.channelOrder.length === 0) {
        throw configurationError("No payment channel is configured", {
          code: "no_payment_channel",
        });
      }

      let lastFallbackError: unknown;
      for (const [index, channel] of settings.channelOrder.entries()) {
        const adapter = adapters[channel];
        let channelInput = input;
        try {
          channelInput =
            (await options.lifecycle?.prepareInput?.({
              channel,
              adapter,
              input,
            })) ?? input;
        } catch (error) {
          const willFallback =
            settings.fallbackEnabled &&
            index < settings.channelOrder.length - 1 &&
            canFallbackFromPaymentError(error);
          if (!willFallback) throw error;
          lastFallbackError = error;
          continue;
        }

        let payment: NormalizedPayment;
        try {
          payment = await adapter.create(channelInput);
        } catch (error) {
          const willFallback =
            settings.fallbackEnabled &&
            index < settings.channelOrder.length - 1 &&
            canFallbackFromPaymentError(error);
          await options.lifecycle?.failed?.({
            channel,
            adapter,
            input: channelInput,
            error,
            willFallback,
          });
          if (!willFallback) throw error;
          lastFallbackError = error;
          continue;
        }

        await options.lifecycle?.succeeded?.({
          channel,
          adapter,
          input: channelInput,
          payment,
        });
        return payment;
      }

      if (lastFallbackError !== undefined) throw lastFallbackError;
      throw configurationError("No payment adapter is available", {
        code: "no_payment_adapter",
      });
    },
  };
};

export const orchestratePayment = async (
  source: PaymentSettingsSource,
  input: CreatePaymentInput,
  options: PaymentOrchestratorOptions = {},
): Promise<NormalizedPayment> =>
  createPaymentOrchestrator(source, options).create(input);

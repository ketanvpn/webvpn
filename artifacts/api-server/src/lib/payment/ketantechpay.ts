import { ambiguousError, configurationError, definitiveError } from "./errors";
import {
  ensureNonEmpty,
  ensurePositiveAmount,
  firstRecord,
  firstString,
  parseProviderDate,
  requestPaymentJson,
} from "./http";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentAdapter,
  PaymentRuntimeOptions,
} from "./types";

export interface KetantechPayAdapterSettings {
  enabled?: boolean;
  baseUrl?: string;
  clientKey?: string;
  timeoutMs: number;
  expiryMinutes: number;
}

const PROVIDER = "ketantechpay" as const;
const CHANNEL = "ketantechpay" as const;

export const createKetantechPayAdapter = (
  settings: KetantechPayAdapterSettings,
  runtime: PaymentRuntimeOptions = {},
): PaymentAdapter => {
  const fetchImplementation = runtime.fetch ?? globalThis.fetch;
  const now = runtime.now ?? (() => new Date());

  return {
    provider: PROVIDER,
    channel: CHANNEL,
    async create(input: CreatePaymentInput): Promise<NormalizedPayment> {
      if (settings.enabled === false) {
        throw configurationError("KetantechPay channel is disabled", {
          provider: PROVIDER,
          channel: CHANNEL,
          code: "channel_disabled",
        });
      }
      if (!settings.baseUrl) {
        throw configurationError("KetantechPay base URL is required", {
          provider: PROVIDER,
          channel: CHANNEL,
          code: "missing_base_url",
        });
      }
      ensureNonEmpty(
        input.localReference,
        "local_reference",
        PROVIDER,
        CHANNEL,
      );
      ensureNonEmpty(
        input.idempotencyKey,
        "idempotency_key",
        PROVIDER,
        CHANNEL,
      );
      ensurePositiveAmount(input.baseAmount, PROVIDER, CHANNEL, "baseAmount");

      const headers: Record<string, string> = {
        "Idempotency-Key": input.idempotencyKey,
      };
      if (settings.clientKey) {
        // Both names are supported by deployed KetantechPay versions.
        headers["X-Client-Key"] = settings.clientKey;
        headers["x-api-key"] = settings.clientKey;
      }

      const response = await requestPaymentJson({
        fetch: fetchImplementation,
        provider: PROVIDER,
        channel: CHANNEL,
        baseUrl: settings.baseUrl,
        path: "/api/v1/payments/charge",
        headers,
        body: {
          orderId: input.localReference,
          amount: input.baseAmount,
          currency: "IDR",
          method: "qris",
          customer: {
            name: input.customer?.name ?? "WebVPN User",
            email: input.customer?.email ?? "webvpn@local.invalid",
          },
          description: input.description ?? "WebVPN QRIS payment",
        },
        timeoutMs: settings.timeoutMs,
        signal: input.signal,
        operation: "KetantechPay charge",
      });

      if (
        response.success === false &&
        firstRecord(response.data, response.payment) === undefined
      ) {
        throw definitiveError("KetantechPay charge was rejected", {
          provider: PROVIDER,
          channel: CHANNEL,
          code: "charge_rejected",
        });
      }

      const data = firstRecord(response.data, response.payment, response);
      const transactionId = firstString(
        data?.id,
        data?.transactionId,
        data?.transaction_id,
        data?.paymentId,
      );
      const qrisUrl = firstString(
        data?.paymentUrl,
        data?.payment_url,
        data?.qrisUrl,
        data?.qris_url,
        data?.qrUrl,
        data?.qr_url,
      );
      if (!qrisUrl) {
        throw ambiguousError(
          "KetantechPay charge succeeded without a payment URL",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "missing_payment_url",
          },
        );
      }

      const expiry =
        parseProviderDate(
          data?.expiresAt ??
            data?.expires_at ??
            data?.expiryTime ??
            data?.expiry_time,
        ) ?? new Date(now().getTime() + settings.expiryMinutes * 60_000);

      return {
        transactionId,
        qrisUrl,
        qrString: firstString(data?.qrString, data?.qr_string, data?.qrContent),
        checkoutUrl: firstString(
          data?.checkoutUrl,
          data?.checkout_url,
          data?.paymentUrl,
        ),
        expiry,
        provider: PROVIDER,
        channel: CHANNEL,
        baseAmount: input.baseAmount,
        payableAmount: input.baseAmount,
        uniqueCode: 0,
      };
    },
  };
};

export const createKetantechpayAdapter = createKetantechPayAdapter;

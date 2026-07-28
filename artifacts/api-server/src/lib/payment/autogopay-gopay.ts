import { ambiguousError, configurationError, definitiveError } from "./errors";
import {
  ensureNonEmpty,
  ensurePositiveAmount,
  firstBoolean,
  firstNumber,
  firstRecord,
  firstString,
  parseProviderDate,
  requestPaymentJson,
} from "./http";
import { isPaidStatus } from "./helpers";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentAdapter,
  PaymentCancellation,
  PaymentRuntimeOptions,
  PaymentStatus,
} from "./types";

export interface AutoGoPayGoPayAdapterSettings {
  enabled?: boolean;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  expiryMinutes: number;
}

export interface AutoGoPayGoPayAdapter extends PaymentAdapter {
  status(transactionId: string, signal?: AbortSignal): Promise<PaymentStatus>;
  cancel(
    transactionId: string,
    signal?: AbortSignal,
  ): Promise<PaymentCancellation>;
}

const PROVIDER = "autogopay" as const;
const CHANNEL = "autogopay_gopay" as const;

const authorizationHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
});

export const createAutoGoPayGoPayAdapter = (
  settings: AutoGoPayGoPayAdapterSettings,
  runtime: PaymentRuntimeOptions = {},
): AutoGoPayGoPayAdapter => {
  const fetchImplementation = runtime.fetch ?? globalThis.fetch;
  const now = runtime.now ?? (() => new Date());

  const configuredApiKey = (): string => {
    if (settings.enabled === false) {
      throw configurationError("AutoGoPay GoPay channel is disabled", {
        provider: PROVIDER,
        channel: CHANNEL,
        code: "channel_disabled",
      });
    }
    if (!settings.apiKey) {
      throw configurationError("AutoGoPay GoPay API key is required", {
        provider: PROVIDER,
        channel: CHANNEL,
        code: "missing_api_key",
      });
    }
    return settings.apiKey;
  };

  return {
    provider: PROVIDER,
    channel: CHANNEL,
    async create(input: CreatePaymentInput): Promise<NormalizedPayment> {
      const apiKey = configuredApiKey();
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

      const response = await requestPaymentJson({
        fetch: fetchImplementation,
        provider: PROVIDER,
        channel: CHANNEL,
        baseUrl: settings.baseUrl,
        path: "/qris/generate",
        headers: {
          ...authorizationHeaders(apiKey),
          "Idempotency-Key": input.idempotencyKey,
          "X-Merchant-Reference": input.localReference,
        },
        body: { amount: input.baseAmount },
        timeoutMs: settings.timeoutMs,
        signal: input.signal,
        operation: "AutoGoPay GoPay QRIS generation",
      });

      if (
        firstBoolean(response.success) === false &&
        firstRecord(response.data, response.transaction) === undefined
      ) {
        throw definitiveError("AutoGoPay GoPay QRIS generation was rejected", {
          provider: PROVIDER,
          channel: CHANNEL,
          code: "generation_rejected",
        });
      }

      const data = firstRecord(response.data, response.transaction, response);
      const transactionId = firstString(
        data?.transaction_id,
        data?.transactionId,
        data?.id,
      );
      const qrisUrl = firstString(
        data?.qr_url,
        data?.qrUrl,
        data?.qris_url,
        data?.qrisUrl,
      );
      if (!qrisUrl) {
        throw ambiguousError(
          "AutoGoPay GoPay created a transaction without a QRIS URL",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "missing_qris_url",
          },
        );
      }

      return {
        transactionId,
        qrisUrl,
        qrString: firstString(
          data?.qr_string,
          data?.qrString,
          data?.qr_content,
        ),
        checkoutUrl: firstString(data?.checkout_url, data?.checkoutUrl),
        expiry:
          parseProviderDate(
            data?.expiry_time ??
              data?.expiryTime ??
              data?.expires_at ??
              data?.expiresAt,
          ) ?? new Date(now().getTime() + settings.expiryMinutes * 60_000),
        provider: PROVIDER,
        channel: CHANNEL,
        baseAmount: input.baseAmount,
        payableAmount: input.baseAmount,
        uniqueCode: 0,
      };
    },
    async status(
      transactionId: string,
      signal?: AbortSignal,
    ): Promise<PaymentStatus> {
      const apiKey = configuredApiKey();
      ensureNonEmpty(transactionId, "transaction_id", PROVIDER, CHANNEL);
      const response = await requestPaymentJson({
        fetch: fetchImplementation,
        provider: PROVIDER,
        channel: CHANNEL,
        baseUrl: settings.baseUrl,
        path: "/qris/status",
        headers: authorizationHeaders(apiKey),
        body: { transaction_id: transactionId },
        timeoutMs: settings.timeoutMs,
        signal,
        operation: "AutoGoPay GoPay status lookup",
      });
      const data = firstRecord(response.data, response.transaction, response);
      const status =
        firstString(
          data?.transaction_status,
          data?.transactionStatus,
          data?.status,
        ) ?? "unknown";
      return {
        transactionId:
          firstString(data?.transaction_id, data?.transactionId, data?.id) ??
          transactionId,
        status,
        paid: isPaidStatus(status),
        amount: firstNumber(data?.amount, data?.gross_amount),
        provider: PROVIDER,
        channel: CHANNEL,
      };
    },
    async cancel(
      transactionId: string,
      signal?: AbortSignal,
    ): Promise<PaymentCancellation> {
      const apiKey = configuredApiKey();
      ensureNonEmpty(transactionId, "transaction_id", PROVIDER, CHANNEL);
      const response = await requestPaymentJson({
        fetch: fetchImplementation,
        provider: PROVIDER,
        channel: CHANNEL,
        baseUrl: settings.baseUrl,
        path: "/qris/cancel",
        headers: authorizationHeaders(apiKey),
        body: { transaction_id: transactionId },
        timeoutMs: settings.timeoutMs,
        signal,
        operation: "AutoGoPay GoPay cancellation",
      });
      const data = firstRecord(response.data, response.transaction, response);
      const status =
        firstString(
          data?.transaction_status,
          data?.transactionStatus,
          data?.status,
        ) ?? (firstBoolean(response.success) ? "cancel" : "unknown");
      return {
        transactionId:
          firstString(data?.transaction_id, data?.transactionId, data?.id) ??
          transactionId,
        status,
        cancelled: ["cancel", "cancelled", "canceled"].includes(
          status.toLowerCase(),
        ),
        provider: PROVIDER,
        channel: CHANNEL,
      };
    },
  };
};

export const createAutogopayGoPayAdapter = createAutoGoPayGoPayAdapter;

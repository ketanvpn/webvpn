import { ambiguousError, configurationError, definitiveError } from "./errors";
import {
  asArray,
  ensureNonEmpty,
  ensurePositiveAmount,
  firstBoolean,
  firstNumber,
  firstRecord,
  firstString,
  parseProviderDate,
  requestPaymentJson,
  type JsonRecord,
} from "./http";
import { isPaidStatus, type ShopeeTransactionLike } from "./helpers";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentAdapter,
  PaymentRuntimeOptions,
  PaymentStatus,
} from "./types";

export interface AutoGoPayShopeePayAdapterSettings {
  enabled?: boolean;
  baseUrl: string;
  apiKey?: string;
  /** Raw merchant QRIS read from settings; never include it in logs/errors. */
  staticQrString?: string;
  timeoutMs: number;
  expiryMinutes: number;
}

export interface ShopeePayProviderStatus {
  available: boolean;
  status: string;
}

export interface AutoGoPayShopeePayAdapter extends PaymentAdapter {
  providerStatus(signal?: AbortSignal): Promise<ShopeePayProviderStatus>;
  status(signal?: AbortSignal): Promise<ShopeePayProviderStatus>;
  transactions(signal?: AbortSignal): Promise<ShopeeTransactionLike[]>;
  transactionStatus(
    transactionId: string,
    signal?: AbortSignal,
  ): Promise<PaymentStatus>;
}

const PROVIDER = "autogopay" as const;
const CHANNEL = "autogopay_shopeepay" as const;

const transactionRows = (response: JsonRecord): ShopeeTransactionLike[] => {
  const data = firstRecord(response.data);
  const rows = Array.isArray(response.data)
    ? response.data
    : (asArray(
        data?.transactions ??
          data?.items ??
          data?.records ??
          response.transactions ??
          response.items ??
          response.records,
      ) ?? []);
  return rows
    .map((row) => firstRecord(row))
    .filter((row): row is JsonRecord => row !== undefined);
};

export const createAutoGoPayShopeePayAdapter = (
  settings: AutoGoPayShopeePayAdapterSettings,
  runtime: PaymentRuntimeOptions = {},
): AutoGoPayShopeePayAdapter => {
  const fetchImplementation = runtime.fetch ?? globalThis.fetch;
  const now = runtime.now ?? (() => new Date());

  const configuredApiKey = (): string => {
    if (settings.enabled === false) {
      throw configurationError("AutoGoPay ShopeePay channel is disabled", {
        provider: PROVIDER,
        channel: CHANNEL,
        code: "channel_disabled",
      });
    }
    if (!settings.apiKey) {
      throw configurationError("AutoGoPay ShopeePay API key is required", {
        provider: PROVIDER,
        channel: CHANNEL,
        code: "missing_api_key",
      });
    }
    return settings.apiKey;
  };

  const headers = (apiKey: string): Record<string, string> => ({
    Authorization: `Bearer ${apiKey}`,
  });

  const getProviderStatus = async (
    signal?: AbortSignal,
  ): Promise<ShopeePayProviderStatus> => {
    const apiKey = configuredApiKey();
    const response = await requestPaymentJson({
      fetch: fetchImplementation,
      provider: PROVIDER,
      channel: CHANNEL,
      baseUrl: settings.baseUrl,
      path: "/shopeepay/status",
      method: "GET",
      headers: headers(apiKey),
      timeoutMs: settings.timeoutMs,
      signal,
      operation: "AutoGoPay ShopeePay availability lookup",
    });
    const data = firstRecord(response.data, response.shopeepay, response);
    const status =
      firstString(
        data?.status,
        data?.service_status,
        data?.account_status,
        firstBoolean(data?.available, data?.active, response.success)
          ? "available"
          : undefined,
      ) ?? "unknown";
    const available =
      firstBoolean(data?.available, data?.active, data?.enabled) ??
      [
        "available",
        "active",
        "ready",
        "online",
        "connected",
        "success",
      ].includes(status.toLowerCase());
    return { available, status };
  };

  const getTransactions = async (
    signal?: AbortSignal,
  ): Promise<ShopeeTransactionLike[]> => {
    const apiKey = configuredApiKey();
    const response = await requestPaymentJson({
      fetch: fetchImplementation,
      provider: PROVIDER,
      channel: CHANNEL,
      baseUrl: settings.baseUrl,
      path: "/shopeepay/transactions",
      method: "GET",
      headers: headers(apiKey),
      timeoutMs: settings.timeoutMs,
      signal,
      operation: "AutoGoPay ShopeePay transaction lookup",
    });
    return transactionRows(response);
  };

  return {
    provider: PROVIDER,
    channel: CHANNEL,
    providerStatus: getProviderStatus,
    status: getProviderStatus,
    transactions: getTransactions,
    async transactionStatus(
      transactionId: string,
      signal?: AbortSignal,
    ): Promise<PaymentStatus> {
      ensureNonEmpty(transactionId, "transaction_id", PROVIDER, CHANNEL);
      const transactions = await getTransactions(signal);
      const transaction = transactions.find(
        (candidate) =>
          firstString(
            candidate.transactionId,
            candidate.transaction_id,
            candidate.id,
          ) === transactionId,
      );
      if (!transaction) {
        return {
          transactionId,
          status: "not_found",
          paid: false,
          provider: PROVIDER,
          channel: CHANNEL,
        };
      }
      const status =
        firstString(
          transaction.transaction_status,
          transaction.payment_status,
          transaction.status,
        ) ?? "unknown";
      return {
        transactionId,
        status,
        paid: isPaidStatus(status),
        amount: firstNumber(
          transaction.payableAmount,
          transaction.payable_amount,
          transaction.totalAmount,
          transaction.total_amount,
          transaction.amount,
        ),
        provider: PROVIDER,
        channel: CHANNEL,
      };
    },
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

      const uniqueCode =
        input.uniqueCode ??
        (input.payableAmount === undefined
          ? 0
          : input.payableAmount - input.baseAmount);
      const payableAmount =
        input.payableAmount ?? input.baseAmount + uniqueCode;
      ensurePositiveAmount(payableAmount, PROVIDER, CHANNEL, "payableAmount");
      if (!Number.isInteger(uniqueCode) || uniqueCode < 0) {
        throw configurationError("uniqueCode must be a non-negative integer", {
          provider: PROVIDER,
          channel: CHANNEL,
          code: "invalid_unique_code",
        });
      }
      if (payableAmount !== input.baseAmount + uniqueCode) {
        throw configurationError(
          "payableAmount must equal baseAmount plus uniqueCode",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "amount_unique_code_mismatch",
          },
        );
      }

      const response = await requestPaymentJson({
        fetch: fetchImplementation,
        provider: PROVIDER,
        channel: CHANNEL,
        baseUrl: settings.baseUrl,
        path: "/shopeepay/qris/create",
        headers: {
          ...headers(apiKey),
          "Idempotency-Key": input.idempotencyKey,
          "X-Merchant-Reference": input.localReference,
        },
        body: {
          amount: payableAmount,
          base_amount: input.baseAmount,
          payable_amount: payableAmount,
          unique_code: uniqueCode,
          reference: input.localReference,
          idempotency_key: input.idempotencyKey,
          ...(settings.staticQrString
            ? {
                qr_string: settings.staticQrString,
                qris_static: settings.staticQrString,
              }
            : {}),
        },
        timeoutMs: settings.timeoutMs,
        signal: input.signal,
        operation: "AutoGoPay ShopeePay QRIS creation",
      });

      if (
        firstBoolean(response.success) === false &&
        firstRecord(response.data, response.transaction) === undefined
      ) {
        throw definitiveError(
          "AutoGoPay ShopeePay QRIS creation was rejected",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "creation_rejected",
          },
        );
      }

      const data = firstRecord(response.data, response.transaction, response);
      const transactionId = firstString(
        data?.transaction_id,
        data?.transactionId,
        data?.id,
      );
      const qrString = firstString(
        data?.qr_string,
        data?.qrString,
        data?.qr_content,
        data?.qris_string,
        data?.qrisString,
      );
      const checkoutUrl = firstString(
        data?.checkout_url,
        data?.checkoutUrl,
        data?.deeplink,
        data?.deep_link,
      );
      // Keep checkout/deep links separate. Customer UIs render qrisUrl as an
      // image, so only documented QR image fields are valid here.
      const qrisUrl = firstString(
        data?.qr_url,
        data?.qrUrl,
        data?.qris_url,
        data?.qrisUrl,
      );
      if (!qrisUrl) {
        throw ambiguousError(
          "AutoGoPay ShopeePay created a transaction without a QRIS URL",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "missing_qris_url",
          },
        );
      }

      const responseBaseAmount = firstNumber(
        data?.base_amount,
        data?.baseAmount,
      );
      const responsePayableAmount = firstNumber(
        data?.payable_amount,
        data?.payableAmount,
        data?.total_amount,
        data?.totalAmount,
      );
      const responseUniqueCode = firstNumber(
        data?.unique_code,
        data?.uniqueCode,
      );
      if (
        responseBaseAmount !== undefined &&
        responseBaseAmount !== input.baseAmount
      ) {
        throw ambiguousError(
          "AutoGoPay ShopeePay returned an unexpected base amount",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "base_amount_mismatch",
          },
        );
      }
      if (
        responsePayableAmount !== undefined &&
        responsePayableAmount !== payableAmount
      ) {
        throw ambiguousError(
          "AutoGoPay ShopeePay returned an unexpected payable amount",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "payable_amount_mismatch",
          },
        );
      }
      if (
        responseUniqueCode !== undefined &&
        responseUniqueCode !== uniqueCode
      ) {
        throw ambiguousError(
          "AutoGoPay ShopeePay returned an unexpected unique code",
          {
            provider: PROVIDER,
            channel: CHANNEL,
            code: "unique_code_mismatch",
          },
        );
      }

      return {
        transactionId,
        qrisUrl,
        qrString,
        checkoutUrl,
        expiry:
          parseProviderDate(
            data?.expiry_time ??
              data?.expiryTime ??
              data?.expires_at ??
              data?.expiresAt,
          ) ?? new Date(now().getTime() + settings.expiryMinutes * 60_000),
        provider: PROVIDER,
        channel: CHANNEL,
        baseAmount: responseBaseAmount ?? input.baseAmount,
        payableAmount,
        uniqueCode,
      };
    },
  };
};

export const createAutogopayShopeePayAdapter = createAutoGoPayShopeePayAdapter;

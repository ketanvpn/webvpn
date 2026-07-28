import {
  ambiguousError,
  configurationError,
  definitiveError,
  PaymentProviderError,
} from "./errors";
import type { PaymentChannel, PaymentFetch, PaymentProvider } from "./types";

export type JsonRecord = Record<string, unknown>;

interface PaymentJsonRequest {
  fetch: PaymentFetch;
  provider: PaymentProvider;
  channel: PaymentChannel;
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: JsonRecord;
  timeoutMs: number;
  signal?: AbortSignal;
  operation: string;
}

export const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;

export const asArray = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

export const firstRecord = (...values: unknown[]): JsonRecord | undefined => {
  for (const value of values) {
    const record = asRecord(value);
    if (record) return record;
  }
  return undefined;
};

export const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return undefined;
};

export const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

export const firstBoolean = (...values: unknown[]): boolean | undefined => {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return undefined;
};

export const parseProviderDate = (value: unknown): Date | undefined => {
  const raw = firstString(value);
  if (!raw) return undefined;
  const normalized =
    raw.includes("T") || /(?:Z|[+-]\d{2}:?\d{2})$/u.test(raw)
      ? raw
      : raw.replace(" ", "T") + "+07:00";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const ensurePositiveAmount = (
  amount: number,
  provider: PaymentProvider,
  channel: PaymentChannel,
  field = "amount",
): void => {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw configurationError(`${field} must be a positive integer`, {
      provider,
      channel,
      code: "invalid_amount",
    });
  }
};

export const ensureNonEmpty = (
  value: string,
  field: string,
  provider: PaymentProvider,
  channel: PaymentChannel,
): void => {
  if (!value.trim()) {
    throw configurationError(`${field} is required`, {
      provider,
      channel,
      code: `missing_${field}`,
    });
  }
};

const errorForHttpStatus = (
  status: number,
  provider: PaymentProvider,
  channel: PaymentChannel,
  operation: string,
): PaymentProviderError => {
  const options = {
    provider,
    channel,
    status,
    code: `http_${status}`,
  } as const;

  if ([401, 403, 404, 405, 407].includes(status)) {
    return configurationError(
      `${operation} is not configured correctly`,
      options,
    );
  }
  if (
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 425 &&
    status !== 429
  ) {
    return definitiveError(`${operation} was rejected`, options);
  }
  return ambiguousError(`${operation} outcome is unknown`, options);
};

const validatedUrl = (
  baseUrl: string,
  path: string,
  provider: PaymentProvider,
  channel: PaymentChannel,
): string => {
  try {
    const url = new URL(path, `${baseUrl.replace(/\/+$/u, "")}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("protocol");
    return url.toString();
  } catch (cause) {
    throw configurationError("Payment provider base URL is invalid", {
      provider,
      channel,
      code: "invalid_base_url",
      cause,
    });
  }
};

/** Native-fetch JSON request with one timeout/error policy for every provider. */
export const requestPaymentJson = async (
  request: PaymentJsonRequest,
): Promise<JsonRecord> => {
  const {
    fetch: fetchImplementation,
    provider,
    channel,
    baseUrl,
    path,
    method = "POST",
    headers = {},
    body,
    timeoutMs,
    signal,
    operation,
  } = request;

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw configurationError("Payment timeout must be positive", {
      provider,
      channel,
      code: "invalid_timeout",
    });
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Payment provider timeout"));
  }, timeoutMs);

  const unknownOutcomeError = (cause: unknown): PaymentProviderError => {
    const code = timedOut
      ? "timeout"
      : signal?.aborted
        ? "aborted"
        : "network_error";
    const message = timedOut
      ? `${operation} timed out; its outcome is unknown`
      : signal?.aborted
        ? `${operation} was aborted; its outcome is unknown`
        : `${operation} failed before confirmation; its outcome is unknown`;
    return ambiguousError(message, { provider, channel, code, cause });
  };

  let response: Response;
  let parsed: unknown;
  try {
    try {
      response = await fetchImplementation(
        validatedUrl(baseUrl, path, provider, channel),
        {
          method,
          headers: {
            Accept: "application/json",
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } catch (cause) {
      throw unknownOutcomeError(cause);
    }

    try {
      parsed = await response.json();
    } catch (cause) {
      if (timedOut || signal?.aborted) throw unknownOutcomeError(cause);
      if (!response.ok) {
        throw errorForHttpStatus(response.status, provider, channel, operation);
      }
      throw ambiguousError(`${operation} returned an unreadable response`, {
        provider,
        channel,
        status: response.status,
        code: "invalid_json",
        cause,
      });
    }
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }

  if (!response.ok) {
    throw errorForHttpStatus(response.status, provider, channel, operation);
  }

  const record = asRecord(parsed);
  if (!record) {
    throw ambiguousError(`${operation} returned an invalid response`, {
      provider,
      channel,
      status: response.status,
      code: "invalid_response",
    });
  }
  return record;
};

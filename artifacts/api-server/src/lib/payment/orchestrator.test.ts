import { describe, expect, it, vi } from "vitest";
import {
  ambiguousError,
  configurationError,
  definitiveError,
} from "./errors";
import { createPaymentOrchestrator } from "./orchestrator";
import type {
  CreatePaymentInput,
  NormalizedPayment,
  PaymentAdapter,
  PaymentChannel,
  PaymentProvider,
} from "./types";

const input: CreatePaymentInput = {
  localReference: "webvpn-order-42",
  idempotencyKey: "webvpn:order:42:create:v1",
  baseAmount: 10_000,
};

const payment = (
  channel: PaymentChannel,
  provider: PaymentProvider,
): NormalizedPayment => ({
  transactionId: `${channel}-transaction`,
  qrisUrl: `https://payments.test/${channel}.png`,
  expiry: new Date("2026-07-28T12:30:00Z"),
  provider,
  channel,
  baseAmount: 10_000,
  payableAmount: 10_000,
  uniqueCode: 0,
});

const adapter = (
  channel: PaymentChannel,
  provider: PaymentProvider,
  create: PaymentAdapter["create"],
): PaymentAdapter => ({ channel, provider, create });

const settings = {
  paymentChannelOrder: JSON.stringify([
    "ketantechpay",
    "autogopay_gopay",
    "autogopay_shopeepay",
  ]),
  paymentFallbackEnabled: true,
  ketantechPayEnabled: true,
  autoGopayGopayEnabled: true,
  autoGopayShopeePayEnabled: true,
};

describe("createPaymentOrchestrator", () => {
  it("falls back in configured order after a definitive failure", async () => {
    const calls: PaymentChannel[] = [];
    const failed = vi.fn(async () => {
      calls.push("ketantechpay");
      throw definitiveError("rejected", {
        provider: "ketantechpay",
        channel: "ketantechpay",
      });
    });
    const succeeded = vi.fn(async () => {
      calls.push("autogopay_gopay");
      return payment("autogopay_gopay", "autogopay");
    });
    const unused = vi.fn(async () => {
      calls.push("autogopay_shopeepay");
      return payment("autogopay_shopeepay", "autogopay");
    });

    const result = await createPaymentOrchestrator(settings, {
      adapters: {
        ketantechpay: adapter("ketantechpay", "ketantechpay", failed),
        autogopay_gopay: adapter(
          "autogopay_gopay",
          "autogopay",
          succeeded,
        ),
        autogopay_shopeepay: adapter(
          "autogopay_shopeepay",
          "autogopay",
          unused,
        ),
      },
    }).create(input);

    expect(result.channel).toBe("autogopay_gopay");
    expect(calls).toEqual(["ketantechpay", "autogopay_gopay"]);
    expect(unused).not.toHaveBeenCalled();
  });

  it("also falls back from local configuration failures", async () => {
    const fallback = vi.fn(async () =>
      payment("autogopay_gopay", "autogopay"),
    );

    const result = await createPaymentOrchestrator(settings, {
      adapters: {
        ketantechpay: adapter("ketantechpay", "ketantechpay", async () => {
          throw configurationError("missing key", {
            provider: "ketantechpay",
            channel: "ketantechpay",
          });
        }),
        autogopay_gopay: adapter(
          "autogopay_gopay",
          "autogopay",
          fallback,
        ),
      },
    }).create(input);

    expect(result.channel).toBe("autogopay_gopay");
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("stops immediately after an ambiguous provider outcome", async () => {
    const fallback = vi.fn(async () =>
      payment("autogopay_gopay", "autogopay"),
    );
    const orchestrator = createPaymentOrchestrator(settings, {
      adapters: {
        ketantechpay: adapter("ketantechpay", "ketantechpay", async () => {
          throw ambiguousError("timeout", {
            provider: "ketantechpay",
            channel: "ketantechpay",
            code: "timeout",
          });
        }),
        autogopay_gopay: adapter(
          "autogopay_gopay",
          "autogopay",
          fallback,
        ),
      },
    });

    await expect(orchestrator.create(input)).rejects.toMatchObject({
      category: "ambiguous",
      code: "timeout",
    });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("does not fall back when fallback is disabled", async () => {
    const next = vi.fn(async () => payment("autogopay_gopay", "autogopay"));
    const orchestrator = createPaymentOrchestrator(
      { ...settings, paymentFallbackEnabled: false },
      {
        adapters: {
          ketantechpay: adapter("ketantechpay", "ketantechpay", async () => {
            throw definitiveError("rejected", {
              provider: "ketantechpay",
              channel: "ketantechpay",
            });
          }),
          autogopay_gopay: adapter(
            "autogopay_gopay",
            "autogopay",
            next,
          ),
        },
      },
    );

    await expect(orchestrator.create(input)).rejects.toMatchObject({
      category: "definitive",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("filters disabled channels before invoking adapters", async () => {
    const disabled = vi.fn();
    const enabled = vi.fn(async () =>
      payment("autogopay_shopeepay", "autogopay"),
    );
    const result = await createPaymentOrchestrator(
      {
        ...settings,
        ketantechPayEnabled: false,
        autoGopayGopayEnabled: false,
      },
      {
        adapters: {
          ketantechpay: adapter("ketantechpay", "ketantechpay", disabled),
          autogopay_gopay: adapter(
            "autogopay_gopay",
            "autogopay",
            disabled,
          ),
          autogopay_shopeepay: adapter(
            "autogopay_shopeepay",
            "autogopay",
            enabled,
          ),
        },
      },
    ).create(input);

    expect(result.channel).toBe("autogopay_shopeepay");
    expect(disabled).not.toHaveBeenCalled();
  });
});

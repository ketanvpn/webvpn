import { describe, expect, it } from "vitest";
import { parsePaymentSettings } from "./settings";

describe("parsePaymentSettings", () => {
  it("migrates the legacy AutoGoPay gateway to GoPay only", () => {
    const settings = parsePaymentSettings({
      activeGateway: "autogopay",
      autoGopayEnabled: "true",
      autoGopaySecretKey: "test-api-key",
    });

    expect(settings.channelOrder).toEqual(["autogopay_gopay"]);
    expect(settings.autoGopayGoPay.enabled).toBe(true);
    expect(settings.autoGopayShopeePay.enabled).toBe(false);
  });

  it("honors explicit channel flags and priority order", () => {
    const settings = parsePaymentSettings({
      paymentChannelOrder: JSON.stringify([
        "autogopay_shopeepay",
        "ketantechpay",
        "autogopay_gopay",
      ]),
      paymentFallbackEnabled: "true",
      ketantechPayEnabled: "true",
      autoGopayGopayEnabled: "false",
      autoGopayShopeePayEnabled: "true",
    });

    expect(settings.channelOrder).toEqual([
      "autogopay_shopeepay",
      "ketantechpay",
    ]);
    expect(settings.fallbackEnabled).toBe(true);
  });

  it("bounds timeout and expiry values", () => {
    const settings = parsePaymentSettings({
      paymentTimeoutMs: 99,
      paymentExpiryMinutes: 9999,
    });

    expect(settings.timeoutMs).toBe(1_000);
    expect(settings.expiryMinutes).toBe(1_440);
  });
});

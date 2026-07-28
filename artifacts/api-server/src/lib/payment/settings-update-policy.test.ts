import { describe, expect, it } from "vitest";
import {
  paymentChannelOrderValidationError,
  paymentSettingsUsabilityError,
} from "./settings-update-policy";

describe("payment settings update policy", () => {
  it("rejects duplicate and oversized channel orders", () => {
    expect(
      paymentChannelOrderValidationError([
        "ketantechpay",
        "ketantechpay",
      ]),
    ).toContain("duplikat");
    expect(
      paymentChannelOrderValidationError([
        "ketantechpay",
        "autogopay_gopay",
        "autogopay_shopeepay",
        "ketantechpay",
      ]),
    ).toContain("maksimal 3");
  });

  it("rejects settings with no enabled payment channel", () => {
    expect(
      paymentSettingsUsabilityError({
        ketantechPayEnabled: false,
        autoGopayGopayEnabled: false,
        autoGopayShopeePayEnabled: false,
      }),
    ).toContain("minimal satu channel");
  });

  it("requires the credentials and artifacts used by enabled channels", () => {
    expect(
      paymentSettingsUsabilityError({
        ketantechPayEnabled: true,
        autoGopayGopayEnabled: false,
        autoGopayShopeePayEnabled: false,
      }),
    ).toContain("Base URL KetantechPay");

    expect(
      paymentSettingsUsabilityError({
        ketantechPayEnabled: false,
        autoGopayGopayEnabled: true,
        autoGopayShopeePayEnabled: false,
        autoGopayApiUrl: "https://v1-gateway.autogopay.site",
      }),
    ).toContain("API Key AutoGoPay");

    expect(
      paymentSettingsUsabilityError({
        ketantechPayEnabled: false,
        autoGopayGopayEnabled: false,
        autoGopayShopeePayEnabled: true,
        autoGopayApiUrl: "https://v1-gateway.autogopay.site",
        autoGopaySecretKey: "configured",
      }),
    ).toContain("QRIS statis ShopeePay");
  });

  it("accepts a usable mixed-channel configuration", () => {
    expect(
      paymentSettingsUsabilityError({
        ketantechPayEnabled: true,
        ketantechPayBaseUrl: "https://pay.example.test",
        autoGopayGopayEnabled: false,
        autoGopayShopeePayEnabled: true,
        autoGopayApiUrl: "https://gateway.example.test",
        autoGopaySecretKey: "configured",
        autoGopayShopeePayQrisStatic: "000201010211...",
      }),
    ).toBeNull();
  });
});

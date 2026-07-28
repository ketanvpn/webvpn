import { describe, expect, it, vi } from "vitest";
import { createAutoGoPayGoPayAdapter } from "./autogopay-gopay";
import { createAutoGoPayShopeePayAdapter } from "./autogopay-shopeepay";
import { createKetantechPayAdapter } from "./ketantechpay";
import type { CreatePaymentInput, PaymentFetch } from "./types";

const input: CreatePaymentInput = {
  localReference: "webvpn-order-8",
  idempotencyKey: "webvpn:order:8:channel:create:v1",
  baseAmount: 25_000,
};

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const requestBody = (init?: RequestInit): Record<string, unknown> =>
  JSON.parse(String(init?.body)) as Record<string, unknown>;

describe("payment adapters", () => {
  it("uses a stable idempotency key for KetantechPay", async () => {
    const fetch = vi.fn<PaymentFetch>(async (_url, init) => {
      expect(init?.headers).toMatchObject({
        "Idempotency-Key": input.idempotencyKey,
        "X-Client-Key": "client-key",
        "x-api-key": "client-key",
      });
      expect(requestBody(init)).toMatchObject({
        orderId: input.localReference,
        amount: input.baseAmount,
        method: "qris",
      });
      return jsonResponse({
        success: true,
        data: {
          id: "kt-1",
          paymentUrl: "https://payments.test/kt-1",
        },
      });
    });

    const result = await createKetantechPayAdapter(
      {
        enabled: true,
        baseUrl: "https://ketantech.test",
        clientKey: "client-key",
        timeoutMs: 1_000,
        expiryMinutes: 15,
      },
      { fetch },
    ).create(input);

    expect(result).toMatchObject({
      provider: "ketantechpay",
      channel: "ketantechpay",
      transactionId: "kt-1",
      payableAmount: 25_000,
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("normalizes AutoGoPay GoPay create and paid status responses", async () => {
    const fetch = vi.fn<PaymentFetch>(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === "/qris/generate") {
        expect(requestBody(init)).toEqual({ amount: 25_000 });
        return jsonResponse({
          data: {
            transaction_id: "gp-1",
            qr_url: "https://payments.test/gp-1.png",
          },
        });
      }
      expect(path).toBe("/qris/status");
      return jsonResponse({
        data: {
          transaction_id: "gp-1",
          transaction_status: "settlement",
          amount: 25_000,
        },
      });
    });
    const adapter = createAutoGoPayGoPayAdapter(
      {
        enabled: true,
        baseUrl: "https://autogopay.test",
        apiKey: "test-key",
        timeoutMs: 1_000,
        expiryMinutes: 15,
      },
      { fetch },
    );

    const created = await adapter.create(input);
    const status = await adapter.status("gp-1");

    expect(created).toMatchObject({
      provider: "autogopay",
      channel: "autogopay_gopay",
      transactionId: "gp-1",
      payableAmount: 25_000,
      uniqueCode: 0,
    });
    expect(status).toMatchObject({ paid: true, amount: 25_000 });
  });

  it("sends the ShopeePay payable amount including its unique code", async () => {
    const fetch = vi.fn<PaymentFetch>(async (_url, init) => {
      const body = requestBody(init);
      expect(body).toMatchObject({
        amount: 25_037,
        base_amount: 25_000,
        payable_amount: 25_037,
        unique_code: 37,
        qris_static: "static-qris-payload",
      });
      return jsonResponse({
        success: true,
        data: {
          qr_url: "https://payments.test/sp-qr.png",
          base_amount: 25_000,
          payable_amount: 25_037,
          unique_code: 37,
        },
      });
    });

    const result = await createAutoGoPayShopeePayAdapter(
      {
        enabled: true,
        baseUrl: "https://autogopay.test",
        apiKey: "test-key",
        staticQrString: "static-qris-payload",
        timeoutMs: 1_000,
        expiryMinutes: 15,
      },
      { fetch },
    ).create({ ...input, payableAmount: 25_037, uniqueCode: 37 });

    expect(result).toMatchObject({
      channel: "autogopay_shopeepay",
      baseAmount: 25_000,
      payableAmount: 25_037,
      uniqueCode: 37,
    });
  });

  it("does not render a ShopeePay checkout link as a QR image", async () => {
    const adapter = createAutoGoPayShopeePayAdapter(
      {
        enabled: true,
        baseUrl: "https://autogopay.test",
        apiKey: "test-key",
        staticQrString: "static-qris-payload",
        timeoutMs: 1_000,
        expiryMinutes: 15,
      },
      {
        fetch: async () =>
          jsonResponse({
            data: { checkout_url: "https://payments.test/checkout/sp-1" },
          }),
      },
    );

    await expect(
      adapter.create({ ...input, payableAmount: 25_037, uniqueCode: 37 }),
    ).rejects.toMatchObject({
      category: "ambiguous",
      code: "missing_qris_url",
    });
  });

  it("treats an accepted response without a QR URL as ambiguous", async () => {
    const adapter = createAutoGoPayGoPayAdapter(
      {
        enabled: true,
        baseUrl: "https://autogopay.test",
        apiKey: "test-key",
        timeoutMs: 1_000,
        expiryMinutes: 15,
      },
      { fetch: async () => jsonResponse({ data: { transaction_id: "gp-2" } }) },
    );

    await expect(adapter.create(input)).rejects.toMatchObject({
      category: "ambiguous",
      code: "missing_qris_url",
    });
  });

  it("classifies provider HTTP errors for safe fallback decisions", async () => {
    const makeAdapter = (status: number) =>
      createKetantechPayAdapter(
        {
          enabled: true,
          baseUrl: "https://ketantech.test",
          timeoutMs: 1_000,
          expiryMinutes: 15,
        },
        { fetch: async () => jsonResponse({ error: "rejected" }, status) },
      );

    await expect(makeAdapter(422).create(input)).rejects.toMatchObject({
      category: "definitive",
      status: 422,
    });
    await expect(makeAdapter(500).create(input)).rejects.toMatchObject({
      category: "ambiguous",
      status: 500,
    });
  });
});

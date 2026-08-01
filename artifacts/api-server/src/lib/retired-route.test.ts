import { describe, expect, it } from "vitest";
import { retiredRouteResponse } from "./retired-route";

describe("retiredRouteResponse", () => {
  it("returns migration guidance for the legacy static order creation route", () => {
    // Given
    const route = "staticOrder";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Pembelian paket statis sudah dihentikan.",
      replacement: "POST /dynamic-vpn/orders",
    });
  });

  it("returns dynamic renewal guidance for static renewals", () => {
    // Given
    const route = "staticRenew";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Perpanjangan paket statis sudah dihentikan.",
      replacement: "Buat akun baru melalui POST /dynamic-vpn/orders",
    });
  });

  it("guides static payment calls to history and dynamic ordering", () => {
    // Given
    const route = "staticOrderPayment";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Pembayaran order paket statis sudah dihentikan.",
      replacement: "GET /orders untuk riwayat; pembelian baru gunakan POST /dynamic-vpn/orders",
    });
  });

  it("keeps admin product history available as the migration target", () => {
    // Given
    const route = "adminProductMutation";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Perubahan produk statis sudah dihentikan.",
      replacement: "GET /admin/products untuk riwayat dan audit",
    });
  });

  it("retires static admin order confirmation in favor of settlement processing", () => {
    // Given
    const route = "adminStaticOrderConfirmation";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Konfirmasi order paket statis oleh admin sudah dihentikan.",
      replacement: "Gunakan settlement pembayaran atau GET /admin/orders untuk riwayat dan audit",
    });
  });

  it("preserves static admin order history by retiring deletion", () => {
    // Given
    const route = "adminStaticOrderDeletion";

    // When
    const response = retiredRouteResponse(route);

    // Then
    expect(response).toEqual({
      status: 410,
      error: "Penghapusan order paket statis oleh admin sudah dihentikan.",
      replacement: "GET /admin/orders untuk riwayat dan audit",
    });
  });
});

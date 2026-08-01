export type RetiredRoute =
  | "staticOrder"
  | "staticOrderPayment"
  | "staticRenew"
  | "adminProductMutation"
  | "adminStaticOrderConfirmation"
  | "adminStaticOrderDeletion";

type RetiredRouteGuidance = {
  readonly error: string;
  readonly replacement: string;
};

const retiredRouteGuidance = {
  staticOrder: {
    error: "Pembelian paket statis sudah dihentikan.",
    replacement: "POST /dynamic-vpn/orders",
  },
  staticOrderPayment: {
    error: "Pembayaran order paket statis sudah dihentikan.",
    replacement: "GET /orders untuk riwayat; pembelian baru gunakan POST /dynamic-vpn/orders",
  },
  staticRenew: {
    error: "Perpanjangan paket statis sudah dihentikan.",
    replacement: "Buat akun baru melalui POST /dynamic-vpn/orders",
  },
  adminProductMutation: {
    error: "Perubahan produk statis sudah dihentikan.",
    replacement: "GET /admin/products untuk riwayat dan audit",
  },
  adminStaticOrderConfirmation: {
    error: "Konfirmasi order paket statis oleh admin sudah dihentikan.",
    replacement: "Gunakan settlement pembayaran atau GET /admin/orders untuk riwayat dan audit",
  },
  adminStaticOrderDeletion: {
    error: "Penghapusan order paket statis oleh admin sudah dihentikan.",
    replacement: "GET /admin/orders untuk riwayat dan audit",
  },
} satisfies Record<RetiredRoute, RetiredRouteGuidance>;

export type RetiredRouteResponse = RetiredRouteGuidance & {
  readonly status: 410;
};

export function retiredRouteResponse(route: RetiredRoute): RetiredRouteResponse {
  return { status: 410, ...retiredRouteGuidance[route] };
}

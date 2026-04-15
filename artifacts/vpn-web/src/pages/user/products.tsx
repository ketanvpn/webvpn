import { useListProducts } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, HardDrive, Network, ShoppingCart, PackageX, Zap } from "lucide-react";
import type { ListProductsProtocol } from "@workspace/api-client-react";

const protocols: { value: string; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "ssh", label: "SSH" },
  { value: "vmess", label: "VMess" },
  { value: "vless", label: "VLess" },
  { value: "trojan", label: "Trojan" },
  { value: "shadowsocks", label: "SS" },
];

const PROTOCOL_COLORS: Record<string, string> = {
  ssh: "bg-orange-100 text-orange-700 border-orange-200",
  vmess: "bg-blue-100 text-blue-700 border-blue-200",
  vless: "bg-purple-100 text-purple-700 border-purple-200",
  trojan: "bg-red-100 text-red-700 border-red-200",
  shadowsocks: "bg-green-100 text-green-700 border-green-200",
};

export default function Products() {
  const [protocol, setProtocol] = useState<string>("all");

  const { data: products, isLoading } = useListProducts(
    protocol === "all" ? undefined : { protocol: protocol as ListProductsProtocol }
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produk VPN</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pilih paket VPN sesuai kebutuhanmu.</p>
      </div>

      {/* Filter Tab — scroll horizontal, tidak wrap */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        {protocols.map((p) => (
          <button
            key={p.value}
            onClick={() => setProtocol(p.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              protocol === p.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Product List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const effectivePrice = product.resellerPrice ?? product.price;
            const hasDiscount = product.resellerPrice != null;
            const inStock = product.availableStock > 0;
            const lowStock = product.availableStock > 0 && product.availableStock <= 3;
            const protocolColor = PROTOCOL_COLORS[product.protocol] ?? "bg-gray-100 text-gray-700 border-gray-200";

            return (
              <div
                key={product.id}
                className={`relative flex flex-col gap-2 rounded-xl border-2 p-3 transition-all ${
                  inStock
                    ? "bg-card hover:border-primary/50 hover:shadow-sm"
                    : "bg-muted/30 opacity-70"
                }`}
              >
                {/* Baris 1: Badge + Nama + Harga */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`shrink-0 text-[11px] font-bold uppercase px-1.5 py-0.5 rounded border ${protocolColor}`}>
                      {product.protocol}
                    </span>
                    <span className="font-semibold text-sm leading-tight truncate">{product.name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    {hasDiscount && (
                      <div className="text-[10px] text-muted-foreground line-through leading-none">
                        {formatRupiah(product.price)}
                      </div>
                    )}
                    <div className={`font-bold text-base leading-tight ${hasDiscount ? "text-green-600" : "text-primary"}`}>
                      {formatRupiah(effectivePrice)}
                    </div>
                  </div>
                </div>

                {/* Baris 2: Spek */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />{product.durationDays}h
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />{product.quota ? `${product.quota}GB` : "∞"}
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    <Network className="h-3 w-3" />{product.maxConnections ? `${product.maxConnections} IP` : "∞ IP"}
                  </span>
                  {hasDiscount && (
                    <>
                      <span className="text-border">·</span>
                      <span className="text-green-600 font-medium">Reseller</span>
                    </>
                  )}
                  {product.category && (
                    <>
                      <span className="text-border">·</span>
                      <span>{product.category}</span>
                    </>
                  )}
                </div>

                {/* Baris 3: Deskripsi (opsional) */}
                {product.description && (
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {product.description}
                  </p>
                )}

                {/* Baris 4: Tombol + Stok */}
                <div className="flex items-center gap-2 mt-1">
                  {inStock ? (
                    <Button size="sm" className="flex-1 h-8 gap-1.5 text-xs" asChild>
                      <Link href={`/products/${product.id}`}>
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Beli Sekarang
                      </Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="flex-1 h-8 gap-1.5 text-xs" disabled variant="secondary">
                      <PackageX className="h-3.5 w-3.5" />
                      Stok Habis
                    </Button>
                  )}
                  <span className={`text-[10px] font-medium shrink-0 ${
                    !inStock ? "text-destructive" :
                    lowStock ? "text-amber-600" :
                    "text-muted-foreground"
                  }`}>
                    {!inStock ? "Habis" : lowStock ? (
                      <span className="flex items-center gap-0.5"><Zap className="h-3 w-3" />Sisa {product.availableStock}</span>
                    ) : `${product.availableStock} slot`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl bg-card border-dashed">
          <p className="text-sm text-muted-foreground">Tidak ada produk untuk protokol ini.</p>
        </div>
      )}
    </div>
  );
}

import { useListProducts } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, HardDrive, ShoppingCart, PackageX, Zap, ChevronDown, Package, AlertCircle, Key } from "lucide-react";
import type { ListProductsProtocol } from "@workspace/api-client-react";
import { PageHeader, EmptyState } from "@/components/common";

const protocols: { value: string; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "ssh", label: "SSH" },
  { value: "vmess", label: "VMess" },
  { value: "vless", label: "VLess" },
  { value: "trojan", label: "Trojan" },
  { value: "shadowsocks", label: "SS" },
];

const PROTOCOL_COLORS: Record<string, string> = {
  ssh: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  vmess: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  vless: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  trojan: "bg-red-500/10 text-red-400 border-red-500/30",
  shadowsocks: "bg-green-500/10 text-green-400 border-green-500/30",
};

function ProductCard({ product }: { product: any }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const effectivePrice = product.resellerPrice ?? product.price;
  const hasDiscount = product.resellerPrice != null;
  const inStock = product.availableStock > 0;
  
  const initial = product.name.substring(0, 2).toUpperCase();
  const protocolColor = PROTOCOL_COLORS[product.protocol] ?? "bg-gray-500/10 text-gray-400 border-gray-500/30";

  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 border ${isDetailOpen ? 'border-primary/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-white/5 hover:border-primary/30'} ${inStock ? 'glass-card' : 'bg-muted/10 opacity-70'}`}>
       {/* Top main card area */}
       <div className="p-3 sm:p-4 flex gap-3">
          {/* Left: Circle Avatar & Badges */}
          <div className="flex flex-col items-center gap-1.5 w-14 sm:w-16 shrink-0">
             <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border shadow-lg ${protocolColor}`}>
                <span className="text-xs sm:text-sm font-bold">{initial}</span>
             </div>
             <div className="flex flex-col items-center gap-1 w-full mt-1">
                <span className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded w-full text-center border ${protocolColor}`}>
                  {product.protocol.toUpperCase()}
                </span>
                {product.protocol === "ssh" || product.protocol === "shadowsocks" ? (
                  <span className="text-[8px] sm:text-[9px] font-bold bg-white/5 text-muted-foreground px-1 py-0.5 rounded w-full text-center border border-white/10 flex items-center justify-center gap-0.5">
                    <Key className="w-2 h-2" /> MANUAL
                  </span>
                ) : (
                  <span className="text-[8px] sm:text-[9px] font-bold bg-primary/10 text-primary px-1 py-0.5 rounded w-full text-center border border-primary/20 flex items-center justify-center gap-0.5">
                    <Zap className="w-2 h-2" /> READY
                  </span>
                )}
             </div>
          </div>
          
          {/* Middle: Name & Mini Badges */}
          <div className="flex-1 min-w-0 py-0.5">
             <h3 className="font-semibold text-sm sm:text-base leading-snug text-foreground truncate mb-1.5">{product.name}</h3>
             
             {/* Mini badges for Protocol, Duration, etc */}
             <div className="flex flex-wrap gap-1.5">
                <span className="text-[9px] sm:text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {product.durationDays === 0 ? "1 Jam" : `${product.durationDays} Hari`}
                </span>
                <span className="text-[9px] sm:text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                  <HardDrive className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {product.quota ? `${product.quota}GB` : "Unli"}
                </span>
             </div>
          </div>

          {/* Right: Price & Button */}
          <div className="flex flex-col items-end justify-between shrink-0 py-0.5">
             <div className="text-right">
                {hasDiscount && (
                   <div className="text-[10px] sm:text-xs text-muted-foreground line-through mb-0.5">
                     {formatRupiah(product.price)}
                   </div>
                )}
                <div className={`font-bold text-sm sm:text-[15px] tracking-tight ${hasDiscount ? "text-green-500" : "text-primary"}`}>
                   {formatRupiah(effectivePrice)}
                </div>
             </div>
             
             {inStock ? (
                <Button size="sm" className="h-7 sm:h-8 px-3 sm:px-4 text-xs shadow-[0_0_10px_rgba(16,185,129,0.2)] transition-all" asChild>
                  <Link href={`/products/${product.id}`}>
                    <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> Beli
                  </Link>
                </Button>
             ) : (
                <Button size="sm" variant="secondary" className="h-7 sm:h-8 px-3 sm:px-4 text-xs" disabled>
                   Habis
                </Button>
             )}
          </div>
       </div>

       {/* Accordion Toggle */}
       <button 
          onClick={() => setIsDetailOpen(!isDetailOpen)}
          className="w-full py-1.5 sm:py-2 bg-black/20 text-[9px] sm:text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 border-t border-white/5"
       >
          {isDetailOpen ? "TUTUP DETAIL" : "LIHAT DETAIL"}
          <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-300 ${isDetailOpen ? "rotate-180" : ""}`} />
       </button>

       {/* Detail Content */}
       <div className={`overflow-hidden transition-all duration-300 ${isDetailOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="p-3 sm:p-4 pt-2 bg-black/40 border-t border-white/5 space-y-3">
             <div className="flex flex-wrap gap-2">
                {product.category && (
                   <div className="text-[9px] sm:text-[10px] bg-white/5 px-2 sm:px-2.5 py-1 rounded border border-white/10 text-muted-foreground flex items-center gap-1 sm:gap-1.5">
                      <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> KATEGORI: {product.category.toUpperCase()}
                   </div>
                )}
             </div>

             {product.description ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 sm:p-2.5 text-amber-200/90 text-[10px] sm:text-[11px] leading-relaxed">
                   <span className="font-semibold flex items-center gap-1 mb-1 text-amber-400">
                     <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Peringatan:
                   </span>
                   {product.description}
                </div>
             ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-2 sm:p-2.5 text-amber-200/90 text-[10px] sm:text-[11px] leading-relaxed">
                   <span className="font-semibold flex items-center gap-1 mb-1 text-amber-400">
                     <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Peringatan:
                   </span>
                   Cocokkan durasi produk pada judul dengan detail di atas. Jangan membeli jika stok kosong.
                </div>
             )}
             
             <div className="text-[10px] sm:text-[11px] text-muted-foreground space-y-1 mt-2">
                <p>• Maksimal koneksi: <span className="text-foreground">{product.maxConnections ? `${product.maxConnections} IP` : "Unlimited"}</span></p>
                <p>• Stok tersisa: <span className="text-foreground">{product.availableStock} slot</span></p>
             </div>
          </div>
       </div>
    </div>
  );
}

export default function Products() {
  const [protocol, setProtocol] = useState<string>("all");

  const { data: products, isLoading } = useListProducts(
    protocol === "all" ? undefined : { protocol: protocol as ListProductsProtocol }
  );

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Produk VPN" description="Pilih paket VPN sesuai kebutuhanmu." />

      {/* Filter Tab — scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {protocols.map((p) => (
          <button
            key={p.value}
            onClick={() => setProtocol(p.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-300 ${
              protocol === p.value
                ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "glass-card text-muted-foreground border border-white/5 hover:border-primary/30 hover:text-foreground"
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
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState icon={PackageX} title="Belum ada produk untuk kategori ini." />
      )}
    </div>
  );
}


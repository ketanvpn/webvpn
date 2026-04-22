import { useListProducts } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, HardDrive, Network, ShoppingCart, PackageX, Zap, ChevronDown, Package, AlertCircle, Key, Filter } from "lucide-react";
import type { ListProductsProtocol } from "@workspace/api-client-react";

const protocols: { value: string; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "ssh", label: "SSH" },
  { value: "vmess", label: "VMess" },
  { value: "vless", label: "VLess" },
  { value: "trojan", label: "Trojan" },
  { value: "shadowsocks", label: "SS" },
];

function ProductCard({ product }: { product: any }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const effectivePrice = product.resellerPrice ?? product.price;
  const hasDiscount = product.resellerPrice != null;
  const inStock = product.availableStock > 0;
  
  const initial = product.name.substring(0, 2).toUpperCase();

  return (
    <div className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 bg-[#12121a] border ${isDetailOpen ? 'border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.05)]' : 'border-white/5 hover:border-white/10'}`}>
       {/* Top main card area */}
       <div className="p-3 sm:p-4 flex gap-3">
          {/* Left: Circle Avatar & Badges */}
          <div className="flex flex-col items-center gap-1.5 w-14 sm:w-16 shrink-0">
             <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center border border-white/10 shadow-lg">
                <span className="text-xs sm:text-sm font-bold text-white/80">{initial}</span>
             </div>
             <div className="flex flex-col items-center gap-1 w-full mt-1">
                <span className="text-[8px] sm:text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded w-full text-center border border-emerald-500/20">NEW</span>
                {product.protocol === "ssh" || product.protocol === "shadowsocks" ? (
                  <span className="text-[8px] sm:text-[9px] font-bold bg-purple-500/10 text-purple-400 px-1 py-0.5 rounded w-full text-center border border-purple-500/20 flex items-center justify-center gap-0.5">
                    <Key className="w-2 h-2" /> MANUAL
                  </span>
                ) : (
                  <span className="text-[8px] sm:text-[9px] font-bold bg-blue-500/10 text-blue-400 px-1 py-0.5 rounded w-full text-center border border-blue-500/20 flex items-center justify-center gap-0.5">
                    <Zap className="w-2 h-2" /> READY
                  </span>
                )}
             </div>
          </div>
          
          {/* Middle: Name & Mini Badges */}
          <div className="flex-1 min-w-0 py-0.5">
             <h3 className="font-semibold text-sm sm:text-base leading-snug text-white/90 truncate mb-1.5">{product.name}</h3>
             
             {/* Mini badges for Protocol, Duration, etc */}
             <div className="flex flex-wrap gap-1.5">
                <span className="text-[9px] sm:text-[10px] bg-white/5 text-muted-foreground px-1.5 py-0.5 rounded border border-white/5 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {product.durationDays} Hari
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
                <div className="font-bold text-sm sm:text-[15px] text-emerald-400 tracking-tight">
                   {formatRupiah(effectivePrice)}
                </div>
             </div>
             
             {inStock ? (
                <Button size="sm" className="h-7 sm:h-8 px-3 sm:px-4 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all" asChild>
                  <Link href={`/products/${product.id}`}>
                    <ShoppingCart className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" /> Beli
                  </Link>
                </Button>
             ) : (
                <Button size="sm" className="h-7 sm:h-8 px-3 sm:px-4 text-xs bg-white/5 text-white/50 cursor-not-allowed rounded-lg" disabled>
                   Habis
                </Button>
             )}
          </div>
       </div>

       {/* Accordion Toggle */}
       <button 
          onClick={() => setIsDetailOpen(!isDetailOpen)}
          className="w-full py-1.5 sm:py-2 bg-black/20 text-[9px] sm:text-[10px] font-semibold text-muted-foreground hover:text-white transition-colors flex items-center justify-center gap-1 border-t border-white/5"
       >
          {isDetailOpen ? "TUTUP DETAIL" : "LIHAT DETAIL"}
          <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform duration-300 ${isDetailOpen ? "rotate-180" : ""}`} />
       </button>

       {/* Detail Content */}
       <div className={`overflow-hidden transition-all duration-300 ${isDetailOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="p-3 sm:p-4 pt-2 bg-black/40 border-t border-white/5 space-y-3">
             <div className="flex flex-wrap gap-2">
                {product.category && (
                   <div className="text-[9px] sm:text-[10px] bg-white/5 px-2 sm:px-2.5 py-1 rounded border border-white/10 text-white/70 flex items-center gap-1 sm:gap-1.5">
                      <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> KATEGORI: {product.category.toUpperCase()}
                   </div>
                )}
                <div className="text-[9px] sm:text-[10px] bg-white/5 px-2 sm:px-2.5 py-1 rounded border border-white/10 text-white/70 flex items-center gap-1 sm:gap-1.5">
                   <Network className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> PROTOKOL: {product.protocol.toUpperCase()}
                </div>
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
             
             <div className="text-[10px] sm:text-[11px] text-white/60 space-y-1 mt-2">
                <p>• Maksimal koneksi: <span className="text-white/90">{product.maxConnections ? `${product.maxConnections} IP` : "Unlimited"}</span></p>
                <p>• Stok tersisa: <span className="text-white/90">{product.availableStock} slot</span></p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Produk Reguler</h1>
        </div>
        {/* Mock Filter Button to match design */}
        <Button size="sm" variant="outline" className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 hover:text-indigo-300 h-8 text-xs px-3 rounded-lg flex items-center gap-1.5">
          <Filter className="w-3 h-3" /> Filter <ChevronDown className="w-3 h-3 opacity-70" />
        </Button>
      </div>

      {/* Filter Tab — scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
        {protocols.map((p) => (
          <button
            key={p.value}
            onClick={() => setProtocol(p.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-300 ${
              protocol === p.value
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                : "bg-white/5 text-muted-foreground border border-white/5 hover:border-indigo-500/30 hover:text-white"
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
        <div className="text-center py-16 rounded-xl glass-panel border-white/5 flex flex-col items-center justify-center gap-3">
          <PackageX className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Belum ada produk untuk kategori ini.</p>
        </div>
      )}
    </div>
  );
}


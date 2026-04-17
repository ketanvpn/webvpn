import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shield, Zap, Globe, ChevronRight, CheckCircle2 } from "lucide-react";
import { LogoBrand } from "@/components/logo";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

async function fetchPublicProducts() {
  const res = await fetch(`${BASE}/api/products`);
  if (!res.ok) return [];
  return res.json();
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function formatDuration(days: number) {
  if (days >= 30 && days % 30 === 0) return `${days / 30} Bulan`;
  if (days >= 7 && days % 7 === 0) return `${days / 7} Minggu`;
  return `${days} Hari`;
}

const protocolColor: Record<string, string> = {
  ssh: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  vmess: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  vless: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trojan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["public-products"],
    queryFn: fetchPublicProducts,
    staleTime: 60000,
  });

  const featured = products.slice(0, 6);

  const scrollToPackages = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("paket")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <LogoBrand iconSize={34} />
          <nav className="flex items-center gap-4">
            <button
              onClick={scrollToPackages}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Paket
            </button>
            {isAuthenticated ? (
              <Button asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5">
                  Buka Dashboard <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Daftar</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative py-16 lg:py-24 px-4 text-center overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="container relative z-10 mx-auto max-w-3xl space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Layanan VPN untuk<br className="hidden sm:block" />
              <span className="text-primary"> Indonesia</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              SSH, VMess, VLess, dan Trojan tersedia dengan server yang bisa dipilih sesuai kebutuhan. Harga transparan, aktif setelah pembayaran dikonfirmasi.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {isAuthenticated ? (
                <Button size="lg" className="w-full sm:w-auto px-8" asChild>
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full sm:w-auto px-8" asChild>
                    <Link href="/register">Daftar Sekarang</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto px-8" onClick={scrollToPackages}>
                    Lihat Paket
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Quick Info */}
        <section className="py-8 px-4 border-y border-white/5 bg-card/40">
          <div className="container mx-auto max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Aktif Cepat</p>
                  <p className="text-xs text-muted-foreground">Akun VPN dibuat otomatis setelah pembayaran dikonfirmasi.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Globe className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Multi Protokol</p>
                  <p className="text-xs text-muted-foreground">SSH, VMess, VLess, Trojan — pilih yang paling cocok.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Harga Transparan</p>
                  <p className="text-xs text-muted-foreground">Tidak ada biaya tersembunyi. Bayar sesuai paket yang dipilih.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Packages Section */}
        {featured.length > 0 && (
          <section id="paket" className="py-14 px-4">
            <div className="container mx-auto max-w-6xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tight">Paket Tersedia</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Aktif instan setelah pembayaran dikonfirmasi.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featured.map((p) => (
                  <div
                    key={p.id}
                    className="relative p-5 rounded-xl glass-card border border-white/5 hover:border-primary/30 transition-colors duration-200 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${protocolColor[p.protocol] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {p.protocol}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2.5 py-0.5 border border-white/5">
                        {formatDuration(p.durationDays)}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold leading-tight">{p.name}</h3>

                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {p.quota != null && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          Kuota {p.quota} GB
                        </li>
                      )}
                      {p.maxConnections && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          Max {p.maxConnections} koneksi
                        </li>
                      )}
                      {p.serverName && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          Server: {p.serverName}
                        </li>
                      )}
                    </ul>

                    <div className="mt-auto pt-2 flex items-end justify-between">
                      <div>
                        <div className="text-xl font-bold text-primary">
                          {formatRupiah(p.price)}
                        </div>
                        <p className="text-xs text-muted-foreground">per {formatDuration(p.durationDays)}</p>
                      </div>
                      {p.availableStock === 0 ? (
                        <span className="text-xs text-red-400 border border-red-400/30 rounded-full px-2.5 py-1">Habis</span>
                      ) : p.availableStock <= 5 ? (
                        <span className="text-xs text-yellow-400 border border-yellow-400/30 rounded-full px-2.5 py-1">Sisa {p.availableStock}</span>
                      ) : null}
                    </div>

                    <Button
                      className="w-full"
                      disabled={p.availableStock === 0}
                      asChild={p.availableStock !== 0}
                    >
                      {p.availableStock !== 0 ? (
                        <Link href={isAuthenticated ? "/products" : "/register"}>
                          {isAuthenticated ? "Pesan Sekarang" : "Daftar & Beli"}
                        </Link>
                      ) : (
                        <span>Stok Habis</span>
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              {products.length > 6 && (
                <div className="mt-8">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={isAuthenticated ? "/products" : "/register"}>
                      Lihat semua paket <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="py-6 border-t bg-card">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p className="font-medium text-foreground mb-0.5">KETANTECH VPN Store</p>
          <p>&copy; {new Date().getFullYear()} KETANTECH. Seluruh hak cipta dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}

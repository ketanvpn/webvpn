import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shield, Zap, Globe, Lock, ChevronRight, Users, Server, Clock, HeartHandshake, CheckCircle2 } from "lucide-react";

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
          <div className="font-bold text-xl tracking-tight text-primary">
            KETANTECH
          </div>
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
                  <Link href="/register">Daftar Sekarang</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="relative py-24 lg:py-32 px-4 text-center overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="container relative z-10 mx-auto max-w-4xl space-y-8">
            <div className="inline-flex items-center rounded-full border border-primary/30 px-4 py-1.5 text-sm font-medium glass-panel shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Layanan VPN Premium untuk Indonesia
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground drop-shadow-md">
              Internet Bebas.<br className="hidden sm:block" />
              <span className="text-primary drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]">Tanpa Batas.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Nikmati kecepatan tinggi dan keamanan enterprise dengan server SSH, VMess, VLess, dan Trojan premium kami.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-105" asChild>
                <Link href="/register">Mulai Sekarang</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 glass-panel border-primary/30 hover:bg-primary/10 transition-all" onClick={scrollToPackages}>
                Lihat Paket
              </Button>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="py-10 px-4 border-y border-white/5 bg-card/40">
          <div className="container mx-auto max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-3xl font-extrabold text-primary">
                  <Users className="h-6 w-6" /> 1.000+
                </div>
                <p className="text-sm text-muted-foreground">Pengguna Aktif</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-3xl font-extrabold text-primary">
                  <Server className="h-6 w-6" /> 10+
                </div>
                <p className="text-sm text-muted-foreground">Server Premium</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-3xl font-extrabold text-primary">
                  <Clock className="h-6 w-6" /> 99.9%
                </div>
                <p className="text-sm text-muted-foreground">Uptime Terjamin</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 text-3xl font-extrabold text-primary">
                  <HeartHandshake className="h-6 w-6" /> 24/7
                </div>
                <p className="text-sm text-muted-foreground">Support Siap</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight">Kenapa Pilih KETANTECH?</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                Kami menyediakan VPN terpercaya dengan performa tinggi, harga terjangkau, dan dukungan penuh.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Zap, title: "Super Cepat", desc: "Server performa tinggi, cocok untuk gaming, streaming, dan browsing sehari-hari." },
                { icon: Shield, title: "Aman & Terenkripsi", desc: "Enkripsi tingkat militer melindungi data dan privasi kamu dari ancaman siber." },
                { icon: Globe, title: "Multi Lokasi", desc: "Server di berbagai negara — akses konten lokal maupun internasional tanpa hambatan." },
                { icon: Lock, title: "No Log Policy", desc: "Kami tidak menyimpan riwayat aktivitasmu. Privasi kamu adalah hak, bukan fitur." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-6 rounded-2xl glass-card border border-white/5 shadow-lg space-y-4 hover:-translate-y-1 transition-transform duration-300">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Packages Section */}
        {featured.length > 0 && (
          <section id="paket" className="py-24 px-4 bg-card/20">
            <div className="container mx-auto max-w-6xl">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tight">Paket Tersedia</h2>
                <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                  Pilih paket yang sesuai kebutuhanmu. Aktif instan setelah pembayaran dikonfirmasi.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featured.map((p) => (
                  <div
                    key={p.id}
                    className="relative p-6 rounded-2xl glass-card border border-white/5 shadow-lg hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all duration-300 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase ${protocolColor[p.protocol] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {p.protocol}
                      </span>
                      <span className="text-xs text-muted-foreground bg-muted/40 rounded-full px-2.5 py-0.5 border border-white/5">
                        {formatDuration(p.durationDays)}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold leading-tight">{p.name}</h3>

                    {p.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{p.description}</p>
                    )}

                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                      {p.quota != null && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          Kuota {p.quota} GB
                        </li>
                      )}
                      {p.maxConnections && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          Max {p.maxConnections} Koneksi
                        </li>
                      )}
                      {p.serverName && (
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          Server: {p.serverName}
                        </li>
                      )}
                    </ul>

                    <div className="mt-auto pt-2">
                      <div className="text-2xl font-extrabold text-primary">
                        {formatRupiah(p.price)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">per {formatDuration(p.durationDays)}</p>
                    </div>

                    <Button className="w-full mt-2 shadow-[0_0_12px_rgba(16,185,129,0.3)]" asChild>
                      <Link href={isAuthenticated ? "/products" : "/register"}>
                        {isAuthenticated ? "Pesan Sekarang" : "Daftar & Beli"}
                      </Link>
                    </Button>

                    {p.availableStock <= 5 && p.availableStock > 0 && (
                      <p className="text-xs text-yellow-400 text-center">Stok terbatas: {p.availableStock} tersisa</p>
                    )}
                    {p.availableStock === 0 && (
                      <p className="text-xs text-red-400 text-center">Stok habis</p>
                    )}
                  </div>
                ))}
              </div>

              {products.length > 6 && (
                <div className="text-center mt-10">
                  <Button variant="outline" size="lg" className="glass-panel border-primary/30" asChild>
                    <Link href={isAuthenticated ? "/products" : "/register"}>
                      Lihat Semua Paket <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="relative py-24 px-4 overflow-hidden">
          <div className="absolute inset-0 bg-primary/5"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/10 blur-[100px] pointer-events-none rounded-t-full"></div>
          <div className="container relative z-10 mx-auto max-w-2xl text-center space-y-8 glass-panel border-primary/20 p-12 rounded-3xl shadow-[0_0_40px_rgba(16,185,129,0.1)]">
            <h2 className="text-4xl font-bold tracking-tight">Siap Mulai?</h2>
            <p className="text-muted-foreground text-lg">
              Daftar gratis, pilih paket, dan nikmati internet tanpa batas dalam hitungan menit.
            </p>
            <Button size="lg" className="text-lg h-14 px-10 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-transform hover:scale-105" asChild>
              <Link href="/register">Daftar Gratis Sekarang</Link>
            </Button>
            <p className="text-sm text-muted-foreground pt-4">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-primary hover:text-primary/80 hover:underline font-medium">
                Masuk di sini
              </Link>
            </p>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t bg-card">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p className="font-bold text-foreground mb-1">KETANTECH VPN Store</p>
          <p>&copy; {new Date().getFullYear()} KETANTECH. Seluruh hak cipta dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}

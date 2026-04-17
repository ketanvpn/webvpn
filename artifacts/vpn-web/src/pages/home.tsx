import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shield, Zap, Globe, ChevronRight, Server, ArrowRight } from "lucide-react";
import { LogoBrand } from "@/components/logo";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

async function fetchPublicServers() {
  const res = await fetch(`${BASE}/api/servers`);
  if (!res.ok) return [];
  return res.json();
}

const protocolLabel: Record<string, string> = {
  ssh: "SSH",
  vmess: "VMess",
  vless: "VLess",
  trojan: "Trojan",
  shadowsocks: "SS",
};

const protocolColor: Record<string, string> = {
  ssh: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  vmess: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  vless: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trojan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  shadowsocks: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

const infoItems = [
  {
    icon: Zap,
    title: "Aktif Otomatis",
    desc: "Akun langsung dibuat setelah pembayaran dikonfirmasi — tanpa tunggu manual.",
  },
  {
    icon: Globe,
    title: "Multi Protokol",
    desc: "SSH, VMess, VLess, Trojan tersedia. Pilih yang paling cocok untuk kebutuhanmu.",
  },
  {
    icon: Shield,
    title: "Harga Transparan",
    desc: "Tidak ada biaya tersembunyi. Bayar sesuai paket yang kamu pilih.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: servers = [], isLoading } = useQuery<any[]>({
    queryKey: ["public-servers"],
    queryFn: fetchPublicServers,
    staleTime: 60000,
  });

  const scrollToServers = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("server-list")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navbar ─────────────────────────────────── */}
      <header className="border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <LogoBrand iconSize={32} />
          <nav className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={scrollToServers}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block px-2"
            >
              Server
            </button>
            {isAuthenticated ? (
              <Button size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5">
                  Dashboard <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Daftar</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">

        {/* ── Hero ───────────────────────────────────── */}
        <section className="relative px-4 sm:px-6 pt-16 pb-14 lg:pt-24 lg:pb-20 text-center overflow-hidden">
          {/* background glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/15 rounded-full blur-[140px]" />
          </div>

          <div className="relative z-10 mx-auto max-w-2xl flex flex-col items-center gap-5">
            {/* badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs sm:text-sm font-medium text-primary shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Layanan VPN Premium untuk Indonesia
            </div>

            {/* heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              VPN Andal untuk{" "}
              <span className="text-primary drop-shadow-[0_0_24px_rgba(16,185,129,0.45)]">
                Indonesia
              </span>
            </h1>

            {/* sub */}
            <p className="text-sm sm:text-base text-muted-foreground max-w-md leading-relaxed">
              SSH, VMess, VLess, dan Trojan tersedia.
              Akun aktif otomatis setelah pembayaran dikonfirmasi.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-1">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_28px_rgba(16,185,129,0.55)] hover:scale-[1.02] transition-all duration-200"
                  asChild
                >
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_28px_rgba(16,185,129,0.55)] hover:scale-[1.02] transition-all duration-200"
                    asChild
                  >
                    <Link href="/register">Daftar Sekarang</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto px-8 border-white/10 hover:bg-white/5 hover:border-primary/30 transition-all duration-200"
                    onClick={scrollToServers}
                  >
                    Lihat Server
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Info Cards ─────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-14">
          <div className="container mx-auto max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {infoItems.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex gap-4 items-start p-4 sm:p-5 rounded-2xl border border-white/5 bg-card/50 hover:border-white/10 transition-colors"
                >
                  <div className="shrink-0 mt-0.5 h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Server List ────────────────────────────── */}
        <section id="server-list" className="px-4 sm:px-6 pb-16">
          <div className="container mx-auto max-w-4xl">

            {/* heading */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Server Tersedia</h2>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
                  Server aktif yang bisa dipilih saat pemesanan.
                </p>
              </div>
              {!isLoading && servers.length > 0 && (
                <span className="text-xs text-muted-foreground bg-muted/30 border border-white/5 rounded-full px-3 py-1">
                  {servers.length} server
                </span>
              )}
            </div>

            {/* skeleton */}
            {isLoading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-muted/20 animate-pulse" />
                ))}
              </div>

            /* empty */
            ) : servers.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-muted-foreground text-sm gap-2">
                <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-1">
                  <Server className="h-5 w-5 opacity-40" />
                </div>
                <p className="font-medium">Belum ada server tersedia</p>
                <p className="text-xs text-center max-w-xs">Daftar untuk melihat paket lengkap yang tersedia.</p>
              </div>

            /* server cards */
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {servers.map((s: any) => (
                  <div
                    key={s.id}
                    className="group flex items-center gap-4 p-4 sm:p-5 rounded-2xl border border-white/5 bg-card/50 hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)] transition-all duration-200"
                  >
                    {/* flag */}
                    <div className="shrink-0 h-12 w-12 rounded-xl bg-muted/20 border border-white/5 flex items-center justify-center text-2xl">
                      {s.flag}
                    </div>

                    {/* info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1.5">
                        <p className="font-semibold text-sm truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.location}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(s.supportedProtocols ?? []).map((p: string) => (
                          <span
                            key={p}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                              protocolColor[p] ?? "bg-muted/40 text-muted-foreground border-white/10"
                            }`}
                          >
                            {protocolLabel[p] ?? p}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* arrow hint on hover */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/50 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {/* bottom CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button className="w-full sm:w-auto" asChild>
                <Link href={isAuthenticated ? "/products" : "/register"}>
                  {isAuthenticated ? "Lihat Paket & Harga" : "Daftar & Lihat Paket"}
                  <ChevronRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
              {!isAuthenticated && (
                <Button variant="ghost" className="w-full sm:w-auto text-muted-foreground hover:text-foreground" asChild>
                  <Link href="/login">Sudah punya akun? Masuk</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="py-6 border-t border-white/5 bg-card/40">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm font-medium text-foreground">KETANTECH VPN Store</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            &copy; {new Date().getFullYear()} KETANTECH. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </footer>

    </div>
  );
}

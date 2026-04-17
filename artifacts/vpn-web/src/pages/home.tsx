import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shield, Zap, Globe, ChevronRight, Server } from "lucide-react";
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
  ssh: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  vmess: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  vless: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trojan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  shadowsocks: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

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
      {/* Navbar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <LogoBrand iconSize={34} />
          <nav className="flex items-center gap-4">
            <button
              onClick={scrollToServers}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Server
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
        {/* Hero */}
        <section className="relative py-16 lg:py-24 px-4 text-center overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
          <div className="container relative z-10 mx-auto max-w-3xl space-y-5">
            <div className="inline-flex items-center rounded-full border border-primary/30 px-4 py-1.5 text-sm font-medium glass-panel shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
              Layanan VPN Premium untuk Indonesia
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight drop-shadow-md">
              Layanan VPN untuk <span className="text-primary drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">Indonesia</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              SSH, VMess, VLess, dan Trojan tersedia. Harga transparan, akun aktif otomatis setelah pembayaran dikonfirmasi.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {isAuthenticated ? (
                <Button size="lg" className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-105 transition-all" asChild>
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full sm:w-auto px-8 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-105 transition-all" asChild>
                    <Link href="/register">Daftar Sekarang</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 glass-panel border-primary/30 hover:bg-primary/10 transition-all" onClick={scrollToServers}>
                    Lihat Server
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Info Strip */}
        <section className="py-7 px-4 border-y border-white/5 bg-card/40">
          <div className="container mx-auto max-w-4xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-center sm:text-left">
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Aktif Otomatis</p>
                  <p className="text-xs text-muted-foreground">Akun dibuat langsung setelah pembayaran terkonfirmasi.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Globe className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Multi Protokol</p>
                  <p className="text-xs text-muted-foreground">SSH, VMess, VLess, Trojan — sesuaikan dengan kebutuhan.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Harga Jelas</p>
                  <p className="text-xs text-muted-foreground">Tidak ada biaya tambahan. Bayar sesuai paket yang dipilih.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Server List */}
        <section id="server-list" className="py-14 px-4">
          <div className="container mx-auto max-w-5xl">
            <div className="mb-8">
              <h2 className="text-xl font-semibold tracking-tight">Server Tersedia</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Server aktif yang bisa dipilih saat memesan.
              </p>
            </div>

            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : servers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Server className="h-8 w-8 mx-auto mb-3 opacity-30" />
                <p>Belum ada server yang tersedia.</p>
                <p className="mt-1">Daftar akun untuk melihat paket yang tersedia.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {servers.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-4 p-4 rounded-xl glass-card border border-white/5 hover:border-primary/40 hover:shadow-[0_0_16px_rgba(16,185,129,0.12)] transition-all duration-200"
                  >
                    <span className="text-3xl leading-none mt-0.5">{s.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground mb-2">{s.location}</p>
                      <div className="flex flex-wrap gap-1">
                        {(s.supportedProtocols ?? []).map((p: string) => (
                          <span
                            key={p}
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${protocolColor[p] ?? "bg-muted/40 text-muted-foreground border-white/10"}`}
                          >
                            {protocolLabel[p] ?? p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              <Button asChild>
                <Link href={isAuthenticated ? "/products" : "/register"}>
                  {isAuthenticated ? "Lihat Paket" : "Daftar & Lihat Paket"}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              {!isAuthenticated && (
                <Button variant="ghost" asChild>
                  <Link href="/login">Sudah punya akun?</Link>
                </Button>
              )}
            </div>
          </div>
        </section>
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

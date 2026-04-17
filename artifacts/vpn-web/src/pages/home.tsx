import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Zap, Globe, Lock, ChevronRight } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-bold text-xl tracking-tight text-primary">
            KETANTECH
          </div>
          <nav className="flex items-center gap-4">
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
          {/* Ambient Glow */}
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
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8 glass-panel border-primary/30 hover:bg-primary/10 transition-all" asChild>
                <Link href="/products">Lihat Paket</Link>
              </Button>
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
              <div className="p-6 rounded-2xl glass-card border border-white/5 shadow-lg space-y-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Super Cepat</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Server performa tinggi, cocok untuk gaming, streaming, dan browsing sehari-hari.</p>
              </div>
              <div className="p-6 rounded-2xl glass-card border border-white/5 shadow-lg space-y-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Aman & Terenkripsi</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Enkripsi tingkat militer melindungi data dan privasi kamu dari ancaman siber.</p>
              </div>
              <div className="p-6 rounded-2xl glass-card border border-white/5 shadow-lg space-y-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Multi Lokasi</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Server di berbagai negara — akses konten lokal maupun internasional tanpa hambatan.</p>
              </div>
              <div className="p-6 rounded-2xl glass-card border border-white/5 shadow-lg space-y-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">No Log Policy</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">Kami tidak menyimpan riwayat aktivitasmu. Privasi kamu adalah hak, bukan fitur.</p>
              </div>
            </div>
          </div>
        </section>

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

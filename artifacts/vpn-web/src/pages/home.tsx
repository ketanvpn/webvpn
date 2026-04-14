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
        <section className="py-24 lg:py-32 px-4 text-center bg-gradient-to-b from-background to-accent/20">
          <div className="container mx-auto max-w-4xl space-y-8">
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium bg-background shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Layanan VPN Premium untuk Indonesia
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground">
              Internet Bebas.<br className="hidden sm:block" />
              <span className="text-primary">Tanpa Batas.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Nikmati kecepatan tinggi dan keamanan enterprise dengan server SSH, VMess, VLess, dan Trojan premium kami.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
              <Button size="lg" className="w-full sm:w-auto text-lg h-14 px-8" asChild>
                <Link href="/register">Mulai Sekarang</Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg h-14 px-8" asChild>
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
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Super Cepat</h3>
                <p className="text-muted-foreground">Server performa tinggi, cocok untuk gaming, streaming, dan browsing sehari-hari.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Aman & Terenkripsi</h3>
                <p className="text-muted-foreground">Enkripsi tingkat militer melindungi data dan privasi kamu dari ancaman siber.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Globe className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Multi Lokasi</h3>
                <p className="text-muted-foreground">Server di berbagai negara — akses konten lokal maupun internasional tanpa hambatan.</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border shadow-sm space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">No Log Policy</h3>
                <p className="text-muted-foreground">Kami tidak menyimpan riwayat aktivitasmu. Privasi kamu adalah hak, bukan fitur.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-primary/5 border-y">
          <div className="container mx-auto max-w-2xl text-center space-y-6">
            <h2 className="text-3xl font-bold tracking-tight">Siap Mulai?</h2>
            <p className="text-muted-foreground text-lg">
              Daftar gratis, pilih paket, dan nikmati internet tanpa batas dalam hitungan menit.
            </p>
            <Button size="lg" className="text-lg h-14 px-10" asChild>
              <Link href="/register">Daftar Gratis Sekarang</Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
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

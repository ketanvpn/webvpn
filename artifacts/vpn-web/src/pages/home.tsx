import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Shield, Zap, Globe, ChevronRight, Server, ArrowRight, Users, Activity, Clock, UserPlus, CreditCard, Wifi, ChevronDown } from "lucide-react";
import { LogoBrand } from "@/components/logo";
import { motion, Variants, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");

async function fetchPublicServers() {
  const res = await fetch(`${BASE}/api/servers`);
  if (!res.ok) return [];
  return res.json();
}

async function fetchProducts() {
  const res = await fetch(`${BASE}/api/products`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data as any[]).filter((p: any) => p.isActive && p.price > 0).sort((a: any, b: any) => a.price - b.price).slice(0, 3);
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
    desc: "Akun langsung dibuat setelah konfirmasi pembayaran — tanpa tunggu admin.",
  },
  {
    icon: Globe,
    title: "Multi Protokol",
    desc: "Tersedia SSH, VMess, VLess, dan Trojan. Cocokkan dengan semua kebutuhanmu.",
  },
  {
    icon: Shield,
    title: "Harga Transparan",
    desc: "Tanpa biaya tersembunyi, bayar sesuai yang tercantum di paket pilihanmu.",
  },
];

// Animation Variants
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{count.toLocaleString("id-ID")}{suffix}</span>;
}

const howItWorks = [
  { icon: UserPlus, step: "1", title: "Daftar Gratis", desc: "Buat akun dalam hitungan detik. Tanpa kartu kredit." },
  { icon: CreditCard, step: "2", title: "Isi Saldo & Pilih Paket", desc: "Top-up via QRIS/Transfer, lalu pilih paket VPN sesuai kebutuhan." },
  { icon: Wifi, step: "3", title: "Langsung Terhubung", desc: "Akun VPN aktif otomatis. Salin config dan mulai browsing aman." },
];

const faqItems = [
  { q: "Apa itu VPN dan untuk apa?", a: "VPN (Virtual Private Network) mengenkripsi koneksi internet kamu sehingga aktivitas online lebih aman dan privat. Cocok untuk mengakses konten yang dibatasi, melindungi data di WiFi publik, dan kebutuhan tunneling." },
  { q: "Protokol apa saja yang tersedia?", a: "Kami menyediakan SSH, VMess, VLess, dan Trojan. Setiap protokol memiliki kelebihan masing-masing untuk berbagai kebutuhan koneksi." },
  { q: "Bagaimana cara pembayaran?", a: "Kamu bisa top-up saldo via QRIS (scan langsung bayar) atau transfer manual ke rekening bank/e-wallet yang tersedia. Setelah saldo terisi, tinggal pilih paket." },
  { q: "Apakah akun VPN langsung aktif?", a: "Ya! Setelah pembayaran dikonfirmasi, akun VPN kamu langsung dibuat secara otomatis. Tidak perlu menunggu admin." },
  { q: "Bisa perpanjang masa aktif?", a: "Tentu. Masuk ke menu Akun VPN di dashboard, lalu klik Perpanjang pada akun yang ingin diperpanjang." },
];

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const { data: servers = [], isLoading } = useQuery<any[]>({
    queryKey: ["public-servers"],
    queryFn: fetchPublicServers,
    staleTime: 60000,
  });
  const { data: topProducts = [] } = useQuery<any[]>({
    queryKey: ["public-products-top"],
    queryFn: fetchProducts,
    staleTime: 60000,
  });
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const scrollToServers = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("server-list")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden selection:bg-primary/30 selection:text-white">
      {/* ── Navbar ─────────────────────────────────── */}
      <header className="border-b border-white/5 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <LogoBrand iconSize={32} />
          <nav className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={scrollToServers}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors hidden sm:block px-2"
            >
              Server
            </button>
            {isAuthenticated ? (
              <Button size="sm" className="shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all" asChild>
                <Link href="/dashboard" className="flex items-center gap-1.5">
                  Dashboard <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hover:bg-white/5" asChild>
                  <Link href="/login">Masuk</Link>
                </Button>
                <Button size="sm" className="shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all" asChild>
                  <Link href="/register">Daftar</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {/* Abstract Background Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] min-w-[300px] min-h-[300px] bg-primary/10 rounded-full blur-[100px] opacity-60" />
          <div className="absolute top-[20%] right-[-10%] w-[35vw] h-[35vw] min-w-[250px] min-h-[250px] bg-emerald-600/10 rounded-full blur-[120px] opacity-40" />
          <div className="absolute bottom-[-10%] left-[20%] w-[50vw] h-[50vw] min-w-[400px] min-h-[400px] bg-primary/5 rounded-full blur-[150px] opacity-50" />
        </div>

        {/* ── Hero ───────────────────────────────────── */}
        <section className="relative px-4 sm:px-6 pt-20 pb-16 lg:pt-32 lg:pb-24 text-center overflow-hidden flex flex-col items-center justify-center min-h-[75vh]">
          <motion.div
            className="relative z-10 mx-auto max-w-3xl flex flex-col items-center gap-6"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* badge */}
            <motion.div variants={fadeUp} className="glass-panel inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium text-primary mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Akses Internet Aman & Stabil
            </motion.div>

            {/* heading */}
            <motion.div variants={fadeUp}>
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.15]">
                Solusi Jaringan Andal, <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-primary drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  Akses Tanpa Hambatan
                </span>
              </h1>
            </motion.div>

            {/* sub */}
            <motion.p variants={fadeUp} className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed mt-2">
              Hadirkan kenyamanan berselancar di internet dengan koneksi yang stabil dan aman. Proses pendaftaran mudah dan aktivasi instan.
            </motion.p>

            {/* CTA */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto pt-6">
              {isAuthenticated ? (
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 h-14 text-base glow-primary hover:scale-[1.02] transition-all duration-300"
                  asChild
                >
                  <Link href="/dashboard">Buka Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto px-8 h-14 text-base glow-primary hover:scale-[1.02] transition-all duration-300"
                    asChild
                  >
                    <Link href="/register">Mulai Sekarang — Gratis Daftar</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto px-8 h-14 text-base glass-card hover:bg-white/10 hover:border-primary/50 transition-all duration-300"
                    onClick={scrollToServers}
                  >
                    Lihat Lokasi Server
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        </section>

        {/* ── Info Cards ─────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20 relative z-10">
          <motion.div
            className="container mx-auto max-w-5xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              {infoItems.map(({ icon: Icon, title, desc }, idx) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  whileHover={{ y: -5 }}
                  className="glass-card group flex flex-col sm:flex-row gap-4 sm:gap-5 items-start p-6 rounded-3xl hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] transition-all duration-300"
                >
                  <div className="shrink-0 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <Icon className="h-6 w-6 text-primary group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-all" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-1.5">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Server List ────────────────────────────── */}
        <section id="server-list" className="px-4 sm:px-6 pb-24 relative z-10">
          <motion.div
            className="container mx-auto max-w-5xl"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
          >
            {/* heading */}
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Jaringan Global Kami</h2>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Server berkecepatan tinggi yang siap melayani kebutuhan Anda 24/7.
                </p>
              </div>
              {!isLoading && servers.length > 0 && (
                <div className="glass-card inline-flex px-4 py-2 rounded-full border-primary/20">
                  <span className="text-sm font-medium text-primary">
                    <span className="font-bold text-foreground">{servers.length}</span> Server Aktif
                  </span>
                </div>
              )}
            </motion.div>

            {/* content */}
            {isLoading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-28 rounded-3xl glass-card relative overflow-hidden animate-pulse">
                    <div className="absolute inset-0 bg-white/5" />
                  </div>
                ))}
              </div>
            ) : servers.length === 0 ? (
              <motion.div variants={fadeUp} className="py-20 flex flex-col items-center glass-card rounded-3xl text-center border-white/5">
                <div className="h-16 w-16 rounded-3xl bg-muted/20 flex items-center justify-center mb-4 border border-white/5">
                  <Server className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="font-semibold text-lg">Belum ada server</p>
                <p className="text-sm text-muted-foreground mt-1">Silakan mendaftar untuk melihat paket lengkap kami.</p>
              </motion.div>
            ) : (
              <motion.div variants={staggerContainer} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {servers.map((s: any) => (
                  <motion.div
                    key={s.id}
                    variants={fadeUp}
                    whileHover={{ y: -3 }}
                    className="group flex flex-col gap-3 p-5 rounded-3xl glass-card hover:border-primary/40 hover:bg-card/60 hover:shadow-[0_10px_40px_rgba(16,185,129,0.1)] transition-all duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 h-12 w-12 rounded-2xl glass-panel flex items-center justify-center text-2xl shadow-inner shadow-white/10">
                          {s.flag}
                        </div>
                        <div>
                          <p className="font-bold text-base line-clamp-1">{s.name}</p>
                          <p className="text-xs font-medium text-muted-foreground line-clamp-1">{s.location}</p>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:-rotate-45 transition-all duration-300" />
                      </div>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(s.supportedProtocols ?? []).map((p: string) => (
                        <span
                          key={p}
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm ${
                            protocolColor[p] ?? "bg-muted/40 text-muted-foreground border-white/10"
                          }`}
                        >
                          {protocolLabel[p] ?? p}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* bottom CTA */}
            <motion.div variants={fadeUp} className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Button size="lg" className="w-full sm:w-auto px-8 h-12 text-base shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all rounded-xl" asChild>
                <Link href={isAuthenticated ? "/products" : "/register"}>
                  {isAuthenticated ? "Lihat Semua Paket" : "Daftar & Lihat Paket"}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* ── Stats ───────────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20 relative z-10">
          <motion.div className="container mx-auto max-w-4xl" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Users, value: 500, suffix: "+", label: "Pengguna Aktif" },
                { icon: Server, value: servers.length || 5, suffix: "", label: "Server Tersedia" },
                { icon: Activity, value: 99, suffix: "%", label: "Uptime Server" },
                { icon: Clock, value: 24, suffix: "/7", label: "Dukungan Online" },
              ].map(({ icon: Icon, value, suffix, label }) => (
                <motion.div key={label} variants={fadeUp} className="glass-card rounded-2xl p-5 text-center hover:border-primary/30 transition-colors">
                  <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl sm:text-3xl font-extrabold text-foreground"><AnimatedCounter target={value} suffix={suffix} /></p>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">{label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Paket Populer ───────────────────────────── */}
        {topProducts.length > 0 && (
          <section className="px-4 sm:px-6 pb-20 relative z-10">
            <motion.div className="container mx-auto max-w-5xl" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
              <motion.div variants={fadeUp} className="text-center mb-10">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Paket Populer</h2>
                <p className="text-muted-foreground text-sm sm:text-base">Mulai dari harga terjangkau, koneksi langsung aktif.</p>
              </motion.div>
              <div className="grid sm:grid-cols-3 gap-5">
                {topProducts.map((p: any, i: number) => (
                  <motion.div key={p.id} variants={fadeUp} whileHover={{ y: -5 }}
                    className={`glass-card rounded-3xl p-6 flex flex-col relative overflow-hidden transition-all duration-300 ${i === 1 ? "border-primary/40 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : "hover:border-primary/30"}`}
                  >
                    {i === 1 && <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Terlaris</div>}
                    <div className="mb-4">
                      <h3 className="font-bold text-lg">{p.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{p.protocol?.toUpperCase()} • {p.durationDays} Hari</p>
                    </div>
                    <p className="text-3xl font-extrabold text-primary mb-1">{formatRupiah(p.price)}</p>
                    <p className="text-xs text-muted-foreground mb-5">{formatRupiah(Math.round(p.price / p.durationDays))}/hari</p>
                    <div className="mt-auto">
                      <Button className="w-full h-11 glow-primary hover:scale-[1.02] transition-all" asChild>
                        <Link href={isAuthenticated ? "/products" : "/register"}>Pilih Paket</Link>
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Cara Kerja ──────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-20 relative z-10">
          <motion.div className="container mx-auto max-w-4xl" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <motion.div variants={fadeUp} className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Cara Kerja</h2>
              <p className="text-muted-foreground text-sm sm:text-base">Tiga langkah mudah untuk mulai terhubung.</p>
            </motion.div>
            <div className="grid sm:grid-cols-3 gap-6">
              {howItWorks.map(({ icon: Icon, step, title, desc }) => (
                <motion.div key={step} variants={fadeUp} className="glass-card rounded-2xl p-6 text-center group hover:border-primary/30 transition-colors">
                  <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-xs font-bold text-primary mb-2 tracking-widest">LANGKAH {step}</div>
                  <h3 className="font-bold text-base mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── FAQ ──────────────────────────────────────── */}
        <section className="px-4 sm:px-6 pb-24 relative z-10">
          <motion.div className="container mx-auto max-w-2xl" initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={staggerContainer}>
            <motion.div variants={fadeUp} className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Pertanyaan Umum</h2>
              <p className="text-muted-foreground text-sm sm:text-base">Jawaban untuk pertanyaan yang sering ditanyakan.</p>
            </motion.div>
            <div className="space-y-3">
              {faqItems.map((item, i) => (
                <motion.div key={i} variants={fadeUp} className="glass-card rounded-2xl overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors">
                    <span className="font-semibold text-sm sm:text-base pr-4">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${openFaq === i ? "rotate-180 text-primary" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-5 -mt-1">
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="py-10 border-t border-white/5 bg-background/60 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <LogoBrand iconSize={28} />
              <p className="text-xs text-muted-foreground mt-3 max-w-xs leading-relaxed">
                Layanan VPN premium Indonesia dengan aktivasi instan, server cepat, dan dukungan pelanggan 24/7.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Navigasi</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/register" className="hover:text-primary transition-colors">Daftar</Link></li>
                <li><Link href="/login" className="hover:text-primary transition-colors">Masuk</Link></li>
                <li><button onClick={scrollToServers} className="hover:text-primary transition-colors">Server</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Kontak</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>📱 WhatsApp: <span className="text-foreground">Tersedia di Dashboard</span></li>
                <li>🤖 Telegram Bot: <span className="text-foreground">@ketantechvpn_bot</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground font-medium">
              &copy; {new Date().getFullYear()} KETANTECH VPN. Hak Cipta Dilindungi.
            </p>
            <p className="text-[10px] text-muted-foreground/50">v2.0 • Made with ❤️ in Indonesia</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { Wallet, ShoppingCart, Star, History, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";

const actions = [
  { href: "/balance", icon: Wallet, label: "Topup Saldo", desc: "Isi saldo" },
  { href: "/order-vpn", icon: ShoppingCart, label: "Order VPN", desc: "Beli akun baru" },
  { href: "/points", icon: Star, label: "Poin", desc: "Tukar poin" },
  { href: "/balance/logs", icon: History, label: "Riwayat", desc: "Mutasi saldo" },
  { href: "/tickets", icon: MessageCircle, label: "Bantuan", desc: "Tiket support" },
] as const;

export function QuickActions() {
  return (
    <Card className="glass-panel border-white/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">Aksi Cepat</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="block">
            <div className="rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors p-3 flex flex-col items-center gap-1.5 text-center h-full min-h-[84px] justify-center">
              <a.icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-semibold leading-tight">{a.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{a.desc}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

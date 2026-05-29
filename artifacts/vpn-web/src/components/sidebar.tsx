import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  LayoutDashboard,
  Server,
  ShoppingCart,
  Wallet,
  Settings,
  Users,
  ShieldAlert,
  Package,
  CreditCard,
  Menu,
  Shield,
  QrCode,
  Send,
  Bell,
  History,
  Smartphone,
  Gift,
  HardDrive,
  Megaphone,
  Star,
  TicketCheck,
  Activity,
  Tag,
  MoreHorizontal,
  ChevronRight,
  Bug,
  ArrowRightLeft,
  Cloud,
  ShieldPlus,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SheetTrigger } from "@/components/ui/sheet";
import { useGetAdminDashboard, getGetAdminDashboardQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { LogoIcon } from "@/components/logo";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
const API_BASE = `${BASE_URL}api`.replace(/\/+/g, "/");

function usePendingTicketCount(enabled: boolean) {
  return useQuery<{ count: number }>({
    queryKey: ["admin-pending-tickets"],
    queryFn: () => fetch(`${API_BASE}/admin/tickets/pending-count`, { credentials: "include" }).then((r) => r.json()),
    enabled,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "pendingTopups" | "pendingTickets";
};

const userNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Order VPN", href: "/order-vpn", icon: ShieldPlus },
  { title: "Akun VPN", href: "/accounts", icon: Server },
  { title: "Riwayat Order", href: "/orders", icon: ShoppingCart },
  { title: "Saldo", href: "/balance", icon: Wallet },
  { title: "Bantuan", href: "/tickets", icon: TicketCheck },
  { title: "Profil", href: "/profile", icon: Settings },
];

const adminNav: NavItem[] = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Pengguna", href: "/admin/users", icon: Users },
  { title: "Produk", href: "/admin/products", icon: Package },
  { title: "Server", href: "/admin/servers", icon: Server },
  { title: "Order", href: "/admin/orders", icon: ShoppingCart },
  { title: "Topup", href: "/admin/topups", icon: CreditCard, badgeKey: "pendingTopups" },
  { title: "Akun VPN", href: "/admin/accounts", icon: Shield },
  { title: "Payment Gateway", href: "/admin/settings/payment", icon: QrCode },
  { title: "Notifikasi Telegram", href: "/admin/settings/telegram", icon: Bell },
  { title: "WhatsApp OTP", href: "/admin/settings/whatsapp", icon: Smartphone },
  { title: "Program Referral", href: "/admin/settings/referral", icon: Gift },
  { title: "Program Reseller", href: "/admin/settings/reseller", icon: Users },
  { title: "Notifikasi Kedaluwarsa", href: "/admin/settings/expiry-notif", icon: Bell },
  { title: "Monitor Server", href: "/admin/server-monitor", icon: Activity },
  { title: "Order Dynamic", href: "/admin/dynamic-vpn", icon: ShieldPlus },
  { title: "NadiaVPN", href: "/admin/nadiavpn", icon: Cloud },
  { title: "Voucher / Kode Promo", href: "/admin/vouchers", icon: Tag },
  { title: "Tiket Bantuan", href: "/admin/tickets", icon: TicketCheck, badgeKey: "pendingTickets" },
  { title: "Pengumuman", href: "/admin/announcements", icon: Megaphone },
  { title: "Sistem Poin", href: "/admin/settings/points", icon: Star },
  { title: "Manajemen Bug", href: "/admin/bug-presets", icon: Bug },
  { title: "Broadcast", href: "/admin/broadcast", icon: Send },
  { title: "Backup & Restore DB", href: "/admin/backup", icon: HardDrive },
];

const adminPageTitles: Record<string, string> = {
  "/admin": "Overview",
  "/admin/users": "Pengguna",
  "/admin/products": "Produk",
  "/admin/servers": "Server",
  "/admin/orders": "Order",
  "/admin/topups": "Topup",
  "/admin/accounts": "Akun VPN",
  "/admin/settings/payment": "Payment Gateway",
  "/admin/settings/telegram": "Notifikasi Telegram",
  "/admin/settings/whatsapp": "WhatsApp OTP",
  "/admin/settings/referral": "Program Referral",
  "/admin/settings/reseller": "Program Reseller",
  "/admin/settings/expiry-notif": "Notifikasi Kedaluwarsa",
  "/admin/server-monitor": "Monitor Server",
  "/admin/dynamic-vpn": "Order Dynamic",
  "/admin/nadiavpn": "NadiaVPN",
  "/admin/vouchers": "Voucher / Kode Promo",
  "/admin/tickets": "Tiket Bantuan",
  "/admin/announcements": "Pengumuman",
  "/admin/settings/points": "Sistem Poin",
  "/admin/bug-presets": "Manajemen Bug",
  "/admin/broadcast": "Broadcast",
  "/admin/backup": "Backup & Restore DB",
};

const mobileBottomNav: NavItem[] = [
  { title: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { title: "Order", href: "/order-vpn", icon: ShieldPlus },
  { title: "Akun", href: "/accounts", icon: Server },
  { title: "Saldo", href: "/balance", icon: Wallet },
];

const mobileMoreNav: NavItem[] = [
  { title: "Convert Config", href: "/converter", icon: ArrowRightLeft },
  { title: "Bantuan", href: "/tickets", icon: TicketCheck },
  { title: "Program Poin", href: "/points", icon: Star },
  { title: "Riwayat Saldo", href: "/balance/logs", icon: History },
  { title: "Riwayat Order", href: "/orders", icon: ShoppingCart },
  { title: "Profil", href: "/profile", icon: Settings },
];

function isNavActive(location: string, href: string): boolean {
  if (location === href) return true;
  if (
    href !== "/admin" &&
    href !== "/dashboard" &&
    href !== "/" &&
    href !== "/balance"
  ) {
    return location.startsWith(href + "/");
  }
  return false;
}

export function MobileBottomNav() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = mobileMoreNav.some((item) => isNavActive(location, item.href));

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel border-t-0 shadow-[0_-5px_15px_rgba(0,0,0,0.3)] safe-area-inset-bottom">
        <div className="flex items-stretch h-16 relative">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          {mobileBottomNav.map((item) => {
            const active = isNavActive(location, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center flex-1 gap-1 text-[10px] font-medium transition-colors min-w-0 px-1 ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
                <span className="truncate w-full text-center">{item.title}</span>
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Lainnya button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center flex-1 gap-1 text-[10px] font-medium transition-colors min-w-0 px-1 ${
              moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MoreHorizontal className={`h-5 w-5 shrink-0 ${moreActive ? "text-primary" : ""}`} />
            <span className="truncate w-full text-center">Lainnya</span>
            {moreActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-base">Menu Lainnya</SheetTitle>
            <SheetDescription className="sr-only">Navigasi menu tambahan</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-1">
            {mobileMoreNav.map((item) => {
              const active = isNavActive(location, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/30 text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium flex-1">{item.title}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </Link>
              );
            })}
            <div className="mt-2 border-t border-white/5 pt-2">
              <button
                onClick={() => { setMoreOpen(false); logout(); }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-left hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">Keluar</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavLinks({
  nav,
  isAdmin,
  pendingTopups,
  pendingTickets,
  userIsAdmin,
  logout,
  location,
}: {
  nav: NavItem[];
  isAdmin: boolean;
  pendingTopups: number;
  pendingTickets: number;
  userIsAdmin: boolean;
  logout: () => void;
  location: string;
}) {
  return (
    <nav className="flex flex-col gap-1 p-4 h-full overflow-y-auto">
      <div className="mb-6 px-2 flex items-center gap-3">
        <LogoIcon size={38} />
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-base tracking-tight text-foreground">KETANTECH</span>
          <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
            {isAdmin ? "Admin Portal" : "VPN Store"}
          </span>
        </div>
      </div>

      {nav.map((item) => {
        const active = isNavActive(location, item.href);
        const badge =
          item.badgeKey === "pendingTopups" ? pendingTopups :
          item.badgeKey === "pendingTickets" ? pendingTickets : 0;
        const badgeColor =
          item.badgeKey === "pendingTickets"
            ? (active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-red-500 text-white")
            : (active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-yellow-500 text-white");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.title}</span>
            {badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${badgeColor}`}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}

      {!isAdmin && userIsAdmin && (
        <div className="mt-8">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ShieldAlert className="h-4 w-4" />
            Admin Portal
          </Link>
        </div>
      )}

      <div className="mt-auto pt-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>
    </nav>
  );
}

export function MobileAdminHeader() {
  const [location] = useLocation();
  const { logout, isAdmin: userIsAdmin } = useAuth();

  const { data: dashboardData } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), enabled: true, staleTime: 30000 },
  });
  const pendingTopups = dashboardData?.pendingTopups ?? 0;
  const { data: ticketData } = usePendingTicketCount(true);
  const pendingTickets = ticketData?.count ?? 0;

  const pageTitle =
    Object.entries(adminPageTitles)
      .find(([path]) => {
        if (location === path) return true;
        if (path !== "/admin") return location.startsWith(path + "/");
        return false;
      })?.[1] ?? "Admin Portal";

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center h-14 glass-panel border-b-0 shadow-md px-2 gap-2 shrink-0">
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 relative">
            <Menu className="h-5 w-5" />
            {pendingTickets > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
            )}
            {pendingTopups > 0 && pendingTickets === 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-yellow-500" />
            )}
            <span className="sr-only">Buka menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu Navigasi</SheetTitle>
            <SheetDescription>Navigasi utama admin KETANTECH VPN</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <NavLinks
              nav={adminNav}
              isAdmin={true}
              pendingTopups={pendingTopups}
              pendingTickets={pendingTickets}
              userIsAdmin={userIsAdmin}
              logout={logout}
              location={location}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 min-w-0 text-center">
        <span className="text-sm font-semibold truncate">{pageTitle}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={logout}
        title="Keluar"
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">Keluar</span>
      </Button>
    </header>
  );
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const [location] = useLocation();
  const { logout, isAdmin: userIsAdmin } = useAuth();
  const nav = isAdmin ? adminNav : userNav;

  const { data: dashboardData } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), enabled: isAdmin, staleTime: 30000 },
  });
  const { data: ticketData } = usePendingTicketCount(isAdmin);

  const pendingTopups = dashboardData?.pendingTopups ?? 0;
  const pendingTickets = ticketData?.count ?? 0;

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0">
      <NavLinks
        nav={nav}
        isAdmin={isAdmin}
        pendingTopups={pendingTopups}
        pendingTickets={pendingTickets}
        userIsAdmin={userIsAdmin}
        logout={logout}
        location={location}
      />
    </div>
  );
}

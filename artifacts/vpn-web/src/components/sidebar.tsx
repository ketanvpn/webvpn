import React from "react";
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
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SheetTrigger } from "@/components/ui/sheet";
import { useGetAdminDashboard } from "@workspace/api-client-react";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "pendingTopups";
};

const userNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produk VPN", href: "/products", icon: Package },
  { title: "Akun VPN", href: "/accounts", icon: Server },
  { title: "Riwayat Order", href: "/orders", icon: ShoppingCart },
  { title: "Saldo", href: "/balance", icon: Wallet },
  { title: "Riwayat Saldo", href: "/balance/logs", icon: History },
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
  { title: "Broadcast", href: "/admin/broadcast", icon: Send },
];

const mobileBottomNav: NavItem[] = [
  { title: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { title: "Produk", href: "/products", icon: Package },
  { title: "Akun", href: "/accounts", icon: Server },
  { title: "Order", href: "/orders", icon: ShoppingCart },
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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {mobileBottomNav.map((item) => {
          const active = isNavActive(location, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 gap-1 text-[10px] font-medium transition-colors min-w-0 px-1 ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${active ? "text-primary" : ""}`} />
              <span className="truncate w-full text-center">{item.title}</span>
              {active && (
                <span className="absolute bottom-0 h-0.5 w-8 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const [location] = useLocation();
  const { logout, isAdmin: userIsAdmin } = useAuth();
  const nav = isAdmin ? adminNav : userNav;

  const { data: dashboardData } = useGetAdminDashboard({
    query: { enabled: isAdmin, staleTime: 30000 },
  });

  const pendingTopups = dashboardData?.pendingTopups ?? 0;

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 p-4 h-full">
      <div className="mb-6 px-2">
        <h2 className="text-xl font-bold tracking-tight text-primary">
          KETANTECH
        </h2>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
          {isAdmin ? "Admin Portal" : "VPN Store"}
        </p>
      </div>

      {nav.map((item) => {
        const active = isNavActive(location, item.href);
        const badge = item.badgeKey === "pendingTopups" ? pendingTopups : 0;
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
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-yellow-500 text-white"
                }`}
              >
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

  return (
    <>
      {/* Mobile Hamburger — hanya untuk admin */}
      {isAdmin && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden absolute top-4 left-4 z-50">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Buka menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu Navigasi</SheetTitle>
              <SheetDescription>Navigasi utama aplikasi KETANTECH VPN</SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar — selalu tampil di layar besar */}
      <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0">
        <NavLinks />
      </div>
    </>
  );
}

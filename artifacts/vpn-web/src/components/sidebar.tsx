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
  Smartphone,
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
  { title: "WhatsApp OTP", href: "/admin/settings/whatsapp", icon: Smartphone },
  { title: "Broadcast", href: "/admin/broadcast", icon: Send },
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
  "/admin/broadcast": "Broadcast",
};

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

function NavLinks({
  nav,
  isAdmin,
  pendingTopups,
  userIsAdmin,
  logout,
  location,
}: {
  nav: NavItem[];
  isAdmin: boolean;
  pendingTopups: number;
  userIsAdmin: boolean;
  logout: () => void;
  location: string;
}) {
  return (
    <nav className="flex flex-col gap-1 p-4 h-full overflow-y-auto">
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
}

export function MobileAdminHeader() {
  const [location] = useLocation();
  const { logout, isAdmin: userIsAdmin } = useAuth();

  const { data: dashboardData } = useGetAdminDashboard({
    query: { enabled: true, staleTime: 30000 },
  });
  const pendingTopups = dashboardData?.pendingTopups ?? 0;

  const pageTitle =
    Object.entries(adminPageTitles)
      .find(([path]) => {
        if (location === path) return true;
        if (path !== "/admin") return location.startsWith(path + "/");
        return false;
      })?.[1] ?? "Admin Portal";

  return (
    <header className="md:hidden sticky top-0 z-40 flex items-center h-14 border-b bg-card/95 backdrop-blur-sm px-2 gap-2 shrink-0">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 relative">
            <Menu className="h-5 w-5" />
            {pendingTopups > 0 && (
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
    query: { enabled: isAdmin, staleTime: 30000 },
  });

  const pendingTopups = dashboardData?.pendingTopups ?? 0;

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0">
      <NavLinks
        nav={nav}
        isAdmin={isAdmin}
        pendingTopups={pendingTopups}
        userIsAdmin={userIsAdmin}
        logout={logout}
        location={location}
      />
    </div>
  );
}

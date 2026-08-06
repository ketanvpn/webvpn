import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminBadges } from "@/hooks/use-admin-badges";
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
  Network,
  Crown,
  BookOpen,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SheetTrigger } from "@/components/ui/sheet";
import { LogoIcon } from "@/components/logo";

type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: "pendingTopups" | "pendingTickets";
};

type AdminNavGroup = {
  title: string;
  items: NavItem[];
};

const userNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Order VPN", href: "/order-vpn", icon: ShieldPlus },
  { title: "Akun VPN", href: "/accounts", icon: Server },
  { title: "Riwayat Order", href: "/orders", icon: ShoppingCart },
  { title: "Saldo", href: "/balance", icon: Wallet },
  { title: "Riwayat Saldo", href: "/balance/logs", icon: History },
  { title: "Program Poin", href: "/points", icon: Star },
  { title: "Inject Paket", href: "/converter", icon: ArrowRightLeft },
  { title: "Bantuan", href: "/tickets", icon: TicketCheck },
  { title: "Profil", href: "/profile", icon: Settings },
];

const adminOverview: NavItem = {
  title: "Overview",
  href: "/admin",
  icon: LayoutDashboard,
};

const adminNavGroups: AdminNavGroup[] = [
  {
    title: "Katalog",
    items: [
      { title: "Server", href: "/admin/servers", icon: Server },
      { title: "Akun VPN", href: "/admin/accounts", icon: Shield },
      { title: "Voucher / Kode Promo", href: "/admin/vouchers", icon: Tag },
    ],
  },
  {
    title: "Operasi",
    items: [
      { title: "Order", href: "/admin/orders", icon: ShoppingCart },
      { title: "Topup", href: "/admin/topups", icon: CreditCard, badgeKey: "pendingTopups" },
      { title: "Tiket Bantuan", href: "/admin/tickets", icon: TicketCheck, badgeKey: "pendingTickets" },
      { title: "Order Dynamic", href: "/admin/dynamic-vpn", icon: ShieldPlus },
    ],
  },
  {
    title: "Pengguna",
    items: [
      { title: "Pengguna", href: "/admin/users", icon: Users },
      { title: "Program Poin", href: "/admin/settings/points", icon: Star },
      { title: "Program Referral", href: "/admin/settings/referral", icon: Gift },
      { title: "Program Reseller", href: "/admin/settings/reseller", icon: Users },
    ],
  },
  {
    title: "Marketing",
    items: [
      { title: "Pengumuman", href: "/admin/announcements", icon: Megaphone },
      { title: "Broadcast", href: "/admin/broadcast", icon: Send },
    ],
  },
  {
    title: "Sistem",
    items: [
      { title: "Monitor Server", href: "/admin/server-monitor", icon: Activity },
      { title: "NadiaVPN", href: "/admin/nadiavpn", icon: Cloud },
      { title: "Preset Inject Paket", href: "/admin/inject-presets", icon: Network },
      { title: "Manajemen Bug", href: "/admin/bug-presets", icon: Bug },
      { title: "Tutorial Aplikasi", href: "/admin/tutorials", icon: BookOpen },
      { title: "Payment Gateway", href: "/admin/settings/payment", icon: QrCode },
      { title: "Notifikasi Telegram", href: "/admin/settings/telegram", icon: Bell },
      { title: "WhatsApp OTP", href: "/admin/settings/whatsapp", icon: Smartphone },
      { title: "Notifikasi Kedaluwarsa", href: "/admin/settings/expiry-notif", icon: Bell },
      { title: "Backup & Restore DB", href: "/admin/backup", icon: HardDrive },
      { title: "Riwayat Aksi Admin", href: "/admin/audit-logs", icon: History },
    ],
  },
];

const adminNavFlat: NavItem[] = [
  adminOverview,
  ...adminNavGroups.flatMap((g) => g.items),
];

const mobileBottomNav: NavItem[] = [
  { title: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { title: "Order", href: "/order-vpn", icon: ShieldPlus },
  { title: "Akun", href: "/accounts", icon: Server },
  { title: "Saldo", href: "/balance", icon: Wallet },
];

const mobileMoreNav: NavItem[] = [
  { title: "Inject Paket", href: "/converter", icon: ArrowRightLeft },
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

function resolveAdminPageTitle(location: string): string {
  const match = adminNavFlat.find((item) => isNavActive(location, item.href));
  return match?.title ?? "Admin Portal";
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

type NavItemLinkProps = {
  item: NavItem;
  active: boolean;
  badge: number;
};

function NavItemLink({ item, active, badge }: NavItemLinkProps) {
  const badgeColor =
    item.badgeKey === "pendingTickets"
      ? active
        ? "bg-primary-foreground/20 text-primary-foreground"
        : "bg-red-500 text-white"
      : active
        ? "bg-primary-foreground/20 text-primary-foreground"
        : "bg-yellow-500 text-white";

  return (
    <Link
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
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 mt-4 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 first:mt-2">
      {children}
    </div>
  );
}

function AdminNavList({
  location,
  pendingTopups,
  pendingTickets,
}: {
  location: string;
  pendingTopups: number;
  pendingTickets: number;
}) {
  const badgeFor = (item: NavItem) =>
    item.badgeKey === "pendingTopups"
      ? pendingTopups
      : item.badgeKey === "pendingTickets"
        ? pendingTickets
        : 0;

  return (
    <>
      <NavItemLink
        item={adminOverview}
        active={isNavActive(location, adminOverview.href)}
        badge={badgeFor(adminOverview)}
      />
      {adminNavGroups.map((group) => (
        <div key={group.title}>
          <SectionHeader>{group.title}</SectionHeader>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => (
              <NavItemLink
                key={item.href}
                item={item}
                active={isNavActive(location, item.href)}
                badge={badgeFor(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function UserNavList({ location }: { location: string }) {
  return (
    <>
      {userNav.map((item) => (
        <NavItemLink
          key={item.href}
          item={item}
          active={isNavActive(location, item.href)}
          badge={0}
        />
      ))}
    </>
  );
}

function NavLinks({
  isAdmin,
  pendingTopups,
  pendingTickets,
  userIsAdmin,
  userRole,
  logout,
  location,
}: {
  isAdmin: boolean;
  pendingTopups: number;
  pendingTickets: number;
  userIsAdmin: boolean;
  userRole?: string;
  logout: () => void;
  location: string;
}) {
  return (
    <nav className="flex flex-col gap-1 p-4 h-full overflow-y-auto">
      <div className="mb-6 px-2 flex items-center gap-3">
        <LogoIcon size={38} />
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-base tracking-tight text-foreground">KETANTECH</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-primary tracking-widest uppercase">
              {isAdmin ? "Admin Portal" : "VPN Store"}
            </span>
            {!isAdmin && userRole === "reseller" && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Crown className="h-2.5 w-2.5" />
                RESELLER
              </span>
            )}
          </div>
        </div>
      </div>

      {isAdmin ? (
        <AdminNavList
          location={location}
          pendingTopups={pendingTopups}
          pendingTickets={pendingTickets}
        />
      ) : (
        <UserNavList location={location} />
      )}

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
  const { logout, isAdmin: userIsAdmin, user } = useAuth();
  const { pendingTopups, pendingTickets } = useAdminBadges(true);

  const pageTitle = resolveAdminPageTitle(location);

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
              isAdmin={true}
              pendingTopups={pendingTopups}
              pendingTickets={pendingTickets}
              userIsAdmin={userIsAdmin}
              userRole={user?.role}
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
  const { logout, isAdmin: userIsAdmin, user } = useAuth();
  const { pendingTopups, pendingTickets } = useAdminBadges(isAdmin);

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl sticky top-0">
      <NavLinks
        isAdmin={isAdmin}
        pendingTopups={pendingTopups}
        pendingTickets={pendingTickets}
        userIsAdmin={userIsAdmin}
        userRole={user?.role}
        logout={logout}
        location={location}
      />
    </div>
  );
}

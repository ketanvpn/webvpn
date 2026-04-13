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
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const userNav = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Products", href: "/products", icon: Package },
  { title: "My Accounts", href: "/accounts", icon: Server },
  { title: "Orders", href: "/orders", icon: ShoppingCart },
  { title: "Balance", href: "/balance", icon: Wallet },
  { title: "Profile", href: "/profile", icon: Settings },
];

const adminNav = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  { title: "Users", href: "/admin/users", icon: Users },
  { title: "Products", href: "/admin/products", icon: Package },
  { title: "Servers", href: "/admin/servers", icon: Server },
  { title: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { title: "Topups", href: "/admin/topups", icon: CreditCard },
];

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const nav = isAdmin ? adminNav : userNav;

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-6 px-2">
        <h2 className="text-xl font-bold tracking-tight text-primary">
          KETANTECH
        </h2>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
          {isAdmin ? "Admin Portal" : "VPN Store"}
        </p>
      </div>

      {nav.map((item) => {
        const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/admin" && item.href !== "/dashboard" && item.href !== "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}

      {!isAdmin && (
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
          Logout
        </Button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden absolute top-4 left-4 z-50">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <div className="flex h-full flex-col">
            <NavLinks />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card/50 backdrop-blur-xl">
        <NavLinks />
      </div>
    </>
  );
}

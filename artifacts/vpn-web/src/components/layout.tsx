import React from "react";
import { Sidebar, MobileBottomNav, MobileAdminHeader } from "./sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Skeleton } from "./ui/skeleton";

export function Layout({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, isLoading, isAdmin, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation("/login");
      } else if (requireAdmin && !isAdmin) {
        setLocation("/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, isAdmin, requireAdmin, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (requireAdmin && !isAdmin)) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full bg-background/95">
      <Sidebar isAdmin={requireAdmin} />
      <div className="flex flex-col flex-1 min-w-0">
        {requireAdmin && <MobileAdminHeader />}
        <main className="flex-1 overflow-y-auto w-full">
          <div
            className={`mx-auto max-w-6xl p-4 md:p-8 ${
              !requireAdmin ? "pb-24 md:pb-8" : ""
            }`}
          >
            {children}
          </div>
        </main>
      </div>
      {!requireAdmin && <MobileBottomNav />}
    </div>
  );
}

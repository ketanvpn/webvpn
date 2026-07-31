import { useQuery } from "@tanstack/react-query";
import {
  useGetAdminDashboard,
  getGetAdminDashboardQueryKey,
} from "@workspace/api-client-react";
import { apiClient } from "@/lib/api-client";

function usePendingTicketCount(enabled: boolean) {
  return useQuery<{ count: number }>({
    queryKey: ["admin-pending-tickets"],
    queryFn: () => apiClient.get<{ count: number }>("/api/admin/tickets/pending-count"),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Satu sumber angka badge admin (pending topup + pending ticket).
 * TanStack Query men-dedupe per queryKey, jadi memanggil hook ini di
 * beberapa komponen (Sidebar + MobileAdminHeader) hanya menghasilkan
 * satu request tiap endpoint.
 */
export function useAdminBadges(enabled: boolean) {
  const { data: dashboardData } = useGetAdminDashboard({
    query: {
      queryKey: getGetAdminDashboardQueryKey(),
      enabled,
      staleTime: 30_000,
    },
  });
  const { data: ticketData } = usePendingTicketCount(enabled);

  return {
    pendingTopups: dashboardData?.pendingTopups ?? 0,
    pendingTickets: ticketData?.count ?? 0,
  };
}

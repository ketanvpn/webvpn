import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ResellerStatus, PromoData, ReferralStatus } from "@/lib/types/profile";

export function useResellerStatus(enabled: boolean) {
  return useQuery<ResellerStatus>({
    queryKey: ["reseller", "status"],
    queryFn: () => apiClient.get<ResellerStatus>("/api/reseller/status"),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });
}

export function useResellerPromo(enabled: boolean) {
  return useQuery<PromoData>({
    queryKey: ["reseller", "promo"],
    queryFn: () => apiClient.get<PromoData>("/api/reseller/promo"),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useReferralStatus() {
  return useQuery<ReferralStatus>({
    queryKey: ["referral", "status"],
    queryFn: () => apiClient.get<ReferralStatus>("/api/referral/status"),
    staleTime: 120_000,
  });
}

export function usePointsSummary(enabled = true) {
  return useQuery<{ points: number }>({
    queryKey: ["user-points", "summary"],
    queryFn: () => apiClient.get<{ points: number }>("/api/points"),
    enabled,
    staleTime: 30_000,
  });
}

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale/id";
import { UserCircle, Mail, Phone, Calendar, LogOut, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { getApiError } from "@/lib/utils";

import { InfoRow } from "@/components/profile/InfoRow";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { SecurityCard } from "@/components/profile/SecurityCard";
import { TelegramNotifCard } from "@/components/profile/TelegramNotifCard";
import { ReferralCard } from "@/components/profile/ReferralCard";
import { ResellerStatusCard } from "@/components/profile/ResellerStatusCard";
import { ResellerPromoCard, ResellerPromoDisabledCard } from "@/components/profile/ResellerPromoCard";
import { QuickActions } from "@/components/profile/QuickActions";

import {
  useResellerStatus,
  useResellerPromo,
  useReferralStatus,
} from "@/hooks/profile/use-profile-extras";

export default function Profile() {
  const { user, isLoading, logout } = useAuth();
  const { toast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [promoRequested, setPromoRequested] = useState(false);
  const [promoRequesting, setPromoRequesting] = useState(false);

  const isReseller = user?.role === "reseller";
  const isUser = user?.role === "user";

  const resellerStatusQuery = useResellerStatus(!!isReseller);
  const promoQuery = useResellerPromo(!!isUser);
  const referralStatusQuery = useReferralStatus();

  if (isLoading && !user) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return <ProfileSkeleton />;
  }

  const promo = promoQuery.data ?? null;

  const handlePromoRequest = async () => {
    setPromoRequesting(true);
    try {
      const data = await apiClient.post<{ message?: string; error?: string }>("/api/reseller/request");
      setPromoRequested(true);
      toast({ title: "Permintaan terkirim!", description: data.message });
    } catch (err) {
      toast({ title: "Gagal", description: getApiError(err, "Gagal mengirim permintaan."), variant: "destructive" });
    } finally {
      setPromoRequesting(false);
    }
  };

  const formattedJoinDate = (() => {
    try {
      return format(new Date(user.createdAt), "d MMMM yyyy", { locale: localeId });
    } catch {
      try {
        return format(new Date(user.createdAt), "d MMMM yyyy");
      } catch {
        return String(user.createdAt);
      }
    }
  })();

  return (
    <div className="max-w-lg mx-auto pb-6 space-y-4">
      <ProfileHero user={user} onEdit={() => setEditMode(true)} editMode={editMode} />

      <ProfileStats user={user} />

      {editMode ? (
        <EditProfileForm user={user} onClose={() => setEditMode(false)} onSuccess={() => setEditMode(false)} />
      ) : (
        <Card className="glass-panel border-white/5 overflow-hidden shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <div className="px-4">
                <InfoRow icon={UserCircle} label="Username" value={`@${user.username}`} />
              </div>
              <div className="px-4">
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={user.email || <span className="text-muted-foreground italic text-sm">Belum diisi</span>}
                />
              </div>
              {user.whatsapp && (
                <div className="px-4">
                  <InfoRow icon={Phone} label="No. WhatsApp" value={user.whatsapp} />
                </div>
              )}
              <div className="px-4">
                <InfoRow icon={Calendar} label="Bergabung" value={formattedJoinDate} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <SecurityCard />

      <TelegramNotifCard user={user} />

      {user.referralCode && <ReferralCard referralCode={user.referralCode} status={referralStatusQuery.data} />}

      {isReseller && resellerStatusQuery.data && (
        <ResellerStatusCard status={resellerStatusQuery.data} onRefresh={() => resellerStatusQuery.refetch()} loading={resellerStatusQuery.isFetching} />
      )}

      {isUser && promo?.promoEnabled && (
        <ResellerPromoCard
          promo={promo}
          onRequest={handlePromoRequest}
          requesting={promoRequesting}
          requested={promoRequested}
          onNavigateTopup={() => {
            window.location.href = "/balance";
          }}
        />
      )}

      {isUser && promo && !promo.promoEnabled && <ResellerPromoDisabledCard />}

      <QuickActions />

      <div className="pt-2">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4 text-red-500" />
          </div>
          <span className="font-semibold text-sm">Keluar dari Akun</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
    </div>
  );
}

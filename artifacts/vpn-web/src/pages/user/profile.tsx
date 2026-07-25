import { getApiError } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useUpdateProfile,
  useChangePassword,
  useGetTelegramLink,
  useUnlinkTelegram,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { profileSchema, passwordSchema } from "./profile/schemas";
import type { ResellerStatus, PromoData } from "./profile/types";
import { ProfileHeroCard, LogoutButton } from "./profile/profile-hero-card";
import { SecuritySection } from "./profile/security-section";
import { TelegramVpnSection } from "./profile/telegram-vpn-section";
import { TelegramNotifSection } from "./profile/telegram-notif-section";
import { ReferralSection } from "./profile/referral-section";
import { ResellerStatusSection } from "./profile/reseller-status-section";
import { ResellerPromoSection } from "./profile/reseller-promo-section";
import { z } from "zod";

const API = import.meta.env.VITE_API_URL ?? "";

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [resellerStatus, setResellerStatus] = useState<ResellerStatus | null>(null);
  const [resellerLoading, setResellerLoading] = useState(false);
  const [vpnTgInfo, setVpnTgInfo] = useState<{ vpnTelegramId: number | null }>({
    vpnTelegramId: null,
  });
  const [vpnLink, setVpnLink] = useState<string | null>(null);
  const [vpnLinkLoading, setVpnLinkLoading] = useState(false);
  const [vpnUnlinkLoading, setVpnUnlinkLoading] = useState(false);
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [promoRequesting, setPromoRequesting] = useState(false);
  const [promoRequested, setPromoRequested] = useState(false);

  const fetchResellerStatus = () => {
    if (user?.role !== "reseller") return;
    setResellerLoading(true);
    fetch(`${API}/api/reseller/status`, { credentials: "include" })
      .then((r) => r.json())
      .then(setResellerStatus)
      .catch(() => {})
      .finally(() => setResellerLoading(false));
  };

  useEffect(() => {
    fetchResellerStatus();
    if (user?.role !== "reseller") return;
    const interval = setInterval(fetchResellerStatus, 30_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  useEffect(() => {
    if (user?.role !== "user") return;
    fetch(`${API}/api/reseller/promo`, { credentials: "include" })
      .then((r) => r.json())
      .then(setPromo)
      .catch(() => {});
  }, [user?.role]);

  const handlePromoRequest = async () => {
    setPromoRequesting(true);
    try {
      const r = await fetch(`${API}/api/reseller/request`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (r.ok) {
        setPromoRequested(true);
        toast({ title: "Permintaan terkirim!", description: data.message });
      } else {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Gagal mengirim permintaan.", variant: "destructive" });
    } finally {
      setPromoRequesting(false);
    }
  };

  const copyReferralCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  };

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const unlinkTelegram = useUnlinkTelegram();

  const { refetch: fetchTelegramLink, isFetching: isFetchingLink } = useGetTelegramLink({
    query: { enabled: false } as never,
  });

  const handleGetTelegramLink = async () => {
    const result = await fetchTelegramLink();
    if (result.data?.url) {
      setTelegramLink(result.data.url);
    } else if (result.data?.token) {
      setTelegramLink(`t.me/…?start=link_${result.data.token}`);
      toast({
        title: "Token berhasil dibuat",
        description: "Salin link dan kirim ke bot Telegram kamu",
      });
    }
  };

  const handleUnlinkTelegram = () => {
    unlinkTelegram.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Telegram berhasil diputus" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setTelegramLink(null);
      },
      onError: () => toast({ title: "Gagal memutus Telegram", variant: "destructive" }),
    });
  };

  const refreshVpnLinkStatus = () => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.vpnTelegramId !== "undefined") {
          setVpnTgInfo({ vpnTelegramId: data.vpnTelegramId ?? null });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    refreshVpnLinkStatus();
  }, []);

  const handleGetVpnLink = async () => {
    setVpnLinkLoading(true);
    try {
      const r = await fetch(`${API}/api/telegram/vpn-link`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (r.ok && data?.url) {
        setVpnLink(data.url);
      } else {
        toast({
          title: "Gagal membuat link Bot VPN",
          description: data?.error || "Coba lagi nanti.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Gagal membuat link Bot VPN", variant: "destructive" });
    } finally {
      setVpnLinkLoading(false);
    }
  };

  const handleUnlinkVpn = async () => {
    setVpnUnlinkLoading(true);
    try {
      const r = await fetch(`${API}/api/telegram/vpn-link`, {
        method: "DELETE",
        credentials: "include",
      });
      if (r.ok) {
        toast({ title: "Akun Bot VPN berhasil diputus" });
        setVpnTgInfo({ vpnTelegramId: null });
        setVpnLink(null);
      } else {
        const data = await r.json().catch(() => ({}));
        toast({
          title: "Gagal memutus Bot VPN",
          description: data?.error || "Coba lagi nanti.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Gagal memutus Bot VPN", variant: "destructive" });
    } finally {
      setVpnUnlinkLoading(false);
    }
  };

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: user?.fullName ?? "",
      email: user?.email ?? "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  if (!user) return null;

  const onSaveProfile = (values: z.infer<typeof profileSchema>) => {
    updateProfile.mutate(
      { data: { fullName: values.fullName || null, email: values.email } },
      {
        onSuccess: () => {
          toast({ title: "Profil berhasil diperbarui" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setEditMode(false);
        },
        onError: (err) =>
          toast({
            title: "Gagal memperbarui profil",
            description: getApiError(err),
            variant: "destructive",
          }),
      }
    );
  };

  const onChangePassword = (values: z.infer<typeof passwordSchema>) => {
    changePassword.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password berhasil diubah" });
          passwordForm.reset();
          setShowPasswordForm(false);
        },
        onError: (err) =>
          toast({
            title: "Gagal ubah password",
            description: getApiError(err),
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div className="max-w-lg mx-auto pb-6 space-y-4">
      <ProfileHeroCard
        user={user}
        editMode={editMode}
        profileForm={profileForm}
        isUpdating={updateProfile.isPending}
        onSaveProfile={onSaveProfile}
        onToggleEditMode={() => setEditMode(true)}
        onCancelEdit={() => {
          setEditMode(false);
          profileForm.reset();
        }}
      />

      <SecuritySection
        showPasswordForm={showPasswordForm}
        passwordForm={passwordForm}
        isChangingPassword={changePassword.isPending}
        onTogglePasswordForm={() => setShowPasswordForm(true)}
        onChangePassword={onChangePassword}
        onCancelPasswordForm={() => {
          setShowPasswordForm(false);
          passwordForm.reset();
        }}
      />

      <TelegramVpnSection
        vpnTelegramId={vpnTgInfo.vpnTelegramId}
        vpnLink={vpnLink}
        vpnLinkLoading={vpnLinkLoading}
        vpnUnlinkLoading={vpnUnlinkLoading}
        onGetVpnLink={handleGetVpnLink}
        onUnlinkVpn={handleUnlinkVpn}
        onResetVpnLink={() => setVpnLink(null)}
      />

      <TelegramNotifSection
        telegramId={user.telegramId}
        telegramLink={telegramLink}
        isFetchingLink={isFetchingLink}
        onGetTelegramLink={handleGetTelegramLink}
        onUnlinkTelegram={handleUnlinkTelegram}
        onResetTelegramLink={() => setTelegramLink(null)}
        unlinkTelegramMutation={unlinkTelegram}
      />

      {user.referralCode && (
        <ReferralSection
          referralCode={user.referralCode}
          copiedCode={copiedCode}
          onCopyReferralCode={copyReferralCode}
        />
      )}

      {user.role === "reseller" && resellerStatus && (
        <ResellerStatusSection
          resellerStatus={resellerStatus}
          resellerLoading={resellerLoading}
          onRefresh={fetchResellerStatus}
        />
      )}

      {user.role === "user" && promo?.promoEnabled && (
        <ResellerPromoSection
          promo={promo}
          promoRequesting={promoRequesting}
          promoRequested={promoRequested}
          onPromoRequest={handlePromoRequest}
        />
      )}

      <LogoutButton onLogout={logout} />
    </div>
  );
}

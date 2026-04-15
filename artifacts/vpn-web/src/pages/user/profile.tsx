import { getApiError } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useUpdateProfile,
  useChangePassword,
  useGetTelegramLink,
  useUnlinkTelegram,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  UserCircle, Mail, Shield, Calendar, Edit2, Lock, Send,
  CheckCircle, ExternalLink, Gift, Copy, Check, Phone,
  LogOut, TrendingUp, RefreshCw, ChevronRight, X, KeyRound, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { formatRupiah } from "@/lib/format";

const API = import.meta.env.VITE_API_URL ?? "";

type ResellerStatus = {
  resellerEnabled: boolean;
  discountPercent: number;
  targetEnabled: boolean;
  monthlyTarget: number;
  currentMonthSales: number;
  progressPercent: number | null;
  currentMonth: string;
};

const profileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email("Email tidak valid"),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Wajib diisi"),
  newPassword: z.string().min(6, "Minimal 6 karakter"),
  confirmPassword: z.string().min(1, "Wajib diisi"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Konfirmasi password tidak cocok",
  path: ["confirmPassword"],
});

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

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

  type PromoData = { promoEnabled: boolean; promoTitle: string; promoText: string; requestEnabled: boolean; discountPercent: number };
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
      const r = await fetch(`${API}/api/reseller/request`, { method: "POST", credentials: "include" });
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
      toast({ title: "Token berhasil dibuat", description: "Salin link dan kirim ke bot Telegram kamu" });
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
          toast({ title: "Gagal memperbarui profil", description: getApiError(err), variant: "destructive" }),
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
          toast({ title: "Gagal ubah password", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const initials = (user.fullName || user.username).slice(0, 2).toUpperCase();

  const roleLabel: Record<string, string> = { user: "Pengguna", reseller: "Reseller", admin: "Admin" };
  const roleColor: Record<string, string> = {
    user: "bg-blue-100 text-blue-700",
    reseller: "bg-purple-100 text-purple-700",
    admin: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="max-w-lg mx-auto pb-6 space-y-4">

      {/* ── Hero Card ── */}
      <Card className="overflow-hidden border-0 shadow-md">
        {/* Gradient header */}
        <div className="h-24 bg-gradient-to-br from-primary to-primary/70 relative" />

        <CardContent className="px-5 pb-5 pt-0">
          {/* Avatar */}
          <div className="flex items-end justify-between -mt-10 mb-4">
            <div className="h-20 w-20 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center text-primary font-bold text-2xl select-none">
              {initials}
            </div>
            {!editMode && (
              <Button size="sm" variant="outline" className="gap-1.5 mb-1" onClick={() => setEditMode(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {/* Name + badges */}
          <div className="mb-1">
            <h2 className="text-xl font-bold leading-tight">{user.fullName || user.username}</h2>
            {user.fullName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColor[user.role] ?? "bg-muted text-muted-foreground"}`}>
              {roleLabel[user.role] ?? user.role}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
              {user.isActive ? "Aktif" : "Disuspend"}
            </span>
          </div>

          {/* Edit form */}
          {editMode ? (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Edit Profil</p>
                <button onClick={() => { setEditMode(false); profileForm.reset(); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-3">
                  <FormField control={profileForm.control} name="fullName" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nama Lengkap</FormLabel>
                      <FormControl><Input placeholder="Nama lengkap kamu" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={profileForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl><Input type="email" placeholder="email@contoh.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm" disabled={updateProfile.isPending} className="flex-1">
                      {updateProfile.isPending ? "Menyimpan..." : "Simpan"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setEditMode(false); profileForm.reset(); }}>
                      Batal
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border bg-muted/20 overflow-hidden">
              <div className="px-4"><InfoRow icon={UserCircle} label="Username" value={`@${user.username}`} /></div>
              <div className="px-4"><InfoRow icon={Mail} label="Email" value={user.email || <span className="text-muted-foreground italic text-sm">Belum diisi</span>} /></div>
              {user.whatsapp && <div className="px-4"><InfoRow icon={Phone} label="No. WhatsApp" value={user.whatsapp} /></div>}
              <div className="px-4"><InfoRow icon={Calendar} label="Bergabung" value={format(new Date(user.createdAt), "d MMMM yyyy")} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Keamanan ── */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-orange-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Keamanan</p>
            <p className="text-xs text-muted-foreground">Kelola password akun</p>
          </div>
          {!showPasswordForm && (
            <button onClick={() => setShowPasswordForm(true)} className="text-muted-foreground hover:text-primary transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
        {showPasswordForm && (
          <>
            <Separator />
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> Ubah Password</p>
                <button onClick={() => { setShowPasswordForm(false); passwordForm.reset(); }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-3">
                  <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Saat Ini</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Baru</FormLabel>
                      <FormControl><Input type="password" placeholder="Min. 6 karakter" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Konfirmasi Password Baru</FormLabel>
                      <FormControl><Input type="password" placeholder="Ulangi password baru" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm" variant="destructive" disabled={changePassword.isPending} className="flex-1">
                      {changePassword.isPending ? "Mengubah..." : "Ubah Password"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setShowPasswordForm(false); passwordForm.reset(); }}>
                      Batal
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </>
        )}
      </Card>

      {/* ── Telegram ── */}
      <Card className="overflow-hidden border shadow-sm">
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-sky-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Notifikasi Telegram</p>
              <p className="text-xs text-muted-foreground">Terima notifikasi order & topup</p>
            </div>
            {user.telegramId && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Terhubung
              </span>
            )}
          </div>

          {user.telegramId ? (
            <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 flex items-center justify-between">
              <p className="text-xs text-green-700">ID: {user.telegramId}</p>
              <button
                onClick={handleUnlinkTelegram}
                disabled={unlinkTelegram.isPending}
                className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
              >
                {unlinkTelegram.isPending ? "Memutus..." : "Putus koneksi"}
              </button>
            </div>
          ) : !telegramLink ? (
            <Button variant="outline" size="sm" onClick={handleGetTelegramLink} disabled={isFetchingLink} className="gap-2 w-full">
              <Send className="h-4 w-4" />
              {isFetchingLink ? "Membuat link..." : "Hubungkan Telegram"}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Klik link berikut untuk menghubungkan akun Telegram:</p>
              <a href={telegramLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 rounded-lg px-3 py-2 border border-primary/20">
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{telegramLink}</span>
              </a>
              <p className="text-xs text-muted-foreground">Link hanya berlaku sekali.</p>
              <button onClick={() => setTelegramLink(null)} className="text-xs text-muted-foreground hover:text-primary underline">
                Buat link baru
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Referral ── */}
      {user.referralCode && (
        <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Program Referral</p>
                <p className="text-xs text-muted-foreground">Ajak teman, dapat bonus saldo otomatis</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-background rounded-xl border px-4 py-3 shadow-sm">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-0.5">Kode kamu</p>
                <p className="text-lg font-mono font-bold tracking-[0.2em] text-primary">{user.referralCode}</p>
              </div>
              <Button size="sm" variant={copiedCode ? "default" : "outline"} className="gap-1.5 shrink-0" onClick={copyReferralCode}>
                {copiedCode ? <><Check className="h-3.5 w-3.5" /> Tersalin!</> : <><Copy className="h-3.5 w-3.5" /> Salin</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Bonus masuk otomatis saat temanmu beli produk pertama.
            </p>
          </div>
        </Card>
      )}

      {/* ── Reseller Status ── */}
      {user.role === "reseller" && resellerStatus && (
        <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-blue-50/80 via-transparent to-transparent dark:from-blue-950/20">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Status Reseller</p>
                  <p className="text-xs text-muted-foreground">Bulan {resellerStatus.currentMonth}</p>
                </div>
              </div>
              <button
                onClick={fetchResellerStatus}
                disabled={resellerLoading}
                className="text-muted-foreground hover:text-blue-600 disabled:opacity-40 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${resellerLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Discount badge */}
            <div className="flex items-center justify-between rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 mb-4">
              <span className="text-sm text-muted-foreground">Diskon harga reseller</span>
              <span className="font-bold text-green-600 text-xl">{resellerStatus.discountPercent}%</span>
            </div>

            {/* Progress */}
            {resellerStatus.targetEnabled ? (
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Penjualan bulan ini</p>
                    <p className="text-lg font-bold">{formatRupiah(resellerStatus.currentMonthSales)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Target: {formatRupiah(resellerStatus.monthlyTarget)}</p>
                </div>
                <div className="space-y-1.5">
                  <Progress value={resellerStatus.progressPercent ?? 0} className="h-2.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${(resellerStatus.progressPercent ?? 0) >= 100 ? "text-green-600" : "text-muted-foreground"}`}>
                      {resellerStatus.progressPercent ?? 0}%
                    </span>
                    {(resellerStatus.progressPercent ?? 0) >= 100 ? (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Target tercapai!
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Kurang {formatRupiah(resellerStatus.monthlyTarget - resellerStatus.currentMonthSales)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Status dievaluasi setiap tanggal 1.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Target bulanan tidak diaktifkan. Status reseller kamu permanen.</p>
            )}
          </div>
        </Card>
      )}

      {/* ── Ajakan Reseller — hanya untuk user biasa ── */}
      {user.role === "user" && promo?.promoEnabled && (
        <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-primary/8 via-transparent to-transparent">
          <div className="px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{promo.promoTitle}</p>
                <span className="text-[10px] bg-primary text-primary-foreground font-bold px-2 py-0.5 rounded-full">
                  Hemat {promo.discountPercent}%
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {promo.promoText.replace("{discount}", String(promo.discountPercent))}
            </p>
            {promoRequested ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle className="h-4 w-4" />
                Permintaan terkirim! Admin akan segera menghubungi kamu.
              </div>
            ) : promo.requestEnabled ? (
              <Button
                onClick={handlePromoRequest}
                disabled={promoRequesting}
                size="sm"
                className="w-full gap-2"
              >
                {promoRequesting ? "Mengirim..." : "Ajukan Jadi Reseller →"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Hubungi admin untuk bergabung sebagai reseller.</p>
            )}
          </div>
        </Card>
      )}

      {/* ── Keluar ── */}
      <div className="md:hidden">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4 text-red-500" />
          </div>
          <span className="font-semibold text-sm">Keluar dari Akun</span>
          <ChevronRight className="h-4 w-4 ml-auto" />
        </button>
      </div>
    </div>
  );
}

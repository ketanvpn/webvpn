import { getApiError } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  useUpdateProfile,
  useChangePassword,
  useGetTelegramLink,
  useUnlinkTelegram,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UserCircle, Mail, Key, Shield, Calendar, Edit2, Lock, Send, CheckCircle, ExternalLink, Gift, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

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
    query: { enabled: false },
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil</h1>
        <p className="text-muted-foreground mt-1">Kelola informasi akun kamu.</p>
      </div>

      {/* Profile Card */}
      <Card className="border-2 shadow-sm overflow-hidden">
        <div className="h-28 bg-primary/10 relative">
          <div className="absolute -bottom-10 left-6 h-20 w-20 bg-background rounded-full p-1.5 border-2 border-border">
            <div className="h-full w-full bg-primary/20 rounded-full flex items-center justify-center text-primary">
              <UserCircle className="h-10 w-10" />
            </div>
          </div>
        </div>

        <CardContent className="pt-14 pb-6 px-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{user.fullName || user.username}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="capitalize flex items-center gap-1 text-xs">
                  <Shield className="h-3 w-3" /> {user.role}
                </Badge>
                <Badge
                  variant={user.isActive ? "outline" : "destructive"}
                  className={user.isActive ? "border-green-500 text-green-600 text-xs" : "text-xs"}
                >
                  {user.isActive ? "Aktif" : "Disuspend"}
                </Badge>
              </div>
            </div>
            {!editMode && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditMode(true)}>
                <Edit2 className="h-3.5 w-3.5" /> Edit Profil
              </Button>
            )}
          </div>

          <Separator className="my-4" />

          {editMode ? (
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input placeholder="Nama lengkap kamu" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@contoh.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={updateProfile.isPending} size="sm">
                    {updateProfile.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditMode(false); profileForm.reset(); }}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" /> Username
                </div>
                <div className="font-medium">{user.username}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </div>
                <div className="font-medium">{user.email}</div>
              </div>
              {user.fullName && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <UserCircle className="h-3.5 w-3.5" /> Nama Lengkap
                  </div>
                  <div className="font-medium">{user.fullName}</div>
                </div>
              )}
              {user.referralCode && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" /> Kode Referral
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-mono bg-muted px-2 py-0.5 rounded text-sm inline-block tracking-widest">
                      {user.referralCode}
                    </div>
                    <button
                      onClick={copyReferralCode}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title="Salin kode"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Bergabung
                </div>
                <div className="font-medium">{format(new Date(user.createdAt), "d MMMM yyyy")}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" /> Keamanan
              </CardTitle>
              <CardDescription className="mt-1">Ubah password akun kamu</CardDescription>
            </div>
            {!showPasswordForm && (
              <Button size="sm" variant="outline" onClick={() => setShowPasswordForm(true)}>
                Ubah Password
              </Button>
            )}
          </div>
        </CardHeader>
        {showPasswordForm && (
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Saat Ini</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 6 karakter" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konfirmasi Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Ulangi password baru" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={changePassword.isPending} size="sm" variant="destructive">
                    {changePassword.isPending ? "Mengubah..." : "Ubah Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowPasswordForm(false); passwordForm.reset(); }}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        )}
      </Card>

      {/* Telegram Linking Card */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4" /> Notifikasi Telegram
              </CardTitle>
              <CardDescription className="mt-1">
                Hubungkan akun dengan Telegram untuk menerima notifikasi topup
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          {user.telegramId ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Telegram terhubung (ID: {user.telegramId})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlinkTelegram}
                disabled={unlinkTelegram.isPending}
                className="text-destructive hover:text-destructive border-destructive/30"
              >
                {unlinkTelegram.isPending ? "Memutus..." : "Putus Koneksi Telegram"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {!telegramLink ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetTelegramLink}
                  disabled={isFetchingLink}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isFetchingLink ? "Membuat link..." : "Dapatkan Link Telegram"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Klik link di bawah untuk membuka bot Telegram dan menghubungkan akun:
                  </p>
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="break-all">{telegramLink}</span>
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Link hanya berlaku satu kali. Jika bot tidak merespons, buat link baru.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTelegramLink(null)}
                    className="text-xs"
                  >
                    Buat link baru
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Belum punya bot? Tanya admin untuk mendapatkan link bot KETANTECH VPN.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Card */}
      {user.referralCode && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-primary/10 rounded-full flex items-center justify-center">
                <Gift className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4" /> Program Referral
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Ajak teman — dapatkan bonus saldo!
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Bagikan kode referral kamu. Setiap teman yang mendaftar dan melakukan pembelian pertama,
                kamu akan mendapat bonus saldo otomatis.
              </p>
              <div className="flex items-center gap-2 bg-muted/60 rounded-lg p-3 border">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Kode Referral kamu</p>
                  <p className="text-xl font-mono font-bold tracking-[0.2em] text-primary">
                    {user.referralCode}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={copyReferralCode}
                >
                  {copiedCode
                    ? <><Check className="h-3.5 w-3.5 text-green-500" /> Tersalin!</>
                    : <><Copy className="h-3.5 w-3.5" /> Salin</>
                  }
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Minta temanmu masukkan kode ini saat mendaftar. Bonus akan otomatis masuk ke saldo kamu setelah temanmu beli produk pertama.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

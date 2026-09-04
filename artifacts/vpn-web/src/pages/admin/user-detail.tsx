import { getApiError } from "@/lib/utils";
import { useAdminGetUser, useAdminUpdateUser, getAdminGetUserQueryKey, useAdminGetUserBalanceLogs, getAdminGetUserBalanceLogsQueryKey, useAdminResetUserPassword, useAdminDeleteUser } from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, UserCircle, Wallet, Lock, Unlock, Mail, Calendar,
  ShoppingCart, Server, CreditCard, CheckCircle, XCircle, Clock,
  History, ArrowUpRight, ArrowDownLeft, Settings2, Phone, Send, Users, Trash2, Crown,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatRupiah, safeFormatDate } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminUpdateUserBodyRole } from "@workspace/api-client-react";
import { useState } from "react";
import { ROLE_COLORS } from "@/lib/constants";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  processing: "bg-blue-500/10 text-blue-600 border-blue-200",
  paid: "bg-green-500/10 text-green-600 border-green-200",
  failed: "bg-red-500/10 text-red-600 border-red-200",
  expired: "bg-gray-500/10 text-gray-600 border-gray-200",
  confirmed: "bg-green-500/10 text-green-600 border-green-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const userId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [balanceAdjustment, setBalanceAdjustment] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteDialog1, setShowDeleteDialog1] = useState(false);
  const [showDeleteDialog2, setShowDeleteDialog2] = useState(false);

  const { data: user, isLoading } = useAdminGetUser(userId, {
    query: { enabled: !!userId, queryKey: getAdminGetUserQueryKey(userId) },
  });

  const { data: balanceLogsData } = useAdminGetUserBalanceLogs(userId, {}, {
    query: { queryKey: getAdminGetUserBalanceLogsQueryKey(userId, {}), enabled: !!userId, staleTime: 30000 },
  });

  const updateUser = useAdminUpdateUser();
  const resetPassword = useAdminResetUserPassword();
  const deleteUser = useAdminDeleteUser();
  const [, navigate] = useLocation();

  const handleUpdateRole = (role: AdminUpdateUserBodyRole) => {
    updateUser.mutate(
      { id: userId, data: { role } },
      {
        onSuccess: () => {
          toast({ title: "Role berhasil diubah", description: `Role diubah menjadi ${role}` });
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        },
      }
    );
  };

  const handleToggleLock = () => {
    updateUser.mutate(
      { id: userId, data: { isActive: !user?.isActive } },
      {
        onSuccess: () => {
          toast({
            title: "Status akun diperbarui",
            description: user?.isActive ? "Akun disuspend" : "Akun diaktifkan kembali",
          });
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
        },
      }
    );
  };

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(balanceAdjustment, 10);
    if (isNaN(amount) || amount === 0) return;

    updateUser.mutate(
      { id: userId, data: { adjustBalance: amount } },
      {
        onSuccess: () => {
          toast({ title: "Saldo berhasil disesuaikan", description: `${amount > 0 ? "+" : ""}${formatRupiah(amount)}` });
          setBalanceAdjustment("");
          // Invalidate user data (untuk update total saldo)
          queryClient.invalidateQueries({ queryKey: getAdminGetUserQueryKey(userId) });
          // Perbaikan: Invalidate juga log saldo agar riwayat langsung muncul tanpa refresh!
          queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "balance-logs"] });
        },
        onError: (err) =>
          toast({ title: "Gagal menyesuaikan saldo", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const handleConfirmDelete = () => {
    deleteUser.mutate(
      { id: userId },
      {
        onSuccess: () => {
          toast({ title: "Pengguna berhasil dihapus", description: `Akun ${user?.username} dan semua datanya telah dihapus permanen.` });
          navigate("/admin/users");
        },
        onError: (err) => {
          setShowDeleteDialog2(false);
          toast({ title: "Gagal menghapus pengguna", description: getApiError(err), variant: "destructive" });
        },
      }
    );
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return;
    resetPassword.mutate(
      { id: userId, data: { newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password berhasil direset", description: `Password user ${user?.username} telah diubah.` });
          setNewPassword("");
        },
        onError: (err) =>
          toast({ title: "Gagal reset password", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (!user) return <div>User tidak ditemukan</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link href="/admin/users" className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar User
        </Link>
      </Button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Kiri: info user + tab data */}
        <div className="md:col-span-2 space-y-6">
          {/* Profil */}
          <Card className="glass-panel border-white/5 overflow-hidden">
            <div className="h-24 bg-primary/10 relative" />
            <div className="absolute top-[5.5rem] left-10 h-16 w-16 bg-[#0a0a0a] rounded-full p-1.5 shadow-xl border border-white/10">
              <div className="h-full w-full bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xl">
                {user.username.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <CardContent className="pt-12 pb-6 px-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">{user.username}</h2>
                  <div className="text-muted-foreground flex items-center gap-2 mt-1 text-sm">
                    <Mail className="h-4 w-4" /> {user.email}
                  </div>
                  {user.fullName && (
                    <div className="text-muted-foreground text-sm mt-0.5">{user.fullName}</div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={user.isActive ? "outline" : "destructive"}>
                    {user.isActive ? "Aktif" : "Disuspend"}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    {user.role === 'reseller' && <Crown className="h-3.5 w-3.5 text-emerald-400" />}
                    <Badge variant="outline" className={`capitalize ${ROLE_COLORS[user.role]?.badge ?? ""}`}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 text-sm">
                <div>
                  <div className="text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Bergabung
                  </div>
                  <div className="font-medium">{safeFormatDate(user.createdAt, "d MMM yyyy")}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Kode Referral</div>
                  <div className="font-mono font-medium">{user.referralCode ?? "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground flex items-center gap-1 mb-1">
                    <Phone className="h-3.5 w-3.5" /> WhatsApp
                  </div>
                  <div className="font-medium">
                    {user.whatsapp ? (
                      <a
                        href={`https://wa.me/${user.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {user.whatsapp}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">Tidak ada</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground flex items-center gap-1 mb-1">
                    <Send className="h-3.5 w-3.5" /> Telegram
                  </div>
                  <div className="font-medium">
                    {user.telegramId ? (
                      <span className="text-blue-600">
                        {user.telegramUsername ? `@${user.telegramUsername}` : `ID: ${user.telegramId}`}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Belum terhubung</span>
                    )}
                  </div>
                </div>
                {user.referredBy && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground flex items-center gap-1 mb-1">
                      <Users className="h-3.5 w-3.5" /> Didaftarkan via Referral
                    </div>
                    <div className="font-mono font-medium text-purple-600">{user.referredBy}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tab data */}
          <Tabs defaultValue="orders">
            <TabsList className="w-full glass-panel border border-white/5 flex-wrap h-auto p-1">
              <TabsTrigger value="orders" className="flex-1 gap-2">
                <ShoppingCart className="h-4 w-4" /> Pesanan ({user.orders?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="accounts" className="flex-1 gap-2">
                <Server className="h-4 w-4" /> Akun VPN ({user.accounts?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="topups" className="flex-1 gap-2">
                <CreditCard className="h-4 w-4" /> Topup ({user.topupHistory?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="balance-logs" className="flex-1 gap-2">
                <History className="h-4 w-4" /> Log Saldo ({balanceLogsData?.total ?? 0})
              </TabsTrigger>
            </TabsList>

            {/* Orders */}
            <TabsContent value="orders">
              <Card className="glass-panel border-white/5">
                <CardContent className="p-0">
                  {!user.orders || user.orders.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Belum ada pesanan</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {user.orders.map((order) => (
                        <div key={order.id} className="p-4 flex justify-between items-center hover:bg-white/5">
                          <div>
                            <div className="font-medium text-sm">{order.product?.name ?? `Produk #${order.productId}`}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {safeFormatDate(order.createdAt, "d MMM yyyy HH:mm")} &bull; {order.paymentMethod}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-sm">{formatRupiah(order.amount)}</div>
                            <Badge className={`mt-1 text-[10px] ${statusColor[order.status] ?? ""}`} variant="outline">
                              {order.status === "paid" ? "Lunas" : order.status === "pending" ? "Menunggu" : order.status === "failed" ? "Gagal" : "Kedaluwarsa"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Akun VPN */}
            <TabsContent value="accounts">
              <Card className="glass-panel border-white/5">
                <CardContent className="p-0">
                  {!user.accounts || user.accounts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Belum ada akun VPN</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {user.accounts.map((acc) => (
                        <div key={acc.id} className="p-4 flex justify-between items-start hover:bg-white/5">
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              <Badge variant="secondary" className="uppercase text-[10px]">{acc.protocol}</Badge>
                              <span className="font-mono">{acc.username}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Server: {acc.server?.name ?? "-"} &bull; Kedaluarsa: {safeFormatDate(acc.expiresAt, "d MMM yyyy")}
                            </div>
                          </div>
                          <Badge
                            variant={acc.isActive && new Date(acc.expiresAt) > new Date() ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {acc.isActive && new Date(acc.expiresAt) > new Date() ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Topup */}
            <TabsContent value="topups">
              <Card className="glass-panel border-white/5">
                <CardContent className="p-0">
                  {!user.topupHistory || user.topupHistory.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">Belum ada riwayat topup</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {user.topupHistory.map((t) => (
                        <div key={t.id} className="p-4 flex justify-between items-center hover:bg-white/5">
                          <div>
                            <div className="font-medium text-sm">{formatRupiah(t.amount)}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {safeFormatDate(t.createdAt, "d MMM yyyy HH:mm")}
                            </div>
                          </div>
                          <Badge
                            className={`text-[10px] capitalize ${statusColor[t.status] ?? ""}`}
                            variant="outline"
                          >
                            {t.status === "confirmed" && <CheckCircle className="h-3 w-3 mr-1 inline" />}
                            {t.status === "rejected" && <XCircle className="h-3 w-3 mr-1 inline" />}
                            {t.status === "pending" && <Clock className="h-3 w-3 mr-1 inline" />}
                            {t.status === "confirmed" ? "Dikonfirmasi" : t.status === "pending" ? "Menunggu" : "Ditolak"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Log Saldo */}
            <TabsContent value="balance-logs">
              <Card className="glass-panel border-white/5">
                <CardContent className="p-0">
                  {!balanceLogsData?.data || balanceLogsData.data.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      <History className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      Belum ada riwayat perubahan saldo
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {balanceLogsData.data.map((log) => {
                        const isPositive = log.amount >= 0;
                        const lowerDescription = (log.description ?? "").toLowerCase();
                        const typeInfo = log.type === "topup"
                          ? { label: "Topup", color: "bg-green-500/10 text-green-700 border-green-200", icon: <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" /> }
                          : log.type === "order" && lowerDescription.includes("renew")
                          ? { label: "Renew", color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: <ArrowUpRight className="h-3.5 w-3.5 text-amber-600" /> }
                          : log.type === "order"
                          ? { label: "Pembelian", color: "bg-red-500/10 text-red-700 border-red-200", icon: <ArrowUpRight className="h-3.5 w-3.5 text-red-600" /> }
                          : { label: "Penyesuaian", color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: <Settings2 className="h-3.5 w-3.5 text-blue-600" /> };
                        return (
                          <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-white/5">
                            <div className="mt-0.5 w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              {typeInfo.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{log.description}</span>
                                <Badge className={`text-[10px] ${typeInfo.color}`} variant="outline">{typeInfo.label}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {safeFormatDate(log.createdAt, "d MMM yyyy, HH:mm")} &bull;{" "}
                                <span className="opacity-70">{formatRupiah(log.balanceBefore)} → {formatRupiah(log.balanceAfter)}</span>
                              </div>
                            </div>
                            <span className={`font-bold text-sm flex-shrink-0 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                              {isPositive ? "+" : ""}{formatRupiah(log.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Kanan: kontrol */}
        <div className="space-y-6">
          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Saldo & Dompet
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Saldo Saat Ini</div>
                <div className="text-3xl font-bold text-primary">{formatRupiah(user.balance)}</div>
              </div>

              {user.role !== "admin" && (
                <form onSubmit={handleAdjustBalance} className="space-y-3 pt-4 border-t border-white/5">
                  <Label className="text-xs text-muted-foreground">Sesuaikan Saldo (+/-)</Label>
                  <p className="text-xs text-muted-foreground">Positif = tambah, negatif = kurangi</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Contoh: 50000 atau -10000"
                      value={balanceAdjustment}
                      onChange={(e) => setBalanceAdjustment(e.target.value)}
                      data-testid="input-balance-adjust"
                    />
                    <Button type="submit" size="sm" disabled={updateUser.isPending || !balanceAdjustment}>
                      Terapkan
                    </Button>
                  </div>
                </form>
              )}
              {user.role === "admin" && (
                <p className="text-xs text-muted-foreground pt-4 border-t italic">
                  Saldo tidak berlaku untuk akun Administrator.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass-panel border-white/5">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCircle className="h-4 w-4 text-primary" /> Kontrol Akses
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-3">
                <Label>Role Akun</Label>
                <Select
                  value={user.role}
                  onValueChange={(v: AdminUpdateUserBodyRole) => handleUpdateRole(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User Biasa</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-3">
                <Label className="text-xs text-muted-foreground">Reset Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Password baru (min. 6 karakter)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                  <Button type="submit" size="sm" variant="outline" disabled={resetPassword.isPending || newPassword.length < 6}>
                    Reset
                  </Button>
                </div>
              </form>

              {user.role !== "admin" && (
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <Button
                    variant={user.isActive ? "destructive" : "default"}
                    className="w-full gap-2"
                    onClick={handleToggleLock}
                    disabled={updateUser.isPending}
                    data-testid="button-toggle-lock"
                  >
                    {user.isActive ? (
                      <><Lock className="h-4 w-4" /> Suspend Akun</>
                    ) : (
                      <><Unlock className="h-4 w-4" /> Aktifkan Kembali</>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {user.isActive
                      ? "User yang disuspend tidak bisa login atau membeli."
                      : "User akan mendapatkan akses penuh kembali."}
                  </p>

                  <div className="pt-2 border-t border-white/5">
                    <Button
                      variant="outline"
                      className="w-full gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => setShowDeleteDialog1(true)}
                    >
                      <Trash2 className="h-4 w-4" /> Hapus Pengguna
                    </Button>
                  </div>
                </div>
              )}

              {/* Dialog Peringatan 1 */}
              <AlertDialog open={showDeleteDialog1} onOpenChange={setShowDeleteDialog1}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive flex items-center gap-2">
                      <Trash2 className="h-5 w-5" /> Hapus Pengguna?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3 text-sm">
                        <p>Kamu akan menghapus akun <strong>{user.username}</strong> beserta seluruh data berikut secara permanen:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Semua riwayat pesanan</li>
                          <li>Semua akun VPN milik user ini</li>
                          <li>Semua riwayat topup</li>
                          <li>Saldo dan log saldo</li>
                        </ul>
                        <p className="font-semibold text-destructive">Data yang dihapus tidak bisa dikembalikan!</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={() => { setShowDeleteDialog1(false); setShowDeleteDialog2(true); }}
                    >
                      Lanjutkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Dialog Peringatan 2 — Konfirmasi Final */}
              <AlertDialog open={showDeleteDialog2} onOpenChange={setShowDeleteDialog2}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive flex items-center gap-2">
                      ⚠️ Konfirmasi Terakhir
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Ini adalah langkah terakhir. Setelah dikonfirmasi, akun <strong>{user.username}</strong> dan semua datanya akan terhapus permanen dan tidak bisa dipulihkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowDeleteDialog2(false)}>Batal, Jangan Hapus</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={handleConfirmDelete}
                      disabled={deleteUser.isPending}
                    >
                      {deleteUser.isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

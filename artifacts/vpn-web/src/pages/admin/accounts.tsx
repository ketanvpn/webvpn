import { getApiError } from "@/lib/utils";
import {
  useAdminListAccounts,
  useAdminToggleAccount,
  useAdminDeleteAccount,
  useAdminExtendAccount,
  getAdminListAccountsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Search, ChevronLeft, ChevronRight, Power, CalendarPlus, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";

const LIMIT = 20;

const protocolOptions = ["semua", "ssh", "vmess", "vless", "trojan", "shadowsocks"];

export default function AdminAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [protocol, setProtocol] = useState("semua");
  const [isActiveFilter, setIsActiveFilter] = useState("semua");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 400);
  const [extendDays, setExtendDays] = useState("30");
  const [extendDialogId, setExtendDialogId] = useState<number | null>(null);
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());

  const handleSync = async (id: number, username: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      await customFetch(`/api/admin/accounts/${id}/sync`, { method: "POST" });
      toast({ title: `Akun "${username}" berhasil disinkron dari panel` });
      queryClient.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
    } catch {
      toast({ title: `Gagal sync akun "${username}" dari panel`, variant: "destructive" });
    } finally {
      setSyncingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const { data, isLoading } = useAdminListAccounts({
    limit: LIMIT,
    offset,
    protocol: protocol === "semua" ? undefined : protocol,
    isActive: isActiveFilter === "semua" ? undefined : isActiveFilter === "aktif",
    search: debouncedSearch || undefined,
  });

  const toggleAccount = useAdminToggleAccount();
  const deleteAccount = useAdminDeleteAccount();
  const extendAccount = useAdminExtendAccount();

  const handleToggle = (id: number, currentActive: boolean) => {
    toggleAccount.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: currentActive ? "Akun VPN dinonaktifkan" : "Akun VPN diaktifkan",
          });
          queryClient.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal mengubah status akun", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteAccount.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Akun VPN dihapus" });
          queryClient.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal menghapus akun", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const handleExtend = () => {
    if (!extendDialogId) return;
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days < 1) return;

    extendAccount.mutate(
      { id: extendDialogId, data: { days } },
      {
        onSuccess: (res) => {
          toast({
            title: "Akun diperpanjang",
            description: `Expired baru: ${format(new Date(res.expiresAt), "d MMM yyyy")}`,
          });
          setExtendDialogId(null);
          queryClient.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal memperpanjang akun", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const accounts = data?.accounts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Akun VPN</h1>
        <p className="text-muted-foreground mt-1">Pantau dan kelola semua akun VPN aktif dari seluruh user.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari username / email user..."
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setOffset(0); }}
            className="pl-9"
            data-testid="input-account-search"
          />
        </div>
        <Select
          value={protocol}
          onValueChange={(v) => { setProtocol(v); setOffset(0); }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {protocolOptions.map((p) => (
              <SelectItem key={p} value={p} className="uppercase">
                {p === "semua" ? "Semua Protokol" : p.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={isActiveFilter}
          onValueChange={(v) => { setIsActiveFilter(v); setOffset(0); }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="aktif">Aktif</SelectItem>
            <SelectItem value="nonaktif">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" /> Daftar Akun ({total})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {debouncedSearch ? `Tidak ada akun untuk "${debouncedSearch}".` : "Tidak ada akun VPN ditemukan."}
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((acc) => {
                const expired = acc.expiresAt && new Date(acc.expiresAt) < new Date();
                const isActive = acc.isActive && !expired;
                return (
                  <div
                    key={acc.id}
                    className="p-4 sm:p-5 grid sm:grid-cols-[1fr_auto] gap-3 hover:bg-accent/20 transition-colors"
                    data-testid={`row-account-${acc.id}`}
                  >
                    <div className="flex flex-wrap gap-4 items-start">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="uppercase text-[10px] font-mono w-20 justify-center">
                            {acc.protocol}
                          </Badge>
                          <span className="font-mono font-medium text-sm">{acc.username}</span>
                          <Badge
                            variant={isActive ? "default" : "destructive"}
                            className="text-[10px]"
                          >
                            {expired ? "Kedaluwarsa" : isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>
                            User:{" "}
                            {acc.user ? (
                              <Link
                                href={`/admin/users/${acc.userId}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {acc.user.username}
                              </Link>
                            ) : (
                              `#${acc.userId}`
                            )}
                          </span>
                          <span>Server: {(acc as any).server?.name ?? "-"}</span>
                          <span>
                            Expired:{" "}
                            {acc.expiresAt ? format(new Date(acc.expiresAt), "d MMM yyyy") : "-"}
                          </span>
                          {acc.quota != null && (
                            <span>
                              Kuota: {acc.usedQuota ?? 0}/{acc.quota} GB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                      {/* Sync button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs h-8 text-violet-600 border-violet-200 hover:bg-violet-50"
                        onClick={() => handleSync(acc.id, acc.username)}
                        disabled={syncingIds.has(acc.id)}
                        title="Sync UUID & config link dari panel VPS"
                        data-testid={`button-sync-account-${acc.id}`}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${syncingIds.has(acc.id) ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                      {/* Extend button */}
                      <Dialog open={extendDialogId === acc.id} onOpenChange={(open) => {
                        if (!open) setExtendDialogId(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                            onClick={() => { setExtendDialogId(acc.id); setExtendDays("30"); }}
                            data-testid={`button-extend-account-${acc.id}`}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Perpanjang
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Perpanjang Akun VPN</DialogTitle>
                            <DialogDescription>
                              Akun: <strong className="font-mono">{acc.username}</strong><br />
                              Expired sekarang: {acc.expiresAt ? format(new Date(acc.expiresAt), "d MMM yyyy") : "-"}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-3 py-2">
                            <Label>Tambah berapa hari?</Label>
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={extendDays}
                              onChange={(e) => setExtendDays(e.target.value)}
                              placeholder="Contoh: 30"
                            />
                            <p className="text-xs text-muted-foreground">
                              Dihitung dari tanggal expired saat ini (atau hari ini jika sudah expired).
                            </p>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setExtendDialogId(null)}>Batal</Button>
                            <Button
                              onClick={handleExtend}
                              disabled={extendAccount.isPending}
                            >
                              Perpanjang {extendDays} Hari
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Toggle button */}
                      <Button
                        size="sm"
                        variant={acc.isActive ? "outline" : "default"}
                        className={`gap-1.5 text-xs h-8 ${acc.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : ""}`}
                        onClick={() => handleToggle(acc.id, acc.isActive)}
                        disabled={toggleAccount.isPending}
                        data-testid={`button-toggle-account-${acc.id}`}
                      >
                        <Power className="h-3.5 w-3.5" />
                        {acc.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </Button>

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                            disabled={deleteAccount.isPending}
                            data-testid={`button-delete-account-${acc.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Akun VPN?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Akun <strong className="font-mono">{acc.username}</strong> milik <strong>{acc.user?.username ?? `#${acc.userId}`}</strong> akan dihapus permanen dari database. Aksi ini tidak bisa dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => handleDelete(acc.id)}
                            >
                              Hapus Permanen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            disabled={offset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(offset + LIMIT)}
            disabled={offset + LIMIT >= total}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

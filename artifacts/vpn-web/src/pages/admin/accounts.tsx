import { useAdminListAccounts, useAdminToggleAccount, getAdminListAccountsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Search, ChevronLeft, ChevronRight, Power } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

const LIMIT = 20;

const protocolOptions = ["semua", "ssh", "vmess", "vless", "trojan", "shadowsocks"];

export default function AdminAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [protocol, setProtocol] = useState("semua");
  const [isActiveFilter, setIsActiveFilter] = useState("semua");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useAdminListAccounts({
    limit: LIMIT,
    offset,
    protocol: protocol === "semua" ? undefined : protocol,
    isActive: isActiveFilter === "semua" ? undefined : isActiveFilter === "aktif",
  });

  const toggleAccount = useAdminToggleAccount();

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
          toast({ title: "Gagal mengubah status akun", description: err.error, variant: "destructive" }),
      }
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setOffset(0);
  };

  const accounts = data?.accounts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  const filtered = search
    ? accounts.filter(
        (a) =>
          a.username?.toLowerCase().includes(search.toLowerCase()) ||
          a.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
          a.user?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : accounts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Akun VPN</h1>
        <p className="text-muted-foreground mt-1">Pantau dan kelola semua akun VPN aktif dari seluruh user.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Cari username / email user..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs"
            data-testid="input-account-search"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
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
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Tidak ada akun VPN ditemukan.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((acc) => {
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
                            {expired ? "Expired" : isActive ? "Aktif" : "Nonaktif"}
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
                    <div className="flex items-center gap-2 sm:justify-end">
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

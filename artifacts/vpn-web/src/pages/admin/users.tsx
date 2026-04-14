import { useAdminListUsers } from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";
import { Users, Search, ShieldAlert, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-600 border-red-200",
  reseller: "bg-blue-500/10 text-blue-600 border-blue-200",
  user: "",
};

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebounce(search, 500);

  const { data, isLoading } = useAdminListUsers({
    search: debouncedSearch || undefined,
    role: roleFilter === "all" ? undefined : roleFilter,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const users = data?.users ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(0);
  };

  const handleRoleChange = (val: string) => {
    setRoleFilter(val);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-muted-foreground mt-1">Kelola user dan reseller platform.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari username / email..."
              className="pl-9"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={handleRoleChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> Daftar User
            {!isLoading && <span className="text-sm font-normal text-muted-foreground">({total} total)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y">
              {users.map((user) => (
                <div key={user.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {user.username}
                        {user.role === 'admin' && <ShieldAlert className="h-3 w-3 text-red-500" />}
                        {user.role === 'reseller' && <Shield className="h-3 w-3 text-blue-500" />}
                        <Badge variant="outline" className={`text-[10px] capitalize ${roleColors[user.role] ?? ""}`}>
                          {user.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="text-sm text-right hidden sm:block">
                      <div className="font-medium text-primary">{formatRupiah(user.balance)}</div>
                      <div className="text-xs text-muted-foreground">Bergabung {format(new Date(user.createdAt), "MMM yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={user.isActive ? "outline" : "destructive"}>
                        {user.isActive ? "Aktif" : "Disuspend"}
                      </Badge>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={`/admin/users/${user.id}`}>Kelola</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              {search || roleFilter !== "all"
                ? "Tidak ada user yang cocok dengan filter."
                : "Belum ada user terdaftar."}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <span className="text-sm text-muted-foreground">
                Halaman {page + 1} dari {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

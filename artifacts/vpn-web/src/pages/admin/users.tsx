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
import { Users, Search, ShieldAlert, Shield, ChevronLeft, ChevronRight, UserPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getApiError } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { ROLE_COLORS } from "@/lib/constants";

const PAGE_SIZE = 20;

type CreateUserForm = {
  username: string;
  password: string;
  fullName: string;
  email: string;
  whatsapp: string;
  role: "user" | "reseller" | "admin";
};

const defaultForm: CreateUserForm = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  whatsapp: "",
  role: "user",
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebounce(search, 500);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(defaultForm);
  const [isCreating, setIsCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<CreateUserForm>>({});

  const { data, isLoading } = useAdminListUsers({
    search: debouncedSearch || undefined,
    role: roleFilter === "all" ? undefined : (roleFilter as any),
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

  function validateForm(): boolean {
    const errors: Partial<CreateUserForm> = {};
    if (!form.username.trim() || form.username.trim().length < 3) {
      errors.username = "Username minimal 3 karakter";
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      errors.username = "Hanya huruf, angka, dan underscore";
    }
    if (!form.password || form.password.length < 6) {
      errors.password = "Password minimal 6 karakter";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Format email tidak valid";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleCreate() {
    if (!validateForm()) return;
    setIsCreating(true);
    try {
      const data = await apiClient.post<{ username: string; role: string }>("/api/admin/users", {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName || undefined,
        email: form.email || undefined,
        whatsapp: form.whatsapp || undefined,
        role: form.role,
      });
      toast({ title: "Pengguna berhasil dibuat!", description: `@${data.username} (${data.role}) sudah ditambahkan.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDialogOpen(false);
      setForm(defaultForm);
      setFormErrors({});
    } catch (err) {
      toast({ title: "Gagal membuat pengguna", description: getApiError(err, "Tidak dapat terhubung ke server"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenDialog() {
    setForm(defaultForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="text-muted-foreground mt-1">Kelola user dan reseller platform.</p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2 shrink-0">
          <UserPlus className="h-4 w-4" />
          Tambah Pengguna
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
          <SelectTrigger className="w-full sm:w-[140px]">
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

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
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
            <div className="divide-y divide-white/5">
              {users.map((user) => (
                <div key={user.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      user.role === 'reseller' 
                        ? 'bg-emerald-500/15 text-emerald-400' 
                        : user.role === 'admin'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {user.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        {user.username}
                        {user.role === 'admin' && <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />}
                        {user.role === 'reseller' && <Crown className="h-3.5 w-3.5 text-emerald-400" />}
                        <Badge variant="outline" className={`text-[10px] capitalize ${ROLE_COLORS[user.role]?.badge ?? ""}`}>
                          {user.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email ?? "-"}</div>
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Tambah Pengguna Baru
            </DialogTitle>
            <DialogDescription>
              Buat akun baru secara manual. Akun langsung aktif tanpa verifikasi WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-username"
                  placeholder="contoh123"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
                {formErrors.username && (
                  <p className="text-xs text-destructive">{formErrors.username}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((f) => ({ ...f, role: v as CreateUserForm["role"] }))}
                >
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">
                Password <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Min. 6 karakter"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
              {formErrors.password && (
                <p className="text-xs text-destructive">{formErrors.password}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-fullname">
                Nama Lengkap <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <Input
                id="new-fullname"
                placeholder="Nama lengkap pengguna"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email">
                Email <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <Input
                id="new-email"
                type="email"
                placeholder="email@contoh.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              {formErrors.email && (
                <p className="text-xs text-destructive">{formErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-whatsapp">
                WhatsApp <span className="text-muted-foreground text-xs">(opsional)</span>
              </Label>
              <Input
                id="new-whatsapp"
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={isCreating} className="gap-2">
              {isCreating ? (
                "Membuat..."
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Buat Akun
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import {
  useAdminListServers,
  useAdminCreateServer,
  useAdminUpdateServer,
  useAdminDeleteServer,
  getAdminListServersQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Server, Plus, MoreVertical, Edit, Trash2, Activity, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminListServersResponseItem } from "@workspace/api-client-react/src/generated/api.schemas";

type ServerForm = {
  name: string;
  location: string;
  flag: string;
  host: string;
  apiUrl: string;
  apiToken: string;
  supportedProtocols: string[];
  isActive: boolean;
};

const emptyForm: ServerForm = {
  name: "",
  location: "",
  flag: "🌐",
  host: "",
  apiUrl: "",
  apiToken: "",
  supportedProtocols: ["ssh", "vmess"],
  isActive: true,
};

const allProtocols = ["ssh", "vmess", "vless", "trojan", "shadowsocks"];

const COUNTRY_FLAGS = [
  // Asia Tenggara
  { flag: "🇮🇩", name: "Indonesia" },
  { flag: "🇸🇬", name: "Singapura" },
  { flag: "🇲🇾", name: "Malaysia" },
  { flag: "🇹🇭", name: "Thailand" },
  { flag: "🇵🇭", name: "Filipina" },
  { flag: "🇻🇳", name: "Vietnam" },
  { flag: "🇰🇭", name: "Kamboja" },
  { flag: "🇲🇲", name: "Myanmar" },
  // Asia Timur
  { flag: "🇯🇵", name: "Jepang" },
  { flag: "🇰🇷", name: "Korea Selatan" },
  { flag: "🇨🇳", name: "Tiongkok" },
  { flag: "🇹🇼", name: "Taiwan" },
  { flag: "🇭🇰", name: "Hong Kong" },
  { flag: "🇲🇴", name: "Makau" },
  // Asia Selatan & Tengah
  { flag: "🇮🇳", name: "India" },
  { flag: "🇵🇰", name: "Pakistan" },
  { flag: "🇧🇩", name: "Bangladesh" },
  { flag: "🇰🇿", name: "Kazakhstan" },
  // Asia Barat / Timur Tengah
  { flag: "🇹🇷", name: "Turki" },
  { flag: "🇦🇪", name: "UEA" },
  { flag: "🇸🇦", name: "Arab Saudi" },
  { flag: "🇮🇱", name: "Israel" },
  // Eropa Barat
  { flag: "🇩🇪", name: "Jerman" },
  { flag: "🇫🇷", name: "Prancis" },
  { flag: "🇬🇧", name: "Inggris" },
  { flag: "🇳🇱", name: "Belanda" },
  { flag: "🇨🇭", name: "Swiss" },
  { flag: "🇸🇪", name: "Swedia" },
  { flag: "🇳🇴", name: "Norwegia" },
  { flag: "🇫🇮", name: "Finlandia" },
  { flag: "🇩🇰", name: "Denmark" },
  { flag: "🇪🇸", name: "Spanyol" },
  { flag: "🇮🇹", name: "Italia" },
  { flag: "🇵🇹", name: "Portugal" },
  { flag: "🇦🇹", name: "Austria" },
  { flag: "🇧🇪", name: "Belgia" },
  { flag: "🇵🇱", name: "Polandia" },
  { flag: "🇨🇿", name: "Ceko" },
  { flag: "🇭🇺", name: "Hungaria" },
  { flag: "🇷🇴", name: "Rumania" },
  // Eropa Timur / CIS
  { flag: "🇷🇺", name: "Rusia" },
  { flag: "🇺🇦", name: "Ukraina" },
  { flag: "🇱🇻", name: "Latvia" },
  { flag: "🇱🇹", name: "Lithuania" },
  { flag: "🇪🇪", name: "Estonia" },
  { flag: "🇲🇩", name: "Moldova" },
  // Amerika
  { flag: "🇺🇸", name: "Amerika" },
  { flag: "🇨🇦", name: "Kanada" },
  { flag: "🇧🇷", name: "Brasil" },
  { flag: "🇲🇽", name: "Meksiko" },
  { flag: "🇦🇷", name: "Argentina" },
  { flag: "🇨🇱", name: "Chile" },
  { flag: "🇨🇴", name: "Kolombia" },
  // Oseania
  { flag: "🇦🇺", name: "Australia" },
  { flag: "🇳🇿", name: "Selandia Baru" },
  // Afrika
  { flag: "🇿🇦", name: "Afrika Selatan" },
  { flag: "🇳🇬", name: "Nigeria" },
  { flag: "🇪🇬", name: "Mesir" },
  { flag: "🇰🇪", name: "Kenya" },
  // Lainnya
  { flag: "🌐", name: "Global" },
];

function FlagPicker({ value, onChange }: { value: string; onChange: (flag: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? COUNTRY_FLAGS.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.flag.includes(search))
    : COUNTRY_FLAGS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal text-left"
          type="button"
        >
          <span className="flex items-center gap-2">
            <span className="text-2xl leading-none">{value}</span>
            <span className="text-sm text-muted-foreground">
              {COUNTRY_FLAGS.find((c) => c.flag === value)?.name ?? "Pilih bendera"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          placeholder="Cari negara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2 h-8 text-sm"
          autoFocus
        />
        <div className="grid grid-cols-5 gap-1 max-h-56 overflow-y-auto pr-1">
          {filtered.map((c) => (
            <button
              key={c.flag}
              type="button"
              title={c.name}
              onClick={() => {
                onChange(c.flag);
                setOpen(false);
                setSearch("");
              }}
              className={`flex flex-col items-center justify-center p-1.5 rounded-md text-xl leading-none hover:bg-accent transition-colors cursor-pointer ${
                value === c.flag ? "bg-primary/10 ring-1 ring-primary" : ""
              }`}
            >
              {c.flag}
              <span className="text-[9px] text-muted-foreground mt-0.5 truncate w-full text-center leading-tight">
                {c.name}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-5 py-4 text-center text-sm text-muted-foreground">
              Tidak ditemukan
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function AdminServers() {
  const { data: servers, isLoading } = useAdminListServers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createServer = useAdminCreateServer();
  const updateServer = useAdminUpdateServer();
  const deleteServer = useAdminDeleteServer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServerForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: AdminListServersResponseItem) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      location: s.location,
      flag: s.flag,
      host: s.host,
      apiUrl: s.apiUrl ?? "",
      apiToken: s.apiToken ?? "",
      supportedProtocols: s.supportedProtocols ?? [],
      isActive: s.isActive,
    });
    setDialogOpen(true);
  };

  const toggleProtocol = (protocol: string) => {
    setForm((prev) => ({
      ...prev,
      supportedProtocols: prev.supportedProtocols.includes(protocol)
        ? prev.supportedProtocols.filter((p) => p !== protocol)
        : [...prev.supportedProtocols, protocol],
    }));
  };

  const handleSave = () => {
    if (!form.name || !form.host || !form.location) {
      toast({ title: "Isi semua field yang diperlukan", variant: "destructive" });
      return;
    }
    if (form.supportedProtocols.length === 0) {
      toast({ title: "Pilih minimal satu protokol", variant: "destructive" });
      return;
    }

    const payload = {
      name: form.name,
      location: form.location,
      flag: form.flag,
      host: form.host,
      apiUrl: form.apiUrl || undefined,
      apiToken: form.apiToken || undefined,
      supportedProtocols: form.supportedProtocols,
      isActive: form.isActive,
    };

    if (editingId) {
      updateServer.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Server berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: getAdminListServersQueryKey() });
            setDialogOpen(false);
          },
          onError: (err) => toast({ title: "Gagal memperbarui server", description: err.error, variant: "destructive" }),
        }
      );
    } else {
      createServer.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "Server berhasil ditambahkan" });
            queryClient.invalidateQueries({ queryKey: getAdminListServersQueryKey() });
            setDialogOpen(false);
          },
          onError: (err) => toast({ title: "Gagal menambah server", description: err.error, variant: "destructive" }),
        }
      );
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteServer.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Server dihapus" });
          queryClient.invalidateQueries({ queryKey: getAdminListServersQueryKey() });
          setDeleteTarget(null);
        },
        onError: (err) => toast({ title: "Gagal menghapus server", description: err.error, variant: "destructive" }),
      }
    );
  };

  const isSaving = createServer.isPending || updateServer.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Server VPN</h1>
          <p className="text-muted-foreground mt-1">Kelola node infrastruktur VPN.</p>
        </div>
        <Button className="gap-2" onClick={openCreate} data-testid="button-add-server">
          <Plus className="h-4 w-4" /> Tambah Server
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)
        ) : servers && servers.length > 0 ? (
          servers.map((server) => (
            <Card key={server.id} className="flex flex-col group" data-testid={`card-server-${server.id}`}>
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{server.flag}</span>
                    <Badge variant={server.isActive ? "default" : "destructive"}>
                      {server.isActive ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(server)}>
                        <Edit className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget({ id: server.id, name: server.name })}
                      >
                        <Trash2 className="h-4 w-4" /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-lg mt-2">{server.name}</CardTitle>
                <div className="text-sm text-muted-foreground">{server.location}</div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground truncate">{server.host}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {server.supportedProtocols?.map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px] uppercase px-1.5 py-0">
                      {p}
                    </Badge>
                  ))}
                </div>
                <div className="pt-4 mt-auto border-t flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Activity className="h-4 w-4" /> Akun Aktif
                  </span>
                  <span className="font-bold">{server.activeAccounts ?? 0}</span>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full p-12 text-center border rounded-xl bg-card border-dashed">
            <p className="text-muted-foreground">Belum ada server.</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Server" : "Tambah Server Baru"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="srv-name">Nama Server *</Label>
              <Input
                id="srv-name"
                placeholder="SG-01"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-server-name"
              />
            </div>

            <div className="grid gap-2">
              <Label>Bendera Negara</Label>
              <FlagPicker
                value={form.flag}
                onChange={(flag) => setForm({ ...form, flag })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="srv-location">Lokasi *</Label>
              <Input
                id="srv-location"
                placeholder="Singapore"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="srv-host">Host / IP *</Label>
              <Input
                id="srv-host"
                placeholder="sg1.example.com atau 1.2.3.4"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                data-testid="input-server-host"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="srv-api">URL API (opsional)</Label>
              <Input
                id="srv-api"
                placeholder="https://server.com:8888"
                value={form.apiUrl}
                onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="srv-token">Token API (opsional)</Label>
              <Input
                id="srv-token"
                type="password"
                placeholder="••••••••"
                value={form.apiToken}
                onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label>Protokol yang Didukung *</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {allProtocols.map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <Checkbox
                      id={`proto-${p}`}
                      checked={form.supportedProtocols.includes(p)}
                      onCheckedChange={() => toggleProtocol(p)}
                    />
                    <Label htmlFor={`proto-${p}`} className="uppercase font-mono cursor-pointer">{p}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                id="srv-active"
                data-testid="switch-server-active"
              />
              <Label htmlFor="srv-active">Server Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-server">
              {isSaving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Server"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Server "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Server ini akan dihapus secara permanen. Semua akun VPN yang terhubung ke server ini mungkin terpengaruh. Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteServer.isPending}
            >
              {deleteServer.isPending ? "Menghapus..." : "Hapus Server"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

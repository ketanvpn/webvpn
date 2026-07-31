import { getApiError } from "@/lib/utils";
import {
  useAdminListProducts,
  useAdminCreateProduct,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  getAdminListProductsQueryKey,
  useAdminListServers,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRupiah } from "@/lib/format";
import { Package, Plus, MoreVertical, Edit, Trash2, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Product } from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";

type ProductForm = {
  name: string;
  description: string;
  protocol: string;
  durationDays: string;
  price: string;
  quota: string;
  maxConnections: string;
  stock: string;
  category: string;
  sortOrder: string;
  isActive: boolean;
  serverId: string;
};

const emptyForm: ProductForm = {
  name: "",
  description: "",
  protocol: "vmess",
  durationDays: "30",
  price: "",
  quota: "",
  maxConnections: "",
  stock: "",
  category: "",
  sortOrder: "0",
  isActive: true,
  serverId: "none",
};

const protocolOptions = ["ssh", "vmess", "vless", "trojan", "shadowsocks"];

export default function AdminProducts() {
  const { data: products, isLoading } = useAdminListProducts();
  const { data: servers } = useAdminListServers();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduct = useAdminCreateProduct();
  const updateProduct = useAdminUpdateProduct();
  const deleteProduct = useAdminDeleteProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>(["vmess"]);

  // Protokol yang didukung server terpilih (null = semua boleh / otomatis)
  const selectedServer = form.serverId !== "none"
    ? servers?.find((s) => String(s.id) === form.serverId)
    : null;
  const serverSupportedProtocols: string[] | null =
    selectedServer?.supportedProtocols ?? null;

  const toggleProtocol = (proto: string) => {
    if (serverSupportedProtocols && !serverSupportedProtocols.includes(proto)) return;
    setSelectedProtocols((prev) =>
      prev.includes(proto) ? prev.filter((p) => p !== proto) : [...prev, proto]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedProtocols(["vmess"]);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description ?? "",
      protocol: p.protocol,
      durationDays: String(p.durationDays),
      price: String(p.price),
      quota: p.quota != null ? String(p.quota) : "",
      maxConnections: p.maxConnections != null ? String(p.maxConnections) : "",
      stock: String(p.stock),
      category: p.category ?? "",
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
      serverId: p.serverId != null ? String(p.serverId) : "none",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const stock = parseInt(form.stock, 10);
    const basePayload = {
      name: form.name,
      description: form.description || undefined,
      durationDays: parseInt(form.durationDays, 10),
      price: parseFloat(form.price),
      quota: form.quota ? parseFloat(form.quota) : null,
      maxConnections: form.maxConnections ? parseInt(form.maxConnections, 10) : null,
      stock,
      category: form.category || undefined,
      sortOrder: parseInt(form.sortOrder, 10),
      isActive: form.isActive,
      serverId: form.serverId && form.serverId !== "none" ? parseInt(form.serverId, 10) : null,
    };

    if (!basePayload.name || isNaN(basePayload.price) || isNaN(basePayload.durationDays) || isNaN(stock) || stock < 1) {
      toast({ title: "Isi semua field yang diperlukan (termasuk Stok, minimal 1)", variant: "destructive" });
      return;
    }

    if (editingId) {
      // Mode edit: protokol tidak berubah, pakai form.protocol
      const payload = { ...basePayload, protocol: form.protocol as "ssh" | "vmess" | "vless" | "trojan" | "shadowsocks" };
      updateProduct.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Produk berhasil diperbarui" });
            queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
            setDialogOpen(false);
          },
          onError: (err) => toast({ title: "Gagal memperbarui produk", description: getApiError(err), variant: "destructive" }),
        }
      );
    } else {
      // Mode buat: centang bisa lebih dari satu protokol
      if (selectedProtocols.length === 0) {
        toast({ title: "Pilih minimal satu protokol", variant: "destructive" });
        return;
      }

      const isMultiple = selectedProtocols.length > 1;

      const results = await Promise.allSettled(
        selectedProtocols.map((proto) => {
          const name = isMultiple
            ? `${proto.toUpperCase()} - ${basePayload.name}`
            : basePayload.name;
          return createProduct.mutateAsync({
            data: {
              ...basePayload,
              name,
              protocol: proto as "ssh" | "vmess" | "vless" | "trojan" | "shadowsocks",
            },
          });
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failedResults = results.filter((r) => r.status === "rejected");

      queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });

      if (failedResults.length === 0) {
        toast({
          title: isMultiple
            ? `${succeeded} produk berhasil ditambahkan`
            : "Produk berhasil ditambahkan",
        });
        setDialogOpen(false);
      } else if (succeeded > 0) {
        toast({
          title: `${succeeded} berhasil, ${failedResults.length} gagal`,
          description: `${succeeded} produk sudah tersimpan. ${failedResults.length} produk gagal — cek daftar produk dan coba tambah ulang yang kurang.`,
          variant: "destructive",
        });
        setDialogOpen(false);
      } else {
        const firstErr = failedResults[0] as PromiseRejectedResult;
        toast({
          title: "Semua produk gagal ditambahkan",
          description: getApiError(firstErr.reason),
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteProduct.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Produk dihapus" });
          queryClient.invalidateQueries({ queryKey: getAdminListProductsQueryKey() });
          setDeleteTarget(null);
        },
        onError: (err) => {
          toast({ title: "Gagal menghapus produk", description: getApiError(err), variant: "destructive" });
          setDeleteTarget(null);
        },
      }
    );
  };

  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produk"
        description="Kelola paket VPN yang tersedia di toko."
        actions={
          <Button className="gap-2" onClick={openCreate} data-testid="button-add-product">
            <Plus className="h-4 w-4" /> Tambah Produk
          </Button>
        }
      />

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" /> Katalog Produk
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : products && products.length > 0 ? (
            <div className="divide-y divide-white/5">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="p-4 sm:p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
                  data-testid={`row-product-${product.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary" className="uppercase w-20 justify-center font-mono">
                      {product.protocol}
                    </Badge>
                    <div>
                      <div className="font-semibold text-base flex items-center gap-2">
                        {product.name}
                        {!product.isActive && (
                          <Badge variant="destructive" className="text-[10px] h-5">Nonaktif</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-2 mt-1">
                        <span>{product.durationDays === 0 ? "1 Jam (Trial)" : `${product.durationDays} Hari`}</span>
                        <span>&bull;</span>
                        <span>{product.quota ? `${product.quota} GB` : "Unlimited"}</span>
                        <span>&bull;</span>
                        <span>{product.maxConnections ? `${product.maxConnections} IP` : "Unlimited IP"}</span>
                        <span>&bull;</span>
                        <span className={product.availableStock === 0 ? "text-destructive font-medium" : ""}>
                          Stok: {product.availableStock}/{product.stock}
                        </span>
                        {product.category && <><span>&bull;</span><span>{product.category}</span></>}
                      {product.serverName && (
                        <><span>&bull;</span>
                        <span className="flex items-center gap-1"><Server className="h-3 w-3" />{product.serverName}</span></>
                      )}
                      {!product.serverName && (
                        <><span>&bull;</span><span className="text-yellow-600">Server: Otomatis</span></>
                      )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="font-bold text-lg text-primary hidden sm:block">
                      {formatRupiah(product.price)}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-menu-product-${product.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(product)}>
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget({ id: product.id, name: product.name })}
                        >
                          <Trash2 className="h-4 w-4" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              Belum ada produk. Buat satu untuk memulai.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk Permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk <span className="font-semibold">"{deleteTarget?.name}"</span> akan dihapus secara permanen dan tidak bisa dikembalikan.
              Jika produk ini punya riwayat order, hapus akan ditolak — nonaktifkan saja lewat tombol Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteProduct.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Produk" : "Tambah Produk Baru"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="prod-name">Nama Produk *</Label>
              <Input
                id="prod-name"
                placeholder="Contoh: VMess 30 Hari"
                value={form.name}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, name: v })); }}
                data-testid="input-product-name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prod-desc">Deskripsi</Label>
              <Textarea
                id="prod-desc"
                placeholder="Deskripsi singkat paket..."
                value={form.description}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, description: v })); }}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="prod-price">Harga (Rp) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  min={0}
                  placeholder="25000"
                  value={form.price}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, price: v })); }}
                  data-testid="input-product-price"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-stock">Stok Maksimal *</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  min={1}
                  placeholder="10"
                  value={form.stock}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, stock: v })); }}
                />
                <p className="text-xs text-muted-foreground">Maks. akun aktif sekaligus</p>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Protokol *</Label>
              {editingId ? (
                // Mode Edit: protokol tidak bisa diubah
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/40">
                  <span className="uppercase font-mono font-semibold text-sm">{form.protocol}</span>
                  <span className="text-xs text-muted-foreground">— tidak dapat diubah setelah dibuat</span>
                </div>
              ) : (
                // Mode Tambah: centang satu atau lebih protokol
                <>
                  <div className="grid grid-cols-3 gap-2 p-3 border rounded-lg bg-muted/20">
                    {protocolOptions.map((proto) => {
                      const notSupported =
                        serverSupportedProtocols !== null &&
                        !serverSupportedProtocols.includes(proto);
                      return (
                        <label
                          key={proto}
                          className={`flex items-center gap-2 select-none ${
                            notSupported ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
                          }`}
                          title={notSupported ? `Server ini tidak mendukung ${proto.toUpperCase()}` : undefined}
                        >
                          <Checkbox
                            checked={selectedProtocols.includes(proto)}
                            onCheckedChange={() => toggleProtocol(proto)}
                            disabled={notSupported}
                          />
                          <span className="uppercase text-sm font-mono font-medium">{proto}</span>
                          {notSupported && (
                            <span className="text-[10px] text-muted-foreground">✗</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {serverSupportedProtocols && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                      Server ini hanya mendukung: <strong>{serverSupportedProtocols.map((p) => p.toUpperCase()).join(", ")}</strong>. Protokol lain dinonaktifkan.
                    </p>
                  )}
                  {selectedProtocols.length > 1 && (
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
                      ✓ Akan membuat <strong>{selectedProtocols.length} produk</strong> sekaligus.
                      Nama otomatis ditambah prefix protokol, contoh: <em>{selectedProtocols[0].toUpperCase()} - {form.name || "Nama Produk"}</em>
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prod-duration">Durasi (hari) *</Label>
              <Input
                id="prod-duration"
                type="number"
                min={0}
                placeholder="30"
                value={form.durationDays}
                onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, durationDays: v })); }}
              />
              <p className="text-xs text-muted-foreground">Isi <strong>0</strong> untuk membuat paket Trial (1 Jam, limit 1 per user).</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="prod-quota">Kuota (GB, kosong = unlimited)</Label>
                <Input
                  id="prod-quota"
                  type="number"
                  min={0}
                  placeholder="100"
                  value={form.quota}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, quota: v })); }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-conn">Maks. Koneksi (kosong = unlimited)</Label>
                <Input
                  id="prod-conn"
                  type="number"
                  min={1}
                  placeholder="3"
                  value={form.maxConnections}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, maxConnections: v })); }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="prod-category">Kategori</Label>
                <Input
                  id="prod-category"
                  placeholder="Contoh: V2Ray, SSH"
                  value={form.category}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, category: v })); }}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prod-sort">Urutan Tampil</Label>
                <Input
                  id="prod-sort"
                  type="number"
                  placeholder="0"
                  value={form.sortOrder}
                  onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, sortOrder: v })); }}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Server VPN</Label>
              <Select
                value={form.serverId}
                onValueChange={(v) => {
                  setForm((f) => ({ ...f, serverId: v }));
                  // Auto-hapus protokol yang tidak didukung server baru
                  if (v !== "none") {
                    const srv = servers?.find((s) => String(s.id) === v);
                    if (srv?.supportedProtocols) {
                      setSelectedProtocols((prev) =>
                        prev.filter((p) => srv.supportedProtocols.includes(p))
                      );
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Otomatis (berdasarkan protokol) —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Otomatis (berdasarkan protokol) —</SelectItem>
                  {servers?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.flag} {s.name} ({s.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pin produk ini ke server tertentu. Biarkan kosong agar sistem pilih server otomatis berdasarkan protokol.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                id="prod-active"
                data-testid="switch-product-active"
              />
              <Label htmlFor="prod-active">Aktif (tampil di toko)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-product">
              {isSaving
                ? "Menyimpan..."
                : editingId
                ? "Simpan Perubahan"
                : selectedProtocols.length > 1
                ? `Tambah ${selectedProtocols.length} Produk Sekaligus`
                : "Tambah Produk"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

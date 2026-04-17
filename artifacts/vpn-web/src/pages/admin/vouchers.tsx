import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Tag, Percent, BadgeDollarSign, Infinity } from "lucide-react";
import { format } from "date-fns";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type Voucher = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
};

const BLANK = {
  code: "",
  discountType: "percent" as "percent" | "fixed",
  discountValue: "",
  maxUses: "",
  isActive: true,
  expiresAt: "",
};

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

export default function AdminVouchers() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data: list = [], isLoading } = useQuery<Voucher[]>({
    queryKey: ["admin-vouchers"],
    queryFn: () => apiFetch("/admin/vouchers"),
  });

  const save = useMutation({
    mutationFn: (data: typeof form) => {
      const body = {
        code: data.code.trim().toUpperCase(),
        discountType: data.discountType,
        discountValue: parseFloat(data.discountValue),
        maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
        isActive: data.isActive,
        expiresAt: data.expiresAt || null,
      };
      return editing
        ? apiFetch(`/admin/vouchers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : apiFetch("/admin/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      toast({ title: editing ? "Voucher diperbarui" : "Voucher dibuat" });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/vouchers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      toast({ title: "Voucher dihapus" });
    },
    onError: (e: Error) => toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/admin/vouchers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-vouchers"] }),
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK });
    setOpen(true);
  }

  function openEdit(v: Voucher) {
    setEditing(v);
    setForm({
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountValue,
      maxUses: v.maxUses != null ? String(v.maxUses) : "",
      isActive: v.isActive,
      expiresAt: v.expiresAt ? v.expiresAt.slice(0, 10) : "",
    });
    setOpen(true);
  }

  const isExpired = (v: Voucher) => !!v.expiresAt && new Date(v.expiresAt) < new Date();
  const isUsedUp = (v: Voucher) => v.maxUses != null && v.currentUses >= v.maxUses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voucher / Kode Promo</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola kode diskon yang bisa dipakai user saat checkout.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Buat Voucher
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="h-4 w-4 text-primary" />
            Daftar Voucher
          </CardTitle>
          <CardDescription>
            {list.length} voucher terdaftar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Tag className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Belum ada voucher. Klik "Buat Voucher" untuk memulai.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {list.map((v) => {
                const expired = isExpired(v);
                const usedUp = isUsedUp(v);
                const inactive = !v.isActive || expired || usedUp;

                return (
                  <div key={v.id} className="py-4 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                    {/* code + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <code className="text-sm font-bold tracking-widest bg-muted/30 border border-white/5 rounded px-2 py-0.5">
                          {v.code}
                        </code>
                        {inactive ? (
                          <Badge variant="outline" className="text-xs border-red-500/30 text-red-400 bg-red-500/10">
                            {expired ? "Kedaluwarsa" : usedUp ? "Kuota Habis" : "Nonaktif"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                            Aktif
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          {v.discountType === "percent"
                            ? <><Percent className="h-3 w-3" /> Diskon {v.discountValue}%</>
                            : <><BadgeDollarSign className="h-3 w-3" /> Diskon {formatRupiah(Number(v.discountValue))}</>
                          }
                        </span>
                        <span className="text-white/20">·</span>
                        <span className="flex items-center gap-1">
                          {v.maxUses == null
                            ? <><Infinity className="h-3 w-3" /> Tidak terbatas</>
                            : `${v.currentUses}/${v.maxUses} pemakaian`
                          }
                        </span>
                        {v.expiresAt && (
                          <>
                            <span className="text-white/20">·</span>
                            <span>Berlaku hingga {format(new Date(v.expiresAt), "d MMM yyyy")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Switch
                        checked={v.isActive}
                        onCheckedChange={(val) => toggleActive.mutate({ id: v.id, isActive: val })}
                        disabled={expired || usedUp}
                        title={expired ? "Sudah kedaluwarsa" : usedUp ? "Kuota habis" : undefined}
                      />
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus voucher?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Kode <strong>{v.code}</strong> akan dihapus permanen dan tidak bisa dikembalikan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => remove.mutate(v.id)}
                            >
                              Hapus
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

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Voucher" : "Buat Voucher Baru"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          >
            <div className="space-y-1.5">
              <Label>Kode Voucher</Label>
              <Input
                placeholder="cth: LEBARAN25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono tracking-wider uppercase"
                required
              />
              <p className="text-xs text-muted-foreground">Kode akan otomatis diubah ke huruf kapital.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipe Diskon</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => setForm({ ...form, discountType: v as "percent" | "fixed" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Persen (%)</SelectItem>
                    <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nilai Diskon</Label>
                <Input
                  type="number"
                  min="0"
                  max={form.discountType === "percent" ? "100" : undefined}
                  step="any"
                  placeholder={form.discountType === "percent" ? "cth: 10" : "cth: 5000"}
                  value={form.discountValue}
                  onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Maks. Pemakaian</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Kosongkan = ∞"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Berlaku Hingga</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(val) => setForm({ ...form, isActive: val })}
                id="is-active"
              />
              <Label htmlFor="is-active">Voucher aktif (bisa digunakan user)</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Buat Voucher"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

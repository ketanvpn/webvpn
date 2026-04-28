import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Megaphone, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
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

type Announcement = {
  id: number;
  title: string;
  content: string;
  type: string;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  info: { label: "Info", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Info },
  warning: { label: "Peringatan", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
  success: { label: "Sukses", color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle },
  error: { label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

const BLANK = { title: "", content: "", type: "info", isActive: true, startAt: "", endAt: "" };

export default function AdminAnnouncements() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data: list = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => apiFetch("/admin/announcements"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        content: form.content,
        type: form.type,
        isActive: form.isActive,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      };
      if (editing) {
        return apiFetch(`/admin/announcements/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      return apiFetch("/admin/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: editing ? "Pengumuman diperbarui" : "Pengumuman dibuat" });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast({ title: "Pengumuman dihapus" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK });
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    const safeFormat = (dateStr: string | null) => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return format(d, "yyyy-MM-dd'T'HH:mm");
      } catch {
        return "";
      }
    };

    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      type: a.type,
      isActive: a.isActive,
      startAt: safeFormat(a.startAt),
      endAt: safeFormat(a.endAt),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Megaphone className="text-primary" /> Pengumuman
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola pengumuman yang ditampilkan di dashboard user</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Buat Pengumuman
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">Memuat...</div>
      ) : list.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Megaphone className="mx-auto mb-3 opacity-30" size={40} />
            <p>Belum ada pengumuman</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const cfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card key={a.id} className={`glass-panel border ${!a.isActive ? "opacity-60" : ""}`}>
                <CardContent className="py-4 px-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`rounded-lg p-2 border ${cfg.color} mt-0.5 shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white text-sm">{a.title}</span>
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        {!a.isActive && <Badge variant="outline" className="text-xs text-muted-foreground">Nonaktif</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{a.content}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/70">
                        <span>Dibuat: {format(new Date(a.createdAt), "dd MMM yyyy")}</span>
                        {a.startAt && <span>Mulai: {format(new Date(a.startAt), "dd MMM yyyy HH:mm")}</span>}
                        {a.endAt && <span>Berakhir: {format(new Date(a.endAt), "dd MMM yyyy HH:mm")}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil size={14} /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 size={14} /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-panel">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Pengumuman?</AlertDialogTitle>
                          <AlertDialogDescription>Pengumuman "<b>{a.title}</b>" akan dihapus permanen.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(a.id)} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Judul</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Judul pengumuman..." />
            </div>
            <div className="space-y-1.5">
              <Label>Isi Pengumuman</Label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Tulis isi pengumuman..." rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jenis</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Peringatan</SelectItem>
                    <SelectItem value="success">Sukses</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} id="is-active" />
                  <Label htmlFor="is-active">Aktif</Label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mulai Tayang (opsional)</Label>
                <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Berakhir (opsional)</Label>
                <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title || !form.content}>
              {save.isPending ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Buat Pengumuman"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

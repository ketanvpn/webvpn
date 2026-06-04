import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Bug } from "lucide-react";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

type BugPreset = {
  id: number;
  name: string;
  bugDomain: string;
  mode: "wildcard" | "sni" | "host";
  isActive: boolean;
  sshInjectConfig?: Record<string, unknown>;
  createdAt: string;
};

const BLANK = {
  name: "",
  bugDomain: "",
  mode: "wildcard" as "wildcard" | "sni" | "host",
  isActive: true,
  sshInjectConfig: {} as Record<string, unknown>,
};

export default function AdminBugPresets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BugPreset | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const { data: list = [], isLoading } = useQuery<BugPreset[]>({
    queryKey: ["admin-bug-presets"],
    queryFn: () => apiFetch("/admin/bug-presets"),
  });

  const save = useMutation({
    mutationFn: (data: typeof form) => {
      const body = {
        name: data.name,
        bugDomain: data.bugDomain.trim(),
        mode: data.mode,
        isActive: data.isActive,
        sshInjectConfig: data.sshInjectConfig || {},
      };
      return editing
        ? apiFetch(`/admin/bug-presets/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : apiFetch("/admin/bug-presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bug-presets"] });
      toast({ title: editing ? "Bug diperbarui" : "Bug ditambahkan" });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiFetch(`/admin/bug-presets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bug-presets"] });
      toast({ title: "Bug dihapus" });
    },
    onError: (e: Error) => toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiFetch(`/admin/bug-presets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-bug-presets"] }),
    onError: (e: Error) => toast({ title: "Gagal", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK });
    setOpen(true);
  }

  function openEdit(v: BugPreset) {
    setEditing(v);
    setForm({
      name: v.name,
      bugDomain: v.bugDomain,
      sshInjectConfig: v.sshInjectConfig || {},
      mode: v.mode,
      isActive: v.isActive,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Bug / SNI</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola daftar preset Bug, SNI, dan Wildcard untuk Alat Convert Config.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Tambah Bug
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4 text-primary" />
            Daftar Preset
          </CardTitle>
          <CardDescription>
            {list.length} bug terdaftar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-muted/20 animate-pulse" />)}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Bug className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p>Belum ada preset bug. Klik "Tambah Bug" untuk memulai.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {list.map((v) => {
                return (
                  <div key={v.id} className="py-4 flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold tracking-wide">
                          {v.name}
                        </span>
                        {!v.isActive ? (
                          <Badge variant="outline" className="text-xs border-red-500/30 text-red-400 bg-red-500/10">
                            Nonaktif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                            Aktif
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30 capitalize">
                          {v.mode}
                        </Badge>
                        {v.sshInjectConfig && Object.keys(v.sshInjectConfig).length > 0 && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                            SSH Injek
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <code className="bg-muted/30 border border-white/5 rounded px-2 py-0.5 font-mono text-white/80">
                          {v.bugDomain}
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Switch
                        checked={v.isActive}
                        onCheckedChange={(val) => toggleActive.mutate({ id: v.id, isActive: val })}
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
                            <AlertDialogTitle>Hapus preset bug?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Preset <strong>{v.name}</strong> akan dihapus permanen.
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Bug" : "Tambah Bug Baru"}</DialogTitle>
            <DialogDescription>
              Isi informasi bug yang akan dipakai pengguna di Alat Convert.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          >
            <div className="space-y-1.5">
              <Label>Nama Preset</Label>
              <Input
                placeholder="cth: Gamemax Tsel"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Domain Bug / SNI</Label>
              <Input
                placeholder="cth: cf-vod.nimo.tv"
                value={form.bugDomain}
                onChange={(e) => setForm({ ...form, bugDomain: e.target.value })}
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Mode Injeksi</Label>
              <Select
                value={form.mode}
                onValueChange={(v) => setForm({ ...form, mode: v as "wildcard" | "sni" | "host" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wildcard">Wildcard (Bug.DomainServer)</SelectItem>
                  <SelectItem value="sni">SNI Only (Trik SSL/TLS)</SelectItem>
                  <SelectItem value="host">Host Only (Trik Websocket HTTP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(val) => setForm({ ...form, isActive: val })}
                id="is-active"
              />
              <Label htmlFor="is-active">Preset aktif (ditampilkan ke pengguna)</Label>
            </div>

            <div className="space-y-1.5">
              <Label>SSH Inject Config (JSON untuk DarkTunnel dll)</Label>
              <Textarea
                placeholder='{"mode": "PROXY_SNI", "serverNameIndication": "[host]", "proxyHost": "wpassets.kuncie.com", "proxyPort": 443, "payload": "GET / HTTP/1.1[crlf]Host: [host][crlf]..."}'
                className="font-mono text-xs min-h-[120px]"
                value={JSON.stringify(form.sshInjectConfig || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value || "{}");
                    setForm({ ...form, sshInjectConfig: parsed });
                  } catch {}
                }}
              />
              <p className="text-[10px] text-muted-foreground">Isi struktur injectConfig. Gunakan <b>[host]</b> sebagai placeholder — nanti otomatis diganti dengan SSH Host yang user ketik. Untuk Ilmupedia CloudFront, set <code>"serverNameIndication": "[host]"</code> supaya pakai host SSH yang user beli.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Bug"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

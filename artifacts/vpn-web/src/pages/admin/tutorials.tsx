import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  Image,
  Loader2,
  GripVertical,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TutorialStepActionType =
  | "none"
  | "playstore"
  | "payload_proxy"
  | "sni"
  | "ssh_account"
  | "connect";

type TutorialStep = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  imageUrl: string | null;
  actionType?: TutorialStepActionType;
};

type AppTutorial = {
  id: number;
  appSlug: string;
  appName: string;
  description: string | null;
  steps: TutorialStep[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Form state shape
// ---------------------------------------------------------------------------

type FormState = {
  appSlug: string;
  appName: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  steps: TutorialStep[];
};

const BLANK_FORM: FormState = {
  appSlug: "",
  appName: "",
  description: "",
  isActive: true,
  sortOrder: 0,
  steps: [],
};

function newStep(stepNumber: number): TutorialStep {
  return {
    id: crypto.randomUUID(),
    stepNumber,
    title: "",
    description: "",
    imageUrl: null,
    actionType: "none",
  };
}

/** Re-number steps sequentially starting from 1. */
function renumber(steps: TutorialStep[]): TutorialStep[] {
  return steps.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

// ---------------------------------------------------------------------------
// Step image upload sub-component
// ---------------------------------------------------------------------------

function StepImageUpload({
  imageUrl,
  onUploaded,
  onRemoved,
}: {
  imageUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/admin/tutorials/upload-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload gagal" }));
        throw new Error(err.error ?? "Upload gagal");
      }
      const data: { url: string } = await res.json();
      onUploaded(data.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!imageUrl) return;
    try {
      await apiClient.del("/api/admin/tutorials/delete-image", {
        url: imageUrl,
      });
    } catch {
      // best-effort cleanup
    }
    onRemoved();
  };

  if (imageUrl) {
    return (
      <div className="relative group w-full">
        <img
          src={imageUrl}
          alt="Step screenshot"
          className="rounded-lg border border-border max-h-40 object-contain w-full bg-black/20"
        />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleRemove}
        >
          <X size={12} />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 size={12} className="animate-spin" /> Mengunggah...
          </>
        ) : (
          <>
            <Upload size={12} /> Upload Gambar
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function AdminTutorials() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppTutorial | null>(null);
  const [form, setForm] = useState<FormState>({ ...BLANK_FORM });

  // ---- queries & mutations ------------------------------------------------

  const { data: list = [], isLoading } = useQuery<AppTutorial[]>({
    queryKey: ["admin-tutorials"],
    queryFn: () => apiClient.get<AppTutorial[]>("/api/admin/tutorials"),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        appSlug: form.appSlug,
        appName: form.appName,
        description: form.description || null,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
        steps: form.steps,
      };
      if (editing) {
        return apiClient.put(`/api/admin/tutorials/${editing.id}`, body);
      }
      return apiClient.post("/api/admin/tutorials", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorials"] });
      // also invalidate public cache so converter picks up changes
      qc.invalidateQueries({ queryKey: ["tutorial"] });
      toast({
        title: editing ? "Tutorial diperbarui" : "Tutorial dibuat",
      });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: e.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiClient.del(`/api/admin/tutorials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorials"] });
      qc.invalidateQueries({ queryKey: ["tutorial"] });
      toast({ title: "Tutorial dihapus" });
    },
    onError: (e: Error) =>
      toast({ title: e.message, variant: "destructive" }),
  });

  // ---- dialog helpers -----------------------------------------------------

  const openCreate = () => {
    setEditing(null);
    setForm({ ...BLANK_FORM, steps: [newStep(1)] });
    setOpen(true);
  };

  const openEdit = (t: AppTutorial) => {
    setEditing(t);
    setForm({
      appSlug: t.appSlug,
      appName: t.appName,
      description: t.description ?? "",
      isActive: t.isActive,
      sortOrder: t.sortOrder,
      steps: t.steps.length > 0 ? [...t.steps] : [newStep(1)],
    });
    setOpen(true);
  };

  // ---- step manipulation --------------------------------------------------

  const updateStep = (idx: number, patch: Partial<TutorialStep>) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const addStep = () => {
    setForm((f) => ({
      ...f,
      steps: [...f.steps, newStep(f.steps.length + 1)],
    }));
  };

  const removeStep = (idx: number) => {
    setForm((f) => ({
      ...f,
      steps: renumber(f.steps.filter((_, i) => i !== idx)),
    }));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    setForm((f) => {
      if (target < 0 || target >= f.steps.length) return f;
      const next = [...f.steps];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...f, steps: renumber(next) };
    });
  };

  // ---- validation ---------------------------------------------------------

  const canSave =
    form.appSlug.trim().length > 0 &&
    form.appName.trim().length > 0 &&
    form.steps.length > 0 &&
    form.steps.every((s) => s.title.trim() && s.description.trim());

  // ---- render -------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="text-primary" /> Manajemen Tutorial
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kelola tutorial penggunaan aplikasi VPN untuk pengguna
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} /> Tambah Tutorial
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-muted-foreground text-center py-12">
          Memuat...
        </div>
      ) : list.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 opacity-30" size={40} />
            <p>Belum ada tutorial</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...list]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((t) => (
              <Card
                key={t.id}
                className={`glass-panel border ${!t.isActive ? "opacity-60" : ""}`}
              >
                <CardContent className="py-4 px-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="rounded-lg p-2 border border-primary/20 bg-primary/10 mt-0.5 shrink-0">
                      <Image size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-white text-sm">
                          {t.appName}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          {t.appSlug}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${t.isActive ? "border-green-500/30 bg-green-500/10 text-green-400" : "text-muted-foreground"}`}
                        >
                          {t.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {t.steps.length} langkah
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="glass-panel">
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Hapus Tutorial?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tutorial &ldquo;{t.appName}&rdquo; akan dihapus
                            permanen beserta semua langkah dan gambarnya.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => del.mutate(t.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass-panel max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Tutorial" : "Buat Tutorial Baru"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Slug Aplikasi</Label>
                <Input
                  value={form.appSlug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appSlug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  placeholder="http-custom"
                  disabled={!!editing}
                />
                <p className="text-[10px] text-muted-foreground/60">
                  Huruf kecil, angka, strip. Tidak bisa diubah setelah dibuat.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Nama Aplikasi</Label>
                <Input
                  value={form.appName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, appName: e.target.value }))
                  }
                  placeholder="HTTP Custom"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Deskripsi (opsional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Deskripsi singkat tutorial..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Urutan</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, isActive: v }))
                    }
                    id="tut-active"
                  />
                  <Label htmlFor="tut-active">Aktif</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Steps Editor */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-white">
                  Langkah-langkah Tutorial
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={addStep}
                >
                  <Plus size={12} /> Tambah Langkah
                </Button>
              </div>

              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {form.steps.map((step, idx) => (
                  <Card key={step.id} className="border border-border/50 bg-background/30">
                    <CardContent className="p-3 space-y-3">
                      {/* Step header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripVertical
                            size={14}
                            className="text-muted-foreground/50"
                          />
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {step.stepNumber}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === 0}
                            onClick={() => moveStep(idx, -1)}
                          >
                            <ArrowUp size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={idx === form.steps.length - 1}
                            onClick={() => moveStep(idx, 1)}
                          >
                            <ArrowDown size={12} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => removeStep(idx)}
                            disabled={form.steps.length <= 1}
                          >
                            <X size={12} />
                          </Button>
                        </div>
                      </div>

                      {/* Step fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Judul</Label>
                          <Input
                            value={step.title}
                            onChange={(e) =>
                              updateStep(idx, { title: e.target.value })
                            }
                            placeholder="Buka aplikasi"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5 sm:row-span-3">
                          <Label className="text-xs">Gambar</Label>
                          <StepImageUpload
                            imageUrl={step.imageUrl}
                            onUploaded={(url) =>
                              updateStep(idx, { imageUrl: url })
                            }
                            onRemoved={() =>
                              updateStep(idx, { imageUrl: null })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Aksi / Data Interaktif Otomatis</Label>
                          <Select
                            value={step.actionType ?? "none"}
                            onValueChange={(val: TutorialStepActionType) =>
                              updateStep(idx, { actionType: val })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Pilih aksi" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Tidak ada (Hanya Teks &amp; Gambar)</SelectItem>
                              <SelectItem value="playstore">Tombol Unduh / Play Store</SelectItem>
                              <SelectItem value="payload_proxy">Kotak Salin Payload &amp; Remote Proxy</SelectItem>
                              <SelectItem value="sni">Kotak Salin SNI (Hanya jika SSL/TLS)</SelectItem>
                              <SelectItem value="ssh_account">Kotak Kredensial Akun SSH (Host:Port, User, Pass)</SelectItem>
                              <SelectItem value="connect">Petunjuk &amp; Status Terhubung</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Deskripsi</Label>
                          <Textarea
                            value={step.description}
                            onChange={(e) =>
                              updateStep(idx, {
                                description: e.target.value,
                              })
                            }
                            placeholder="Instruksi detail untuk langkah ini..."
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !canSave}
            >
              {save.isPending
                ? "Menyimpan..."
                : editing
                  ? "Simpan Perubahan"
                  : "Buat Tutorial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

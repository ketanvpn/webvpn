import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Cloud,
  Code2,
  Copy,
  History,
  Info,
  Loader2,
  MoreVertical,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";

const ADMIN_PRESETS_QUERY_KEY = ["admin-easy-inject-presets"] as const;
const USER_PRESETS_QUERY_KEY = ["easy-inject-presets"] as const;

type RequiredAccountKind = "normal" | "cloudfront";
type InjectMode = "PROXY" | "PROXY_SNI";
type SniPolicy = "none" | "account_host" | "custom";

type EasyInjectPreset = {
  id: number;
  slug: string;
  name: string;
  description: string;
  accountLabel: string;
  requiredAccountKind: RequiredAccountKind;
  sshPort: number;
  mode: InjectMode;
  proxyHost: string;
  proxyPort: number;
  payload: string;
  sniPolicy: SniPolicy;
  customSni: string | null;
  usePayload: boolean;
  ssl: boolean;
  supportsDarkTunnel: boolean;
  supportsHttpCustom: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type EasyInjectPresetRevision = {
  id: number;
  presetId: number;
  version: number;
  snapshot: Record<string, unknown>;
  action: string;
  createdAt: string;
};

type EasyInjectPresetInput = Pick<
  EasyInjectPreset,
  | "slug"
  | "name"
  | "description"
  | "accountLabel"
  | "requiredAccountKind"
  | "sshPort"
  | "mode"
  | "proxyHost"
  | "proxyPort"
  | "payload"
  | "sniPolicy"
  | "customSni"
  | "usePayload"
  | "ssl"
  | "supportsDarkTunnel"
  | "supportsHttpCustom"
  | "isActive"
  | "sortOrder"
>;

type PresetForm = Omit<
  EasyInjectPresetInput,
  "sshPort" | "proxyPort" | "sortOrder" | "customSni"
> & {
  sshPort: string;
  proxyPort: string;
  sortOrder: string;
  customSni: string;
};

type ApiListResponse<T> = T[] | { data: T[] };
type FormErrors = Partial<Record<keyof PresetForm, string>>;
type FormMode = "create" | "edit" | "duplicate";

function unwrapList<T>(response: ApiListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.data;
}

function createBlankForm(): PresetForm {
  return {
    slug: "",
    name: "",
    description: "",
    accountLabel: "SSH biasa",
    requiredAccountKind: "normal",
    sshPort: "443",
    mode: "PROXY",
    proxyHost: "",
    proxyPort: "443",
    payload: "",
    sniPolicy: "none",
    customSni: "",
    usePayload: true,
    ssl: false,
    supportsDarkTunnel: true,
    supportsHttpCustom: true,
    isActive: true,
    sortOrder: "0",
  };
}

function presetToForm(preset: EasyInjectPreset): PresetForm {
  return {
    slug: preset.slug,
    name: preset.name,
    description: preset.description ?? "",
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: String(preset.sshPort),
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: String(preset.proxyPort),
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni ?? "",
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    isActive: preset.isActive,
    sortOrder: String(preset.sortOrder),
  };
}

function validateForm(form: PresetForm): FormErrors {
  const errors: FormErrors = {};
  const slug = form.slug.trim();
  const sshPort = Number(form.sshPort);
  const proxyPort = Number(form.proxyPort);
  const sortOrder = Number(form.sortOrder);

  if (!slug) {
    errors.slug = "Slug wajib diisi.";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = "Gunakan huruf kecil, angka, dan tanda hubung saja.";
  }
  if (!form.name.trim()) errors.name = "Nama preset wajib diisi.";
  if (!form.description.trim()) errors.description = "Deskripsi pengguna wajib diisi.";
  if (!form.accountLabel.trim()) errors.accountLabel = "Label akun wajib diisi.";
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
    errors.sshPort = "Port SSH harus bilangan 1–65535.";
  }
  if (!form.proxyHost.trim()) errors.proxyHost = "Host remote proxy wajib diisi.";
  if (!Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    errors.proxyPort = "Port proxy harus bilangan 1–65535.";
  }
  if (!form.payload.trim()) {
    errors.payload = "Payload wajib diisi agar preset dapat dibuat dengan aman.";
  }
  if (form.mode === "PROXY_SNI" && form.sniPolicy === "none") {
    errors.sniPolicy = "Mode PROXY_SNI wajib memakai Host akun atau Custom SNI.";
  }
  if (form.sniPolicy === "custom" && !form.customSni.trim()) {
    errors.customSni = "Custom SNI wajib diisi untuk kebijakan ini.";
  }
  if (form.sniPolicy === "none" && form.ssl) {
    errors.ssl = "Matikan SSL atau pilih kebijakan SNI terlebih dahulu.";
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    errors.sortOrder = "Urutan tampil harus bilangan bulat 0 atau lebih.";
  }
  if (!form.supportsDarkTunnel && !form.supportsHttpCustom) {
    errors.supportsDarkTunnel = "Aktifkan minimal satu aplikasi agar preset dapat digunakan.";
  }

  return errors;
}

function toRequestBody(form: PresetForm): EasyInjectPresetInput {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    accountLabel: form.accountLabel.trim(),
    requiredAccountKind: form.requiredAccountKind,
    sshPort: Number(form.sshPort),
    mode: form.mode,
    proxyHost: form.proxyHost.trim(),
    proxyPort: Number(form.proxyPort),
    payload: form.payload,
    sniPolicy: form.sniPolicy,
    customSni: form.sniPolicy === "custom" ? form.customSni.trim() : null,
    usePayload: form.usePayload,
    ssl: form.ssl,
    supportsDarkTunnel: form.supportsDarkTunnel,
    supportsHttpCustom: form.supportsHttpCustom,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder),
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

function PreviewPanel({ form }: { form: PresetForm }) {
  const sshPortNumber = Number(form.sshPort);
  const proxyPortNumber = Number(form.proxyPort);
  const sshPort = Number.isInteger(sshPortNumber) ? sshPortNumber : form.sshPort || "PORT";
  const proxyPort = Number.isInteger(proxyPortNumber)
    ? proxyPortNumber
    : form.proxyPort || "PORT";
  const resolvedSni =
    form.sniPolicy === "account_host"
      ? "dummy.example.com"
      : form.sniPolicy === "custom"
        ? (form.customSni.trim() || "(custom SNI belum diisi)").replaceAll(
            "[host]",
            "dummy.example.com",
          )
        : null;
  const payload = form.payload || "(payload belum diisi)";
  const darkTunnelPreview = {
    type: "SSH",
    name: form.name.trim() || "Preview Preset",
    sshTunnelConfig: {
      sshConfig: {
        host: "dummy.example.com",
        port: sshPort,
        username: "contoh",
        password: "password-contoh",
      },
      injectConfig: {
        mode: form.mode,
        proxyHost: form.proxyHost.trim() || "(host proxy belum diisi)",
        proxyPort,
        ...(form.usePayload ? { payload } : {}),
        ...(resolvedSni ? { serverNameIndication: resolvedSni } : {}),
      },
    },
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Code2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold">Preview struktural</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Semua kredensial di bawah adalah data dummy, bukan data akun pengguna.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">SSH Login</p>
          <code className="break-all text-xs sm:text-sm">
            dummy.example.com:{sshPort}@contoh:password-contoh
          </code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">Remote Proxy</p>
          <code className="break-all text-xs sm:text-sm">
            {form.proxyHost.trim() || "(host belum diisi)"}:{proxyPort}
          </code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">Resolved SNI</p>
          <code className="break-all text-xs sm:text-sm">{resolvedSni ?? "Tidak digunakan"}</code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">SSL</p>
          <span>{form.ssl ? "Aktif (TLS/SSL)" : "Nonaktif"}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Payload</p>
          <Badge variant="outline" className="text-[10px]">
            {form.usePayload ? "Digunakan" : "Tidak dikirim"}
          </Badge>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/5 bg-background/70 p-3 text-xs font-mono">
          {payload}
        </pre>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Output DarkTunnel (JSON-like)</p>
          {!form.supportsDarkTunnel && (
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
              Dukungan app nonaktif
            </Badge>
          )}
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-white/5 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-200 font-mono">
          {JSON.stringify(darkTunnelPreview, null, 2)}
        </pre>
      </div>

      <Alert className="border-amber-500/25 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-xs text-muted-foreground">
          Preview ini hanya memeriksa bentuk konfigurasi dan tidak menguji konektivitas operator secara live.
        </AlertDescription>
      </Alert>
    </section>
  );
}

export default function AdminInjectPresets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const togglePendingRef = useRef(new Set<number>());
  const savePendingRef = useRef(false);
  const deletePendingRef = useRef(false);
  const restorePendingRef = useRef(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingPreset, setEditingPreset] = useState<EasyInjectPreset | null>(null);
  const [form, setForm] = useState<PresetForm>(createBlankForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [togglePendingIds, setTogglePendingIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const [deleteTarget, setDeleteTarget] = useState<EasyInjectPreset | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [revisionPreset, setRevisionPreset] = useState<EasyInjectPreset | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<EasyInjectPresetRevision | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    data: presets = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<EasyInjectPreset[]>({
    queryKey: ADMIN_PRESETS_QUERY_KEY,
    queryFn: async () =>
      unwrapList(
        await apiClient.get<ApiListResponse<EasyInjectPreset>>("/api/admin/easy-inject-presets"),
      ),
  });

  const revisionsQuery = useQuery<EasyInjectPresetRevision[]>({
    queryKey: ["admin-easy-inject-preset-revisions", revisionPreset?.id],
    queryFn: async () =>
      unwrapList(
        await apiClient.get<ApiListResponse<EasyInjectPresetRevision>>(
          `/api/admin/easy-inject-presets/${revisionPreset!.id}/revisions`,
        ),
      ),
    enabled: revisionPreset !== null,
  });

  const activeCount = presets.filter((preset) => preset.isActive).length;
  const builtInCount = presets.filter((preset) => preset.isBuiltIn).length;

  async function invalidatePresetQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_PRESETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: USER_PRESETS_QUERY_KEY }),
    ]);
  }

  function updateForm<K extends keyof PresetForm>(key: K, value: PresetForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => ({ ...current, [key]: undefined }));
    if (key === "supportsDarkTunnel" || key === "supportsHttpCustom") {
      setFormErrors((current) => ({
        ...current,
        supportsDarkTunnel: undefined,
        supportsHttpCustom: undefined,
      }));
    }
    if (key === "sniPolicy") {
      setFormErrors((current) => ({ ...current, customSni: undefined }));
    }
    if (key === "usePayload") {
      setFormErrors((current) => ({ ...current, payload: undefined }));
    }
    setFormMessage(null);
  }

  function prepareForm(mode: FormMode, preset?: EasyInjectPreset) {
    setFormMode(mode);
    setEditingPreset(mode === "edit" && preset ? preset : null);
    setFormErrors({});
    setFormMessage(null);

    if (!preset) {
      setForm(createBlankForm());
    } else if (mode === "duplicate") {
      setForm({
        ...presetToForm(preset),
        slug: "",
        name: `${preset.name} (Salinan)`,
      });
    } else {
      setForm(presetToForm(preset));
    }
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savePendingRef.current) return;

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormMessage("Periksa kembali field yang ditandai sebelum menyimpan.");
      return;
    }

    savePendingRef.current = true;
    setIsSaving(true);
    setFormMessage(null);
    try {
      const body = toRequestBody(form);
      if (editingPreset) {
        const { slug: _immutableSlug, ...updateBody } = body;
        await apiClient.patch(`/api/admin/easy-inject-presets/${editingPreset.id}`, updateBody);
      } else {
        await apiClient.post("/api/admin/easy-inject-presets", body);
      }
      await invalidatePresetQueries();
      toast({
        title: editingPreset ? "Preset berhasil diperbarui" : "Preset berhasil dibuat",
        description: `${body.name} siap dikelola dari daftar preset.`,
      });
      setFormOpen(false);
      setEditingPreset(null);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Gagal menyimpan preset.";
      setFormMessage(message);
      toast({ title: "Gagal menyimpan preset", description: message, variant: "destructive" });
    } finally {
      savePendingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleToggle(preset: EasyInjectPreset, isActive: boolean) {
    if (togglePendingRef.current.has(preset.id)) return;

    togglePendingRef.current.add(preset.id);
    setTogglePendingIds(new Set(togglePendingRef.current));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[preset.id];
      return next;
    });

    try {
      await apiClient.patch(`/api/admin/easy-inject-presets/${preset.id}`, { isActive });
      await invalidatePresetQueries();
      toast({
        title: isActive ? "Preset diaktifkan" : "Preset dinonaktifkan",
        description: isActive
          ? `${preset.name} kembali tersedia untuk pengguna.`
          : `${preset.name} disembunyikan dari pilihan pengguna.`,
      });
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Gagal mengubah status.";
      setRowErrors((current) => ({ ...current, [preset.id]: message }));
      toast({ title: "Status tidak berubah", description: message, variant: "destructive" });
    } finally {
      togglePendingRef.current.delete(preset.id);
      setTogglePendingIds(new Set(togglePendingRef.current));
    }
  }

  function openDeleteConfirmation(preset: EasyInjectPreset) {
    if (preset.isBuiltIn || deletePendingRef.current) return;
    setDeleteError(null);
    setDeleteTarget(preset);
  }

  async function handleDelete(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!deleteTarget || deletePendingRef.current) return;

    deletePendingRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.del(`/api/admin/easy-inject-presets/${deleteTarget.id}`);
      await invalidatePresetQueries();
      toast({ title: "Preset dihapus", description: `${deleteTarget.name} telah dihapus.` });
      setDeleteTarget(null);
    } catch (removeError) {
      const message = removeError instanceof Error ? removeError.message : "Gagal menghapus preset.";
      setDeleteError(message);
      toast({ title: "Gagal menghapus preset", description: message, variant: "destructive" });
    } finally {
      deletePendingRef.current = false;
      setIsDeleting(false);
    }
  }

  function openRevisions(preset: EasyInjectPreset) {
    setRestoreTarget(null);
    setRestoreError(null);
    setRevisionPreset(preset);
  }

  async function handleRestore(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!revisionPreset || !restoreTarget || restorePendingRef.current) return;

    restorePendingRef.current = true;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await apiClient.post(
        `/api/admin/easy-inject-presets/${revisionPreset.id}/revisions/${restoreTarget.id}/restore`,
      );
      await Promise.all([
        invalidatePresetQueries(),
        queryClient.invalidateQueries({
          queryKey: ["admin-easy-inject-preset-revisions", revisionPreset.id],
        }),
      ]);
      const refreshedPreset = queryClient
        .getQueryData<EasyInjectPreset[]>(ADMIN_PRESETS_QUERY_KEY)
        ?.find((preset) => preset.id === revisionPreset.id);
      if (refreshedPreset) setRevisionPreset(refreshedPreset);
      toast({
        title: "Revisi berhasil dipulihkan",
        description: `${revisionPreset.name} dikembalikan ke versi ${restoreTarget.version}.`,
      });
      setRestoreTarget(null);
    } catch (restoreFailure) {
      const message =
        restoreFailure instanceof Error ? restoreFailure.message : "Gagal memulihkan revisi.";
      setRestoreError(message);
      toast({ title: "Gagal memulihkan revisi", description: message, variant: "destructive" });
    } finally {
      restorePendingRef.current = false;
      setIsRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Preset Inject Paket</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Kelola konfigurasi Easy Inject yang tersedia untuk DarkTunnel dan HTTP Custom.
          </p>
        </div>
        <Button className="w-full sm:w-auto gap-2" onClick={() => prepareForm("create")}>
          <Plus className="h-4 w-4" /> Buat Preset
        </Button>
      </div>

      {!isLoading && !error && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            <p className="text-xl sm:text-2xl font-bold mt-1">{presets.length}</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Aktif</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 text-emerald-400">{activeCount}</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Bawaan</p>
            <p className="text-xl sm:text-2xl font-bold mt-1">{builtInCount}</p>
          </div>
        </div>
      )}

      <Card className="glass-panel border-white/5 overflow-hidden">
        <CardHeader className="border-b border-white/5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Network className="h-5 w-5 text-primary" /> Daftar Preset
              </CardTitle>
              <CardDescription className="mt-1">
                Urutan dan status di sini menentukan pilihan yang diterima pengguna.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refetch()}
              disabled={isFetching}
              title="Muat ulang daftar"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="sr-only">Muat ulang daftar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 sm:p-6 space-y-4">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-40 sm:h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 sm:p-10 text-center">
              <div className="mx-auto h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                <RefreshCw className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-semibold">Preset gagal dimuat</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-md mx-auto">
                {error instanceof Error ? error.message : "Terjadi kesalahan saat memuat data."}
              </p>
              <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                Coba Lagi
              </Button>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-10 sm:p-14 text-center">
              <Network className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="font-semibold">Belum ada preset</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Buat preset pertama agar konfigurasi Easy Inject dapat dipilih pengguna.
              </p>
              <Button onClick={() => prepareForm("create")}>
                <Plus className="h-4 w-4" /> Buat Preset
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {presets.map((preset) => {
                const rowPending = togglePendingIds.has(preset.id);
                return (
                  <div
                    key={preset.id}
                    className={`p-4 sm:p-5 transition-colors hover:bg-white/[0.025] ${
                      !preset.isActive ? "bg-muted/10" : ""
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold break-words">{preset.name}</h3>
                          <Badge
                            variant="outline"
                            className={
                              preset.isActive
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                : "border-red-500/30 bg-red-500/10 text-red-400"
                            }
                          >
                            {preset.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                          {preset.isBuiltIn && (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="h-3 w-3" /> Bawaan
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono text-[10px]">
                            v{preset.version}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <code className="font-mono text-foreground/80">{preset.slug}</code>
                          <span>Urutan {preset.sortOrder}</span>
                          <span>Diperbarui {formatDate(preset.updatedAt)}</span>
                        </div>

                        {preset.description && (
                          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
                            {preset.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <Badge variant="outline" className="gap-1 bg-background/40">
                            {preset.requiredAccountKind === "cloudfront" ? (
                              <Cloud className="h-3 w-3" />
                            ) : (
                              <Server className="h-3 w-3" />
                            )}
                            {preset.accountLabel} · {preset.requiredAccountKind}
                          </Badge>
                          <Badge variant="outline" className="font-mono bg-background/40">
                            {preset.mode}
                          </Badge>
                          <Badge variant="outline" className="font-mono bg-background/40">
                            SSH :{preset.sshPort}
                          </Badge>
                          <Badge variant="outline" className="font-mono bg-background/40 max-w-full">
                            <span className="truncate">
                              Proxy {preset.proxyHost}:{preset.proxyPort}
                            </span>
                          </Badge>
                          {preset.supportsDarkTunnel && (
                            <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/25 gap-1">
                              <Code2 className="h-3 w-3" /> DarkTunnel
                            </Badge>
                          )}
                          {preset.supportsHttpCustom && (
                            <Badge className="bg-violet-500/15 text-violet-300 border border-violet-500/25 gap-1">
                              <Smartphone className="h-3 w-3" /> HTTP Custom
                            </Badge>
                          )}
                        </div>

                        {preset.isBuiltIn && (
                          <p className="flex items-start gap-1.5 text-xs text-amber-400/90 mt-3">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            Preset bawaan tidak dapat dihapus. Nonaktifkan untuk menyembunyikannya dari pengguna.
                          </p>
                        )}
                        {rowErrors[preset.id] && (
                          <p className="text-xs text-destructive mt-3">{rowErrors[preset.id]}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 lg:border-0 lg:pt-0 lg:justify-end">
                        <div className="flex items-center gap-2">
                          {rowPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                          <Label htmlFor={`preset-active-${preset.id}`} className="text-xs text-muted-foreground">
                            Aktif
                          </Label>
                          <Switch
                            id={`preset-active-${preset.id}`}
                            checked={preset.isActive}
                            disabled={rowPending || isDeleting}
                            onCheckedChange={(checked) => void handleToggle(preset, checked)}
                            aria-label={`${preset.isActive ? "Nonaktifkan" : "Aktifkan"} ${preset.name}`}
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={rowPending || isDeleting || isRestoring}
                              title={`Aksi untuk ${preset.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Buka aksi preset</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => prepareForm("edit", preset)}>
                              <Pencil className="h-4 w-4" /> Edit preset
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => prepareForm("duplicate", preset)}>
                              <Copy className="h-4 w-4" /> Duplikat
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRevisions(preset)}>
                              <History className="h-4 w-4" /> Riwayat revisi
                            </DropdownMenuItem>
                            {!preset.isBuiltIn && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => openDeleteConfirmation(preset)}
                                >
                                  <Trash2 className="h-4 w-4" /> Hapus permanen
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && isSaving) return;
          setFormOpen(open);
          if (!open) setEditingPreset(null);
        }}
      >
        <DialogContent
          className="w-[calc(100%-1rem)] max-w-4xl h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col"
          onInteractOutside={(event) => isSaving && event.preventDefault()}
          onEscapeKeyDown={(event) => isSaving && event.preventDefault()}
        >
          <DialogHeader className="p-4 sm:p-6 pr-12 border-b border-white/5 shrink-0">
            <DialogTitle>
              {formMode === "edit"
                ? "Edit Preset Inject"
                : formMode === "duplicate"
                  ? "Duplikat Preset Inject"
                  : "Buat Preset Inject"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "duplicate"
                ? "Isi slug unik untuk salinan ini, lalu tinjau preview sebelum menyimpan."
                : "Atur identitas, koneksi, dukungan aplikasi, lalu tinjau hasil strukturalnya."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {formMessage && (
                <Alert variant="destructive">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Preset belum dapat disimpan</AlertTitle>
                  <AlertDescription>{formMessage}</AlertDescription>
                </Alert>
              )}

              <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-semibold">Identitas & akun</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Informasi yang membantu admin dan pengguna mengenali kegunaan preset.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-name">Nama preset *</Label>
                    <Input
                      id="inject-name"
                      value={form.name}
                      onChange={(event) => updateForm("name", event.target.value)}
                      placeholder="Contoh: CloudFront Opok"
                      aria-invalid={!!formErrors.name}
                    />
                    <FieldError message={formErrors.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-slug">Slug unik *</Label>
                    <Input
                      id="inject-slug"
                      value={form.slug}
                      onChange={(event) => updateForm("slug", event.target.value.toLowerCase())}
                      placeholder="cloudfront-opok"
                      className="font-mono"
                      disabled={formMode === "edit"}
                      aria-invalid={!!formErrors.slug}
                    />
                    <FieldError message={formErrors.slug} />
                    {!formErrors.slug && (
                      <p className="text-[11px] text-muted-foreground">
                        {formMode === "edit"
                          ? "Slug adalah identitas stabil dan tidak dapat diubah setelah preset dibuat."
                          : "Huruf kecil, angka, dan tanda hubung; dipakai sebagai identitas stabil."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inject-description">Deskripsi</Label>
                  <Textarea
                    id="inject-description"
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                    placeholder="Jelaskan paket/operator atau skenario penggunaan preset."
                    rows={2}
                    aria-invalid={!!formErrors.description}
                  />
                  <FieldError message={formErrors.description} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="inject-account-label">Label akun *</Label>
                    <Input
                      id="inject-account-label"
                      value={form.accountLabel}
                      onChange={(event) => updateForm("accountLabel", event.target.value)}
                      placeholder="SSH biasa"
                      aria-invalid={!!formErrors.accountLabel}
                    />
                    <FieldError message={formErrors.accountLabel} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jenis akun wajib</Label>
                    <Select
                      value={form.requiredAccountKind}
                      onValueChange={(value) =>
                        updateForm("requiredAccountKind", value as RequiredAccountKind)
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="cloudfront">CloudFront</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-sort-order">Urutan tampil</Label>
                    <Input
                      id="inject-sort-order"
                      type="number"
                      min={0}
                      step={1}
                      value={form.sortOrder}
                      onChange={(event) => updateForm("sortOrder", event.target.value)}
                      aria-invalid={!!formErrors.sortOrder}
                    />
                    <FieldError message={formErrors.sortOrder} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
                  <div>
                    <Label htmlFor="inject-form-active">Preset aktif</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Preset aktif dapat muncul pada pilihan pengguna.
                    </p>
                  </div>
                  <Switch
                    id="inject-form-active"
                    checked={form.isActive}
                    onCheckedChange={(value) => updateForm("isActive", value)}
                  />
                </div>
              </section>

              <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-semibold">Koneksi & inject</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tentukan mode SSH, remote proxy, payload, dan resolusi SNI.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-ssh-port">Port SSH *</Label>
                    <Input
                      id="inject-ssh-port"
                      type="number"
                      min={1}
                      max={65535}
                      value={form.sshPort}
                      onChange={(event) => updateForm("sshPort", event.target.value)}
                      aria-invalid={!!formErrors.sshPort}
                    />
                    <FieldError message={formErrors.sshPort} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Mode</Label>
                    <Select
                      value={form.mode}
                      onValueChange={(value) => updateForm("mode", value as InjectMode)}
                    >
                      <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PROXY">PROXY</SelectItem>
                        <SelectItem value="PROXY_SNI">PROXY_SNI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 lg:col-span-1">
                    <Label htmlFor="inject-proxy-host">Remote proxy host *</Label>
                    <Input
                      id="inject-proxy-host"
                      value={form.proxyHost}
                      onChange={(event) => updateForm("proxyHost", event.target.value)}
                      placeholder="proxy.example.com"
                      className="font-mono"
                      aria-invalid={!!formErrors.proxyHost}
                    />
                    <FieldError message={formErrors.proxyHost} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-proxy-port">Port proxy *</Label>
                    <Input
                      id="inject-proxy-port"
                      type="number"
                      min={1}
                      max={65535}
                      value={form.proxyPort}
                      onChange={(event) => updateForm("proxyPort", event.target.value)}
                      aria-invalid={!!formErrors.proxyPort}
                    />
                    <FieldError message={formErrors.proxyPort} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Kebijakan SNI</Label>
                    <Select
                      value={form.sniPolicy}
                      onValueChange={(value) => updateForm("sniPolicy", value as SniPolicy)}
                    >
                      <SelectTrigger aria-invalid={!!formErrors.sniPolicy}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tanpa SNI</SelectItem>
                        <SelectItem value="account_host">Host akun</SelectItem>
                        <SelectItem value="custom">Custom SNI</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError message={formErrors.sniPolicy} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inject-custom-sni">Custom SNI</Label>
                    <Input
                      id="inject-custom-sni"
                      value={form.customSni}
                      onChange={(event) => updateForm("customSni", event.target.value)}
                      placeholder="sni.example.com"
                      className="font-mono"
                      disabled={form.sniPolicy !== "custom"}
                      aria-invalid={!!formErrors.customSni}
                    />
                    <FieldError message={formErrors.customSni} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="inject-payload">Payload {form.usePayload ? "*" : ""}</Label>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="inject-use-payload" className="text-xs text-muted-foreground">
                        Use Payload
                      </Label>
                      <Switch
                        id="inject-use-payload"
                        checked={form.usePayload}
                        onCheckedChange={(value) => updateForm("usePayload", value)}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="inject-payload"
                    value={form.payload}
                    onChange={(event) => updateForm("payload", event.target.value)}
                    placeholder={"GET / HTTP/1.1[crlf]\nHost: [host][crlf]\nConnection: Upgrade[crlf][crlf]"}
                    className="min-h-36 font-mono text-xs"
                    aria-invalid={!!formErrors.payload}
                  />
                  <FieldError message={formErrors.payload} />
                  <p className="text-[11px] text-muted-foreground">
                    Placeholder runtime seperti <code>[host]</code> tetap ditampilkan pada preview payload.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
                  <div>
                    <Label htmlFor="inject-ssl">SSL/TLS</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mengaktifkan koneksi aman pada konfigurasi hasil.
                    </p>
                  </div>
                  <Switch
                    id="inject-ssl"
                    checked={form.ssl}
                    onCheckedChange={(value) => updateForm("ssl", value)}
                  />
                </div>
                <FieldError message={formErrors.ssl} />
              </section>

              <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-semibold">Dukungan aplikasi</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pilih aplikasi yang boleh menawarkan preset ini kepada pengguna.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
                    <div className="flex items-center gap-3">
                      <Code2 className="h-5 w-5 text-blue-400" />
                      <div>
                        <Label htmlFor="inject-dark-tunnel">DarkTunnel</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Output konfigurasi terstruktur</p>
                      </div>
                    </div>
                    <Switch
                      id="inject-dark-tunnel"
                      checked={form.supportsDarkTunnel}
                      onCheckedChange={(value) => updateForm("supportsDarkTunnel", value)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-violet-400" />
                      <div>
                        <Label htmlFor="inject-http-custom">HTTP Custom</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Format inject untuk aplikasi</p>
                      </div>
                    </div>
                    <Switch
                      id="inject-http-custom"
                      checked={form.supportsHttpCustom}
                      onCheckedChange={(value) => updateForm("supportsHttpCustom", value)}
                    />
                  </div>
                </div>
                <FieldError message={formErrors.supportsDarkTunnel} />
              </section>

              <PreviewPanel form={form} />
            </div>

            <DialogFooter className="shrink-0 border-t border-white/5 bg-background/95 p-4 sm:px-6 sm:py-4 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={isSaving}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving
                  ? "Menyimpan..."
                  : editingPreset
                    ? "Simpan Perubahan"
                    : "Simpan Preset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus preset custom?</AlertDialogTitle>
            <AlertDialogDescription>
              Preset <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Tindakan ini hanya tersedia
              untuk preset custom dan tidak dapat dibatalkan dari layar ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => void handleDelete(event)}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeleting ? "Menghapus..." : "Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={revisionPreset !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setRevisionPreset(null);
            setRestoreTarget(null);
            setRestoreError(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 sm:p-6 pr-12 border-b border-white/5 shrink-0">
            <DialogTitle>Riwayat Revisi</DialogTitle>
            <DialogDescription>
              {revisionPreset?.name} · versi aktif {revisionPreset?.version}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {revisionsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : revisionsQuery.error ? (
              <div className="py-10 text-center">
                <p className="font-medium">Riwayat revisi gagal dimuat</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {revisionsQuery.error instanceof Error
                    ? revisionsQuery.error.message
                    : "Terjadi kesalahan saat memuat revisi."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => void revisionsQuery.refetch()}
                  disabled={revisionsQuery.isFetching}
                >
                  {revisionsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Coba Lagi
                </Button>
              </div>
            ) : revisionsQuery.data?.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <History className="h-9 w-9 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada revisi tersimpan untuk preset ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {revisionsQuery.data?.map((revision) => (
                  <div key={revision.id} className="rounded-xl border border-white/5 bg-muted/10 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">v{revision.version}</Badge>
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {revision.action}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(revision.createdAt)} · Revisi #{revision.id}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setRestoreError(null);
                          setRestoreTarget(revision);
                        }}
                        disabled={isRestoring}
                      >
                        <RotateCcw className="h-4 w-4" /> Pulihkan
                      </Button>
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        Lihat snapshot
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950/80 p-3 text-[10px] leading-relaxed text-slate-200 font-mono">
                        {JSON.stringify(revision.snapshot, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setRestoreTarget(null);
            setRestoreError(null);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan versi {restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Konfigurasi <strong>{revisionPreset?.name}</strong> akan dikembalikan ke snapshot versi ini.
              Versi saat ini tetap tercatat dalam riwayat revisi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {restoreError && (
            <Alert variant="destructive">
              <Info className="h-4 w-4" />
              <AlertDescription>{restoreError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={isRestoring} onClick={(event) => void handleRestore(event)}>
              {isRestoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRestoring ? "Memulihkan..." : "Pulihkan Revisi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

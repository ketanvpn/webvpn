import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Plus,
  Pencil,
  Trash2,
  Key,
  Copy,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Activity,
  Calendar,
} from "lucide-react";

type GeneratorApiScope = "generate" | "unlock" | "inspect";

type GeneratorApiKeyDto = {
  id: number;
  keyId: string;
  label: string;
  scopes: GeneratorApiScope[];
  enabled: boolean;
  expiresAt: string | null;
  dailyLimit: number | null;
  dailyUsageDate: string | null;
  dailyUsage: number;
  usageCount: number;
  lastUsedAt: string | null;
  lastIp: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

type CreateKeyResponse = GeneratorApiKeyDto & {
  rawKey: string;
  warning: string;
};

type RegenerateKeyResponse = GeneratorApiKeyDto & {
  rawKey: string;
  warning: string;
};

const AVAILABLE_SCOPES: { id: GeneratorApiScope; label: string; description: string }[] = [
  {
    id: "generate",
    label: "Generate",
    description: "Membuat config HC (.hc) dan Dark Tunnel (.dark) locked",
  },
  {
    id: "unlock",
    label: "Unlock",
    description: "Membuka lock config HC dan Dark Tunnel",
  },
  {
    id: "inspect",
    label: "Inspect",
    description: "Membaca metadata dan field internal config HC (termasuk credential)",
  },
];

const BLANK_FORM = {
  label: "",
  scopes: ["generate"] as GeneratorApiScope[],
  expiresInDays: "" as string | number,
  dailyLimit: "" as string | number,
};

export default function AdminGeneratorApiKeys() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GeneratorApiKeyDto | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [originalExpiresAt, setOriginalExpiresAt] = useState<string | null>(null);
  const [initialExpiresInDays, setInitialExpiresInDays] = useState<string | number>("");

  const [showRawKeyDialog, setShowRawKeyDialog] = useState(false);
  const [rawKeyData, setRawKeyData] = useState<{ rawKey: string; label: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<GeneratorApiKeyDto[]>({
    queryKey: ["admin-generator-api-keys"],
    queryFn: () => apiClient.get<GeneratorApiKeyDto[]>("/api/admin/generator-api-keys"),
  });

  const createKey = useMutation({
    mutationFn: (data: typeof form) => {
      let expiresAt: string | null = null;
      if (data.expiresInDays && Number(data.expiresInDays) > 0) {
        const date = new Date();
        date.setDate(date.getDate() + Number(data.expiresInDays));
        expiresAt = date.toISOString();
      }

      const body = {
        label: data.label.trim(),
        scopes: data.scopes,
        expiresAt,
        dailyLimit: data.dailyLimit ? Number(data.dailyLimit) : null,
      };

      return apiClient.post<CreateKeyResponse>("/api/admin/generator-api-keys", body);
    },
    onSuccess: (res: CreateKeyResponse) => {
      qc.invalidateQueries({ queryKey: ["admin-generator-api-keys"] });
      setOpen(false);
      setRawKeyData({ rawKey: res.rawKey, label: res.label });
      setShowRawKeyDialog(true);
      toast({ title: "API Key berhasil dibuat" });
    },
    onError: (e: Error) =>
      toast({ title: "Gagal membuat key", description: e.message, variant: "destructive" }),
  });

  const updateKey = useMutation({
    mutationFn: (data: { id: number; form: typeof form; enabled?: boolean; originalExpiresAt: string | null; initialDays: string | number }) => {
      let expiresAt: string | null;

      if (data.form.expiresInDays === "" || data.form.expiresInDays === null) {
        expiresAt = null;
      } else if (
        String(data.form.expiresInDays) === String(data.initialDays) &&
        data.originalExpiresAt
      ) {
        expiresAt = data.originalExpiresAt;
      } else if (Number(data.form.expiresInDays) > 0) {
        const date = new Date();
        date.setDate(date.getDate() + Number(data.form.expiresInDays));
        expiresAt = date.toISOString();
      } else {
        expiresAt = null;
      }

      const body: Record<string, unknown> = {
        label: data.form.label.trim(),
        scopes: data.form.scopes,
        dailyLimit: data.form.dailyLimit ? Number(data.form.dailyLimit) : null,
      };

      if (data.enabled === undefined) {
        body.expiresAt = expiresAt;
      } else {
        body.enabled = data.enabled;
      }

      if (data.enabled !== undefined && data.form) {
        return apiClient.patch(`/api/admin/generator-api-keys/${data.id}`, { enabled: data.enabled });
      }

      return apiClient.patch(`/api/admin/generator-api-keys/${data.id}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-generator-api-keys"] });
      setOpen(false);
      toast({ title: "API Key diperbarui" });
    },
    onError: (e: Error) =>
      toast({ title: "Gagal update key", description: e.message, variant: "destructive" }),
  });

  const regenerateKey = useMutation({
    mutationFn: (id: number) =>
      apiClient.post<RegenerateKeyResponse>(`/api/admin/generator-api-keys/${id}/regenerate`),
    onSuccess: (res: RegenerateKeyResponse) => {
      qc.invalidateQueries({ queryKey: ["admin-generator-api-keys"] });
      setRawKeyData({ rawKey: res.rawKey, label: res.label });
      setShowRawKeyDialog(true);
      toast({ title: "Secret key berhasil digenerate ulang" });
    },
    onError: (e: Error) =>
      toast({ title: "Gagal regenerate", description: e.message, variant: "destructive" }),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiClient.patch(`/api/admin/generator-api-keys/${id}`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-generator-api-keys"] }),
    onError: (e: Error) =>
      toast({ title: "Gagal ubah status", description: e.message, variant: "destructive" }),
  });

  const deleteKey = useMutation({
    mutationFn: (id: number) => apiClient.del(`/api/admin/generator-api-keys/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-generator-api-keys"] });
      toast({ title: "API Key dihapus" });
    },
    onError: (e: Error) =>
      toast({ title: "Gagal hapus", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK_FORM });
    setOriginalExpiresAt(null);
    setInitialExpiresInDays("");
    setOpen(true);
  }

  function openEdit(key: GeneratorApiKeyDto) {
    setEditing(key);
    setOriginalExpiresAt(key.expiresAt);

    let remainingDays: number | "" = "";
    if (key.expiresAt) {
      const expDate = new Date(key.expiresAt);
      const now = new Date();
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      remainingDays = diffDays > 0 ? diffDays : "";
    }

    setInitialExpiresInDays(remainingDays);
    setForm({
      label: key.label,
      scopes: key.scopes,
      expiresInDays: remainingDays,
      dailyLimit: key.dailyLimit || "",
    });
    setOpen(true);
  }

  function toggleScope(scope: GeneratorApiScope) {
    setForm((prev) => {
      const exists = prev.scopes.includes(scope);
      if (exists) {
        // Don't allow removing all scopes
        if (prev.scopes.length <= 1) {
          toast({
            title: "Minimal satu scope wajib dipilih",
            variant: "destructive",
          });
          return prev;
        }
        return { ...prev, scopes: prev.scopes.filter((s) => s !== scope) };
      } else {
        return { ...prev, scopes: [...prev.scopes, scope] };
      }
    });
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast({ title: "API Key tersalin ke clipboard" });
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" });
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const [hcTemplateInput, setHcTemplateInput] = useState("");
  const [hcTemplateBase64, setHcTemplateBase64] = useState("");

  function handleHcTemplateConvert() {
    if (!hcTemplateInput.trim()) {
      toast({ title: "Isi template dulu", variant: "destructive" });
      return;
    }
    try {
      const trimmed = hcTemplateInput.trim();
      if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 100) {
        try {
          atob(trimmed.replace(/\s/g, ""));
          setHcTemplateBase64(trimmed.replace(/\s/g, ""));
          toast({ title: "Terdeteksi sudah Base64, langsung pakai" });
          return;
        } catch {}
      }
      const bytes = new TextEncoder().encode(trimmed);
      let binary = "";
      for (const b of bytes) binary += String.fromCharCode(b);
      const b64 = btoa(binary);
      setHcTemplateBase64(b64);
      toast({ title: "Berhasil convert ke Base64" });
    } catch {
      toast({ title: "Gagal convert", description: "Isi tidak valid", variant: "destructive" });
    }
  }

  function handleHcFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64Part = result.includes(",") ? result.split(",")[1] : result;
        const cleaned = base64Part.trim().replace(/\s/g, "");
        const isLikelyFileContent = file.name.endsWith(".hc");
        if (isLikelyFileContent) {
          setHcTemplateBase64(cleaned);
          setHcTemplateInput(`[File ${file.name} - ${file.size} bytes]`);
          toast({ title: "File .hc berhasil dibaca sebagai Base64" });
        } else {
          setHcTemplateInput(result);
          handleHcTemplateConvert();
        }
      } catch {
        toast({ title: "Gagal baca file", variant: "destructive" });
      }
    };
    if (file.name.endsWith(".hc")) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generator API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola API key untuk integrasi Generator HTTP Custom (.hc) dan Dark Tunnel (.dark)
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Buat API Key
        </Button>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Informasi Autentikasi</AlertTitle>
        <AlertDescription>
          API key menggunakan format <code className="font-mono bg-muted px-1 rounded">btg_&lt;id&gt;_&lt;secret&gt;</code>.
          Gunakan header <code className="font-mono bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code> saat melakukan request.
          Raw key hanya ditampilkan <strong>satu kali</strong> saat pembuatan.
        </AlertDescription>
      </Alert>

      <Card className="border-cyan-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" /> Tool: Template .hc & Debugging (Sesuai Docs Asli)
          </CardTitle>
          <CardDescription>
            Docs asli: endpoint butuh template .hc encrypted valid via templateBase64. 1 template untuk semua bug/preset (payload/proxy/SNI diisi dari inject-presets).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-cyan-500/20 bg-cyan-500/5">
            <AlertTitle className="text-cyan-300 text-sm">Cara Dapatkan File .hc Template (Wajib Encrypted Valid)</AlertTitle>
            <AlertDescription className="space-y-2 text-xs">
              <ol className="list-decimal pl-4 space-y-1">
                <li>Buka HTTP Custom di HP</li>
                <li>Buat config: SSH dummy 1.1.1.1:22@user:pass, payload bebas, proxy 127.0.0.1:8080, save &amp; export jadi .hc (ini sudah encrypted valid)</li>
                <li>JANGAN base64 2x. Upload file .hc mentah di bawah, tool akan base64 satu kali sesuai docs: <code>base64 -w 0 template.hc</code></li>
                <li>Limit: body 2MB, template decode max 1MB. Jangan kirim multipart.</li>
                <li>Copy hasil Base64 ke .env <code>GENERATOR_API_HC_TEMPLATE=</code> lalu <code>pm2 restart --update-env</code></li>
              </ol>
              <p className="pt-2"><b>Untuk SEMUA bug?</b> Ya, 1 template cukup. Payload/proxy/SNI diambil dari Admin → Preset Inject Paket (Telkomsel, XL, Axis dll). Flow: templateBase64 + accountText <code>host:port@user:pass</code> + payload + proxy + sni + name → POST /hc/generate → return contentBase64 siap download.</p>
              <p className="pt-1"><b>Template .dark?</b> Dark butuh <code>darktunnel://BASE64</code> link. Bisa kosongkan jika hanya HC. Field docs: template / templateBase64 / templateObject. Jika kirim JSON jangan kirim sebagai string.</p>
              <p className="pt-2 font-mono text-[11px] bg-black/20 p-2 rounded">
                Docs endpoint: POST /hc/generate  Body: &#123; templateBase64, method: "ssh", accountText: "host:port@user:pass", name, payload, proxy, sni &#125;<br/>
                Response: &#123; success:true, data: &#123; format:"hc", variant:"locked", content, contentBase64 &#125; &#125;<br/>
                Error: &#123; success:false, error:"bad_request" | "invalid_api_key" | "payload_too_large" | "rate_limit_exceeded" etc &#125;
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Upload File .hc (atau .txt berisi config)</Label>
            <Input type="file" accept=".hc,.txt,.b64" onChange={handleHcFileUpload} />
          </div>

          <div className="space-y-2">
            <Label>Atau Paste Isi Config / Base64</Label>
            <Textarea value={hcTemplateInput} onChange={(e) => setHcTemplateInput(e.target.value)} placeholder="Paste isi file .hc (akan auto detect base64 atau text lalu convert)..." className="min-h-[80px] font-mono text-xs" />
            <Button type="button" variant="outline" size="sm" onClick={handleHcTemplateConvert}>Convert ke Base64</Button>
          </div>

          {hcTemplateBase64 && (
            <div className="space-y-2">
              <Label>Hasil Base64 (copy ke .env)</Label>
              <div className="flex gap-2">
                <Textarea readOnly value={hcTemplateBase64} className="font-mono text-[10px] min-h-[100px] flex-1" />
                <Button type="button" variant="outline" size="sm" className="shrink-0 h-auto" onClick={() => copyToClipboard(hcTemplateBase64)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="rounded bg-muted p-2 font-mono text-[10px] break-all">
                GENERATOR_API_HC_TEMPLATE={hcTemplateBase64.slice(0, 80)}... ({hcTemplateBase64.length} chars)
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24" />
              </Card>
            ))}
          </div>
        ) : keys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Belum ada API key yang dibuat. Klik tombol di atas untuk membuat.
            </CardContent>
          </Card>
        ) : (
          keys.map((key) => (
            <Card key={key.id} className={!key.enabled ? "opacity-60 bg-muted/20" : ""}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="font-bold">{key.label}</span>
                      <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        btg_{key.keyId}_...
                      </code>
                      <Badge variant={key.enabled ? "default" : "secondary"}>
                        {key.enabled ? "Aktif" : "Nonaktif"}
                      </Badge>
                      {key.expiresAt && new Date(key.expiresAt) < new Date() && (
                        <Badge variant="destructive">Kedaluwarsa</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs text-muted-foreground pt-1">
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" />
                        <span>
                          Total Request: <b>{key.usageCount}</b>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          Hari ini: <b>{key.dailyUsage}</b>
                          {key.dailyLimit ? ` / ${key.dailyLimit}` : " (unlimited)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Expired: {key.expiresAt ? formatDate(key.expiresAt) : "Tidak terbatas"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>Terakhir: {formatDate(key.lastUsedAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t pt-3 lg:border-t-0 lg:pt-0">
                    <div className="flex items-center gap-2 mr-2">
                      <Switch
                        checked={key.enabled}
                        onCheckedChange={(checked) =>
                          toggleEnabled.mutate({ id: key.id, enabled: checked })
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {key.enabled ? "On" : "Off"}
                      </span>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Regenerate Secret Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini akan membuat secret baru dan <strong>membatalkan</strong> key lama secara langsung. Aplikasi yang menggunakan key ini harus diperbarui.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => regenerateKey.mutate(key.id)}
                          >
                            Ya, Regenerate
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="outline" size="sm" onClick={() => openEdit(key)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            API key "{key.label}" akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteKey.mutate(key.id)}
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit API Key" : "Buat API Key Baru"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Ubah label, scope, atau batasan untuk API key ini."
                : "Buat API key baru untuk klien atau partner integrasi."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.label.trim()) {
                toast({ title: "Label wajib diisi", variant: "destructive" });
                return;
              }
              if (editing) {
                updateKey.mutate({ id: editing.id, form, originalExpiresAt, initialDays: initialExpiresInDays });
              } else {
                createKey.mutate(form);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Label Klien / Partner *</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Contoh: Partner Reseller A"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Scopes (Hak Akses) *</Label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <div
                    key={scope.id}
                    onClick={() => toggleScope(scope.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      form.scopes.includes(scope.id)
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:bg-muted/10"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.scopes.includes(scope.id)}
                      onChange={() => {}}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">{scope.label}</div>
                      <div className="text-xs text-muted-foreground">{scope.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Masa Berlaku (Hari)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.expiresInDays}
                  onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                  placeholder="Kosong = selamanya"
                />
              </div>

              <div className="space-y-2">
                <Label>Batas Harian (Quota)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.dailyLimit}
                  onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                  placeholder="Kosong = unlimited"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createKey.isPending || updateKey.isPending}>
                {createKey.isPending || updateKey.isPending
                  ? "Menyimpan..."
                  : editing
                  ? "Simpan Perubahan"
                  : "Buat Key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Raw Key Display Dialog (Shown only once) */}
      <Dialog open={showRawKeyDialog} onOpenChange={setShowRawKeyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> API Key Berhasil Dibuat
            </DialogTitle>
            <DialogDescription>
              Simpan raw key ini sekarang. Key ini <strong>hanya ditampilkan satu kali</strong> dan tidak dapat dilihat lagi.
            </DialogDescription>
          </DialogHeader>

          {rawKeyData && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/20">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <div className="font-semibold">{rawKeyData.label}</div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Raw API Key</Label>
                <div className="flex items-center gap-2">
                  <pre className="flex-1 p-3 rounded-lg border bg-black/40 font-mono text-xs break-all select-all">
                    {rawKeyData.rawKey}
                  </pre>
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => copyToClipboard(rawKeyData.rawKey)}
                  >
                    {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {isCopied ? "Tersalin" : "Salin"}
                  </Button>
                </div>
              </div>

              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Perhatian</AlertTitle>
                <AlertDescription>
                  Jika Anda kehilangan key ini, Anda harus melakukan <strong>Regenerate</strong> dari dashboard admin untuk mendapatkan key baru.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowRawKeyDialog(false)}>
              Saya Sudah Menyimpan Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

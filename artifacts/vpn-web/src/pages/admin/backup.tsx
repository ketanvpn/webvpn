import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  Database,
  Download,
  Send,
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

interface BackupSettings {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupLastAt: string | null;
  backupLastStatus: "success" | "failed" | null;
  backupLastError: string | null;
  backupLastFilename: string | null;
  backupLastSizeBytes: number | null;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return (
    new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }) + " WIB"
  );
}

export default function AdminBackup() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);
  const [localInterval, setLocalInterval] = useState<number | null>(null);

  const { data: settings, isLoading } = useQuery<BackupSettings>({
    queryKey: ["admin-backup-settings"],
    queryFn: () => apiClient.get<BackupSettings>("/api/admin/backup/settings"),
  });

  const enabled = localEnabled !== null ? localEnabled : (settings?.backupEnabled ?? false);
  const interval = localInterval !== null ? localInterval : (settings?.backupIntervalHours ?? 24);

  const saveSettingsMut = useMutation({
    mutationFn: async () => {
      await apiClient.put("/api/admin/backup/settings", { backupEnabled: enabled, backupIntervalHours: interval });
    },
    onSuccess: () => {
      toast({ title: "Pengaturan disimpan", description: "Konfigurasi backup berhasil diperbarui." });
      setLocalEnabled(null);
      setLocalInterval(null);
      qc.invalidateQueries({ queryKey: ["admin-backup-settings"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pengaturan.";
      toast({ title: "Gagal", description: msg, variant: "destructive" });
    },
  });

  const backupNowMut = useMutation({
    mutationFn: () => apiClient.post<{ filename: string; sizeBytes: number; sentToTelegram: boolean }>("/api/admin/backup/now"),
    onSuccess: (data) => {
      const sizeStr = formatBytes(data.sizeBytes);
      const tgInfo = data.sentToTelegram
        ? "File terkirim ke Telegram admin."
        : "Telegram tidak dikonfigurasi — unduh manual via tombol Download.";
      toast({ title: "Backup berhasil!", description: `${data.filename} (${sizeStr}) — ${tgInfo}` });
      qc.invalidateQueries({ queryKey: ["admin-backup-settings"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Backup gagal";
      toast({ title: "Backup gagal", description: msg, variant: "destructive" });
    },
  });

  const downloadMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/backup/download", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Tidak ada backup tersedia" }));
        throw new Error(body?.error ?? "Download gagal");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename = settings?.backupLastFilename ?? "backup.sql.gz";
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Download gagal";
      toast({ title: "Download gagal", description: msg, variant: "destructive" });
    },
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!restoreFile) throw new Error("Pilih file terlebih dahulu");
      const arrayBuf = await restoreFile.arrayBuffer();
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/gzip" },
        body: arrayBuf,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Terjadi kesalahan" }));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
    },
    onSuccess: () => {
      toast({ title: "Restore berhasil!", description: "Database berhasil dipulihkan dari file backup." });
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Restore gagal";
      toast({ title: "Restore gagal", description: msg, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreFile(e.target.files?.[0] ?? null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasSettingsChanged = localEnabled !== null || localInterval !== null;
  const lastStatus = settings?.backupLastStatus;
  const hasBackup = !!settings?.backupLastFilename;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status Backup Terakhir */}
      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Status Backup Database
          </CardTitle>
          <CardDescription>
            Informasi backup terakhir dan tombol untuk memulai backup manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Backup Terakhir</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDate(settings?.backupLastAt ?? null)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div>
                {lastStatus === "success" && (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Berhasil
                  </Badge>
                )}
                {lastStatus === "failed" && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Gagal
                  </Badge>
                )}
                {!lastStatus && <span className="text-muted-foreground">Belum pernah backup</span>}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Nama File</p>
              <p className="font-mono text-xs">{settings?.backupLastFilename ?? "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ukuran File</p>
              <p className="font-medium">{formatBytes(settings?.backupLastSizeBytes ?? null)}</p>
            </div>
          </div>

          {lastStatus === "failed" && settings?.backupLastError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p className="font-medium">Error:</p>
              <p className="font-mono text-xs mt-1">{settings.backupLastError}</p>
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => backupNowMut.mutate()}
              disabled={backupNowMut.isPending}
              className="gap-2"
            >
              {backupNowMut.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {backupNowMut.isPending ? "Memproses..." : "Backup Sekarang"}
            </Button>

            <Button
              variant="outline"
              onClick={() => downloadMut.mutate()}
              disabled={downloadMut.isPending || !hasBackup}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadMut.isPending ? "Mengunduh..." : "Unduh Backup"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            File backup dikirim ke Telegram admin secara otomatis. Tombol Unduh hanya berfungsi
            selama server aktif (file disimpan sementara di /tmp).
          </p>
        </CardContent>
      </Card>

      {/* Pengaturan Auto Backup */}
      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Auto Backup Terjadwal
          </CardTitle>
          <CardDescription>
            Backup otomatis berjalan sesuai interval dan dikirim ke Telegram admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Aktifkan Auto Backup</Label>
              <p className="text-sm text-muted-foreground">
                Backup database secara otomatis sesuai jadwal
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={(v) => setLocalEnabled(v)} />
          </div>

          <div className="space-y-2">
            <Label>Interval Backup</Label>
            <Select
              value={String(interval)}
              onValueChange={(v) => setLocalInterval(parseInt(v))}
              disabled={!enabled}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Setiap 6 jam</SelectItem>
                <SelectItem value="12">Setiap 12 jam</SelectItem>
                <SelectItem value="24">Setiap 24 jam (1 hari)</SelectItem>
                <SelectItem value="48">Setiap 48 jam (2 hari)</SelectItem>
                <SelectItem value="168">Setiap 7 hari</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => saveSettingsMut.mutate()}
            disabled={saveSettingsMut.isPending || !hasSettingsChanged}
          >
            {saveSettingsMut.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Simpan Pengaturan
          </Button>
        </CardContent>
      </Card>

      {/* Restore Database */}
      <Card className="glass-panel border-destructive/30">
        <CardHeader className="border-b border-destructive/30">
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Restore Database
          </CardTitle>
          <CardDescription>
            Upload file backup (.sql.gz) untuk memulihkan database.{" "}
            <strong>Tindakan ini akan menimpa data saat ini</strong> dan tidak bisa dibatalkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>File Backup (.sql.gz)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gz,.sql.gz"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:cursor-pointer hover:file:bg-primary/90"
            />
            {restoreFile && (
              <p className="text-xs text-muted-foreground">
                File dipilih: <span className="font-mono">{restoreFile.name}</span> ({formatBytes(restoreFile.size)})
              </p>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={!restoreFile || restoreMut.isPending}
                className="gap-2"
              >
                {restoreMut.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                {restoreMut.isPending ? "Memulihkan..." : "Restore Database"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Restore Database</AlertDialogTitle>
                <AlertDialogDescription>
                  Anda akan memulihkan database dari file{" "}
                  <strong>{restoreFile?.name}</strong>.<br />
                  <br />
                  <strong className="text-destructive">Peringatan:</strong> Seluruh data saat ini
                  (pengguna, order, akun VPN, saldo) akan ditimpa oleh data dari file backup.
                  Tindakan ini <strong>TIDAK BISA DIBATALKAN</strong>.<br />
                  <br />
                  Apakah Anda yakin ingin melanjutkan?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => restoreMut.mutate()}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Ya, Restore Sekarang
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

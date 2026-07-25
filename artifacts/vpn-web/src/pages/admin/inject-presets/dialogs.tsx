import type { FormEvent, MouseEvent } from "react";
import { Loader2, Info, Plus, RotateCcw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import type {
  EasyInjectPreset,
  EasyInjectPresetRevision,
  FormMode,
  PresetForm,
} from "./types";
import { formatDate } from "./api";

/* ──────────────── Delete Dialog ──────────────── */

interface DeleteDialogProps {
  target: EasyInjectPreset | null;
  error: string | null;
  isDeleting: boolean;
  onConfirm: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDialog({
  target,
  error,
  isDeleting,
  onConfirm,
  onOpenChange,
}: DeleteDialogProps) {
  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !isDeleting) onOpenChange(open);
      }}
    >
      <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-lg rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus preset custom?</AlertDialogTitle>
          <AlertDialogDescription>
            Preset <strong>{target?.name}</strong> akan dihapus permanen. Tindakan ini hanya tersedia
            untuk preset custom dan tidak dapat dibatalkan dari layar ini.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? "Menghapus..." : "Hapus Permanen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ──────────────── Revisions Dialog ──────────────── */

interface RevisionsDialogProps {
  preset: EasyInjectPreset | null;
  revisions: EasyInjectPresetRevision[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  isRestoring: boolean;
  restoreTarget: EasyInjectPresetRevision | null;
  restoreError: string | null;
  onRefetch: () => void;
  onSelectRestore: (revision: EasyInjectPresetRevision) => void;
  onConfirmRestore: (event: MouseEvent<HTMLButtonElement>) => void;
  onOpenChange: (open: boolean) => void;
}

export function RevisionsDialog({
  preset,
  revisions,
  isLoading,
  isFetching,
  error,
  isRestoring,
  restoreTarget,
  restoreError,
  onRefetch,
  onSelectRestore,
  onConfirmRestore,
  onOpenChange,
}: RevisionsDialogProps) {
  return (
    <>
      <Dialog
        open={preset !== null}
        onOpenChange={(open) => {
          if (!open && !isRestoring) onOpenChange(open);
        }}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 sm:p-6 pr-12 border-b border-white/5 shrink-0">
            <DialogTitle>Riwayat Revisi</DialogTitle>
            <DialogDescription>
              {preset?.name} · versi aktif {preset?.version}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : error ? (
              <div className="py-10 text-center">
                <p className="font-medium">Riwayat revisi gagal dimuat</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  {error instanceof Error ? error.message : "Terjadi kesalahan saat memuat revisi."}
                </p>
                <Button variant="outline" onClick={onRefetch} disabled={isFetching}>
                  {isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                  Coba Lagi
                </Button>
              </div>
            ) : revisions?.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <History className="h-9 w-9 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada revisi tersimpan untuk preset ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {revisions?.map((revision) => (
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
                        onClick={() => onSelectRestore(revision)}
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
          if (!open && !isRestoring) onOpenChange(open);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1rem)] sm:max-w-lg rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan versi {restoreTarget?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              Konfigurasi <strong>{preset?.name}</strong> akan dikembalikan ke snapshot versi ini.
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
            <AlertDialogAction disabled={isRestoring} onClick={onConfirmRestore}>
              {isRestoring && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRestoring ? "Memulihkan..." : "Pulihkan Revisi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ──────────────── Stats Bar ──────────────── */

interface StatsBarProps {
  total: number;
  active: number;
  builtIn: number;
}

export function StatsBar({ total, active, builtIn }: StatsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
        <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
        <p className="text-xl sm:text-2xl font-bold mt-1">{total}</p>
      </div>
      <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
        <p className="text-[10px] sm:text-xs text-muted-foreground">Aktif</p>
        <p className="text-xl sm:text-2xl font-bold mt-1 text-emerald-400">{active}</p>
      </div>
      <div className="glass-panel rounded-xl border border-white/5 p-3 sm:p-4">
        <p className="text-[10px] sm:text-xs text-muted-foreground">Bawaan</p>
        <p className="text-xl sm:text-2xl font-bold mt-1">{builtIn}</p>
      </div>
    </div>
  );
}

/* ──────────────── Form Dialog Header ──────────────── */

interface FormDialogHeaderProps {
  mode: FormMode;
}

export function FormDialogHeader({ mode }: FormDialogHeaderProps) {
  return (
    <DialogHeader className="p-4 sm:p-6 pr-12 border-b border-white/5 shrink-0">
      <DialogTitle>
        {mode === "edit"
          ? "Edit Preset Inject"
          : mode === "duplicate"
            ? "Duplikat Preset Inject"
            : "Buat Preset Inject"}
      </DialogTitle>
      <DialogDescription>
        {mode === "duplicate"
          ? "Isi slug unik untuk salinan ini, lalu tinjau preview sebelum menyimpan."
          : "Atur identitas, koneksi, dukungan aplikasi, lalu tinjau hasil strukturalnya."}
      </DialogDescription>
    </DialogHeader>
  );
}

/* ──────────────── Form Dialog Footer ──────────────── */

interface FormDialogFooterProps {
  isSaving: boolean;
  isEditMode: boolean;
  onCancel: () => void;
}

export function FormDialogFooter({ isSaving, isEditMode, onCancel }: FormDialogFooterProps) {
  return (
    <DialogFooter className="shrink-0 border-t border-white/5 bg-background/95 p-4 sm:px-6 sm:py-4 gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
        Batal
      </Button>
      <Button type="submit" disabled={isSaving}>
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSaving ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan Preset"}
      </Button>
    </DialogFooter>
  );
}

/* ──────────────── Form Alert ──────────────── */

export function FormErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <Info className="h-4 w-4" />
      <AlertTitle>Preset belum dapat disimpan</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

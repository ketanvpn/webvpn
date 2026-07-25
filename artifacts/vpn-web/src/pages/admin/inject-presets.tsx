import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCw, Loader2, Network } from "lucide-react";

import type {
  EasyInjectPreset,
  EasyInjectPresetRevision,
  FormErrors,
  FormMode,
  PresetForm,
} from "./inject-presets/types";
import {
  ADMIN_PRESETS_QUERY_KEY,
  USER_PRESETS_QUERY_KEY,
  apiFetch,
  unwrapList,
  createBlankForm,
  presetToForm,
} from "./inject-presets/api";
import { validateForm, toRequestBody } from "./inject-presets/validation";
import { PreviewPanel } from "./inject-presets/preview-panel";
import { PresetRow } from "./inject-presets/preset-row";
import { PresetFormFields } from "./inject-presets/preset-form-fields";
import {
  DeleteDialog,
  RevisionsDialog,
  StatsBar,
  FormDialogHeader,
  FormDialogFooter,
  FormErrorAlert,
} from "./inject-presets/dialogs";
import type { ApiListResponse } from "./inject-presets/types";

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
        await apiFetch<ApiListResponse<EasyInjectPreset>>("/admin/easy-inject-presets"),
      ),
  });

  const revisionsQuery = useQuery<EasyInjectPresetRevision[]>({
    queryKey: ["admin-easy-inject-preset-revisions", revisionPreset?.id],
    queryFn: async () =>
      unwrapList(
        await apiFetch<ApiListResponse<EasyInjectPresetRevision>>(
          `/admin/easy-inject-presets/${revisionPreset!.id}/revisions`,
        ),
      ),
    enabled: revisionPreset !== null,
  });

  const activeCount = presets.filter((p) => p.isActive).length;
  const builtInCount = presets.filter((p) => p.isBuiltIn).length;

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
        await apiFetch(`/admin/easy-inject-presets/${editingPreset.id}`, {
          method: "PATCH",
          body: JSON.stringify(updateBody),
        });
      } else {
        await apiFetch("/admin/easy-inject-presets", {
          method: "POST",
          body: JSON.stringify(body),
        });
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
      await apiFetch(`/admin/easy-inject-presets/${preset.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      });
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
      await apiFetch(`/admin/easy-inject-presets/${deleteTarget.id}`, { method: "DELETE" });
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
      await apiFetch(
        `/admin/easy-inject-presets/${revisionPreset.id}/revisions/${restoreTarget.id}/restore`,
        { method: "POST" },
      );
      await Promise.all([
        invalidatePresetQueries(),
        queryClient.invalidateQueries({
          queryKey: ["admin-easy-inject-preset-revisions", revisionPreset.id],
        }),
      ]);
      const refreshedPreset = queryClient
        .getQueryData<EasyInjectPreset[]>(ADMIN_PRESETS_QUERY_KEY)
        ?.find((p) => p.id === revisionPreset.id);
      if (refreshedPreset) setRevisionPreset(refreshedPreset);
      toast({
        title: "Revisi berhasil dipulihkan",
        description: `${revisionPreset.name} dikembalikan ke versi ${restoreTarget.version}.`,
      });
      setRestoreTarget(null);
    } catch (restoreFailure) {
      const message = restoreFailure instanceof Error ? restoreFailure.message : "Gagal memulihkan revisi.";
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
        <StatsBar total={presets.length} active={activeCount} builtIn={builtInCount} />
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
              {presets.map((preset) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  rowPending={togglePendingIds.has(preset.id)}
                  rowError={rowErrors[preset.id]}
                  onToggle={handleToggle}
                  onEdit={(p) => prepareForm("edit", p)}
                  onDuplicate={(p) => prepareForm("duplicate", p)}
                  onOpenRevisions={openRevisions}
                  onDelete={openDeleteConfirmation}
                  isDeleting={isDeleting}
                  isRestoring={isRestoring}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
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
          onInteractOutside={(e) => isSaving && e.preventDefault()}
          onEscapeKeyDown={(e) => isSaving && e.preventDefault()}
        >
          <FormDialogHeader mode={formMode} />
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <FormErrorAlert message={formMessage} />
              <PresetFormFields
                form={form}
                formErrors={formErrors}
                formMode={formMode}
                updateForm={updateForm}
              />
              <PreviewPanel form={form} />
            </div>
            <FormDialogFooter
              isSaving={isSaving}
              isEditMode={!!editingPreset}
              onCancel={() => setFormOpen(false)}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteDialog
        target={deleteTarget}
        error={deleteError}
        isDeleting={isDeleting}
        onConfirm={(e) => void handleDelete(e)}
        onOpenChange={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      {/* Revisions Dialog + Restore Dialog */}
      <RevisionsDialog
        preset={revisionPreset}
        revisions={revisionsQuery.data}
        isLoading={revisionsQuery.isLoading}
        isFetching={revisionsQuery.isFetching}
        error={revisionsQuery.error}
        isRestoring={isRestoring}
        restoreTarget={restoreTarget}
        restoreError={restoreError}
        onRefetch={() => void revisionsQuery.refetch()}
        onSelectRestore={(r) => {
          setRestoreError(null);
          setRestoreTarget(r);
        }}
        onConfirmRestore={(e) => void handleRestore(e)}
        onOpenChange={() => {
          setRevisionPreset(null);
          setRestoreTarget(null);
          setRestoreError(null);
        }}
      />
    </div>
  );
}

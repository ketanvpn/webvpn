import { Loader2, MoreVertical, Pencil, Copy, History, Trash2, ShieldCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EasyInjectPreset } from "./types";
import { formatDate } from "./api";

interface PresetRowProps {
  preset: EasyInjectPreset;
  rowPending: boolean;
  rowError?: string;
  onToggle: (preset: EasyInjectPreset, isActive: boolean) => void;
  onEdit: (preset: EasyInjectPreset) => void;
  onDuplicate: (preset: EasyInjectPreset) => void;
  onOpenRevisions: (preset: EasyInjectPreset) => void;
  onDelete: (preset: EasyInjectPreset) => void;
  isDeleting: boolean;
  isRestoring: boolean;
}

export function PresetRow({
  preset,
  rowPending,
  rowError,
  onToggle,
  onEdit,
  onDuplicate,
  onOpenRevisions,
  onDelete,
  isDeleting,
  isRestoring,
}: PresetRowProps) {
  return (
    <div
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
              {preset.requiredAccountKind === "cloudfront" ? "☁ " : "🖥 "}
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
                DarkTunnel
              </Badge>
            )}
            {preset.supportsHttpCustom && (
              <Badge className="bg-violet-500/15 text-violet-300 border border-violet-500/25 gap-1">
                HTTP Custom
              </Badge>
            )}
          </div>

          {preset.isBuiltIn && (
            <p className="flex items-start gap-1.5 text-xs text-amber-400/90 mt-3">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Preset bawaan tidak dapat dihapus. Nonaktifkan untuk menyembunyikannya dari pengguna.
            </p>
          )}
          {rowError && (
            <p className="text-xs text-destructive mt-3">{rowError}</p>
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
              onCheckedChange={(checked) => onToggle(preset, checked)}
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
              <DropdownMenuItem onClick={() => onEdit(preset)}>
                <Pencil className="h-4 w-4" /> Edit preset
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(preset)}>
                <Copy className="h-4 w-4" /> Duplikat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenRevisions(preset)}>
                <History className="h-4 w-4" /> Riwayat revisi
              </DropdownMenuItem>
              {!preset.isBuiltIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(preset)}
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
}

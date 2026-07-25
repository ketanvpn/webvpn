import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldPlus,
} from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { EasyInjectPreset, DarkTunnelAccount } from "@/lib/darktunnel";
import type { EasyApp } from "./types";
import { formatExpiry } from "./utils";
import { EasyAppSelector } from "./easy-app-selector";
import { HttpCustomGuideCard } from "./http-custom-guide-card";
import type { HttpCustomGuide } from "@/lib/darktunnel";

interface EasyModeTabProps {
  // Data
  easyPresets: EasyInjectPreset[];
  presetsLoading: boolean;
  presetsError: boolean;
  presetsQueryError: Error | null;
  presetsFetching: boolean;
  refetchPresets: () => void;

  easyPresetId: string;
  easyAccountId: string;
  easyApp: EasyApp | null;
  selectedEasyPreset: EasyInjectPreset | null;
  selectedEasyAccount: DarkTunnelAccount | null;
  compatibleAccounts: DarkTunnelAccount[];
  activeSshAccounts: DarkTunnelAccount[];
  unknownAccounts: DarkTunnelAccount[];
  httpCustomGuide: HttpCustomGuide | null;

  // Account loading
  accountsLoading: boolean;
  accountsError: boolean;
  accountsQueryError: Error | null;
  accountsFetching: boolean;
  refetchAccounts: () => void;

  // Sync
  syncAccountMutation: UseMutationResult<unknown, Error, number, unknown>;

  // Handlers
  onSelectPreset: (presetId: string) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectApp: (app: EasyApp) => void;
  onGenerateConfig: () => void;
  onCopy: (id: string, value: string, label: string) => void;
  copiedField: string | null;
}

export function EasyModeTab({
  easyPresets,
  presetsLoading,
  presetsError,
  presetsQueryError,
  presetsFetching,
  refetchPresets,
  easyPresetId,
  easyAccountId,
  easyApp,
  selectedEasyPreset,
  selectedEasyAccount,
  compatibleAccounts,
  unknownAccounts,
  httpCustomGuide,
  accountsLoading,
  accountsError,
  accountsQueryError,
  accountsFetching,
  refetchAccounts,
  syncAccountMutation,
  onSelectPreset,
  onSelectAccount,
  onSelectApp,
  onGenerateConfig,
  onCopy,
  copiedField,
}: EasyModeTabProps) {
  return (
    <div className="space-y-5">
      {/* ── Step 1: Pilih Paket ── */}
      <Card className="glass-panel overflow-hidden border-primary/20">
        <CardHeader>
          <CardTitle>1. Pilih Paket Internet</CardTitle>
          <CardDescription>
            Sistem akan memasangkan paket dengan jenis akun SSH yang benar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {presetsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((item) => (
                <div key={item} className="h-40 animate-pulse rounded-2xl bg-muted/20" />
              ))}
            </div>
          ) : presetsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Trik injek gagal dimuat</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  {presetsQueryError instanceof Error
                    ? presetsQueryError.message
                    : "Tidak dapat mengambil preset aktif dari server."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={presetsFetching}
                  onClick={() => void refetchPresets()}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${presetsFetching ? "animate-spin" : ""}`} />
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : easyPresets.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Mode Mudah sementara tidak tersedia</AlertTitle>
              <AlertDescription>
                Semua trik sedang dinonaktifkan atau diperbarui oleh admin. Coba lagi nanti.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {easyPresets.map((preset, index) => {
                const active = easyPresetId === String(preset.id);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(String(preset.id))}
                    className={`rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                        : "border-white/10 bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <ShieldPlus className={`mb-3 h-8 w-8 ${index % 2 === 0 ? "text-violet-300" : "text-cyan-300"}`} />
                    <div className="text-lg font-bold">{preset.name}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {preset.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{preset.accountLabel}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        v{preset.version}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Step 2: Pilih Akun ── */}
      {selectedEasyPreset && (
        <Card className="glass-panel overflow-hidden border-cyan-500/20">
          <CardHeader>
            <CardTitle>2. Pilih Akun {selectedEasyPreset.accountLabel}</CardTitle>
            <CardDescription>
              Hanya akun aktif dan cocok untuk {selectedEasyPreset.name} yang ditampilkan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {accountsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa akun...
              </div>
            ) : accountsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Akun gagal dimuat</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    {accountsQueryError instanceof Error
                      ? accountsQueryError.message
                      : "Tidak dapat mengambil akun SSH dari server."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={accountsFetching}
                    onClick={() => void refetchAccounts()}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${accountsFetching ? "animate-spin" : ""}`} />
                    Coba Lagi
                  </Button>
                </AlertDescription>
              </Alert>
            ) : compatibleAccounts.length > 0 ? (
              <>
                <Select value={easyAccountId} onValueChange={onSelectAccount}>
                  <SelectTrigger className="h-12 bg-background/50">
                    <SelectValue placeholder="Pilih akun yang akan dipakai" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleAccounts
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.expiresAt).getTime() -
                          new Date(b.expiresAt).getTime(),
                      )
                      .map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.username} • {account.server?.name ?? "Server"} • aktif s/d {formatExpiry(account.expiresAt)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {selectedEasyAccount && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex items-center gap-2 font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Akun cocok
                    </div>
                    <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                      <span>Username: <b>{selectedEasyAccount.username}</b></span>
                      <span>Aktif sampai: <b>{formatExpiry(selectedEasyAccount.expiresAt)}</b></span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Belum ada akun yang cocok</AlertTitle>
                <AlertDescription>
                  {selectedEasyPreset.name} membutuhkan akun {selectedEasyPreset.accountLabel}. Beli akun tersebut terlebih dahulu atau perbarui data akun Nadia di bawah.
                </AlertDescription>
              </Alert>
            )}

            {unknownAccounts.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                <div>
                  <p className="text-sm font-semibold text-amber-200">Ada akun Nadia yang belum teridentifikasi</p>
                  <p className="text-xs text-muted-foreground">Perbarui data agar sistem dapat menentukan SSH biasa atau CloudFront.</p>
                </div>
                {unknownAccounts.map((account) => (
                  <div key={account.id} className="flex flex-col gap-2 rounded-xl bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">{account.username} • {account.server?.name ?? "Server Nadia"}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={syncAccountMutation.isPending}
                      onClick={() => syncAccountMutation.mutate(account.id)}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${syncAccountMutation.isPending ? "animate-spin" : ""}`} />
                      Perbarui Data Akun
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Pilih Aplikasi ── */}
      {selectedEasyAccount && (
        <Card className="glass-panel overflow-hidden border-primary/20">
          <CardHeader>
            <CardTitle>3. Pilih Aplikasi</CardTitle>
            <CardDescription>
              Gunakan akun yang sama di DarkTunnel atau ikuti panduan HTTP Custom.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EasyAppSelector
              value={easyApp}
              preset={selectedEasyPreset!}
              onChange={onSelectApp}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Step 4: Buat Config DarkTunnel ── */}
      {easyApp === "darktunnel" && selectedEasyAccount && (
        <Card className="glass-panel overflow-hidden border-emerald-500/25">
          <CardHeader>
            <CardTitle>4. Buat Config DarkTunnel</CardTitle>
            <CardDescription>
              Website membuat file .dark menggunakan akun yang sudah dipilih.
            </CardDescription>
          </CardHeader>
          <CardFooter className="border-t border-white/5 bg-primary/5 p-4">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={onGenerateConfig}
            >
              <ShieldPlus className="h-4 w-4" />
              Buat Config DarkTunnel
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ── HTTP Custom Guide ── */}
      {httpCustomGuide && (
        <HttpCustomGuideCard
          guide={httpCustomGuide}
          copiedField={copiedField}
          onCopy={onCopy}
        />
      )}

      {/* ── Cara Pakai ── */}
      {easyApp && (
        <Card className="border-white/10 bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {easyApp === "darktunnel"
                ? "Cara Pakai Setelah Config Dibuat"
                : "Ringkasan Cara Pakai HTTP Custom"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            {(easyApp === "darktunnel"
              ? [
                  ["1", "Download file .dark"],
                  ["2", "Buka file dengan DarkTunnel"],
                  ["3", "Pilih config lalu Connect"],
                ]
              : [
                  ["1", "Salin data sesuai label"],
                  ["2", "Tempel di menu HTTP Custom"],
                  ["3", "CONNECT lalu periksa LOG"],
                ]
            ).map(([number, text]) => (
              <div key={number} className="flex items-center gap-3 rounded-xl border border-white/5 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{number}</span>
                <span>{text}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

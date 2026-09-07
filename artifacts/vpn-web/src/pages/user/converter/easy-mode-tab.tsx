import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldPlus,
  Smartphone,
} from "lucide-react";
import type {
  DarkTunnelAccount,
  EasyInjectPreset,
  HttpCustomGuide,
} from "@/lib/darktunnel";
import type { EasyApp } from "./types";
import { EasyAppSelector } from "./shared-components";
import { formatExpiry, getActivePurchaseOptions } from "./converter-utils";
import { ExternalLink } from "lucide-react";

export type EasyModeTabProps = {
  easyPresets: EasyInjectPreset[];
  compatibleAccounts: DarkTunnelAccount[];
  unknownAccounts: DarkTunnelAccount[];
  selectedEasyPreset: EasyInjectPreset | null;
  selectedEasyAccount: DarkTunnelAccount | undefined;
  easyPresetId: string;
  easyAccountId: string;
  easyActiveStep: 1 | 2 | 3;
  easyApp: EasyApp | null;
  presetsLoading: boolean;
  presetsError: boolean;
  presetsQueryError: Error | null;
  presetsFetching: boolean;
  accountsLoading: boolean;
  accountsError: boolean;
  accountsQueryError: Error | null;
  accountsFetching: boolean;
  syncAccountMutation: { isPending: boolean; mutate: (id: number) => void };
  httpCustomGuide: HttpCustomGuide | null;
  onSelectPreset: (id: string) => void;
  onSelectAccount: (id: string) => void;
  onSelectApp: (app: EasyApp) => void;
  onSetActiveStep: (step: 1 | 2 | 3) => void;
  onGenerateConfig: () => void;
  onRefetchPresets: () => void;
  onRefetchAccounts: () => void;
  onShowHttpModal: () => void;
};

export function EasyModeTab({
  easyPresets,
  compatibleAccounts,
  unknownAccounts,
  selectedEasyPreset,
  selectedEasyAccount,
  easyPresetId,
  easyAccountId,
  easyActiveStep,
  easyApp,
  presetsLoading,
  presetsError,
  presetsQueryError,
  presetsFetching,
  accountsLoading,
  accountsError,
  accountsQueryError,
  accountsFetching,
  syncAccountMutation,
  httpCustomGuide,
  onSelectPreset,
  onSelectAccount,
  onSelectApp,
  onSetActiveStep,
  onGenerateConfig,
  onRefetchPresets,
  onRefetchAccounts,
  onShowHttpModal,
}: EasyModeTabProps) {
  return (
    <div className="w-full min-w-0 space-y-4 overflow-hidden">
      {/* Step 1: Select Preset */}
      {easyActiveStep === 1 ? (
        <Card className="w-full min-w-0 glass-panel overflow-hidden border-primary/20">
          <CardHeader className="min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg break-words">1. Pilih Paket Internet</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px]">
                Langkah 1 dari 3
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm break-words">
              Pilih trik paket yang ingin kamu gunakan.
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 overflow-hidden p-4 sm:p-6 pt-0 space-y-4">
            {presetsLoading ? (
              <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {[1, 2].map((item) => (
                  <div key={item} className="h-40 w-full min-w-0 animate-pulse rounded-2xl bg-muted/20" />
                ))}
              </div>
            ) : presetsError ? (
              <Alert variant="destructive" className="min-w-0 overflow-hidden">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertTitle className="break-words">Trik injek gagal dimuat</AlertTitle>
                <AlertDescription className="space-y-3 min-w-0">
                  <p className="break-words text-xs sm:text-sm">
                    {presetsQueryError instanceof Error
                      ? presetsQueryError.message
                      : "Tidak dapat mengambil preset aktif dari server."}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={presetsFetching}
                    onClick={() => void onRefetchPresets()}
                    className="w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${presetsFetching ? "animate-spin" : ""}`} />
                    Coba Lagi
                  </Button>
                </AlertDescription>
              </Alert>
            ) : easyPresets.length === 0 ? (
              <Alert className="min-w-0 overflow-hidden">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <AlertTitle className="break-words">Mode Mudah sementara tidak tersedia</AlertTitle>
                <AlertDescription className="break-words text-xs sm:text-sm">
                  Semua trik sedang dinonaktifkan atau diperbarui oleh admin. Coba lagi nanti.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {easyPresets.map((preset, index) => {
                  const active = easyPresetId === String(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectPreset(String(preset.id))}
                      className={`flex min-h-[120px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                          : "border-white/10 bg-background/40 hover:border-primary/40"
                      }`}
                    >
                      <ShieldPlus className={`mb-2 sm:mb-3 h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${index % 2 === 0 ? "text-violet-300" : "text-cyan-300"}`} />
                      <div className="text-sm sm:text-lg font-bold break-words line-clamp-2 min-w-0">{preset.name}</div>
                      <p className="mt-1 text-xs text-muted-foreground break-words line-clamp-3 min-w-0">
                        {preset.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2 min-w-0">
                        <Badge variant="outline" className="text-[10px] max-w-full truncate">{preset.accountLabel}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">
                          v{preset.version}
                        </Badge>
                        {getActivePurchaseOptions(preset).length > 0 && (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200 text-[10px] shrink-0">
                            {getActivePurchaseOptions(preset).length} link beli
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedEasyPreset && getActivePurchaseOptions(selectedEasyPreset).length > 0 && (
              <Card className="w-full min-w-0 overflow-hidden glass-panel border-amber-500/20 bg-amber-500/5 mt-3">
                <CardHeader className="pb-2 p-3 sm:p-4">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5">
                    <span>🛒</span> <span>Beli Paket {selectedEasyPreset.name} di MyTelkomsel</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3 sm:p-4 pt-0">
                  {getActivePurchaseOptions(selectedEasyPreset).map((opt) => (
                    <div
                      key={opt.id}
                      className="flex w-full min-w-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-white/5 bg-background/40 p-2.5"
                    >
                      <span className="text-xs font-medium truncate">
                        {opt.label} {opt.quotaText && `• ${opt.quotaText}`} {opt.priceText && `- ${opt.priceText}`}
                      </span>
                      <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1 shrink-0 w-full sm:w-auto">
                        <a href={opt.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> Beli
                        </a>
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full min-w-0 glass-panel border-emerald-500/30 bg-emerald-950/10 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">1. Paket Internet:</span>
                  <span className="text-sm font-bold text-white truncate">{selectedEasyPreset?.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 py-0">
                    {selectedEasyPreset?.accountLabel}
                  </Badge>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetActiveStep(1)}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-white shrink-0"
            >
              Ganti Paket
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Select Account */}
      {easyActiveStep === 2 && selectedEasyPreset ? (
        <Card className="w-full min-w-0 glass-panel overflow-hidden border-cyan-500/20">
          <CardHeader className="min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg break-words">2. Pilih Akun {selectedEasyPreset.accountLabel}</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px]">
                Langkah 2 dari 3
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm break-words">
              Hanya akun aktif dan cocok untuk {selectedEasyPreset.name} yang ditampilkan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0 overflow-hidden p-4 sm:p-6 pt-0">
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
                    onClick={() => void onRefetchAccounts()}
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
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" /> Akun cocok &amp; siap digunakan
                    </div>
                    <div className="grid gap-1 text-sm sm:grid-cols-2">
                      <span>Username: <b>{selectedEasyAccount.username}</b></span>
                      <span>Aktif sampai: <b>{formatExpiry(selectedEasyAccount.expiresAt)}</b></span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold h-9 mt-1"
                      onClick={() => onSetActiveStep(3)}
                    >
                      Lanjut ke Pilih Aplikasi →
                    </Button>
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
      ) : easyActiveStep > 2 && selectedEasyAccount ? (
        <Card className="w-full min-w-0 glass-panel border-emerald-500/30 bg-emerald-950/10 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">2. Akun SSH:</span>
                  <span className="text-sm font-bold text-white truncate">{selectedEasyAccount.username}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    ({selectedEasyAccount.server?.name ?? "Server"} • aktif s/d {formatExpiry(selectedEasyAccount.expiresAt)})
                  </span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetActiveStep(2)}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-white shrink-0"
            >
              Ganti Akun
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="w-full min-w-0 glass-panel border-white/5 opacity-50 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground text-xs font-bold">
              2
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">
              2. Pilih Akun SSH (Pilih paket internet terlebih dahulu)
            </span>
          </div>
        </Card>
      )}

      {/* Step 3: Select Application */}
      {easyActiveStep === 3 && selectedEasyAccount ? (
        <Card className="w-full min-w-0 glass-panel overflow-hidden border-primary/20">
          <CardHeader className="min-w-0 overflow-hidden p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base sm:text-lg break-words">3. Pilih Aplikasi</CardTitle>
              <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px]">
                Langkah Terakhir
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm break-words">
              Ketuk aplikasi untuk membuka jendela panduan atau download config.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 min-w-0 overflow-hidden p-4 sm:p-6 pt-0">
            <EasyAppSelector
              value={easyApp}
              preset={selectedEasyPreset!}
              onChange={onSelectApp}
            />

            {easyApp === "http-custom" && httpCustomGuide && (
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full gap-2 min-w-0 break-words whitespace-normal h-auto py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-bold shadow-lg shadow-cyan-500/20"
                  onClick={onShowHttpModal}
                >
                  <Smartphone className="h-4 w-4 shrink-0" />
                  <span className="break-words">Buka Panduan HTTP Custom (v7) →</span>
                </Button>
              </div>
            )}

            {easyApp === "darktunnel" && (
              <div className="pt-2">
                <Button
                  size="lg"
                  className="w-full gap-2 min-w-0 break-words whitespace-normal h-auto py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-lg shadow-emerald-500/20"
                  onClick={onGenerateConfig}
                >
                  <ShieldPlus className="h-4 w-4 shrink-0" />
                  <span className="break-words">Buka / Download Config DarkTunnel →</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full min-w-0 glass-panel border-white/5 opacity-50 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground text-xs font-bold">
              3
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">
              3. Pilih Aplikasi (Selesaikan pemilihan paket &amp; akun terlebih dahulu)
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

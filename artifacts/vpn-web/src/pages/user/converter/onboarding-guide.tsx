import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ExternalLink } from "lucide-react";
import type { EasyInjectPreset } from "@/lib/darktunnel";
import { GUIDE_DISMISSED_KEY, GUIDE_COLLAPSED_KEY } from "./types";
import { getActivePurchaseOptions, presetIcon } from "./converter-utils";

type PaketOnboardingGuideProps = {
  presets: EasyInjectPreset[];
  onSelectPreset: (id: string) => void;
  hasAccounts: boolean;
};

export function PaketOnboardingGuide({ presets, onSelectPreset, hasAccounts }: PaketOnboardingGuideProps) {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(GUIDE_COLLAPSED_KEY);
      if (raw === "1") return true;
      if (raw === "0") return false;
    } catch {
      return hasAccounts ? true : false;
    }
    return hasAccounts;
  });

  const handleDismiss = () => {
    try {
      localStorage.setItem(GUIDE_DISMISSED_KEY, "1");
    } catch {
      return;
    }
    setDismissed(true);
  };

  const handleUndismiss = () => {
    try {
      localStorage.removeItem(GUIDE_DISMISSED_KEY);
    } catch {
      return;
    }
    setDismissed(false);
  };

  const handleToggleCollapsed = () => {
    const next = !collapsed;
    try {
      localStorage.setItem(GUIDE_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      return;
    }
    setCollapsed(next);
  };

  if (dismissed) {
    return (
      <Card className="w-full min-w-0 overflow-hidden glass-panel border-white/10 bg-background/20">
        <CardContent className="flex w-full min-w-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4">
          <p className="text-sm text-muted-foreground break-words min-w-0 flex-1">Butuh panduan paket GameMax/Ilmupedia?</p>
          <Button size="sm" variant="outline" onClick={handleUndismiss} className="shrink-0 w-full sm:w-auto">
            Tampilkan panduan
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full min-w-0 overflow-hidden glass-panel border-primary/20">
      <CardHeader className="pb-3 min-w-0">
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg break-words">Panduan Pemula - Pilih Paket Kamu</CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm break-words">
              Baru pertama kali inject? Pilih paket operator dulu, lihat link beli paket MyTelkomsel, lalu buat akun SSH yang sesuai.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" onClick={handleToggleCollapsed} className="flex-1 sm:flex-none">
              {collapsed ? "Tampilkan" : "Sembunyikan"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="flex-1 sm:flex-none">
              Sudah paham
            </Button>
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4 min-w-0 w-full overflow-hidden">
          <Alert className="border-amber-500/30 bg-amber-500/10 min-w-0 overflow-hidden">
            <AlertCircle className="h-4 w-4 text-amber-300 shrink-0" />
            <AlertTitle className="text-amber-100 break-words">Perhatian</AlertTitle>
            <AlertDescription className="text-xs text-amber-100/80 break-words">
              Link beli mengarah ke MyTelkomsel, wajib punya aplikasi MyTelkomsel &amp; nomor Telkomsel aktif.
            </AlertDescription>
          </Alert>

          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada paket aktif.</p>
          ) : (
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              {presets.map((preset) => {
                const purchaseOpts = getActivePurchaseOptions(preset);
                const kindLabel = preset.requiredAccountKind === "cloudfront" ? "CloudFront" : "biasa";
                return (
                  <div
                    key={preset.id}
                    className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-background/40 p-3 sm:p-4"
                  >
                    <div className="flex w-full min-w-0 items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                        <span className="text-xl sm:text-2xl shrink-0">{presetIcon(preset.slug)}</span>
                        <span className="font-bold text-sm sm:text-base break-words min-w-0 flex-1 line-clamp-2">{preset.name}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] max-w-[90px] truncate">
                        {preset.accountLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 break-words min-w-0">{preset.description}</p>

                    {purchaseOpts.length > 0 && (
                      <div className="space-y-2 min-w-0 w-full overflow-hidden">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Link Beli MyTelkomsel</p>
                        <div className="space-y-2 w-full min-w-0">
                          {purchaseOpts.map((opt) => (
                            <div
                              key={opt.id}
                              className="flex w-full min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-white/5 bg-black/10 p-2.5"
                            >
                              <div className="min-w-0 w-full overflow-hidden">
                                <p className="text-xs font-medium break-words line-clamp-2">
                                  {opt.label}
                                  {opt.quotaText ? ` • ${opt.quotaText}` : ""}
                                  {opt.priceText ? ` - ${opt.priceText}` : ""}
                                </p>
                              </div>
                              <Button size="sm" variant="outline" asChild className="w-full gap-1 h-8 text-xs shrink-0">
                                <a href={opt.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 w-full">
                                  <ExternalLink className="h-3 w-3 shrink-0" /> Beli - {opt.label}
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex w-full min-w-0 flex-col gap-2 pt-1">
                      <Button
                        size="sm"
                        className="w-full gap-1 whitespace-normal break-words min-h-[36px] h-auto py-2 text-xs sm:text-sm"
                        onClick={() => setLocation(`/order-vpn?preset=${encodeURIComponent(preset.slug)}&kind=${preset.requiredAccountKind}`)}
                      >
                        <span className="break-words">Buat Akun SSH {kindLabel} →</span>
                      </Button>
                      <Button size="sm" variant="outline" className="w-full gap-1 whitespace-normal break-words min-h-[36px] h-auto py-2 text-xs sm:text-sm" onClick={() => onSelectPreset(String(preset.id))}>
                        Pakai Akun Saya →
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

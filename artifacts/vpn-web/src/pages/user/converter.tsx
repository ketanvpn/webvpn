import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  ShieldPlus,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildDarkTunnelConfig,
  buildHttpCustomGuide,
  classifySshAccount,
  isAccountCompatibleWithPreset,
  isActiveSshAccount,
  type DarkTunnelAccount,
  type DarkTunnelBuildResult,
  type EasyInjectPreset,
  type HttpCustomGuide,
} from "@/lib/darktunnel";

const GUIDE_DISMISSED_KEY = "inject_guide_dismissed_v1";
const GUIDE_COLLAPSED_KEY = "inject_guide_collapsed_v1";

function getActivePurchaseOptions(preset: EasyInjectPreset) {
  const opts = (preset.purchaseOptions ?? []).filter((o) => o.isActive);
  return [...opts].sort((a, b) => a.sortOrder - b.sortOrder);
}
function presetIcon(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes("gamemax") || s.includes("game")) return "🎮";
  if (s.includes("ilmupedia") || s.includes("ilmu")) return "📚";
  return "🧩";
}

type BugPreset = {
  id: number;
  name: string;
  bugDomain: string;
  mode: "wildcard" | "sni" | "host";
  isActive: boolean;
  sshInjectConfig?: Record<string, unknown>;
};

type EasyApp = "darktunnel" | "http-custom";

type EasyAppSelectorProps = {
  value: EasyApp | null;
  preset: EasyInjectPreset;
  onChange: (app: EasyApp) => void;
};

function EasyAppSelector({ value, preset, onChange }: EasyAppSelectorProps) {
  const applications = [
    ...(preset.supportsDarkTunnel
      ? [{
          id: "darktunnel" as const,
          label: "DarkTunnel",
          description: "Otomatis: download file .dark atau import melalui link.",
          icon: ShieldPlus,
          iconClass: "text-emerald-300",
        }]
      : []),
    ...(preset.supportsHttpCustom
      ? [{
          id: "http-custom" as const,
          label: "HTTP Custom",
          description: "Panduan: salin data SSH, proxy, payload, dan SNI secara bertahap.",
          icon: Smartphone,
          iconClass: "text-cyan-300",
        }]
      : []),
  ];

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {applications.map((application) => {
        const Icon = application.icon;
        const active = value === application.id;
        return (
          <button
            key={application.id}
            type="button"
            onClick={() => onChange(application.id)}
            className={`flex min-h-[128px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all ${
              active
                ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                : "border-white/10 bg-background/40 hover:border-primary/40"
            }`}
          >
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
              <Icon className={`h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${application.iconClass}`} />
              {application.id === "http-custom" && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200 shrink-0 text-[10px]">
                  Beta
                </Badge>
              )}
            </div>
            <div className="mt-3 text-sm sm:text-lg font-bold break-words min-w-0">{application.label}</div>
            <p className="mt-1 text-xs text-muted-foreground break-words line-clamp-3 min-w-0">
              {application.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

type CopyableGuideFieldProps = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  copied: boolean;
  onCopy: (id: string, value: string, label: string) => void;
};

function CopyableGuideField({
  id,
  label,
  value,
  hint,
  multiline = false,
  copied,
  onCopy,
}: CopyableGuideFieldProps) {
  return (
    <div className={`flex min-w-0 w-full flex-col space-y-2 overflow-hidden ${multiline ? "sm:col-span-2" : ""}`}>
      <div className="min-w-0">
        <Label className="break-words">{label}</Label>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground break-words">{hint}</p>}
      </div>
      <div className={`flex w-full min-w-0 gap-2 overflow-hidden ${multiline ? "flex-col sm:flex-row sm:items-start" : "flex-col sm:flex-row sm:items-center"}`}>
        <pre
          className={`min-w-0 w-full flex-1 select-all overflow-hidden whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] sm:text-xs leading-relaxed ${
            multiline ? "min-h-[112px] max-h-[200px] overflow-y-auto" : "max-h-[150px] overflow-y-auto"
          }`}
        >
          {value}
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-10 sm:h-11 w-full sm:w-auto shrink-0 gap-2 px-3"
          aria-label={`Salin ${label}`}
          onClick={() => onCopy(id, value, label)}
        >
          {copied ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
          <span className="text-xs sm:text-sm">{copied ? "Tersalin" : "Salin"}</span>
        </Button>
      </div>
    </div>
  );
}

type HttpCustomGuideCardProps = {
  guide: HttpCustomGuide;
  copiedField: string | null;
  onCopy: (id: string, value: string, label: string) => void;
};

type WizardStepItem = {
  id: string;
  stepNumber: number;
  title: string;
  shortLabel: string;
  badge?: string;
  description: string;
  instructions: React.ReactNode;
  imageUrl?: string | null;
  actions?: React.ReactNode;
};

function HttpCustomGuideCard({
  guide,
  copiedField,
  onCopy,
}: HttpCustomGuideCardProps) {
  const cardTopRef = useRef<HTMLDivElement>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"wizard" | "all">("wizard");
  const [sshAccountFormat, setSshAccountFormat] = useState<"standard" | "instant">("standard");

  useEffect(() => {
    if (cardTopRef.current) {
      cardTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentStepIndex]);

  const { data: tutorial } = useQuery({
    queryKey: ["tutorial", "http-custom"],
    queryFn: () =>
      apiClient.get<{
        steps: Array<{
          id: string;
          stepNumber: number;
          title: string;
          description: string;
          imageUrl: string | null;
          actionType?: "none" | "playstore" | "payload_proxy" | "sni" | "ssh_account" | "connect";
        }>;
      }>("/api/tutorials/http-custom"),
    staleTime: 5 * 60 * 1000,
  });

  const wizardSteps: WizardStepItem[] = useMemo(() => {
    const isTls = guide.ssl || !!guide.sni;
    const sshHostPort = `${guide.ssh.host}:${guide.ssh.port}`;

    const rawSteps =
      tutorial?.steps && tutorial.steps.length > 0
        ? tutorial.steps
        : [
            {
              id: "step-1",
              stepNumber: 1,
              title: "Buka Aplikasi HTTP Custom",
              description:
                "Buka aplikasi HTTP Custom dan pastikan kamu berada di halaman utama (Beranda). Pastikan aplikasi sudah versi terbaru.",
              imageUrl: null,
              actionType: "playstore" as const,
            },
            {
              id: "step-2",
              stepNumber: 2,
              title: "Masuk ke Menu SSH",
              description:
                "Di halaman Beranda, ketuk chip atau tombol bertuliskan SSH untuk membuka menu konfigurasi SSH.",
              imageUrl: null,
              actionType: "none" as const,
            },
            {
              id: "step-3",
              stepNumber: 3,
              title: "Aktifkan Payload & Remote Proxy",
              description:
                "Nyalakan toggle Gunakan payload (ON). Untuk paket SSL/TLS pilih metode TLS, sedangkan paket standar biarkan metode default.",
              imageUrl: null,
              actionType: "payload_proxy" as const,
            },
            {
              id: "step-4",
              stepNumber: 4,
              title: "Isi Server Name Indication (SNI)",
              description:
                "Khusus paket yang menggunakan metode TLS/SSL, kolom Server Name Indication (SNI) akan muncul di kartu Payload. Tempelkan domain bug berikut.",
              imageUrl: null,
              actionType: "sni" as const,
            },
            {
              id: "step-5",
              stepNumber: 5,
              title: "Masukkan Akun SSH",
              description:
                "Scroll ke bagian Akun pada menu SSH. Masukkan kredensial akun secara berurutan: 1. SSH Host:Port, 2. Nama Pengguna, 3. Kata Sandi.",
              imageUrl: null,
              actionType: "ssh_account" as const,
            },
            {
              id: "step-6",
              stepNumber: 6,
              title: "Hubungkan Koneksi",
              description:
                "Kembali ke halaman Beranda HTTP Custom, lalu ketuk tombol bulat besar bertanda ▶ (Connect) di pojok kanan bawah. Tunggu hingga status terhubung.",
              imageUrl: null,
              actionType: "connect" as const,
            },
          ];

    const result: WizardStepItem[] = [];

    rawSteps.forEach((rawStep) => {
      const action = rawStep.actionType ?? "none";

      if (action === "sni" && !isTls) {
        return;
      }

      const stepIndex = result.length + 1;
      let badge: string | undefined;
      let actions: React.ReactNode | undefined;
      let instructions: React.ReactNode = (
        <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
          {rawStep.description}
        </p>
      );

      if (action === "playstore") {
        badge = "Persiapan";
        actions = (
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">Belum punya aplikasi HTTP Custom atau versi lama?</span>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 shrink-0" asChild>
              <a
                href="https://play.google.com/store/apps/details?id=xyz.easypro.httpcustom"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={13} /> Buka di Play Store
              </a>
            </Button>
          </div>
        );
      } else if (action === "payload_proxy") {
        badge = isTls ? "Metode: TLS" : "Payload ON";
        if (guide.usePayload) {
          actions = (
            <div className="space-y-3 pt-2">
              <CopyableGuideField
                id="payload"
                label="Custom Payload"
                value={guide.payload}
                hint="Tempel persis ke kolom Custom Payload. Jangan ubah kode [host] / [crlf]."
                multiline
                copied={copiedField === "payload"}
                onCopy={onCopy}
              />
              <CopyableGuideField
                id="remote-proxy"
                label="Remote Proxy"
                value={guide.proxy.address}
                hint="Tempel ke kolom Remote Proxy tepat di bawah kolom Payload."
                copied={copiedField === "remote-proxy"}
                onCopy={onCopy}
              />
            </div>
          );
        } else {
          badge = "Tanpa Payload";
          instructions = (
            <div className="space-y-2 text-xs sm:text-sm text-foreground/90">
              <p>
                Pastikan toggle <strong>Gunakan payload</strong> dalam posisi <strong className="text-amber-300">NONAKTIF (OFF)</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Paket ini langsung menggunakan handshake SSL/Direct tanpa payload HTTP.
              </p>
            </div>
          );
        }
      } else if (action === "sni") {
        badge = "Khusus TLS";
        actions = (
          <div className="pt-2">
            <CopyableGuideField
              id="sni"
              label="SNI / Server Name Indication"
              value={guide.sni || ""}
              hint="Tempel pada kolom Server Name Indication (SNI)."
              copied={copiedField === "sni"}
              onCopy={onCopy}
            />
          </div>
        );
      } else if (action === "ssh_account") {
        badge = "Kredensial Akun";
        actions = (
          <div className="space-y-3 pt-2">
            <div className="flex rounded-lg border border-white/10 p-1 bg-black/20 gap-1 w-full max-w-sm">
              <button
                type="button"
                onClick={() => setSshAccountFormat("standard")}
                className={`flex-1 py-1.5 px-3 text-xs rounded-md font-medium transition-all ${
                  sshAccountFormat === "standard"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                📋 Format Standar v7 (Utama)
              </button>
              <button
                type="button"
                onClick={() => setSshAccountFormat("instant")}
                className={`flex-1 py-1.5 px-3 text-xs rounded-md font-medium transition-all ${
                  sshAccountFormat === "instant"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                ⚡ 1x Salin (Gabungan)
              </button>
            </div>

            {sshAccountFormat === "standard" ? (
              <div className="space-y-3">
                <CopyableGuideField
                  id="ssh-host-port"
                  label="1. SSH Host:Port"
                  value={sshHostPort}
                  hint="Tempel ke kolom pertama (SSH Host:Port)"
                  copied={copiedField === "ssh-host-port"}
                  onCopy={onCopy}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <CopyableGuideField
                    id="ssh-username"
                    label="2. Nama Pengguna SSH"
                    value={guide.ssh.username}
                    hint="Tempel ke kolom Nama Pengguna"
                    copied={copiedField === "ssh-username"}
                    onCopy={onCopy}
                  />
                  <CopyableGuideField
                    id="ssh-password"
                    label="3. Kata Sandi SSH"
                    value={guide.ssh.password}
                    hint="Tempel ke kolom Kata Sandi"
                    copied={copiedField === "ssh-password"}
                    onCopy={onCopy}
                  />
                </div>
              </div>
            ) : (
              <CopyableGuideField
                id="ssh-login"
                label="SSH Login Gabungan (ip:port@user:pass)"
                value={guide.ssh.login}
                hint="Format ip:port@username:password jika aplikasimu mendukung 1x tempel."
                multiline
                copied={copiedField === "ssh-login"}
                onCopy={onCopy}
              />
            )}
          </div>
        );
      } else if (action === "connect") {
        badge = "Selesai";
        actions = (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 space-y-1.5 mt-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-300 text-xs sm:text-sm">
              <CheckCircle2 size={16} /> Status Terhubung:
            </div>
            <p className="text-xs text-emerald-100/80">
              Tunggu 3-5 detik sampai status berubah menjadi <strong>&ldquo;HTTP Custom: Connected&rdquo;</strong> dan muncul ikon kunci VPN di status bar HP kamu.
            </p>
          </div>
        );
      }

      result.push({
        id: String(rawStep.id || stepIndex),
        stepNumber: stepIndex,
        shortLabel: rawStep.title.replace(/^[0-9]+\.\s*/, "").slice(0, 14),
        title: `${stepIndex}. ${rawStep.title.replace(/^[0-9]+\.\s*/, "")}`,
        badge,
        description: rawStep.description.slice(0, 120),
        instructions,
        imageUrl: rawStep.imageUrl,
        actions,
      });
    });

    return result;
  }, [guide, tutorial, copiedField, onCopy, sshAccountFormat]);

  const safeStepIndex = Math.min(Math.max(currentStepIndex, 0), wizardSteps.length - 1);
  const currentStep = wizardSteps[safeStepIndex] ?? wizardSteps[0];
  const isFirstStep = safeStepIndex === 0;
  const isLastStep = safeStepIndex === wizardSteps.length - 1;

  const isTls = guide.ssl || !!guide.sni;
  const recommendedMethod = isTls ? "TLS" : "Enhanced";

  return (
    <Card className="w-full min-w-0 glass-panel overflow-hidden border-cyan-500/25 shadow-lg shadow-cyan-950/10">
      <CardHeader ref={cardTopRef} className="min-w-0 overflow-hidden p-4 sm:p-6 pb-3 sm:pb-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold break-words flex items-center gap-2">
                <span>Panduan HTTP Custom</span>
                <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] py-0 px-2 h-5">
                  v7+
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Target Preset: <strong className="text-foreground">{guide.targetLabel}</strong> • Metode:{" "}
                <strong className="text-cyan-300">
                  {isTls ? "TLS (SSL)" : guide.usePayload ? "Payload Standar" : "SSH Direct"}
                </strong>
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 p-1 bg-black/30 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("wizard")}
              className={`flex items-center gap-1.5 py-1 px-2.5 text-xs rounded-lg font-medium transition-all ${
                viewMode === "wizard"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <BookOpenCheck size={13} />
              <span>Step-by-Step</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`flex items-center gap-1.5 py-1 px-2.5 text-xs rounded-lg font-medium transition-all ${
                viewMode === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Layers size={13} />
              <span>Semua Data</span>
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5 min-w-0 overflow-hidden">
        {viewMode === "wizard" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-cyan-300">
                  Langkah {safeStepIndex + 1} dari {wizardSteps.length}
                </span>
                <span className="text-[11px] truncate max-w-[200px] text-right">
                  {currentStep.shortLabel}
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
                {wizardSteps.map((s, idx) => {
                  const isCompleted = idx < safeStepIndex;
                  const isCurrent = idx === safeStepIndex;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`group relative flex flex-col items-center py-2 px-1.5 rounded-xl border transition-all text-center min-w-0 ${
                        isCurrent
                          ? "border-cyan-400/50 bg-cyan-500/15 shadow-sm shadow-cyan-500/20"
                          : isCompleted
                          ? "border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50"
                          : "border-white/5 bg-white/[0.02] hover:border-white/10 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mb-1 transition-all">
                        {isCompleted ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <span className={isCurrent ? "text-cyan-300 font-extrabold" : "text-muted-foreground"}>
                            {idx + 1}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] leading-tight truncate w-full px-0.5 ${
                          isCurrent
                            ? "text-cyan-200 font-semibold"
                            : isCompleted
                            ? "text-emerald-300/80"
                            : "text-muted-foreground/70"
                        }`}
                      >
                        {s.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-background/50 p-4 sm:p-6 space-y-4 shadow-inner min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-white/5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      {currentStep.title}
                    </h3>
                    {currentStep.badge && (
                      <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px]">
                        {currentStep.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {currentStep.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 p-2 flex justify-center max-h-56">
                  <img
                    src={currentStep.imageUrl}
                    alt={currentStep.title}
                    className="rounded-lg object-contain max-h-52 w-auto border border-white/5"
                  />
                </div>
              )}

              <div className="min-w-0">{currentStep.instructions}</div>

              {currentStep.actions && (
                <div className="pt-2 min-w-0">{currentStep.actions}</div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isFirstStep}
                onClick={() => setCurrentStepIndex((prev) => Math.max(prev - 1, 0))}
                className="gap-1.5 h-10 px-4 text-xs sm:text-sm min-w-0"
              >
                <ChevronLeft size={16} />
                <span>Sebelumnya</span>
              </Button>

              {isLastStep ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStepIndex(0)}
                  className="gap-1.5 h-10 px-5 text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-black font-bold shadow-md shadow-emerald-500/20"
                >
                  <CheckCircle2 size={16} />
                  <span>Ulangi Panduan</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentStepIndex((prev) => Math.min(prev + 1, wizardSteps.length - 1))}
                  className="gap-1.5 h-10 px-5 text-xs sm:text-sm bg-cyan-500 hover:bg-cyan-600 text-black font-semibold shadow-md shadow-cyan-500/20"
                >
                  <span>Langkah Selanjutnya</span>
                  <ChevronRight size={16} />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Alert className="min-w-0 overflow-hidden bg-cyan-950/20 border-cyan-500/30">
              <Sparkles className="h-4 w-4 text-cyan-300 shrink-0" />
              <AlertTitle className="text-sm font-semibold text-cyan-300">Mode Cepat (Semua Data)</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-0.5">
                {isTls ? (
                  <>
                    Salin parameter di bawah ini. Pastikan memilih metode <strong>TLS</strong> di HTTP Custom untuk membuka kolom SNI.
                  </>
                ) : (
                  <>
                    Salin parameter di bawah ini. Cukup aktifkan toggle <strong>Gunakan payload</strong> (metode biarkan default).
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2 min-w-0">
              <Badge className={`shrink-0 text-[11px] ${guide.usePayload ? "bg-emerald-600" : "bg-slate-600"}`}>
                Gunakan Payload: {guide.usePayload ? "ON" : "OFF"}
              </Badge>
              <Badge className={`shrink-0 text-[11px] ${isTls ? "bg-cyan-600" : "bg-slate-600"}`}>
                Metode: {isTls ? "TLS" : "Default / Standar"}
              </Badge>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Mode: {guide.mode}
              </Badge>
            </div>

            <section className="space-y-3 min-w-0 w-full overflow-hidden">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm sm:text-base break-words">A. Parameter Payload & Proxy</h4>
                <p className="text-xs text-muted-foreground break-words">
                  Salin ke menu Payload pada aplikasi HTTP Custom.
                </p>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                {guide.usePayload && (
                  <CopyableGuideField
                    id="payload"
                    label="Custom Payload"
                    value={guide.payload}
                    hint="Tempel ke kolom Custom Payload. Jangan ubah placeholder."
                    multiline
                    copied={copiedField === "payload"}
                    onCopy={onCopy}
                  />
                )}
                <CopyableGuideField
                  id="remote-proxy"
                  label="Remote Proxy"
                  value={guide.proxy.address}
                  hint="Tempel pada kolom Remote Proxy tepat di bawah kolom Payload."
                  copied={copiedField === "remote-proxy"}
                  onCopy={onCopy}
                />
                {guide.sni && (
                  <CopyableGuideField
                    id="sni"
                    label="SNI / Server Name Indication"
                    value={guide.sni}
                    hint="Tempel pada kolom Server Name Indication di kartu Payload (Metode TLS)."
                    copied={copiedField === "sni"}
                    onCopy={onCopy}
                  />
                )}
              </div>
            </section>

            <section className="space-y-3 min-w-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-background/30 p-4">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm break-words">B. Kredensial Akun SSH (Format v7)</h4>
                <p className="text-xs text-muted-foreground break-words">
                  Masukkan data akun sesuai urutan kolom pada kartu Akun di aplikasi HTTP Custom.
                </p>
              </div>
              <div className="space-y-3">
                <CopyableGuideField
                  id="ssh-host-port-fast"
                  label="1. SSH Host:Port"
                  value={`${guide.ssh.host}:${guide.ssh.port}`}
                  hint="Tempel ke kolom pertama (SSH Host:Port)"
                  copied={copiedField === "ssh-host-port-fast"}
                  onCopy={onCopy}
                />
                <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <CopyableGuideField
                    id="ssh-username-fast"
                    label="2. Nama Pengguna SSH"
                    value={guide.ssh.username}
                    hint="Tempel ke kolom Nama Pengguna"
                    copied={copiedField === "ssh-username-fast"}
                    onCopy={onCopy}
                  />
                  <CopyableGuideField
                    id="ssh-password-fast"
                    label="3. Kata Sandi SSH"
                    value={guide.ssh.password}
                    hint="Tempel ke kolom Kata Sandi"
                    copied={copiedField === "ssh-password-fast"}
                    onCopy={onCopy}
                  />
                </div>
                <div className="pt-2 border-t border-white/5">
                  <CopyableGuideField
                    id="ssh-login-fast"
                    label="Format Alternatif (1x Salin Gabungan)"
                    value={guide.ssh.login}
                    hint="Format ip:port@user:pass jika diperlukan."
                    copied={copiedField === "ssh-login-fast"}
                    onCopy={onCopy}
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type PaketOnboardingGuideProps = {
  presets: EasyInjectPreset[];
  onSelectPreset: (id: string) => void;
  hasAccounts: boolean;
};

function PaketOnboardingGuide({ presets, onSelectPreset, hasAccounts }: PaketOnboardingGuideProps) {
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

function convertVmess(raw: string, bug: BugPreset) {
  try {
    const b64 = raw.replace("vmess://", "");
    const decoded = atob(b64);
    const json = JSON.parse(decoded);
    const originalHost = json.host || json.add;

    if (bug.mode === "wildcard") {
      json.add = bug.bugDomain;
      json.host = `${bug.bugDomain}.${originalHost}`;
      json.sni = `${bug.bugDomain}.${originalHost}`;
    } else if (bug.mode === "sni") {
      json.sni = bug.bugDomain;
    } else if (bug.mode === "host") {
      json.host = bug.bugDomain;
    }

    return "vmess://" + btoa(JSON.stringify(json));
  } catch {
    return null;
  }
}

function convertVlessOrTrojan(raw: string, bug: BugPreset) {
  try {
    const url = new URL(raw);
    const params = new URLSearchParams(url.search);
    const originalHost = url.hostname;
    const originalSni = params.get("sni") || originalHost;
    const originalHostParam = params.get("host") || originalHost;

    if (bug.mode === "wildcard") {
      url.hostname = bug.bugDomain;
      params.set("host", `${bug.bugDomain}.${originalHostParam}`);
      params.set("sni", `${bug.bugDomain}.${originalSni}`);
    } else if (bug.mode === "sni") {
      params.set("sni", bug.bugDomain);
    } else if (bug.mode === "host") {
      params.set("host", bug.bugDomain);
    }

    url.search = params.toString();
    return url.toString().replace(/%2F/g, "/").replace(/%3A/g, ":");
  } catch {
    return null;
  }
}

function convertShadowsocks(raw: string, bug: BugPreset) {
  try {
    const config = raw.trim();
    if (!config.startsWith("ss://")) return null;

    let body = config.slice(5);
    let remark = "";
    const hashPos = body.indexOf("#");
    if (hashPos !== -1) {
      remark = body.slice(hashPos);
      body = body.slice(0, hashPos);
    }

    let userinfo: string;
    let hostPort: string;
    if (body.includes("@")) {
      const atPos = body.lastIndexOf("@");
      userinfo = body.slice(0, atPos);
      hostPort = body.slice(atPos + 1);
    } else {
      const decoded = atob(body);
      if (!decoded.includes("@")) return null;
      const atPos = decoded.lastIndexOf("@");
      userinfo = decoded.slice(0, atPos);
      hostPort = decoded.slice(atPos + 1);
    }

    const [host, ...portParts] = hostPort.split(":");
    const portRest = portParts.join(":");
    const newHost = bug.mode === "wildcard" ? bug.bugDomain : bug.bugDomain;
    return `ss://${userinfo}@${newHost}:${portRest}${remark}`;
  } catch {
    return null;
  }
}

function convertSshOrText(raw: string, bug: BugPreset) {
  try {
    return raw.replace(/BUG/gi, bug.bugDomain);
  } catch {
    return raw;
  }
}

// Dalam payload DarkTunnel, [host] adalah placeholder runtime dan harus tetap utuh.
// Pada field lain (misalnya serverNameIndication), [host] berarti host SSH akun.
function replaceInjectPlaceholders(value: unknown, sshHost: string, key = ""): unknown {
  if (typeof value === "string") {
    return key === "payload" ? value : value.replace(/\[host\]/gi, sshHost);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceInjectPlaceholders(item, sshHost, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        replaceInjectPlaceholders(childValue, sshHost, childKey),
      ]),
    );
  }
  return value;
}

function buildAdvancedDarkTunnelSsh(
  ssh: { host: string; port: number; username: string; password: string },
  inject: Record<string, unknown>,
  name?: string,
) {
  const config = {
    type: "SSH",
    name: name || "SSH Injek",
    sshTunnelConfig: {
      sshConfig: ssh,
      injectConfig: replaceInjectPlaceholders(inject, ssh.host),
    },
  };

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `darktunnel://${btoa(binary)}`;
  } catch {
    return "";
  }
}

function formatExpiry(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) throw new Error("Clipboard tidak tersedia");
}

export default function ConfigConverter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const incomingPresetSlug = new URLSearchParams(search).get("preset") || new URLSearchParams(search).get("paket");
  const initializedFromQuery = useRef(false);
  const selectedPresetVersionRef = useRef<string | null>(null);

  const [easyPresetId, setEasyPresetId] = useState("");
  const [easyAccountId, setEasyAccountId] = useState("");
  const [easyActiveStep, setEasyActiveStep] = useState<1 | 2 | 3>(1);
  const [easyApp, setEasyApp] = useState<EasyApp | null>(null);
  const [easyResult, setEasyResult] = useState<DarkTunnelBuildResult | null>(null);
  const [showEasyResult, setShowEasyResult] = useState(false);
  const [showHttpModal, setShowHttpModal] = useState(false);
  const [isEasyCopied, setIsEasyCopied] = useState(false);
  const [copiedHttpField, setCopiedHttpField] = useState<string | null>(null);

  const [rawConfig, setRawConfig] = useState("");
  const [selectedBugId, setSelectedBugId] = useState("");
  const [result, setResult] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [sshHost, setSshHost] = useState("");
  const [sshPort, setSshPort] = useState("443");
  const [sshUsername, setSshUsername] = useState("");
  const [sshPassword, setSshPassword] = useState("");
  const [sshConfigName, setSshConfigName] = useState("");
  const [isSshConverting, setIsSshConverting] = useState(false);
  const [showAdvancedResult, setShowAdvancedResult] = useState(false);
  const [sshLink, setSshLink] = useState("");

  const { data: bugs = [], isLoading: bugsLoading } = useQuery<BugPreset[]>({
    queryKey: ["bug-presets"],
    queryFn: () => apiClient.get<BugPreset[]>("/api/bug-presets"),
  });

  const {
    data: easyPresets = [],
    isLoading: presetsLoading,
    isError: presetsError,
    error: presetsQueryError,
    refetch: refetchPresets,
    isFetching: presetsFetching,
  } = useQuery<EasyInjectPreset[]>({
    queryKey: ["easy-inject-presets"],
    queryFn: () => apiClient.get<EasyInjectPreset[]>("/api/easy-inject-presets"),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const {
    data: mySshAccounts = [],
    isLoading: accountsLoading,
    isError: accountsError,
    error: accountsQueryError,
    refetch: refetchAccounts,
    isFetching: accountsFetching,
  } = useQuery<DarkTunnelAccount[]>({
    queryKey: ["my-ssh-accounts"],
    queryFn: () => apiClient.get<DarkTunnelAccount[]>("/api/accounts"),
  });

  const requestedAccountId = Number(
    new URLSearchParams(search).get("account") ?? "0",
  );

  const selectedEasyPreset = useMemo(
    () =>
      presetsError
        ? null
        : easyPresets.find((preset) => String(preset.id) === easyPresetId) ?? null,
    [easyPresetId, easyPresets, presetsError],
  );
  const activeSshAccounts = useMemo(
    () => mySshAccounts.filter((account) => isActiveSshAccount(account)),
    [mySshAccounts],
  );
  const unknownAccounts = useMemo(
    () =>
      activeSshAccounts.filter(
        (account) => classifySshAccount(account) === "unknown",
      ),
    [activeSshAccounts],
  );
  const compatibleAccounts = useMemo(
    () =>
      selectedEasyPreset
        ? activeSshAccounts.filter((account) =>
            isAccountCompatibleWithPreset(account, selectedEasyPreset),
          )
        : [],
    [activeSshAccounts, selectedEasyPreset],
  );

  useEffect(() => {
    if (
      initializedFromQuery.current ||
      accountsLoading ||
      presetsLoading ||
      !requestedAccountId
    ) return;
    initializedFromQuery.current = true;

    const requested = activeSshAccounts.find(
      (account) => account.id === requestedAccountId,
    );
    if (!requested) return;

    const compatiblePresets = easyPresets.filter((preset) =>
      isAccountCompatibleWithPreset(requested, preset),
    );
    setEasyAccountId(String(requested.id));
    if (compatiblePresets.length === 1) {
      setEasyPresetId(String(compatiblePresets[0].id));
    }
  }, [
    accountsLoading,
    activeSshAccounts,
    easyPresets,
    presetsLoading,
    requestedAccountId,
  ]);

  useEffect(() => {
    if (!easyPresetId || presetsLoading || presetsError) return;
    if (!selectedEasyPreset) {
      setEasyPresetId("");
      setEasyAccountId("");
      resetEasyApplicationState();
      return;
    }
    if (compatibleAccounts.length === 1 && !easyAccountId) {
      setEasyAccountId(String(compatibleAccounts[0].id));
      return;
    }
    if (
      easyAccountId &&
      !compatibleAccounts.some(
        (account) => String(account.id) === easyAccountId,
      )
    ) {
      setEasyAccountId("");
      resetEasyApplicationState();
    }
  }, [compatibleAccounts, easyAccountId, easyPresetId, selectedEasyPreset]);

  useEffect(() => {
    if (!selectedEasyPreset) {
      selectedPresetVersionRef.current = null;
      return;
    }

    const signature = `${selectedEasyPreset.id}:${selectedEasyPreset.version}`;
    const previous = selectedPresetVersionRef.current;
    selectedPresetVersionRef.current = signature;

    const appIsSupported =
      !easyApp ||
      (easyApp === "darktunnel" && selectedEasyPreset.supportsDarkTunnel) ||
      (easyApp === "http-custom" && selectedEasyPreset.supportsHttpCustom);
    if (!appIsSupported || (previous !== null && previous !== signature)) {
      resetEasyApplicationState();
    }
  }, [easyApp, selectedEasyPreset]);

  useEffect(() => {
    if (presetsLoading || !incomingPresetSlug || easyPresetId) return;
    const found = easyPresets.find((p) => p.slug === incomingPresetSlug.toLowerCase());
    if (found) setEasyPresetId(String(found.id));
  }, [presetsLoading, easyPresets, incomingPresetSlug, easyPresetId]);

  const syncAccountMutation = useMutation({
    mutationFn: (accountId: number) =>
      apiClient.post(`/api/accounts/${accountId}/sync-provider`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-ssh-accounts"] });
      toast({
        title: "Data akun diperbarui",
        description: "Silakan pilih kembali paket dan akun yang sesuai.",
      });
    },
    onError: (error: Error) =>
      toast({
        title: "Gagal memperbarui akun",
        description: error.message,
        variant: "destructive",
      }),
  });

  function resetEasyApplicationState() {
    setEasyApp(null);
    setEasyResult(null);
    setShowEasyResult(false);
    setShowHttpModal(false);
    setIsEasyCopied(false);
    setCopiedHttpField(null);
  }

  function selectEasyPreset(presetId: string) {
    setEasyPresetId(presetId);
    const nextPreset = easyPresets.find((preset) => String(preset.id) === presetId);
    const currentAccount = activeSshAccounts.find(
      (account) => String(account.id) === easyAccountId,
    );
    if (!nextPreset || !currentAccount || !isAccountCompatibleWithPreset(currentAccount, nextPreset)) {
      setEasyAccountId("");
    }
    resetEasyApplicationState();
    if (presetId) {
      setEasyActiveStep(2);
    }
  }

  function selectEasyAccount(accountId: string) {
    setEasyAccountId(accountId);
    resetEasyApplicationState();
    if (accountId) {
      setEasyActiveStep(3);
    }
  }

  function selectEasyApp(app: EasyApp) {
    setEasyApp(app);
    setIsEasyCopied(false);
    setCopiedHttpField(null);

    if (app === "http-custom") {
      setShowHttpModal(true);
    } else if (app === "darktunnel") {
      if (selectedEasyPreset && easyAccountId) {
        const account = compatibleAccounts.find(
          (item) => String(item.id) === easyAccountId,
        );
        if (account) {
          try {
            const generated = buildDarkTunnelConfig({
              account,
              preset: selectedEasyPreset,
            });
            setEasyResult(generated);
            setShowEasyResult(true);
          } catch {
            setEasyResult(null);
          }
        }
      }
    }
  }

  function generateEasyConfig() {
    if (easyApp !== "darktunnel" || !selectedEasyPreset || !easyAccountId) {
      toast({
        title: "Pilih paket, akun, dan aplikasi",
        description: "Pilih preset aktif, akun SSH yang cocok, lalu DarkTunnel.",
        variant: "destructive",
      });
      return;
    }

    const account = compatibleAccounts.find(
      (item) => String(item.id) === easyAccountId,
    );
    if (!account) {
      toast({
        title: "Akun tidak kompatibel",
        description: "Pilih akun yang ditampilkan pada daftar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const generated = buildDarkTunnelConfig({
        account,
        preset: selectedEasyPreset,
      });
      setEasyResult(generated);
      setIsEasyCopied(false);
      setShowEasyResult(true);
    } catch (error) {
      toast({
        title: "Config gagal dibuat",
        description: error instanceof Error ? error.message : "Data akun tidak valid.",
        variant: "destructive",
      });
    }
  }

  function downloadEasyConfig() {
    if (!easyResult) return;
    const blob = new Blob([easyResult.link], {
      type: "application/octet-stream;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = easyResult.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast({
      title: "File .dark diunduh",
      description: "Buka file tersebut menggunakan aplikasi DarkTunnel.",
    });
  }

  async function copyEasyLink() {
    if (!easyResult) return;
    try {
      await writeClipboard(easyResult.link);
      setIsEasyCopied(true);
      toast({ title: "Link DarkTunnel tersalin" });
      window.setTimeout(() => setIsEasyCopied(false), 2000);
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Gunakan tombol Download File .dark sebagai gantinya.",
        variant: "destructive",
      });
    }
  }

  function openDarkTunnel() {
    if (!easyResult) return;
    window.location.assign(easyResult.link);
  }

  const handleConvert = () => {
    if (!rawConfig.trim() || !selectedBugId) {
      toast({
        title: "Data belum lengkap",
        description: "Masukkan config mentah dan pilih preset bug.",
        variant: "destructive",
      });
      return;
    }

    const bug = bugs.find((item) => item.id.toString() === selectedBugId);
    if (!bug) return;

    const lines = rawConfig.split("\n").map((line) => line.trim()).filter(Boolean);
    const convertedLines = lines.map((line) => {
      if (line.startsWith("vmess://")) return convertVmess(line, bug) || line;
      if (line.startsWith("vless://") || line.startsWith("trojan://")) {
        return convertVlessOrTrojan(line, bug) || line;
      }
      if (line.startsWith("ss://")) return convertShadowsocks(line, bug) || line;
      if (
        line.toLowerCase().includes("bug") ||
        line.toLowerCase().includes("ssh") ||
        line.includes("GET ") ||
        line.includes("Host:") ||
        line.includes("CONNECT ")
      ) {
        return convertSshOrText(line, bug) || line;
      }
      return line;
    });

    if (convertedLines.every((line, index) => line === lines[index])) {
      toast({
        title: "Gagal mengonversi",
        description: "Format config tidak dikenali.",
        variant: "destructive",
      });
      return;
    }

    setResult(convertedLines.join("\n"));
    setIsCopied(false);
    toast({ title: "Config berhasil dikonversi" });
  };

  const handleAdvancedSshConvert = () => {
    if (!sshHost.trim() || !sshUsername.trim() || !sshPassword.trim()) {
      toast({
        title: "Lengkapi data SSH",
        description: "Host, username, dan password wajib diisi.",
        variant: "destructive",
      });
      return;
    }
    const bug = bugs.find((item) => item.id.toString() === selectedBugId);
    if (!bug?.sshInjectConfig || Object.keys(bug.sshInjectConfig).length === 0) {
      toast({
        title: "Pilih preset yang valid",
        description: "Preset harus memiliki SSH Inject Config.",
        variant: "destructive",
      });
      return;
    }

    setIsSshConverting(true);
    const link = buildAdvancedDarkTunnelSsh(
      {
        host: sshHost.trim(),
        port: Number.parseInt(sshPort, 10) || 80,
        username: sshUsername.trim(),
        password: sshPassword,
      },
      bug.sshInjectConfig,
      sshConfigName.trim() || undefined,
    );
    setIsSshConverting(false);

    if (!link) {
      toast({ title: "Gagal membuat link", variant: "destructive" });
      return;
    }
    setSshLink(link);
    setIsCopied(false);
    setShowAdvancedResult(true);
  };

  async function copyValue(value: string, successMessage: string) {
    try {
      await writeClipboard(value);
      setIsCopied(true);
      toast({ title: successMessage });
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" });
    }
  }

  async function copyHttpField(
    id: string,
    value: string,
    label: string,
  ) {
    try {
      await writeClipboard(value);
      setCopiedHttpField(id);
      toast({
        title: `${label} tersalin`,
        description: "Tempel ke field yang sama di HTTP Custom.",
      });
      window.setTimeout(() => {
        setCopiedHttpField((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      toast({
        title: "Gagal menyalin",
        description: `Tekan lama nilai ${label}, lalu pilih Salin.`,
        variant: "destructive",
      });
    }
  }

  const selectedEasyAccount = compatibleAccounts.find(
    (account) => String(account.id) === easyAccountId,
  );
  const httpCustomGuide =
    easyApp === "http-custom" && selectedEasyPreset && selectedEasyAccount
      ? buildHttpCustomGuide({
          account: selectedEasyAccount,
          preset: selectedEasyPreset,
        })
      : null;

  return (
    <div className="mx-auto w-full max-w-4xl min-w-0 space-y-6 overflow-hidden px-1 sm:px-0 pb-8">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold break-words">Inject Paket Internet</h1>
        <p className="mt-1 text-sm text-muted-foreground break-words">
          Pilih trik aktif dari admin, lalu gunakan DarkTunnel otomatis atau panduan HTTP Custom.
        </p>
      </div>

      <PaketOnboardingGuide presets={easyPresets} onSelectPreset={selectEasyPreset} hasAccounts={activeSshAccounts.length > 0} />

        <Tabs defaultValue="easy" className="w-full min-w-0 space-y-5 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 min-w-0">
            <TabsTrigger value="easy" className="text-xs sm:text-sm min-w-0 truncate">Mode Mudah</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs sm:text-sm min-w-0 truncate">Mode Lanjutan</TabsTrigger>
          </TabsList>

          <TabsContent value="easy" className="w-full min-w-0 space-y-4 overflow-hidden">
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
                          onClick={() => void refetchPresets()}
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
                            onClick={() => selectEasyPreset(String(preset.id))}
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
                    onClick={() => setEasyActiveStep(1)}
                    className="h-7 px-2.5 text-xs text-muted-foreground hover:text-white shrink-0"
                  >
                    Ganti Paket
                  </Button>
                </div>
              </Card>
            )}

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
                          onClick={() => void refetchAccounts()}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${accountsFetching ? "animate-spin" : ""}`} />
                          Coba Lagi
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : compatibleAccounts.length > 0 ? (
                    <>
                      <Select value={easyAccountId} onValueChange={selectEasyAccount}>
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
                            onClick={() => setEasyActiveStep(3)}
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
                    onClick={() => setEasyActiveStep(2)}
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
                    onChange={selectEasyApp}
                  />

                  {easyApp === "http-custom" && httpCustomGuide && (
                    <div className="pt-2">
                      <Button
                        size="lg"
                        className="w-full gap-2 min-w-0 break-words whitespace-normal h-auto py-3 bg-cyan-500 hover:bg-cyan-600 text-black font-bold shadow-lg shadow-cyan-500/20"
                        onClick={() => setShowHttpModal(true)}
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
                        onClick={generateEasyConfig}
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
          </TabsContent>

        <TabsContent value="advanced" className="w-full min-w-0 space-y-6 overflow-hidden">
          <Alert className="min-w-0 overflow-hidden">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertTitle className="break-words text-sm">Untuk pengguna berpengalaman</AlertTitle>
            <AlertDescription className="break-words text-xs sm:text-sm">
              Gunakan mode ini hanya jika kamu perlu mengatur preset, host, port, atau config mentah secara manual.
            </AlertDescription>
          </Alert>

          <Card className="w-full min-w-0 relative overflow-hidden border-primary/20 bg-card/40 shadow-xl backdrop-blur-md">
            <CardHeader className="min-w-0 overflow-hidden p-4 sm:p-6">
              <CardTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg break-words">
                <ShieldPlus className="h-5 w-5 text-primary shrink-0" /> <span className="break-words">SSH Injek DarkTunnel</span>
              </CardTitle>
              <CardDescription className="break-words text-xs sm:text-sm">
                Pilih preset admin dan isi data SSH secara manual untuk membuat link DarkTunnel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="space-y-2 min-w-0">
                <Label className="break-words">Preset Injek</Label>
                <Select
                  value={selectedBugId}
                  disabled={isSshConverting}
                  onValueChange={(value) => {
                    setSelectedBugId(value);
                    const inject = bugs.find((bug) => String(bug.id) === value)?.sshInjectConfig;
                    if (inject?.proxyPort != null) setSshPort(String(inject.proxyPort));
                  }}
                >
                  <SelectTrigger className="min-w-0"><SelectValue placeholder="Pilih preset injek" /></SelectTrigger>
                  <SelectContent>
                    {bugs.filter((bug) => bug.sshInjectConfig && Object.keys(bug.sshInjectConfig).length > 0).map((bug) => (
                      <SelectItem key={bug.id} value={String(bug.id)}>{bug.name} ({bug.bugDomain})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-0">
                <Label className="break-words">Pilih Akun SSH Aktif</Label>
                <Select onValueChange={(value) => {
                  const account = activeSshAccounts.find((item) => String(item.id) === value);
                  if (!account) return;
                  const links = account.allLinks ?? {};
                  setSshHost(
                    links.cloudfront || links.domain || links.host || links.hostname || account.server?.originalHost || account.server?.host || "",
                  );
                  setSshUsername(account.username || "");
                  setSshPassword(account.password || "");
                }}>
                  <SelectTrigger className="min-w-0"><SelectValue placeholder={activeSshAccounts.length ? "Pilih akun SSH" : "Belum ada akun SSH aktif"} /></SelectTrigger>
                  <SelectContent>
                    {activeSshAccounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)} className="min-w-0">
                        <span className="break-all text-xs sm:text-sm">{account.username} @ {account.server?.name ?? "Server"} • {formatExpiry(account.expiresAt)}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 min-w-0"><Label className="break-words">SSH Host</Label><Input value={sshHost} onChange={(event) => setSshHost(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
                <div className="space-y-2 min-w-0"><Label>Port</Label><Input type="number" value={sshPort} onChange={(event) => setSshPort(event.target.value)} className="min-w-0" /></div>
                <div className="space-y-2 min-w-0"><Label>Username</Label><Input value={sshUsername} onChange={(event) => setSshUsername(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
                <div className="space-y-2 min-w-0"><Label>Password</Label><Input type="password" value={sshPassword} onChange={(event) => setSshPassword(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
              </div>
              <div className="space-y-2 min-w-0"><Label>Nama Config (opsional)</Label><Input value={sshConfigName} onChange={(event) => setSshConfigName(event.target.value)} className="min-w-0" /></div>
            </CardContent>
            <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4 min-w-0">
              <Button onClick={handleAdvancedSshConvert} disabled={isSshConverting} className="w-full gap-2 min-w-0">
                {isSshConverting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <ArrowRightLeft className="h-4 w-4 shrink-0" />}
                <span className="break-words">Buat Link DarkTunnel</span>
              </Button>
            </CardFooter>
          </Card>

          <Card className="w-full min-w-0 border-primary/20 bg-card/40 overflow-hidden">
            <CardHeader className="min-w-0 overflow-hidden p-4 sm:p-6">
              <CardTitle className="break-words text-base sm:text-lg">Config Injector Umum</CardTitle>
              <CardDescription className="break-words text-xs sm:text-sm">Untuk VMess, VLESS, Trojan, Shadowsocks, atau payload mentah.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="space-y-2 min-w-0">
                <Label className="break-words">1. Pilih Preset Bug</Label>
                <Select value={selectedBugId} onValueChange={setSelectedBugId}>
                  <SelectTrigger className="min-w-0"><SelectValue placeholder={bugsLoading ? "Memuat preset..." : "Pilih preset bug"} /></SelectTrigger>
                  <SelectContent>
                    {bugs.map((bug) => <SelectItem key={bug.id} value={String(bug.id)}>{bug.name} ({bug.bugDomain})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-0">
                <Label className="break-words">2. Config Mentah</Label>
                <Textarea className="min-h-[120px] font-mono text-xs sm:text-sm min-w-0 w-full" value={rawConfig} onChange={(event) => setRawConfig(event.target.value)} placeholder="Tempel vmess://, vless://, trojan://, ss://, atau payload di sini" />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4 min-w-0">
              <Button onClick={handleConvert} className="w-full gap-2 min-w-0"><ArrowRightLeft className="h-4 w-4 shrink-0" /> <span className="break-words">Convert Sekarang</span></Button>
            </CardFooter>
          </Card>

          {result && (
            <Card className="w-full min-w-0 border-emerald-500/30 bg-emerald-950/10 overflow-hidden">
              <CardHeader className="min-w-0 p-4 sm:p-6"><CardTitle className="text-emerald-400 break-words text-base">Hasil Convert</CardTitle></CardHeader>
              <CardContent className="min-w-0 overflow-hidden p-4 sm:p-6 pt-0">
                <Textarea readOnly value={result} className="min-h-[120px] font-mono text-xs sm:text-sm w-full min-w-0 break-all" />
                <Button onClick={() => copyValue(result, "Config tersalin")} className="mt-3 w-full gap-2 min-w-0">
                  {isCopied ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />} <span className="break-words">Salin Config</span>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Panduan HTTP Custom (Smart Interactive Wizard) */}
      <Dialog open={showHttpModal} onOpenChange={setShowHttpModal}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-2 sm:p-6 glass-panel border-cyan-500/30">
          {httpCustomGuide ? (
            <HttpCustomGuideCard
              guide={httpCustomGuide}
              copiedField={copiedHttpField}
              onCopy={copyHttpField}
            />
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Pilih paket dan akun terlebih dahulu untuk melihat panduan.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Hasil Config DarkTunnel */}
      <Dialog open={showEasyResult} onOpenChange={setShowEasyResult}>
        <DialogContent className="sm:max-w-lg glass-panel border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="text-emerald-400 flex items-center gap-2">
              <ShieldPlus className="h-5 w-5" /> Config DarkTunnel Siap
            </DialogTitle>
            <DialogDescription>
              Unduh file .dark lalu buka atau import di aplikasi DarkTunnel.
            </DialogDescription>
          </DialogHeader>
          {easyResult && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm space-y-1">
                <div className="font-semibold text-white">{easyResult.config.name}</div>
                <div className="text-xs text-muted-foreground font-mono">File: {easyResult.filename}</div>
              </div>

              <div className="grid gap-2">
                <Button size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold shadow-lg shadow-emerald-500/20" onClick={downloadEasyConfig}>
                  <Download className="h-4 w-4" /> Download File .dark
                </Button>
                <Button variant="outline" className="gap-2" onClick={openDarkTunnel}>
                  <ExternalLink className="h-4 w-4" /> Buka di DarkTunnel
                </Button>
                <Button variant="outline" className="gap-2" onClick={copyEasyLink}>
                  {isEasyCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {isEasyCopied ? "Link Tersalin" : "Salin Link Config"}
                </Button>
              </div>

              <div className="rounded-xl border border-white/5 bg-background/30 p-3 space-y-2 text-xs">
                <p className="font-semibold text-white">3 Langkah Cepat Pakai:</p>
                <div className="space-y-1 text-muted-foreground">
                  <p>1. Ketuk tombol <strong>Download File .dark</strong> di atas.</p>
                  <p>2. Buka aplikasi DarkTunnel, pilih <strong>Import Config</strong> lalu pilih file yang diunduh.</p>
                  <p>3. Ketuk tombol <strong>Connect</strong> di DarkTunnel.</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEasyResult(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdvancedResult} onOpenChange={setShowAdvancedResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Link DarkTunnel Berhasil Dibuat</DialogTitle>
            <DialogDescription>Salin link lalu import ke DarkTunnel.</DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={sshLink} className="min-h-[100px] font-mono text-xs" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAdvancedResult(false)}>Tutup</Button>
            <Button onClick={() => copyValue(sshLink, "Link DarkTunnel tersalin")} className="gap-2">
              <Copy className="h-4 w-4" /> Salin Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { apiClient } from "@/lib/api-client";
import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { HttpCustomGuide } from "@/lib/darktunnel";
import { CopyableGuideField } from "./shared-components";
import { parseBoldText } from "./converter-utils";

export type HttpCustomGuideCardProps = {
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

export function HttpCustomGuideCard({
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
          {parseBoldText(rawStep.description)}
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
              Tunggu 3-5 detik sampai status di aplikasi menampilkan pesan <strong>&ldquo;Selamat berselancar&rdquo;</strong> dan muncul ikon kunci VPN di status bar HP kamu.
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

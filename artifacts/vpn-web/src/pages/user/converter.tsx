import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldPlus,
  Smartphone,
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
import {
  checkGeneratorApiStatus,
  generateHcConfig,
  generateDarkConfig,
  downloadBase64File,
  downloadTextFile,
  type HcGenerateResponse,
  type DarkGenerateResponse,
  type GeneratorApiStatus,
} from "@/lib/config-generator";

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
    <div className="grid gap-3 sm:grid-cols-2">
      {applications.map((application) => {
        const Icon = application.icon;
        const active = value === application.id;
        return (
          <button
            key={application.id}
            type="button"
            onClick={() => onChange(application.id)}
            className={`min-h-[128px] rounded-2xl border p-5 text-left transition-all ${
              active
                ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                : "border-white/10 bg-background/40 hover:border-primary/40"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <Icon className={`h-8 w-8 ${application.iconClass}`} />
              {application.id === "http-custom" && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                  Beta
                </Badge>
              )}
            </div>
            <div className="mt-3 text-lg font-bold">{application.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">
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
    <div className={`min-w-0 space-y-2 ${multiline ? "sm:col-span-2" : ""}`}>
      <div>
        <Label>{label}</Label>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className={`flex min-w-0 gap-2 ${multiline ? "items-start" : "items-center"}`}>
        <pre
          className={`min-w-0 flex-1 select-all whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-relaxed ${
            multiline ? "min-h-[112px]" : ""
          }`}
        >
          {value}
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 gap-2 px-3"
          aria-label={`Salin ${label}`}
          onClick={() => onCopy(id, value, label)}
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Tersalin" : "Salin"}</span>
        </Button>
      </div>
    </div>
  );
}

type HttpCustomGuideCardProps = {
  guide: HttpCustomGuide;
  copiedField: string | null;
  onCopy: (id: string, value: string, label: string) => void;
  generatorApiAvailable?: boolean;
  onGenerateHc?: () => void;
  isGeneratingHc?: boolean;
};

function HttpCustomGuideCard({
  guide,
  copiedField,
  onCopy,
  generatorApiAvailable,
  onGenerateHc,
  isGeneratingHc,
}: HttpCustomGuideCardProps) {
  const steps = [
    "Pilih mode SSH di HTTP Custom, lalu tempel SSH Login.",
    "Ketuk ikon tiga garis (☰) di kiri atas, lalu pilih menu Payload.",
    guide.usePayload
      ? "Di kolom Payload, tempel Payload. Di kolom tepat di bawahnya, tempel Remote Proxy, lalu pilih Apply."
      : "Biarkan kolom Payload kosong. Tempel Remote Proxy pada kolom yang tersedia, lalu pilih Apply.",
    guide.usePayload
      ? "Aktifkan Use Payload."
      : "Biarkan Use Payload nonaktif sesuai pengaturan preset.",
    guide.ssl
      ? "Ketuk ikon tiga garis (☰) lagi, pilih menu SNI yang berada di bawah Payload, tempel Server Name Indication, lalu aktifkan SSL."
      : "Biarkan SSL mati dan SNI kosong sesuai pengaturan preset.",
    "Tekan CONNECT. Jika gagal, buka tab LOG dan kirim screenshot error ke admin.",
  ];

  return (
    <Card className="glass-panel overflow-hidden border-cyan-500/25">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-cyan-300" />
            4. Panduan HTTP Custom
          </CardTitle>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            Beta
          </Badge>
        </div>
        <CardDescription>
          Salin nilai satu per satu ke field yang sama di HTTP Custom. Posisi menu dapat sedikit berbeda menurut versi aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {onGenerateHc && (
          <div className="space-y-3">
            {generatorApiAvailable ? (
              <>
                <Alert className="border-emerald-500/25 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <AlertTitle className="text-emerald-300">File HC Otomatis Tersedia</AlertTitle>
                  <AlertDescription>
                    Admin sudah mengaktifkan fitur pembuatan file .hc otomatis. Klik tombol di bawah untuk langsung mendownload file config yang siap import.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full gap-2"
                  onClick={onGenerateHc}
                  disabled={isGeneratingHc}
                >
                  {isGeneratingHc ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Membuat file HC...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Buat File HC Otomatis
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Alert variant="default" className="border-amber-500/30 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-300" />
                <AlertTitle className="text-amber-200">File HC Otomatis Belum Aktif</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    Fitur auto .hc butuh konfigurasi Generator API di server. Salin manual dulu pakai panduan di bawah.
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Admin: set GENERATOR_API_BASE_URL, GENERATOR_API_KEY, GENERATOR_API_HC_TEMPLATE di .env lalu pm2 restart
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Belum berupa file import</AlertTitle>
          <AlertDescription>
            Panduan ini menyiapkan data dari akunmu. Jangan ubah teks [host], [ua], atau [crlf] di dalam payload.
          </AlertDescription>
        </Alert>

        <Button variant="outline" className="w-full gap-2" asChild>
          <a
            href="https://play.google.com/store/apps/details?id=xyz.easypro.httpcustom"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" /> Install / Buka HTTP Custom
          </a>
        </Button>

        <div className="flex flex-wrap gap-2">
          <Badge className={guide.usePayload ? "bg-emerald-600" : "bg-slate-600"}>
            Use Payload: {guide.usePayload ? "ON" : "OFF"}
          </Badge>
          <Badge className={guide.ssl ? "bg-emerald-600" : "bg-slate-600"}>
            SSL: {guide.ssl ? "ON" : "OFF"}
          </Badge>
          <Badge variant="outline">Mode: {guide.mode}</Badge>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">A. Data utama</h3>
            <p className="text-xs text-muted-foreground">
              Tampilan standar HTTP Custom memakai format ip:port@user:pass.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CopyableGuideField
              id="ssh-login"
              label="SSH Login"
              value={guide.ssh.login}
              hint="Tempel ke field ip:port@user:pass"
              multiline
              copied={copiedField === "ssh-login"}
              onCopy={onCopy}
            />
            {guide.usePayload && (
              <CopyableGuideField
                id="payload"
                label="Payload"
                value={guide.payload}
                hint="☰ kiri atas → Payload → kolom Payload. Tempel persis; jangan ganti placeholder."
                multiline
                copied={copiedField === "payload"}
                onCopy={onCopy}
              />
            )}
            <CopyableGuideField
              id="remote-proxy"
              label="Remote Proxy"
              value={guide.proxy.address}
              hint="Di menu Payload, tempel pada kolom Remote Proxy tepat di bawah kolom Payload."
              copied={copiedField === "remote-proxy"}
              onCopy={onCopy}
            />
            {guide.sni && (
              <CopyableGuideField
                id="sni"
                label="SNI / Server Name Indication"
                value={guide.sni}
                hint="☰ kiri atas → SNI (di bawah menu Payload); tempel lalu aktifkan SSL."
                copied={copiedField === "sni"}
                onCopy={onCopy}
              />
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-background/30 p-4">
          <h3 className="font-semibold">B. Langkah di aplikasi</h3>
          <ol className="space-y-3 text-sm">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">C. Jika versi aplikasi meminta field terpisah</h3>
            <p className="text-xs text-muted-foreground">
              Gunakan data berikut, bukan SSH Login gabungan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["ssh-host", "SSH Host", guide.ssh.host],
              ["ssh-port", "SSH Port", String(guide.ssh.port)],
              ["ssh-username", "Username", guide.ssh.username],
              ["ssh-password", "Password", guide.ssh.password],
            ].map(([id, label, value]) => (
              <CopyableGuideField
                key={id}
                id={id}
                label={label}
                value={value}
                copied={copiedField === id}
                onCopy={onCopy}
              />
            ))}
          </div>
        </section>
      </CardContent>
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
    let newHostValue = host;
    if (bug.mode === "wildcard" || bug.mode === "host") {
      newHostValue = bug.bugDomain;
    }
    return `ss://${userinfo}@${newHostValue}:${portRest}${remark}`;
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
  const initializedFromQuery = useRef(false);
  const selectedPresetVersionRef = useRef<string | null>(null);

  const [easyPresetId, setEasyPresetId] = useState("");
  const [easyAccountId, setEasyAccountId] = useState("");
  const [easyApp, setEasyApp] = useState<EasyApp | null>(null);
  const [easyResult, setEasyResult] = useState<DarkTunnelBuildResult | null>(null);
  const [showEasyResult, setShowEasyResult] = useState(false);
  const [isEasyCopied, setIsEasyCopied] = useState(false);
  const [copiedHttpField, setCopiedHttpField] = useState<string | null>(null);
  
  const [hcResult, setHcResult] = useState<HcGenerateResponse["data"] | null>(null);
  const [showHcResult, setShowHcResult] = useState(false);
  const [isHcGenerating, setIsHcGenerating] = useState(false);

  const [darkApiResult, setDarkApiResult] = useState<DarkGenerateResponse["data"] | null>(null);
  const [showDarkApiResult, setShowDarkApiResult] = useState(false);
  const [isDarkGenerating, setIsDarkGenerating] = useState(false);

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

  const { data: generatorApiStatus } = useQuery<GeneratorApiStatus>({
    queryKey: ["generator-api-status"],
    queryFn: checkGeneratorApiStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
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
    setIsEasyCopied(false);
    setCopiedHttpField(null);
    setDarkApiResult(null);
    setShowDarkApiResult(false);
    setIsDarkGenerating(false);
    setHcResult(null);
    setShowHcResult(false);
    setIsHcGenerating(false);
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
  }

  function selectEasyAccount(accountId: string) {
    setEasyAccountId(accountId);
    resetEasyApplicationState();
  }

  function selectEasyApp(app: EasyApp) {
    setEasyApp(app);
    setEasyResult(null);
    setShowEasyResult(false);
    setIsEasyCopied(false);
    setCopiedHttpField(null);
    setDarkApiResult(null);
    setShowDarkApiResult(false);
    setHcResult(null);
    setShowHcResult(false);
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

  async function generateHcConfigViaApi() {
    if (!selectedEasyPreset || !easyAccountId) {
      toast({
        title: "Pilih paket dan akun",
        description: "Pilih preset aktif dan akun SSH yang cocok.",
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

    if (!generatorApiStatus?.configured || !generatorApiStatus?.available) {
      toast({
        title: "Generator API tidak tersedia",
        description: "Admin belum mengkonfigurasi Generator API untuk pembuatan file HC otomatis.",
        variant: "destructive",
      });
      return;
    }

    setIsHcGenerating(true);
    try {
      const response = await generateHcConfig({
        presetId: selectedEasyPreset.id,
        accountId: account.id,
        name: `${selectedEasyPreset.name} - ${account.username}`,
      });

      setHcResult(response.data);
      setShowHcResult(true);
      toast({
        title: "Config HC berhasil dibuat",
        description: "File .hc siap diunduh dan diimport ke HTTP Custom.",
      });
    } catch (error) {
      toast({
        title: "Gagal membuat config HC",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat config.",
        variant: "destructive",
      });
    } finally {
      setIsHcGenerating(false);
    }
  }

  function downloadHcConfig() {
    if (!hcResult) return;
    try {
      downloadBase64File(hcResult.contentBase64, hcResult.filename);
      toast({
        title: "File .hc diunduh",
        description: "Import file tersebut ke aplikasi HTTP Custom.",
      });
    } catch (error) {
      toast({
        title: "Gagal download",
        description: error instanceof Error ? error.message : "Format file tidak valid",
        variant: "destructive",
      });
    }
  }

  async function copyHcContent() {
    if (!hcResult) return;
    try {
      await writeClipboard(hcResult.content);
      toast({ title: "Config HC tersalin" });
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Gunakan tombol Download File .hc sebagai gantinya.",
        variant: "destructive",
      });
    }
  }

  async function generateDarkConfigViaApi() {
    if (!selectedEasyPreset || !easyAccountId) {
      toast({
        title: "Pilih paket dan akun",
        description: "Pilih preset aktif dan akun SSH yang cocok.",
        variant: "destructive",
      });
      return;
    }

    const account = compatibleAccounts.find((item) => String(item.id) === easyAccountId);
    if (!account) {
      toast({
        title: "Akun tidak kompatibel",
        description: "Pilih akun yang ditampilkan pada daftar.",
        variant: "destructive",
      });
      return;
    }

    if (!generatorApiStatus?.configured || !generatorApiStatus?.available) {
      toast({
        title: "Generator API tidak tersedia",
        description: "Admin belum mengkonfigurasi Generator API untuk file .dark terkunci.",
        variant: "destructive",
      });
      return;
    }

    setIsDarkGenerating(true);
    try {
      const response = await generateDarkConfig({
        presetId: selectedEasyPreset.id,
        accountId: account.id,
        name: `${selectedEasyPreset.name} - ${account.username}`,
      });
      setDarkApiResult(response.data);
      setShowDarkApiResult(true);
      toast({
        title: "Config .dark terkunci berhasil dibuat",
        description: "File .dark siap diunduh dan diimport ke Dark Tunnel.",
      });
    } catch (error) {
      toast({
        title: "Gagal membuat config .dark terkunci",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat membuat config.",
        variant: "destructive",
      });
    } finally {
      setIsDarkGenerating(false);
    }
  }

  function downloadDarkApiFile() {
    if (!darkApiResult) return;
    try {
      downloadTextFile(darkApiResult.link, darkApiResult.filename);
      toast({
        title: "File .dark terkunci diunduh",
        description: "Import file tersebut ke aplikasi Dark Tunnel.",
      });
    } catch (error) {
      toast({
        title: "Gagal download",
        description: error instanceof Error ? error.message : "Gagal membuat file",
        variant: "destructive",
      });
    }
  }

  async function copyDarkApiLink() {
    if (!darkApiResult) return;
    try {
      await writeClipboard(darkApiResult.link);
      toast({ title: "Link .dark terkunci tersalin" });
    } catch {
      toast({
        title: "Gagal menyalin",
        description: "Gunakan tombol Download sebagai gantinya.",
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inject Paket Internet</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih trik aktif dari admin, lalu gunakan DarkTunnel otomatis atau panduan HTTP Custom.
        </p>
      </div>

      <Tabs defaultValue="easy" className="space-y-5">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="easy">Mode Mudah</TabsTrigger>
          <TabsTrigger value="advanced">Mode Lanjutan</TabsTrigger>
        </TabsList>

        <TabsContent value="easy" className="space-y-5">
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
                        onClick={() => selectEasyPreset(String(preset.id))}
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
                  onChange={selectEasyApp}
                />
              </CardContent>
            </Card>
          )}

          {easyApp === "darktunnel" && selectedEasyAccount && (
            <Card className="glass-panel overflow-hidden border-emerald-500/25">
              <CardHeader>
                <CardTitle>4. Buat Config DarkTunnel</CardTitle>
                <CardDescription>
                  Pilih metode: file unlocked dibuat lokal, atau file terkunci via Generator API jika tersedia.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={generateEasyConfig}
                >
                  <ShieldPlus className="h-4 w-4" />
                  Buat Config DarkTunnel (Unlocked Lokal)
                </Button>

                {generatorApiStatus?.configured && generatorApiStatus?.available ? (
                  <div className="space-y-3">
                    <Alert className="border-emerald-500/25 bg-emerald-500/5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <AlertTitle className="text-emerald-300">File .dark Terkunci Tersedia</AlertTitle>
                      <AlertDescription>
                        Admin mengaktifkan pembuatan file .dark terkunci via Generator API. File locked lebih aman dan terenkripsi.
                      </AlertDescription>
                    </Alert>
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 border-emerald-500/30"
                      onClick={generateDarkConfigViaApi}
                      disabled={isDarkGenerating}
                    >
                      {isDarkGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Membuat file .dark terkunci...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Buat File .dark Terkunci Otomatis
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Alert className="border-amber-500/20 bg-amber-500/5">
                    <AlertCircle className="h-4 w-4 text-amber-300" />
                    <AlertTitle className="text-amber-200 text-sm">File .dark Terkunci Belum Aktif</AlertTitle>
                    <AlertDescription className="text-xs">
                      {generatorApiStatus?.message ?? "Butuh GENERATOR_API_* di .env dan service 6969 jalan. Sementara pakai unlocked lokal di atas."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {httpCustomGuide && (
            <HttpCustomGuideCard
              guide={httpCustomGuide}
              copiedField={copiedHttpField}
              onCopy={copyHttpField}
              generatorApiAvailable={generatorApiStatus?.configured && generatorApiStatus?.available}
              onGenerateHc={generateHcConfigViaApi}
              isGeneratingHc={isHcGenerating}
            />
          )}

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
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Untuk pengguna berpengalaman</AlertTitle>
            <AlertDescription>
              Gunakan mode ini hanya jika kamu perlu mengatur preset, host, port, atau config mentah secara manual.
            </AlertDescription>
          </Alert>

          <Card className="relative overflow-hidden border-primary/20 bg-card/40 shadow-xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldPlus className="h-5 w-5 text-primary" /> SSH Injek DarkTunnel
              </CardTitle>
              <CardDescription>
                Pilih preset admin dan isi data SSH secara manual untuk membuat link DarkTunnel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Preset Injek</Label>
                <Select
                  value={selectedBugId}
                  disabled={isSshConverting}
                  onValueChange={(value) => {
                    setSelectedBugId(value);
                    const inject = bugs.find((bug) => String(bug.id) === value)?.sshInjectConfig;
                    if (inject?.proxyPort != null) setSshPort(String(inject.proxyPort));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Pilih preset injek" /></SelectTrigger>
                  <SelectContent>
                    {bugs.filter((bug) => bug.sshInjectConfig && Object.keys(bug.sshInjectConfig).length > 0).map((bug) => (
                      <SelectItem key={bug.id} value={String(bug.id)}>{bug.name} ({bug.bugDomain})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pilih Akun SSH Aktif</Label>
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
                  <SelectTrigger><SelectValue placeholder={activeSshAccounts.length ? "Pilih akun SSH" : "Belum ada akun SSH aktif"} /></SelectTrigger>
                  <SelectContent>
                    {activeSshAccounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.username} @ {account.server?.name ?? "Server"} • {formatExpiry(account.expiresAt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>SSH Host</Label><Input value={sshHost} onChange={(event) => setSshHost(event.target.value)} className="font-mono" /></div>
                <div className="space-y-2"><Label>Port</Label><Input type="number" value={sshPort} onChange={(event) => setSshPort(event.target.value)} /></div>
                <div className="space-y-2"><Label>Username</Label><Input value={sshUsername} onChange={(event) => setSshUsername(event.target.value)} className="font-mono" /></div>
                <div className="space-y-2"><Label>Password</Label><Input type="password" value={sshPassword} onChange={(event) => setSshPassword(event.target.value)} className="font-mono" /></div>
              </div>
              <div className="space-y-2"><Label>Nama Config (opsional)</Label><Input value={sshConfigName} onChange={(event) => setSshConfigName(event.target.value)} /></div>
            </CardContent>
            <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4">
              <Button onClick={handleAdvancedSshConvert} disabled={isSshConverting} className="w-full gap-2 sm:w-auto">
                {isSshConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                Buat Link DarkTunnel
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-primary/20 bg-card/40">
            <CardHeader>
              <CardTitle>Config Injector Umum</CardTitle>
              <CardDescription>Untuk VMess, VLESS, Trojan, Shadowsocks, atau payload mentah.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>1. Pilih Preset Bug</Label>
                <Select value={selectedBugId} onValueChange={setSelectedBugId}>
                  <SelectTrigger><SelectValue placeholder={bugsLoading ? "Memuat preset..." : "Pilih preset bug"} /></SelectTrigger>
                  <SelectContent>
                    {bugs.map((bug) => <SelectItem key={bug.id} value={String(bug.id)}>{bug.name} ({bug.bugDomain})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>2. Config Mentah</Label>
                <Textarea className="min-h-[120px] font-mono" value={rawConfig} onChange={(event) => setRawConfig(event.target.value)} placeholder="Tempel vmess://, vless://, trojan://, ss://, atau payload di sini" />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4">
              <Button onClick={handleConvert} className="w-full gap-2 sm:w-auto"><ArrowRightLeft className="h-4 w-4" /> Convert Sekarang</Button>
            </CardFooter>
          </Card>

          {result && (
            <Card className="border-emerald-500/30 bg-emerald-950/10">
              <CardHeader><CardTitle className="text-emerald-400">Hasil Convert</CardTitle></CardHeader>
              <CardContent>
                <Textarea readOnly value={result} className="min-h-[120px] font-mono" />
                <Button onClick={() => copyValue(result, "Config tersalin")} className="mt-3 w-full gap-2">
                  {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Salin Config
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showEasyResult} onOpenChange={setShowEasyResult}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Config DarkTunnel Siap</DialogTitle>
            <DialogDescription>
              Download file adalah cara paling mudah. Jika tidak terbuka otomatis, import file dari aplikasi DarkTunnel.
            </DialogDescription>
          </DialogHeader>
          {easyResult && (
            <>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                <div className="font-semibold">{easyResult.config.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">File: {easyResult.filename}</div>
              </div>
              <div className="grid gap-2">
                <Button size="lg" className="gap-2" onClick={downloadEasyConfig}>
                  <Download className="h-4 w-4" /> Download File .dark
                </Button>
                <Button variant="outline" className="gap-2" onClick={openDarkTunnel}>
                  <ExternalLink className="h-4 w-4" /> Buka di DarkTunnel
                </Button>
                <Button variant="outline" className="gap-2" onClick={copyEasyLink}>
                  {isEasyCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {isEasyCopied ? "Link Tersalin" : "Salin Link"}
                </Button>
              </div>
            </>
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

      <Dialog open={showHcResult} onOpenChange={setShowHcResult}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-cyan-400">Config HTTP Custom Siap</DialogTitle>
            <DialogDescription>
              Download file .hc dan import ke aplikasi HTTP Custom.
            </DialogDescription>
          </DialogHeader>
          {hcResult && (
            <>
              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm">
                <div className="font-semibold">{hcResult.filename}</div>
                <div className="mt-1 text-xs text-muted-foreground">Method: {hcResult.method.toUpperCase()}</div>
              </div>
              <div className="grid gap-2">
                <Button size="lg" className="gap-2" onClick={downloadHcConfig}>
                  <Download className="h-4 w-4" /> Download File .hc
                </Button>
                <Button variant="outline" className="gap-2" onClick={copyHcContent}>
                  <Copy className="h-4 w-4" /> Salin Config
                </Button>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHcResult(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDarkApiResult} onOpenChange={setShowDarkApiResult}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">Config DarkTunnel Terkunci Siap</DialogTitle>
            <DialogDescription>
              File .dark terkunci terenkripsi via Generator API. Download dan import ke Dark Tunnel.
            </DialogDescription>
          </DialogHeader>
          {darkApiResult && (
            <>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                <div className="font-semibold">{darkApiResult.filename}</div>
                <div className="mt-1 text-xs text-muted-foreground">Method: {darkApiResult.method.toUpperCase()} - Locked</div>
              </div>
              <div className="grid gap-2">
                <Button size="lg" className="gap-2" onClick={downloadDarkApiFile}>
                  <Download className="h-4 w-4" /> Download File .dark Terkunci
                </Button>
                <Button variant="outline" className="gap-2" onClick={copyDarkApiLink}>
                  <Copy className="h-4 w-4" /> Salin Link
                </Button>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDarkApiResult(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

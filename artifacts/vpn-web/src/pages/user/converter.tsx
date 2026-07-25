import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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

import type { BugPreset, EasyApp } from "./converter/types";
import {
  apiFetch,
  writeClipboard,
  convertVmess,
  convertVlessOrTrojan,
  convertShadowsocks,
  convertSshOrText,
  buildAdvancedDarkTunnelSsh,
} from "./converter/utils";
import { EasyModeTab } from "./converter/easy-mode-tab";
import { AdvancedModeTab } from "./converter/advanced-mode-tab";
import { EasyResultDialog, SshResultDialog } from "./converter/result-dialogs";

export default function ConfigConverter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const initializedFromQuery = useRef(false);
  const selectedPresetVersionRef = useRef<string | null>(null);

  // ── Easy Mode State ──
  const [easyPresetId, setEasyPresetId] = useState("");
  const [easyAccountId, setEasyAccountId] = useState("");
  const [easyApp, setEasyApp] = useState<EasyApp | null>(null);
  const [easyResult, setEasyResult] = useState<DarkTunnelBuildResult | null>(null);
  const [showEasyResult, setShowEasyResult] = useState(false);
  const [isEasyCopied, setIsEasyCopied] = useState(false);
  const [copiedHttpField, setCopiedHttpField] = useState<string | null>(null);

  // ── Advanced Mode State ──
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

  // ── Queries ──
  const { data: bugs = [], isLoading: bugsLoading } = useQuery<BugPreset[]>({
    queryKey: ["bug-presets"],
    queryFn: () => apiFetch("/bug-presets"),
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
    queryFn: () => apiFetch("/easy-inject-presets"),
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
    queryFn: () => apiFetch("/accounts"),
  });

  const requestedAccountId = Number(
    new URLSearchParams(search).get("account") ?? "0",
  );

  // ── Derived State ──
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

  // ── Effects ──
  useEffect(() => {
    if (
      initializedFromQuery.current ||
      accountsLoading ||
      presetsLoading ||
      !requestedAccountId
    )
      return;
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

  // ── Mutations ──
  const syncAccountMutation = useMutation({
    mutationFn: (accountId: number) =>
      apiFetch(`/accounts/${accountId}/sync-provider`, { method: "POST" }),
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

  // ── Handlers ──
  function resetEasyApplicationState() {
    setEasyApp(null);
    setEasyResult(null);
    setShowEasyResult(false);
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

  const handleSelectSshAccount = (value: string) => {
    const account = activeSshAccounts.find((item) => String(item.id) === value);
    if (!account) return;
    const links = account.allLinks ?? {};
    setSshHost(
      links.cloudfront || links.domain || links.host || links.hostname || account.server?.originalHost || account.server?.host || "",
    );
    setSshUsername(account.username || "");
    setSshPassword(account.password || "");
  };

  const handleSelectBug = (value: string) => {
    setSelectedBugId(value);
    const inject = bugs.find((bug) => String(bug.id) === value)?.sshInjectConfig;
    if (inject?.proxyPort != null) setSshPort(String(inject.proxyPort));
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

  // ── Derived for render ──
  const selectedEasyAccount = compatibleAccounts.find(
    (account) => String(account.id) === easyAccountId,
  );
  const httpCustomGuide: HttpCustomGuide | null =
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

        <TabsContent value="easy">
          <EasyModeTab
            easyPresets={easyPresets}
            presetsLoading={presetsLoading}
            presetsError={presetsError}
            presetsQueryError={presetsQueryError}
            presetsFetching={presetsFetching}
            refetchPresets={refetchPresets}
            easyPresetId={easyPresetId}
            easyAccountId={easyAccountId}
            easyApp={easyApp}
            selectedEasyPreset={selectedEasyPreset}
            selectedEasyAccount={selectedEasyAccount}
            compatibleAccounts={compatibleAccounts}
            unknownAccounts={unknownAccounts}
            httpCustomGuide={httpCustomGuide}
            accountsLoading={accountsLoading}
            accountsError={accountsError}
            accountsQueryError={accountsQueryError}
            accountsFetching={accountsFetching}
            refetchAccounts={refetchAccounts}
            syncAccountMutation={syncAccountMutation}
            onSelectPreset={selectEasyPreset}
            onSelectAccount={selectEasyAccount}
            onSelectApp={selectEasyApp}
            onGenerateConfig={generateEasyConfig}
            onCopy={copyHttpField}
            copiedField={copiedHttpField}
          />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedModeTab
            bugs={bugs}
            bugsLoading={bugsLoading}
            selectedBugId={selectedBugId}
            onSelectBug={handleSelectBug}
            activeSshAccounts={activeSshAccounts}
            sshHost={sshHost}
            sshPort={sshPort}
            sshUsername={sshUsername}
            sshPassword={sshPassword}
            sshConfigName={sshConfigName}
            isSshConverting={isSshConverting}
            onSetSshHost={setSshHost}
            onSetSshPort={setSshPort}
            onSetSshUsername={setSshUsername}
            onSetSshPassword={setSshPassword}
            onSetSshConfigName={setSshConfigName}
            onSelectSshAccount={handleSelectSshAccount}
            rawConfig={rawConfig}
            onSetRawConfig={setRawConfig}
            onConvert={handleConvert}
            result={result}
            isCopied={isCopied}
            onCopyResult={() => copyValue(result, "Config tersalin")}
            onAdvancedSshConvert={handleAdvancedSshConvert}
          />
        </TabsContent>
      </Tabs>

      <EasyResultDialog
        open={showEasyResult}
        onOpenChange={setShowEasyResult}
        result={easyResult}
        isCopied={isEasyCopied}
        onDownload={downloadEasyConfig}
        onOpen={openDarkTunnel}
        onCopy={copyEasyLink}
      />

      <SshResultDialog
        open={showAdvancedResult}
        onOpenChange={setShowAdvancedResult}
        sshLink={sshLink}
        isCopied={isCopied}
        onCopy={() => copyValue(sshLink, "Link DarkTunnel tersalin")}
      />
    </div>
  );
}

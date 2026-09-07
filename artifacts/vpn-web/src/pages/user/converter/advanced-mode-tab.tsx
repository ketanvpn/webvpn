import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Loader2,
  ShieldPlus,
} from "lucide-react";
import type { DarkTunnelAccount } from "@/lib/darktunnel";
import type { BugPreset } from "./types";
import { formatExpiry } from "./converter-utils";

export type AdvancedModeTabProps = {
  bugs: BugPreset[];
  bugsLoading: boolean;
  activeSshAccounts: DarkTunnelAccount[];
  selectedBugId: string;
  rawConfig: string;
  result: string;
  isCopied: boolean;
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshPassword: string;
  sshConfigName: string;
  isSshConverting: boolean;
  onSetSelectedBugId: (id: string) => void;
  onSetRawConfig: (v: string) => void;
  onSetSshHost: (v: string) => void;
  onSetSshPort: (v: string) => void;
  onSetSshUsername: (v: string) => void;
  onSetSshPassword: (v: string) => void;
  onSetSshConfigName: (v: string) => void;
  onSelectAccountForSsh: (account: DarkTunnelAccount) => void;
  onConvert: () => void;
  onAdvancedSshConvert: () => void;
  onCopyValue: (value: string, msg: string) => void;
};

export function AdvancedModeTab({
  bugs,
  bugsLoading,
  activeSshAccounts,
  selectedBugId,
  rawConfig,
  result,
  isCopied,
  sshHost,
  sshPort,
  sshUsername,
  sshPassword,
  sshConfigName,
  isSshConverting,
  onSetSelectedBugId,
  onSetRawConfig,
  onSetSshHost,
  onSetSshPort,
  onSetSshUsername,
  onSetSshPassword,
  onSetSshConfigName,
  onSelectAccountForSsh,
  onConvert,
  onAdvancedSshConvert,
  onCopyValue,
}: AdvancedModeTabProps) {
  return (
    <div className="w-full min-w-0 space-y-6 overflow-hidden">
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
                onSetSelectedBugId(value);
                const inject = bugs.find((bug) => String(bug.id) === value)?.sshInjectConfig;
                if (inject?.proxyPort != null) onSetSshPort(String(inject.proxyPort));
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
              if (account) onSelectAccountForSsh(account);
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
            <div className="space-y-2 min-w-0"><Label className="break-words">SSH Host</Label><Input value={sshHost} onChange={(event) => onSetSshHost(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
            <div className="space-y-2 min-w-0"><Label>Port</Label><Input type="number" value={sshPort} onChange={(event) => onSetSshPort(event.target.value)} className="min-w-0" /></div>
            <div className="space-y-2 min-w-0"><Label>Username</Label><Input value={sshUsername} onChange={(event) => onSetSshUsername(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
            <div className="space-y-2 min-w-0"><Label>Password</Label><Input type="password" value={sshPassword} onChange={(event) => onSetSshPassword(event.target.value)} className="font-mono text-xs sm:text-sm min-w-0" /></div>
          </div>
          <div className="space-y-2 min-w-0"><Label>Nama Config (opsional)</Label><Input value={sshConfigName} onChange={(event) => onSetSshConfigName(event.target.value)} className="min-w-0" /></div>
        </CardContent>
        <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4 min-w-0">
          <Button onClick={onAdvancedSshConvert} disabled={isSshConverting} className="w-full gap-2 min-w-0">
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
            <Select value={selectedBugId} onValueChange={onSetSelectedBugId}>
              <SelectTrigger className="min-w-0"><SelectValue placeholder={bugsLoading ? "Memuat preset..." : "Pilih preset bug"} /></SelectTrigger>
              <SelectContent>
                {bugs.map((bug) => <SelectItem key={bug.id} value={String(bug.id)}>{bug.name} ({bug.bugDomain})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 min-w-0">
            <Label className="break-words">2. Config Mentah</Label>
            <Textarea className="min-h-[120px] font-mono text-xs sm:text-sm min-w-0 w-full" value={rawConfig} onChange={(event) => onSetRawConfig(event.target.value)} placeholder="Tempel vmess://, vless://, trojan://, ss://, atau payload di sini" />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4 min-w-0">
          <Button onClick={onConvert} className="w-full gap-2 min-w-0"><ArrowRightLeft className="h-4 w-4 shrink-0" /> <span className="break-words">Convert Sekarang</span></Button>
        </CardFooter>
      </Card>

      {result && (
        <Card className="w-full min-w-0 border-emerald-500/30 bg-emerald-950/10 overflow-hidden">
          <CardHeader className="min-w-0 p-4 sm:p-6"><CardTitle className="text-emerald-400 break-words text-base">Hasil Convert</CardTitle></CardHeader>
          <CardContent className="min-w-0 overflow-hidden p-4 sm:p-6 pt-0">
            <Textarea readOnly value={result} className="min-h-[120px] font-mono text-xs sm:text-sm w-full min-w-0 break-all" />
            <Button onClick={() => onCopyValue(result, "Config tersalin")} className="mt-3 w-full gap-2 min-w-0">
              {isCopied ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />} <span className="break-words">Salin Config</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

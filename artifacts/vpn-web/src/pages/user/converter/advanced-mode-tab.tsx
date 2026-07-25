import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowRightLeft, CheckCircle2, Copy, Loader2, ShieldPlus, AlertCircle } from "lucide-react";
import type { BugPreset } from "./types";
import type { DarkTunnelAccount } from "@/lib/darktunnel";

interface AdvancedModeTabProps {
  // Bug presets
  bugs: BugPreset[];
  bugsLoading: boolean;
  selectedBugId: string;
  onSelectBug: (value: string) => void;

  // SSH accounts
  activeSshAccounts: DarkTunnelAccount[];

  // SSH form
  sshHost: string;
  sshPort: string;
  sshUsername: string;
  sshPassword: string;
  sshConfigName: string;
  isSshConverting: boolean;
  onSetSshHost: (v: string) => void;
  onSetSshPort: (v: string) => void;
  onSetSshUsername: (v: string) => void;
  onSetSshPassword: (v: string) => void;
  onSetSshConfigName: (v: string) => void;
  onSelectSshAccount: (value: string) => void;

  // Config Injector
  rawConfig: string;
  onSetRawConfig: (v: string) => void;
  onConvert: () => void;

  // Results
  result: string;
  isCopied: boolean;
  onCopyResult: () => void;

  // SSH Convert
  onAdvancedSshConvert: () => void;
}

export function AdvancedModeTab({
  bugs,
  bugsLoading,
  selectedBugId,
  onSelectBug,
  activeSshAccounts,
  sshHost,
  sshPort,
  sshUsername,
  sshPassword,
  sshConfigName,
  isSshConverting,
  onSetSshHost,
  onSetSshPort,
  onSetSshUsername,
  onSetSshPassword,
  onSetSshConfigName,
  onSelectSshAccount,
  rawConfig,
  onSetRawConfig,
  onConvert,
  result,
  isCopied,
  onCopyResult,
  onAdvancedSshConvert,
}: AdvancedModeTabProps) {
  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Untuk pengguna berpengalaman</AlertTitle>
        <AlertDescription>
          Gunakan mode ini hanya jika kamu perlu mengatur preset, host, port, atau config mentah secara manual.
        </AlertDescription>
      </Alert>

      {/* ── SSH Injek DarkTunnel ── */}
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
              onValueChange={onSelectBug}
            >
              <SelectTrigger><SelectValue placeholder="Pilih preset injek" /></SelectTrigger>
              <SelectContent>
                {bugs
                  .filter((bug) => bug.sshInjectConfig && Object.keys(bug.sshInjectConfig).length > 0)
                  .map((bug) => (
                    <SelectItem key={bug.id} value={String(bug.id)}>
                      {bug.name} ({bug.bugDomain})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pilih Akun SSH Aktif</Label>
            <Select onValueChange={onSelectSshAccount}>
              <SelectTrigger>
                <SelectValue placeholder={activeSshAccounts.length ? "Pilih akun SSH" : "Belum ada akun SSH aktif"} />
              </SelectTrigger>
              <SelectContent>
                {activeSshAccounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.username} @ {account.server?.name ?? "Server"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>SSH Host</Label>
              <Input value={sshHost} onChange={(e) => onSetSshHost(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={sshPort} onChange={(e) => onSetSshPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={sshUsername} onChange={(e) => onSetSshUsername(e.target.value)} className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={sshPassword} onChange={(e) => onSetSshPassword(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nama Config (opsional)</Label>
            <Input value={sshConfigName} onChange={(e) => onSetSshConfigName(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4">
          <Button onClick={onAdvancedSshConvert} disabled={isSshConverting} className="w-full gap-2 sm:w-auto">
            {isSshConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Buat Link DarkTunnel
          </Button>
        </CardFooter>
      </Card>

      {/* ── Config Injector Umum ── */}
      <Card className="border-primary/20 bg-card/40">
        <CardHeader>
          <CardTitle>Config Injector Umum</CardTitle>
          <CardDescription>Untuk VMess, VLESS, Trojan, Shadowsocks, atau payload mentah.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>1. Pilih Preset Bug</Label>
            <Select value={selectedBugId} onValueChange={onSelectBug}>
              <SelectTrigger>
                <SelectValue placeholder={bugsLoading ? "Memuat preset..." : "Pilih preset bug"} />
              </SelectTrigger>
              <SelectContent>
                {bugs.map((bug) => (
                  <SelectItem key={bug.id} value={String(bug.id)}>
                    {bug.name} ({bug.bugDomain})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>2. Config Mentah</Label>
            <Textarea
              className="min-h-[120px] font-mono"
              value={rawConfig}
              onChange={(e) => onSetRawConfig(e.target.value)}
              placeholder="Tempel vmess://, vless://, trojan://, ss://, atau payload di sini"
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t border-white/5 bg-primary/5 p-4">
          <Button onClick={onConvert} className="w-full gap-2 sm:w-auto">
            <ArrowRightLeft className="h-4 w-4" /> Convert Sekarang
          </Button>
        </CardFooter>
      </Card>

      {/* ── Hasil Convert ── */}
      {result && (
        <Card className="border-emerald-500/30 bg-emerald-950/10">
          <CardHeader>
            <CardTitle className="text-emerald-400">Hasil Convert</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea readOnly value={result} className="min-h-[120px] font-mono" />
            <Button onClick={onCopyResult} className="mt-3 w-full gap-2">
              {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Salin Config
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

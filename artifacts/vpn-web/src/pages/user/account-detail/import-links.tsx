import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, QrCode, ShieldCheck } from "lucide-react";
import { LINK_ORDER, LINK_LABELS, SSH_WS_PAYLOADS, NON_LINK_KEYS } from "./constants";
import { QrCodeImage } from "./qr-code-image";

interface ImportLinksProps {
  account: {
    configLink?: string | null;
    allLinks?: Record<string, string | null> | null;
  };
  hasAllLinks: boolean;
  isSsh: boolean;
  sshDetails: Array<{ label: string; value: string | null }>;
  copyToClipboard: (text: string, label: string) => void;
}

export function ImportLinks({
  account,
  hasAllLinks,
  isSsh,
  sshDetails,
  copyToClipboard,
}: ImportLinksProps) {
  const allLinks = account.allLinks as Record<string, string | null> | null | undefined;

  return (
    <>
      {/* Link Import Cepat (non-SSH) */}
      {!isSsh && (
        <Card className="glass-panel overflow-hidden border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Link Import Cepat
            </CardTitle>
            <CardDescription>
              Salin atau scan QR untuk import ke aplikasi VPN (V2Ray, Clash, NekoBox, dll)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasAllLinks ? (
              <div className="space-y-4">
                {[
                  ...LINK_ORDER.filter((k) => !!allLinks![k]),
                  ...Object.keys(allLinks!).filter(
                    (k) => !LINK_ORDER.includes(k) && !NON_LINK_KEYS.includes(k) && !!allLinks![k]
                  ),
                ].map((key) => {
                  const link = allLinks![key];
                  if (!link) return null;
                  const label = LINK_LABELS[key] ?? key.toUpperCase();
                  return (
                    <div key={key} className="space-y-2 p-3 rounded-lg bg-background border">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {label}
                      </div>
                      <div className="flex min-w-0 gap-2">
                        <Input
                          value={link}
                          readOnly
                          className="min-w-0 font-mono text-xs bg-muted/50"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 px-2 sm:px-3 gap-1"
                          onClick={() => copyToClipboard(link, label)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Salin
                        </Button>
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            Tampilkan QR Code
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center p-8 gap-4">
                          <DialogHeader>
                            <DialogTitle className="text-center">QR Code — {label}</DialogTitle>
                          </DialogHeader>
                          <QrCodeImage data={link} label={label} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => copyToClipboard(link, label)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Salin Link
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  );
                })}
              </div>
            ) : account.configLink ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-background border space-y-2">
                  <div className="flex min-w-0 gap-2">
                    <Input
                      value={account.configLink}
                      readOnly
                      className="min-w-0 font-mono text-xs bg-muted/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 px-2 sm:px-3 gap-1"
                      onClick={() => copyToClipboard(account.configLink!, "Config Link")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Salin
                    </Button>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full gap-2">
                      <QrCode className="h-4 w-4" />
                      Tampilkan QR Code
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center p-8 gap-4">
                    <DialogHeader>
                      <DialogTitle className="text-center">Scan dengan Aplikasi VPN</DialogTitle>
                    </DialogHeader>
                    <QrCodeImage data={account.configLink} label="Config" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => copyToClipboard(account.configLink!, "Config Link")}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Salin Link
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Config link belum tersedia. Silakan hubungi admin.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* SSH Details */}
      {isSsh && sshDetails.length > 0 && (
        <Card className="glass-panel overflow-hidden border-primary/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Detail SSH Tambahan
            </CardTitle>
            <CardDescription>
              Informasi host, port, SlowDNS, dan public key untuk konfigurasi SSH.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {sshDetails.map((item) => (
              <div
                key={item.label}
                className="space-y-1.5 p-3 rounded-lg bg-background border"
              >
                <Label className="text-xs text-muted-foreground">{item.label}</Label>
                <div className="flex min-w-0 gap-2">
                  <Input
                    value={item.value ?? ""}
                    readOnly
                    className="min-w-0 font-mono text-xs bg-muted/50"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(item.value ?? "", item.label)}
                    title={`Salin ${item.label}`}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SSH WebSocket Payloads */}
      {isSsh && (
        <Card className="glass-panel overflow-hidden border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-300" />
              PAYLOAD WEBSOCKET
            </CardTitle>
            <CardDescription>
              Payload umum untuk konfigurasi SSH WebSocket.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SSH_WS_PAYLOADS.map((item) => (
              <div
                key={item.title}
                className="space-y-2 rounded-lg border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    {item.title}
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-2 text-xs"
                    onClick={() => copyToClipboard(item.payload, `Payload ${item.title}`)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Salin
                  </Button>
                </div>
                <pre className="min-w-0 whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                  {item.payload}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

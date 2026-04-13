import { useGetAccount, useRenewAccount, getGetAccountQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, QrCode, Server, Clock, Activity, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const LINK_ORDER = ["tls", "none", "grpc", "uptls", "upntls"];

const LINK_LABELS: Record<string, string> = {
  tls: "WS TLS",
  none: "WS No TLS",
  grpc: "gRPC TLS",
  uptls: "Upgrade TLS",
  upntls: "Upgrade No TLS",
};

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0", 10);
  const { toast } = useToast();

  const { data: account, isLoading } = useGetAccount(accountId, {
    query: { enabled: !!accountId }
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Disalin!",
      description: `${label} disalin ke clipboard.`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!account) {
    return <div>Akun tidak ditemukan</div>;
  }

  // Build config links list: prefer allLinks if available, fallback to configLink
  const allLinks = account.allLinks as Record<string, string | null> | null | undefined;
  const hasAllLinks = allLinks && Object.values(allLinks).some(v => !!v);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Akun
          </Link>
        </Button>
        <Badge variant={account.isActive ? "default" : "destructive"} className="text-sm px-3 py-1">
          {account.isActive ? "Aktif" : "Expired"}
        </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-2 shadow-sm">
            <CardHeader className="bg-muted/20 border-b pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-mono">{account.username}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4" />
                    {account.server.name} ({account.server.location} {account.server.flag})
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="uppercase text-lg py-1">{account.protocol}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

              <div className="grid sm:grid-cols-2 gap-4 p-4 bg-accent/30 rounded-lg border">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Expired At</div>
                  <div className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {format(new Date(account.expiresAt), "MMM d, yyyy HH:mm")}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Quota Usage</div>
                  <div className="font-medium flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    {account.quota ? `${account.usedQuota || 0} GB / ${account.quota} GB` : "Unlimited Bandwidth"}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Detail Koneksi</h3>

                <div className="space-y-4">
                  {account.uuid && (
                    <div className="space-y-1.5">
                      <Label>UUID / Password</Label>
                      <div className="flex gap-2">
                        <Input value={account.uuid} readOnly className="font-mono bg-muted/50" />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(account.uuid!, "UUID")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {(account.protocol === 'ssh') && account.password && (
                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <div className="flex gap-2">
                        <Input value={account.password} readOnly className="font-mono bg-muted/50" />
                        <Button variant="outline" size="icon" onClick={() => copyToClipboard(account.password!, "Password")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Host / IP</Label>
                      <Input value={account.server.host ?? ""} readOnly className="font-mono bg-muted/50 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Port TLS / Non TLS</Label>
                      <Input value={account.protocol === 'ssh' ? "22 / 443" : "443 / 80"} readOnly className="font-mono bg-muted/50 text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Config Links Section */}
          <Card className="border-primary/20 bg-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Quick Import URL
              </CardTitle>
              <CardDescription>Salin link ke VPN client kamu (V2Ray, Clash, NekoBox, dll)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasAllLinks ? (
                // Show all links from panel
                <div className="space-y-3">
                  {[
                    ...LINK_ORDER.filter(k => !!allLinks![k]),
                    ...Object.keys(allLinks!).filter(k => !LINK_ORDER.includes(k) && !!allLinks![k]),
                  ].map((key) => {
                    const link = allLinks![key];
                    if (!link) return null;
                    const label = LINK_LABELS[key] ?? key.toUpperCase();
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
                        <div className="flex gap-2">
                          <Input value={link} readOnly className="font-mono text-xs bg-background" />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => copyToClipboard(link, label)}
                          >
                            <Copy className="h-3.5 w-3.5 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-full gap-2 text-xs text-muted-foreground hover:text-foreground">
                              <QrCode className="h-3.5 w-3.5" />
                              QR Code
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-8">
                            <DialogHeader>
                              <DialogTitle className="text-center mb-2">Scan QR — {label}</DialogTitle>
                            </DialogHeader>
                            <div className="w-64 h-64 bg-white border-4 border-black p-4 flex flex-col items-center justify-center relative">
                              <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-1 p-2 opacity-20">
                                {Array.from({ length: 25 }).map((_, i) => <div key={i} className={`bg-black ${i % 2 === 0 ? 'rounded-sm' : ''}`} />)}
                              </div>
                              <QrCode className="h-16 w-16 text-black relative z-10" />
                              <span className="text-xs font-mono text-black mt-2 relative z-10 font-bold">QR PLACEHOLDER</span>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    );
                  })}
                </div>
              ) : account.configLink ? (
                // Fallback: single config link
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input value={account.configLink} readOnly className="font-mono text-xs bg-background" />
                    <Button onClick={() => copyToClipboard(account.configLink!, "Config Link")}>
                      Copy
                    </Button>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2">
                        <QrCode className="h-4 w-4" />
                        Show QR Code
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-8">
                      <DialogHeader>
                        <DialogTitle className="text-center mb-4">Scan with VPN Client</DialogTitle>
                      </DialogHeader>
                      <div className="w-64 h-64 bg-white border-4 border-black p-4 flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-1 p-2 opacity-20">
                          {Array.from({ length: 25 }).map((_, i) => <div key={i} className={`bg-black ${i % 2 === 0 ? 'rounded-sm' : ''}`} />)}
                        </div>
                        <QrCode className="h-16 w-16 text-black relative z-10" />
                        <span className="text-xs font-mono text-black mt-2 relative z-10 font-bold">QR CODE PLACEHOLDER</span>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Config link belum tersedia.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" asChild>
                <Link href="/products">Renew / Upgrade</Link>
              </Button>
              <Button variant="outline" className="w-full text-muted-foreground" asChild>
                <Link href={`/orders/${account.orderId}`}>Lihat Order Asli</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Aplikasi Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">Download client yang direkomendasikan untuk protokol kamu:</p>
              <ul className="list-disc pl-4 space-y-1 text-primary">
                <li><a href="#" className="hover:underline">v2rayN (Windows)</a></li>
                <li><a href="#" className="hover:underline">NekoBox (Android)</a></li>
                <li><a href="#" className="hover:underline">Shadowrocket (iOS)</a></li>
                <li><a href="#" className="hover:underline">V2RayX (iOS)</a></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

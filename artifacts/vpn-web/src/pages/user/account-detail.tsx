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
      title: "Copied!",
      description: `${label} copied to clipboard.`,
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
    return <div>Account not found</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </Link>
        </Button>
        <Badge variant={account.isActive ? "default" : "destructive"} className="text-sm px-3 py-1">
          {account.isActive ? "Active" : "Expired"}
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
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Expires At</div>
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
                <h3 className="font-semibold text-lg border-b pb-2">Connection Details</h3>
                
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
                      <Input value={account.server.host} readOnly className="font-mono bg-muted/50 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Port</Label>
                      <Input value={account.protocol === 'ssh' ? "22 / 443" : "443"} readOnly className="font-mono bg-muted/50 text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {account.configLink && (
            <Card className="border-primary/20 bg-primary/5 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Quick Import URL
                </CardTitle>
                <CardDescription>Copy this link into your VPN client (V2Ray, Clash, NekoBox, etc)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    {/* Placeholder for actual QR code, since we don't have a QR library installed */}
                    <div className="w-64 h-64 bg-white border-4 border-black p-4 flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 grid grid-cols-5 grid-rows-5 gap-1 p-2 opacity-20">
                           {Array.from({length: 25}).map((_,i) => <div key={i} className={`bg-black ${i%2===0?'rounded-sm':''}`}/>)}
                        </div>
                        <QrCode className="h-16 w-16 text-black relative z-10" />
                        <span className="text-xs font-mono text-black mt-2 relative z-10 font-bold">QR CODE PLACEHOLDER</span>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
           <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" asChild>
                <Link href="/products">Renew / Upgrade</Link>
              </Button>
              <Button variant="outline" className="w-full text-muted-foreground" asChild>
                <Link href={`/orders/${account.orderId}`}>View Original Order</Link>
              </Button>
            </CardContent>
           </Card>

           <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm">Client Apps</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground">Download recommended clients for your protocol:</p>
              <ul className="list-disc pl-4 space-y-1 text-primary">
                <li><a href="#" className="hover:underline">v2rayN (Windows)</a></li>
                <li><a href="#" className="hover:underline">NekoBox (Android)</a></li>
                <li><a href="#" className="hover:underline">Shadowrocket (Android)</a></li>
                <li><a href="#" className="hover:underline">V2RayX (iOS)</a></li>
              </ul>
            </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

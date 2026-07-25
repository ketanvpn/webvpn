import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Clock, Activity, Tag } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { ImportLinks } from "./import-links";

interface ConnectionDetailsProps {
  account: {
    username: string;
    password?: string | null;
    uuid?: string | null;
    protocol: string;
    expiresAt: string;
    isActive: boolean;
    quota?: number | null;
    productName?: string | null;
    configLink?: string | null;
    allLinks?: Record<string, string | null> | null;
  };
  accountHost: string;
  sshPortText: string;
  sshDetails: Array<{ label: string; value: string | null }>;
  hasAllLinks: boolean;
  isSsh: boolean;
  copyToClipboard: (text: string, label: string) => void;
}

export function ConnectionDetails({
  account,
  accountHost,
  sshPortText,
  sshDetails,
  hasAllLinks,
  isSsh,
  copyToClipboard,
}: ConnectionDetailsProps) {
  const daysLeft = differenceInCalendarDays(new Date(account.expiresAt), new Date());

  return (
    <>
      {/* Info Akun */}
      <Card className="glass-panel overflow-hidden border-white/5 shadow-lg">
        <CardHeader className="border-b border-white/5 pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="break-all text-xl font-mono sm:text-2xl">
                {account.username}
              </CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit uppercase text-sm py-1 sm:text-lg">
              {account.protocol}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div
            className={`grid gap-4 p-4 glass-card border-white/5 rounded-lg ${
              account.productName ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase font-semibold">
                Tanggal Kedaluwarsa
              </div>
              <div className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {format(new Date(account.expiresAt), "d MMM yyyy", { locale: idLocale })}
              </div>
              {account.isActive && (
                <div
                  className={`text-xs font-medium ${
                    daysLeft <= 3
                      ? "text-destructive"
                      : daysLeft <= 7
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {daysLeft > 0 ? `${daysLeft} hari lagi` : "Kedaluwarsa hari ini"}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase font-semibold">Kuota</div>
              <div className="font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {account.quota ? `${account.quota} GB` : "Tidak Terbatas"}
              </div>
            </div>
            {account.productName && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase font-semibold">Paket</div>
                <div className="font-medium flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  {account.productName}
                </div>
              </div>
            )}
          </div>

          {/* Detail Koneksi */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Detail Koneksi</h3>

            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-emerald-300">
                    Data Akun {account.protocol.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Salin data utama ini ke aplikasi VPN kamu agar tidak tertukar.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 min-w-0">
                    <Label>Host / IP</Label>
                    <div className="flex min-w-0 gap-2">
                      <Input
                        value={accountHost}
                        readOnly
                        className="min-w-0 font-mono bg-muted/50 text-sm"
                      />
                      {accountHost && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => copyToClipboard(accountHost, "Host")}
                          title="Salin Host"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <Label>Username</Label>
                    <div className="flex min-w-0 gap-2">
                      <Input
                        value={account.username}
                        readOnly
                        className="min-w-0 font-mono bg-muted/50 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => copyToClipboard(account.username, "Username")}
                        title="Salin Username"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {account.password && (
                    <div className="space-y-1.5 min-w-0">
                      <Label>Password</Label>
                      <div className="flex min-w-0 gap-2">
                        <Input
                          value={account.password}
                          readOnly
                          className="min-w-0 font-mono bg-muted/50 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => copyToClipboard(account.password!, "Password")}
                          title="Salin Password"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {!isSsh && account.uuid && (
                    <div className="space-y-1.5 min-w-0">
                      <Label>UUID</Label>
                      <div className="flex min-w-0 gap-2">
                        <Input
                          value={account.uuid}
                          readOnly
                          className="min-w-0 font-mono bg-muted/50 text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => copyToClipboard(account.uuid!, "UUID")}
                          title="Salin UUID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 min-w-0">
                    <Label>Port TLS / Non TLS</Label>
                    <Input
                      value={isSsh ? sshPortText : "443 / 80"}
                      readOnly
                      className="min-w-0 font-mono bg-muted/50 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <ImportLinks
        account={account}
        hasAllLinks={hasAllLinks}
        isSsh={isSsh}
        sshDetails={sshDetails}
        copyToClipboard={copyToClipboard}
      />
    </>
  );
}

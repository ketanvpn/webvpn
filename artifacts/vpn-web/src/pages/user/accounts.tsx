import { useListAccounts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { Link } from "wouter";
import { Server, Activity, ShieldOff } from "lucide-react";

function DaysRemaining({ expiresAt, isActive }: { expiresAt: string; isActive: boolean }) {
  const now = new Date();
  const expDate = new Date(expiresAt);
  const days = differenceInDays(expDate, now);

  if (!isActive || days < 0) {
    return (
      <span className="flex items-center gap-2 text-sm font-medium text-red-500">
        <ShieldOff className="h-4 w-4" />
        Expired
      </span>
    );
  }

  const colorClass =
    days > 7 ? "text-green-600" :
    days > 3 ? "text-yellow-600" :
    "text-red-500";

  return (
    <span className={`flex items-center gap-2 text-sm font-medium ${colorClass}`}>
      <Server className="h-4 w-4" />
      {days === 0
        ? "Expired hari ini"
        : `${days} hari lagi (${format(expDate, "d MMM")})`}
    </span>
  );
}

export default function Accounts() {
  const { data, isLoading } = useListAccounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Akun VPN Saya</h1>
        <p className="text-muted-foreground mt-1">Kelola koneksi dan konfigurasi VPN kamu.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((account) => {
            const daysLeft = differenceInDays(new Date(account.expiresAt), new Date());
            const isExpiringSoon = account.isActive && daysLeft <= 3;
            const cardBorder = isExpiringSoon
              ? "border-red-300 hover:border-red-400"
              : "hover:border-primary/50";

            return (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <Card className={`${cardBorder} transition-colors cursor-pointer h-full flex flex-col group`}>
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl leading-none">{account.server.flag}</span>
                        <Badge variant={account.isActive ? "default" : "destructive"}>
                          {account.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="uppercase font-bold">{account.protocol}</Badge>
                    </div>
                    <CardTitle className="text-lg font-mono truncate mt-1" title={account.username}>
                      {account.username}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{account.server.name} &bull; {account.server.location}</p>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      <span>Kuota: {account.quota ? `${account.usedQuota || 0}/${account.quota} GB` : "Tidak Terbatas"}</span>
                    </div>

                    <div className="mt-auto pt-4 border-t">
                      <DaysRemaining expiresAt={account.expiresAt} isActive={account.isActive} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 border rounded-xl bg-card border-dashed">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Server className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">Belum ada akun VPN.</p>
          <Link href="/products" className="text-primary hover:underline text-sm mt-2 inline-block">
            Beli paket untuk memulai →
          </Link>
        </div>
      )}
    </div>
  );
}

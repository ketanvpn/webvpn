import { useListAccounts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays } from "date-fns";
import { Link } from "wouter";
import { Server, ChevronRight, ShieldOff, Clock } from "lucide-react";

const PROTOCOL_COLORS: Record<string, string> = {
  ssh: "bg-orange-100 text-orange-700 border-orange-200",
  vmess: "bg-blue-100 text-blue-700 border-blue-200",
  vless: "bg-purple-100 text-purple-700 border-purple-200",
  trojan: "bg-red-100 text-red-700 border-red-200",
  shadowsocks: "bg-green-100 text-green-700 border-green-200",
};

function ExpiryBadge({ expiresAt, isActive }: { expiresAt: string; isActive: boolean }) {
  const days = differenceInCalendarDays(new Date(expiresAt), new Date());

  if (!isActive || days < 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
        <ShieldOff className="h-3 w-3" /> Kedaluwarsa
      </span>
    );
  }

  const color = days > 7 ? "text-green-600" : days > 3 ? "text-amber-600" : "text-red-500";
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${color}`}>
      <Clock className="h-3 w-3" />
      {days === 0 ? "Habis hari ini" : `${days} hari lagi`}
    </span>
  );
}

export default function Accounts() {
  const { data, isLoading } = useListAccounts();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Akun VPN Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola koneksi VPN kamu.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : data && data.length > 0 ? (
        <div className="rounded-xl border-2 overflow-hidden divide-y">
          {data.map((account) => {
            const protocolColor = PROTOCOL_COLORS[account.protocol] ?? "bg-gray-100 text-gray-700 border-gray-200";
            const days = differenceInCalendarDays(new Date(account.expiresAt), new Date());
            const isExpiringSoon = account.isActive && days >= 0 && days <= 3;

            return (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <div className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer ${
                  isExpiringSoon ? "bg-red-50/50" : ""
                }`}>
                  {/* Flag */}
                  <span className="text-xl shrink-0 leading-none">{account.server.flag}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${protocolColor}`}>
                        {account.protocol}
                      </span>
                      <span className="font-semibold text-sm font-mono truncate">{account.username}</span>
                      {!account.isActive && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1 shrink-0">Nonaktif</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {account.server.name} · {account.server.location}
                      </span>
                    </div>
                  </div>

                  {/* Expiry + Arrow */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ExpiryBadge expiresAt={account.expiresAt} isActive={account.isActive} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 rounded-xl border-dashed bg-card">
          <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Belum ada akun VPN.</p>
          <Link href="/products" className="text-primary hover:underline text-sm mt-1.5 inline-block">
            Beli paket untuk memulai →
          </Link>
        </div>
      )}
    </div>
  );
}

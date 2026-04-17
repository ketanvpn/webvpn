import { useListAccounts } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInCalendarDays } from "date-fns";
import { Link } from "wouter";
import { Server, ChevronRight, ShieldOff, Clock } from "lucide-react";
import { useState, useMemo } from "react";

const PROTOCOL_COLORS: Record<string, string> = {
  ssh: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  vmess: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  vless: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  trojan: "bg-red-500/10 text-red-400 border-red-500/30",
  shadowsocks: "bg-green-500/10 text-green-400 border-green-500/30",
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
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    // Filter
    if (filter === "active") {
      result = result.filter(a => a.isActive && differenceInCalendarDays(new Date(a.expiresAt), new Date()) >= 0);
    } else if (filter === "expired") {
      result = result.filter(a => !a.isActive || differenceInCalendarDays(new Date(a.expiresAt), new Date()) < 0);
    }

    // Sort: sisa waktu paling lama di atas (descending)
    result.sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime());

    return result;
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Akun VPN Saya</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola koneksi VPN kamu.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
        {[
          { value: "all", label: "Semua" },
          { value: "active", label: "Aktif" },
          { value: "expired", label: "Kedaluwarsa" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
              filter === f.value
                ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                : "glass-card text-muted-foreground border border-white/5 hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filteredAndSortedData.length > 0 ? (
        <div className="glass-panel rounded-xl overflow-hidden divide-y divide-white/5">
          {filteredAndSortedData.map((account) => {
            const protocolColor = PROTOCOL_COLORS[account.protocol] ?? "bg-gray-500/10 text-gray-400 border-gray-500/30";
            const days = differenceInCalendarDays(new Date(account.expiresAt), new Date());
            const isExpiringSoon = account.isActive && days >= 0 && days <= 3;

            return (
              <Link key={account.id} href={`/accounts/${account.id}`}>
                <div className={`flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer ${
                  isExpiringSoon ? "bg-red-500/10" : ""
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
        <div className="text-center py-16 rounded-xl border border-dashed border-white/20 glass-card">
          <Server className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">
            {filter === "all" ? "Belum ada akun VPN." : `Tidak ada akun yang ${filter === "active" ? "Aktif" : "Kedaluwarsa"}.`}
          </p>
          {filter === "all" && (
            <Link href="/products" className="text-primary hover:underline text-sm mt-1.5 inline-block">
              Beli paket untuk memulai →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

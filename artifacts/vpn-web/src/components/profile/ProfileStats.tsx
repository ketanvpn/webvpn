import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Star, Calendar as CalIcon } from "lucide-react";
import { Link } from "wouter";
import { useGetBalance, type User } from "@workspace/api-client-react";
import { usePointsSummary } from "@/hooks/profile/use-profile-extras";
import { formatRupiah } from "@/lib/format";

function StatBox({
  icon: Icon,
  label,
  value,
  sub,
  to,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  to: string;
  loading?: boolean;
}) {
  const content = (
    <div className="rounded-xl border bg-muted/30 hover:bg-muted/50 transition-colors p-3 cursor-pointer h-full">
      <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <div className="font-bold text-sm leading-tight truncate">{value}</div>
      )}
      {sub && <div className="text-[11px] text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );

  return (
    <Link href={to} className="block">
      {content}
    </Link>
  );
}

export function ProfileStats({ user }: { user: User }) {
  const { data: balanceData, isLoading: balLoading } = useGetBalance();
  const { data: pointsData, isLoading: pointsLoading } = usePointsSummary(true);

  const balance = balanceData?.balance ?? (user as any).balance ?? 0;
  const points = pointsData?.points ?? (user as any).points ?? 0;

  const joined = (() => {
    try {
      const d = new Date(user.createdAt);
      const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 1) return "Hari ini";
      if (diff === 1) return "1 hari";
      if (diff < 30) return `${diff} hari`;
      const months = Math.floor(diff / 30);
      return `${months} bln`;
    } catch {
      return "-";
    }
  })();

  return (
    <Card className="glass-panel border-white/5 p-3">
      <div className="grid grid-cols-3 gap-2">
        <StatBox
          icon={Wallet}
          label="Saldo"
          value={balLoading ? "…" : formatRupiah(Number(balance))}
          sub="Tap topup"
          to="/balance"
          loading={balLoading}
        />
        <StatBox
          icon={Star}
          label="Poin"
          value={pointsLoading ? "…" : `${Number(points).toLocaleString("id-ID")} pts`}
          sub="Tukar saldo"
          to="/points"
          loading={pointsLoading}
        />
        <StatBox
          icon={CalIcon}
          label="Member"
          value={joined}
          sub="Sejak bergabung"
          to="/balance/logs"
        />
      </div>
    </Card>
  );
}

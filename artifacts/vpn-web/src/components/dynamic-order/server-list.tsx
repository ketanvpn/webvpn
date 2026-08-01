import { CheckCircle2, PackageX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ServerCard, type DynamicServer } from "@/components/dynamic-order";

type ServerListProps = {
  readonly servers: readonly DynamicServer[];
  readonly isLoading: boolean;
  readonly onSelectServer: (server: DynamicServer) => void;
};

export function ServerList({ servers, isLoading, onSelectServer }: ServerListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl glass-panel border-white/5 flex flex-col items-center justify-center gap-3">
        <PackageX className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Belum ada server aktif. Hubungi bantuan.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} onSelect={() => onSelectServer(server)} />
      ))}
    </div>
  );
}

type SuccessBannerProps = {
  readonly paidOrderId: number | null;
};

export function SuccessBanner({ paidOrderId }: SuccessBannerProps) {
  if (!paidOrderId) return null;

  return (
    <Card className="glass-panel border-emerald-500/30 bg-emerald-500/10">
      <CardContent className="py-4 flex items-center gap-3 text-emerald-200 text-sm">
        <CheckCircle2 className="h-4 w-4" />
        Order #{paidOrderId} berhasil. Silakan buka menu Akun VPN untuk melihat config.
      </CardContent>
    </Card>
  );
}

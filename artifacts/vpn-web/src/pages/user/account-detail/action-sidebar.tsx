import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldPlus, RefreshCw, ExternalLink } from "lucide-react";
import { RenewDialog } from "./renew-dialog";
import { DynamicRenewDialog } from "./dynamic-renew-dialog";
import type { DynamicDurationType } from "@/lib/dynamic-duration";
import type { UseMutationResult } from "@tanstack/react-query";

interface ActionSidebarProps {
  accountId: number;
  account: {
    protocol: string;
    isActive: boolean;
    expiresAt: string;
    serverId?: number | null;
    orderId?: number | null;
    server: {
      name: string;
      flag: string;
      location: string;
      isActive: boolean;
    };
  };
  isSsh: boolean;
  isDynamicAccount: boolean;
  dynamicOrder?: {
    provider?: string | null;
    renewEnabled?: boolean;
    supportedTypes?: string[];
  } | null;
  dynamicRenewTypes: DynamicDurationType[];
  syncProviderMutation: UseMutationResult<unknown, unknown, void, unknown>;
}

export function ActionSidebar({
  accountId,
  account,
  isSsh,
  isDynamicAccount,
  dynamicOrder,
  dynamicRenewTypes,
  syncProviderMutation,
}: ActionSidebarProps) {
  const isActive = account.isActive && new Date(account.expiresAt) > new Date();

  return (
    <div className="contents min-w-0 md:block md:space-y-6">
      <Card className="order-first glass-panel border-white/5 md:order-none">
        <CardHeader className="border-b border-white/5 pb-4">
          <CardTitle className="text-base">Aksi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isSsh && isActive && (
            <Button className="w-full gap-2" asChild>
              <Link href={`/converter?account=${accountId}`}>
                <ShieldPlus className="h-4 w-4" />
                Buat Config Injek
              </Link>
            </Button>
          )}
          {isActive &&
            (isDynamicAccount ? (
              dynamicOrder?.renewEnabled !== false && dynamicRenewTypes.length > 0 ? (
                <DynamicRenewDialog
                  accountId={accountId}
                  protocol={account.protocol}
                  serverName={account.server.name}
                  serverFlag={account.server.flag}
                  serverLocation={account.server.location}
                  supportedTypes={dynamicRenewTypes}
                />
              ) : null
            ) : (
              <RenewDialog
                accountId={accountId}
                serverId={account.serverId!}
                protocol={account.protocol}
                serverName={account.server.name}
                serverFlag={account.server.flag}
                serverLocation={account.server.location}
                serverIsActive={account.server.isActive}
              />
            ))}
          {dynamicOrder?.provider === "nadiavpn" && (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => syncProviderMutation.mutate()}
              disabled={syncProviderMutation.isPending}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncProviderMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncProviderMutation.isPending ? "Sync Detail..." : "Sync Detail Provider"}
            </Button>
          )}
          {account.orderId && (
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/orders/${account.orderId}`}>Lihat Order Asli</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel bg-black/20 border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Aplikasi VPN Client</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground text-xs">
            Rekomendasi aplikasi untuk protokol {account.protocol.toUpperCase()}:
          </p>
          <ul className="space-y-2">
            <li>
              <a
                href="https://github.com/2dust/v2rayN/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                v2rayN (Windows)
              </a>
            </li>
            <li>
              <a
                href="https://play.google.com/store/apps/details?id=com.v2ray.ang"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                v2rayNG (Android)
              </a>
            </li>
            <li>
              <a
                href="https://play.google.com/store/apps/details?id=com.github.kr328.clash"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                NekoBox (Android)
              </a>
            </li>
            <li>
              <a
                href="https://apps.apple.com/us/app/shadowrocket/id932747118"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline text-xs"
              >
                <ExternalLink className="h-3 w-3" />
                Shadowrocket (iOS)
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

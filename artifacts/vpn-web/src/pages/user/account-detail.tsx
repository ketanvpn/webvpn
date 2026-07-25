import { useParams, Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  useGetAccount,
  getGetAccountQueryKey,
} from "@workspace/api-client-react";
import { isDynamicDurationType } from "@/lib/dynamic-duration";
import { pickDisplayHost } from "./account-detail/constants";
import { ConnectionDetails } from "./account-detail/connection-details";
import { ActionSidebar } from "./account-detail/action-sidebar";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0", 10);
  const { toast } = useToast();

  const { data: account, isLoading } = useGetAccount(accountId, {
    query: { queryKey: getGetAccountQueryKey(accountId), enabled: !!accountId },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Disalin!",
      description: `${label} disalin ke clipboard.`,
    });
  };

  const queryClient = useQueryClient();
  const syncProviderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/accounts/${accountId}/sync-provider`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal sync detail provider");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
      toast({
        title: "Detail provider diperbarui",
        description: "Data akun berhasil disinkronkan dari NadiaVPN.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Sync gagal",
        description: err instanceof Error ? err.message : "Gagal sync detail provider",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Akun tidak ditemukan.</p>
        <Link href="/accounts" className="text-primary hover:underline mt-2 inline-block">
          Kembali ke akun
        </Link>
      </div>
    );
  }

  const allLinks = account.allLinks as Record<string, string | null> | null | undefined;
  const dynamicOrder = (
    account as typeof account & {
      dynamicOrder?: {
        provider?: string | null;
        renewEnabled?: boolean;
        supportedTypes?: string[];
        sellPricePerDay?: number;
        sellPricePerWeek?: number;
        sellPricePerMonth?: number;
      } | null;
    }
  ).dynamicOrder;
  const isDynamicAccount =
    dynamicOrder?.provider === "nadiavpn" || dynamicOrder?.provider === "local_panel";
  const dynamicRenewTypes = (dynamicOrder?.supportedTypes ?? []).filter(isDynamicDurationType);
  const isSsh = account.protocol === "ssh";
  const accountHost = pickDisplayHost(allLinks, account.server.host ?? "");
  const hasAllLinks =
    !isSsh &&
    allLinks &&
    Object.entries(allLinks).some(
      ([key, value]) =>
        ![
          "hostname",
          "servername",
          "host",
          "domain",
          "server",
          "cloudfront",
          "sni",
        ].includes(key) && !!value
    );
  const sshHost = accountHost;
  const sshPortText =
    [allLinks?.port_tls, allLinks?.port_none].filter(Boolean).join(" / ") || "22 / 443";
  const sshDetails = [
    { label: "Server Name / SNI", value: allLinks?.servername },
    { label: "Port TLS", value: allLinks?.port_tls },
    { label: "Port Non TLS", value: allLinks?.port_none },
    { label: "Port Any", value: allLinks?.port_any },
    { label: "SlowDNS", value: allLinks?.slowdns },
    { label: "UDP Custom", value: allLinks?.udp_custom },
    { label: "UDPGW", value: allLinks?.udpgw },
    { label: "Squid", value: allLinks?.squid },
    { label: "Public Key", value: allLinks?.pubkey },
  ].filter((item) => !!item.value);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 overflow-hidden">
      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/accounts" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Akun
          </Link>
        </Button>
        <Badge
          variant={account.isActive ? "default" : "destructive"}
          className="text-sm px-3 py-1"
        >
          {account.isActive ? "Aktif" : "Kedaluwarsa"}
        </Badge>
      </div>

      <div className="grid min-w-0 gap-6 md:grid-cols-3">
        <div className="min-w-0 space-y-6 md:col-span-2">
          <ConnectionDetails
            account={account}
            accountHost={accountHost}
            sshPortText={sshPortText}
            sshDetails={sshDetails}
            hasAllLinks={hasAllLinks}
            isSsh={isSsh}
            copyToClipboard={copyToClipboard}
          />
        </div>

        <ActionSidebar
          accountId={accountId}
          account={account}
          isSsh={isSsh}
          isDynamicAccount={isDynamicAccount}
          dynamicOrder={dynamicOrder}
          dynamicRenewTypes={dynamicRenewTypes}
          syncProviderMutation={syncProviderMutation}
        />
      </div>
    </div>
  );
}

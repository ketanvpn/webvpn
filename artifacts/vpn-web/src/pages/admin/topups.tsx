import {
  useAdminListTopups,
  useAdminConfirmTopup,
  useAdminRejectTopup,
  getAdminListTopupsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { CreditCard, Check, X, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminListTopupsStatus } from "@workspace/api-client-react/src/generated/api.schemas";

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending:   { label: "Menunggu",   class: "bg-yellow-500/10 text-yellow-600 border-yellow-200", icon: Clock },
  confirmed: { label: "Dikonfirmasi", class: "bg-green-500/10 text-green-600 border-green-200",   icon: CheckCircle },
  rejected:  { label: "Ditolak",    class: "bg-red-500/10 text-red-600 border-red-200",           icon: XCircle },
};

export default function AdminTopups() {
  const [status, setStatus] = useState<string>("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminListTopups({
    status: status === "all" ? undefined : (status as AdminListTopupsStatus),
  });

  const confirmTopup = useAdminConfirmTopup();
  const rejectTopup = useAdminRejectTopup();

  const handleAction = (id: number, action: "confirm" | "reject") => {
    const mutation = action === "confirm" ? confirmTopup : rejectTopup;
    mutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: action === "confirm" ? "Topup dikonfirmasi" : "Topup ditolak" });
          queryClient.invalidateQueries({ queryKey: getAdminListTopupsQueryKey() });
        },
        onError: (err) =>
          toast({
            title: action === "confirm" ? "Gagal konfirmasi" : "Gagal tolak",
            description: err.error,
            variant: "destructive",
          }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Topup Saldo</h1>
        <p className="text-muted-foreground mt-1">Tinjau dan proses permintaan deposit user.</p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-topup-pending">
            <Clock className="h-4 w-4 mr-1.5" /> Menunggu
          </TabsTrigger>
          <TabsTrigger value="confirmed" data-testid="tab-topup-confirmed">
            <CheckCircle className="h-4 w-4 mr-1.5" /> Dikonfirmasi
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-topup-rejected">
            <XCircle className="h-4 w-4 mr-1.5" /> Ditolak
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-topup-all">Semua</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Permintaan Deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : data && data.length > 0 ? (
            <div className="divide-y">
              {data.map((topup) => {
                const cfg = statusConfig[topup.status] ?? statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <div
                    key={topup.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/30 transition-colors"
                    data-testid={`row-topup-${topup.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full ${topup.status === "confirmed" ? "bg-green-100 text-green-600" : topup.status === "rejected" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {topup.username ?? `User #${topup.userId}`}
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${cfg.class}`}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {format(new Date(topup.createdAt), "d MMM yyyy HH:mm")}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:justify-end">
                      <div className="font-bold text-xl text-primary">
                        {formatRupiah(topup.amount)}
                      </div>
                      {topup.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleAction(topup.id, "confirm")}
                            disabled={confirmTopup.isPending}
                            data-testid={`button-confirm-topup-${topup.id}`}
                          >
                            <Check className="h-4 w-4" /> Konfirmasi
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleAction(topup.id, "reject")}
                            disabled={rejectTopup.isPending}
                            data-testid={`button-reject-topup-${topup.id}`}
                          >
                            <X className="h-4 w-4" /> Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              Tidak ada permintaan topup {status !== "all" ? `berstatus "${statusConfig[status]?.label ?? status}"` : ""}.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

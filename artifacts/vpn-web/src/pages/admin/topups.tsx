import { useAdminListTopups, useAdminConfirmTopup, useAdminRejectTopup, getAdminListTopupsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { CreditCard, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminListTopupsStatus } from "@workspace/api-client-react/src/generated/api.schemas";

export default function AdminTopups() {
  const [status, setStatus] = useState<string>("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminListTopups({
    status: status === "all" ? undefined : (status as AdminListTopupsStatus),
  });

  const confirmTopup = useAdminConfirmTopup();
  const rejectTopup = useAdminRejectTopup();

  const handleAction = (id: number, action: 'confirm' | 'reject') => {
    const mutation = action === 'confirm' ? confirmTopup : rejectTopup;
    mutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: `Topup ${action}ed` });
        queryClient.invalidateQueries({ queryKey: getAdminListTopupsQueryKey() });
      },
      onError: (err) => {
        toast({ title: `Failed to ${action}`, description: err.error, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Balance Topups</h1>
        <p className="text-muted-foreground mt-1">Review and process user deposit requests.</p>
      </div>

      <Tabs defaultValue="pending" value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="pending">Pending Requests</TabsTrigger>
          <TabsTrigger value="all">All History</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Deposit Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data && data.length > 0 ? (
            <div className="divide-y">
              {data.map((topup) => (
                <div key={topup.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {topup.username}
                        <Badge variant={topup.status === 'confirmed' ? "default" : topup.status === 'pending' ? "secondary" : "destructive"} className="text-[10px] capitalize">
                          {topup.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Requested on {format(new Date(topup.createdAt), "MMM d, yyyy HH:mm")}
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
                          size="icon" 
                          variant="outline" 
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => handleAction(topup.id, 'confirm')}
                          disabled={confirmTopup.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleAction(topup.id, 'reject')}
                          disabled={rejectTopup.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No topup requests found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useAdminListOrders, useAdminConfirmOrder, getAdminListOrdersQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { ShoppingCart, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminListOrdersStatus } from "@workspace/api-client-react/src/generated/api.schemas";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export default function AdminOrders() {
  const [status, setStatus] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminListOrders({
    status: status === "all" ? undefined : (status as AdminListOrdersStatus),
  });

  const confirmOrder = useAdminConfirmOrder();

  const handleConfirm = (id: number) => {
    confirmOrder.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Order confirmed", description: "Account generated successfully" });
        queryClient.invalidateQueries({ queryKey: getAdminListOrdersQueryKey() });
      },
      onError: (err) => {
        toast({ title: "Failed to confirm", description: err.error, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Manage and confirm user purchases.</p>
      </div>

      <Tabs defaultValue="all" value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="bg-muted/20 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data?.orders && data.orders.length > 0 ? (
            <div className="divide-y">
              {data.orders.map((order) => (
                <div key={order.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex h-10 w-10 rounded-full bg-primary/10 items-center justify-center text-primary font-bold">
                      #{order.id}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        {order.user?.username}
                        <Badge variant="outline" className={`text-[10px] capitalize ${statusColors[order.status]}`}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {order.product?.name} &bull; {order.paymentMethod} &bull; {format(new Date(order.createdAt), "MMM d, HH:mm")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:justify-end">
                    <div className="font-bold text-lg text-primary">
                      {formatRupiah(order.amount)}
                    </div>
                    {order.status === "pending" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleConfirm(order.id)}
                        disabled={confirmOrder.isPending}
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" /> Confirm
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No orders found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useGetOrder, usePayOrder, getGetOrderQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, CreditCard, ShoppingBag, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { OrderStatus } from "@workspace/api-client-react/src/generated/api.schemas";

const statusColors: Record<OrderStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
  expired: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { enabled: !!orderId }
  });

  const payOrder = usePayOrder();

  const handlePay = () => {
    payOrder.mutate({ id: orderId }, {
      onSuccess: () => {
        toast({
          title: "Payment Successful",
          description: "Your order has been paid.",
        });
        queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      },
      onError: (err) => {
        toast({
          title: "Payment Failed",
          description: err.error || "An error occurred during payment",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full max-w-2xl mx-auto" />
      </div>
    );
  }

  if (!order) {
    return <div>Order not found</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/orders" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
      </div>

      <Card className="border-2 shadow-sm overflow-hidden">
        <div className={`h-2 w-full ${order.status === 'paid' ? 'bg-green-500' : order.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        <CardHeader className="pb-4 border-b bg-muted/20">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Order #{order.id}
                {order.status === 'paid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </CardTitle>
              <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(order.createdAt), "MMMM d, yyyy HH:mm")}
              </div>
            </div>
            <Badge variant="outline" className={`text-base px-3 py-1 capitalize ${statusColors[order.status]}`}>
              {order.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {order.product && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product Details</h3>
              <div className="flex items-start gap-4 p-4 rounded-lg bg-accent/50 border">
                <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-lg">{order.product.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px]">{order.product.protocol}</Badge>
                    <span>{order.product.durationDays} Days</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Payment Summary</h3>
            <div className="p-4 rounded-lg border space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Method
                </span>
                <span className="font-medium capitalize">{order.paymentMethod || "N/A"}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-3 border-t">
                <span>Total Amount</span>
                <span className="text-primary">{formatRupiah(order.amount)}</span>
              </div>
            </div>
          </div>

          {order.status === "paid" && order.vpnAccountId && (
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="font-semibold text-primary">Your VPN account is ready!</div>
              <Button asChild>
                <Link href={`/accounts/${order.vpnAccountId}`}>View Account Details</Link>
              </Button>
            </div>
          )}

          {order.status === "pending" && order.paymentMethod === "qris" && (
            <div className="bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20 text-center space-y-2">
              <AlertCircle className="h-8 w-8 text-yellow-600 mx-auto" />
              <div className="font-semibold text-yellow-700">Waiting for Payment</div>
              <p className="text-sm text-yellow-600/80">Please complete your QRIS payment.</p>
              {/* In a real app, you'd show a QR code image here from an API */}
            </div>
          )}
        </CardContent>

        {order.status === "pending" && order.paymentMethod === "balance" && (
          <CardFooter className="bg-muted/20 border-t pt-6 flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href="/balance">Top Up Balance</Link>
            </Button>
            <Button onClick={handlePay} disabled={payOrder.isPending}>
              {payOrder.isPending ? "Processing..." : "Pay Now"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

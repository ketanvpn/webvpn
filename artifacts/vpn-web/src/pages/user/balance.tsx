import { useGetBalance, useTopupBalance, useListTopupHistory, getGetBalanceQueryKey, getListTopupHistoryQueryKey } from "@workspace/api-client-react";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ArrowUpRight, History, Clock } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const topupSchema = z.object({
  amount: z.coerce.number().min(10000, "Minimum topup is Rp 10.000"),
});

const presetAmounts = [10000, 25000, 50000, 100000, 200000];

export default function Balance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showQris, setShowQris] = useState(false);
  const [qrisUrl, setQrisUrl] = useState("");
  
  const { data: balanceData, isLoading: isLoadingBalance } = useGetBalance();
  const { data: historyData, isLoading: isLoadingHistory } = useListTopupHistory();
  const topup = useTopupBalance();

  const form = useForm<z.infer<typeof topupSchema>>({
    resolver: zodResolver(topupSchema),
    defaultValues: { amount: 50000 },
  });

  const onSubmit = (values: z.infer<typeof topupSchema>) => {
    topup.mutate({ data: values }, {
      onSuccess: (res) => {
        setQrisUrl(res.qrisUrl);
        setShowQris(true);
        queryClient.invalidateQueries({ queryKey: getListTopupHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      },
      onError: (err) => {
        toast({
          title: "Failed to create topup",
          description: err.error || "An error occurred",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Balance & Top Up</h1>
        <p className="text-muted-foreground mt-1">Manage your account funds and view transaction history.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Col: Balance & Form */}
        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
              <Wallet className="h-48 w-48 -mr-10 -mt-10" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-primary-foreground/80 font-medium text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingBalance ? (
                <Skeleton className="h-12 w-48 bg-primary-foreground/20" />
              ) : (
                <div>
                  <div className="text-4xl md:text-5xl font-bold tracking-tight">
                    {formatRupiah(balanceData?.balance || 0)}
                  </div>
                  {balanceData?.pendingTopup !== undefined && balanceData.pendingTopup > 0 && (
                    <div className="mt-2 text-sm bg-primary-foreground/10 inline-block px-3 py-1 rounded-full font-medium">
                      + {formatRupiah(balanceData.pendingTopup)} pending
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5" /> Top Up Funds
              </CardTitle>
              <CardDescription>Add money to your account via QRIS.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <Label>Select Amount</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {presetAmounts.map((amt) => (
                        <Button
                          key={amt}
                          type="button"
                          variant={form.watch("amount") === amt ? "default" : "outline"}
                          className="w-full text-xs sm:text-sm"
                          onClick={() => form.setValue("amount", amt, { shouldValidate: true })}
                        >
                          {formatRupiah(amt)}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <Label>Custom Amount (Min. Rp 10.000)</Label>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">Rp</span>
                            <Input type="number" className="pl-9 text-lg font-medium" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full h-12 text-lg" disabled={topup.isPending}>
                    {topup.isPending ? "Generating QRIS..." : "Generate QRIS"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: History */}
        <div>
          <Card className="h-full flex flex-col border-2">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" /> Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              {isLoadingHistory ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : historyData && historyData.length > 0 ? (
                <div className="divide-y">
                  {historyData.map((tx) => (
                    <div key={tx.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          tx.status === 'confirmed' ? 'bg-green-500/10 text-green-500' :
                          tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                          'bg-red-500/10 text-red-500'
                        }`}>
                          {tx.status === 'confirmed' ? <ArrowUpRight className="h-5 w-5" /> : 
                           tx.status === 'pending' ? <Clock className="h-5 w-5" /> : 
                           <History className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{formatRupiah(tx.amount)}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`capitalize ${
                        tx.status === 'confirmed' ? 'border-green-500 text-green-600' :
                        tx.status === 'pending' ? 'border-yellow-500 text-yellow-600' :
                        'border-red-500 text-red-600'
                      }`}>
                        {tx.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  No topup history found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showQris} onOpenChange={setShowQris}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle>Scan QRIS to Pay</DialogTitle>
            <DialogDescription>
              Open your banking or e-wallet app and scan this QR code to complete the topup.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-6 bg-white rounded-lg my-4">
             {/* Use the actual URL from backend, or a placeholder if it's just a dummy string for now */}
            {qrisUrl ? (
               <img src={qrisUrl} alt="QRIS Code" className="max-w-full h-auto max-h-64 object-contain" onError={(e) => {
                 // Fallback if URL is invalid (since mock API might return dummy text)
                 (e.target as HTMLImageElement).src = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=qris_mock";
               }} />
            ) : (
               <div className="w-48 h-48 bg-gray-200 animate-pulse flex items-center justify-center text-muted-foreground text-sm">QR Code</div>
            )}
          </div>
          <div className="bg-yellow-500/10 text-yellow-700 p-3 rounded-md text-sm border border-yellow-500/20 text-left">
            <strong>Note:</strong> After payment, it may take a few moments for the admin to confirm your transaction.
          </div>
          <Button className="w-full mt-2" onClick={() => setShowQris(false)}>Close</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

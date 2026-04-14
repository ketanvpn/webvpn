import { getApiError } from "@/lib/utils";
import { useGetProduct, useCreateOrder, getGetBalanceQueryKey, useGetBalance } from "@workspace/api-client-react";
import { useParams, useLocation } from "wouter";
import { formatRupiah } from "@/lib/format";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, HardDrive, Network, ShieldCheck, ArrowLeft, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const productId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<"balance" | "qris">("balance");
  const [remarks, setRemarks] = useState("");

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { enabled: !!productId }
  });

  const { data: balanceData } = useGetBalance();
  const balance = balanceData?.balance || 0;

  const createOrder = useCreateOrder();

  const handlePurchase = () => {
    if (!remarks.trim()) {
      toast({
        title: "Nama akun wajib diisi",
        description: "Masukkan nama akun VPN kamu (contoh: lekanto1)",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "balance" && balance < (product?.price || 0)) {
      toast({
        title: "Saldo tidak cukup",
        description: "Silakan top up saldo terlebih dahulu.",
        variant: "destructive",
      });
      setLocation("/balance");
      return;
    }

    createOrder.mutate({
      data: {
        productId,
        paymentMethod,
        remarks: remarks.trim(),
      }
    }, {
      onSuccess: (order) => {
        toast({
          title: "Order berhasil dibuat!",
          description: "Pesananmu telah ditempatkan.",
        });
        queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err) => {
        toast({
          title: "Order Gagal",
          description: getApiError(err) || "Terjadi kesalahan saat membuat order",
          variant: "destructive",
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[400px] w-full max-w-3xl" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Produk tidak ditemukan.</p>
        <Link href="/products" className="text-primary hover:underline mt-2 inline-block">Kembali ke produk</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/products" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Produk
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="uppercase">{product.protocol}</Badge>
              {product.category && <Badge variant="outline">{product.category}</Badge>}
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">{product.name}</h1>
            {product.description && (
              <p className="text-muted-foreground mt-4 text-lg">{product.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                <Clock className="h-8 w-8 text-primary" />
                <div className="text-sm font-medium text-muted-foreground">Durasi</div>
                <div className="text-xl font-bold">{product.durationDays} Hari</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                <HardDrive className="h-8 w-8 text-primary" />
                <div className="text-sm font-medium text-muted-foreground">Kuota</div>
                <div className="text-xl font-bold">{product.quota ? `${product.quota} GB` : "Unlimited"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                <Network className="h-8 w-8 text-primary" />
                <div className="text-sm font-medium text-muted-foreground">Maks. IP</div>
                <div className="text-xl font-bold">{product.maxConnections || "Unlimited"}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center space-y-2">
                <Wifi className="h-8 w-8 text-primary" />
                <div className="text-sm font-medium text-muted-foreground">Server</div>
                <div className="text-xl font-bold">Premium</div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-accent/50 p-4 rounded-xl border flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-semibold block mb-1">Jaminan Kualitas</span>
              Server performa tinggi dengan SLA uptime 99.9%. Cocok untuk gaming, streaming, dan browsing aman.
            </div>
          </div>
        </div>

        <div>
          <Card className="border-2 border-primary/20 sticky top-24 shadow-lg">
            <CardHeader className="bg-muted/50 border-b">
              <CardTitle>Ringkasan Order</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b">
                <span className="text-muted-foreground">Harga</span>
                <span className="text-2xl font-bold">{formatRupiah(product.price)}</span>
              </div>

              <div className="space-y-3">
                <Label htmlFor="remarks">
                  Nama Akun (Remarks) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="remarks"
                  placeholder="Contoh: lekanto1"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                  maxLength={20}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Hanya huruf dan angka. Ini akan menjadi nama akun VPN kamu di server.
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="payment-method">Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={(v: "balance" | "qris") => setPaymentMethod(v)}>
                  <SelectTrigger id="payment-method">
                    <SelectValue placeholder="Pilih metode pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balance">
                      Saldo Akun ({formatRupiah(balance)})
                    </SelectItem>
                    <SelectItem value="qris">QRIS (Bayar langsung)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "balance" && balance < product.price && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
                  Saldo tidak cukup. Kamu butuh {formatRupiah(product.price - balance)} lagi.
                  <Link href="/balance" className="font-semibold underline block mt-1">Top up sekarang →</Link>
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/50 border-t flex flex-col gap-3 pt-6">
              <Button
                size="lg"
                className="w-full text-lg h-14"
                onClick={handlePurchase}
                disabled={createOrder.isPending || !remarks.trim() || (paymentMethod === "balance" && balance < product.price)}
              >
                {createOrder.isPending ? "Memproses..." : "Buat Order"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Dengan melakukan pembelian, kamu menyetujui Syarat & Ketentuan kami.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah } from "@/lib/format";
import { getApiError } from "@/lib/utils";
import {
  useListProducts,
  useGetBalance,
  useRenewAccount,
  getGetAccountQueryKey,
  getListProductsQueryKey,
  getGetBalanceQueryKey,
} from "@workspace/api-client-react";

interface RenewDialogProps {
  accountId: number;
  serverId: number;
  protocol: string;
  serverName: string;
  serverFlag: string;
  serverLocation: string;
  serverIsActive: boolean;
}

export function RenewDialog({
  accountId,
  serverId,
  protocol,
  serverName,
  serverFlag,
  serverLocation,
  serverIsActive,
}: RenewDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [renewed, setRenewed] = useState(false);

  const { data: products, isLoading: loadingProducts } = useListProducts(undefined, {
    query: { queryKey: getListProductsQueryKey(), enabled: open },
  });
  const { data: balanceData, isLoading: loadingBalance } = useGetBalance({
    query: { queryKey: getGetBalanceQueryKey(), enabled: open },
  });

  const renewMutation = useRenewAccount();

  const effectivePrice = (p: { price: number; resellerPrice?: number | null }) =>
    p.resellerPrice ?? p.price;

  const matchingProducts =
    products?.filter(
      (p) => p.isActive && p.protocol === protocol && (!p.serverId || p.serverId === serverId)
    ) ?? [];

  const selectedProduct = matchingProducts.find((p) => p.id === selectedProductId);
  const balance = balanceData?.balance ?? 0;
  const canAfford = selectedProduct ? balance >= effectivePrice(selectedProduct) : false;

  const handleRenew = () => {
    if (!selectedProductId) return;
    renewMutation.mutate(
      { id: accountId, data: { productId: selectedProductId } },
      {
        onSuccess: () => {
          setRenewed(true);
          queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
          toast({
            title: "Renew berhasil!",
            description: `Akun berhasil diperpanjang. ${
              selectedProduct
                ? formatRupiah(effectivePrice(selectedProduct)) + " telah dipotong dari saldo."
                : ""
            }`,
          });
        },
        onError: (err) => {
          toast({
            title: "Renew gagal",
            description: getApiError(err),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setSelectedProductId(null);
      setRenewed(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <RefreshCw className="h-4 w-4" />
          Renew Akun
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Perpanjang Akun VPN</DialogTitle>
          <DialogDescription>
            Pilih durasi perpanjangan. Server dan akun tetap sama, hanya masa aktif yang ditambah.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 text-sm">
          <span className="text-2xl leading-none">{serverFlag}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{serverName}</div>
            <div className="text-xs text-muted-foreground">
              {serverLocation} &bull; {protocol.toUpperCase()}
            </div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            Server tetap sama
          </Badge>
        </div>

        {renewed ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Renew Berhasil!</p>
              <p className="text-sm text-muted-foreground mt-1">Akun kamu sudah diperpanjang.</p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Tutup
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-lg border text-sm">
              <span className="text-muted-foreground">Saldo kamu</span>
              {loadingBalance ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <span className="font-bold text-base">{formatRupiah(balance)}</span>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Pilih Durasi Perpanjangan</Label>
              {loadingProducts ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !serverIsActive ? (
                <div className="text-center py-8 px-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p className="font-semibold">Server Offline / Maintenance</p>
                  <p>
                    Server <b>{serverName}</b> sedang tidak aktif. Kamu tidak dapat melakukan
                    perpanjangan akun saat ini.
                  </p>
                </div>
              ) : matchingProducts.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg">
                  Tidak ada paket tersedia untuk protokol {protocol.toUpperCase()}.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {matchingProducts.map((p) => {
                    const isSelected = selectedProductId === p.id;
                    const eprice = effectivePrice(p);
                    const affordable = balance >= eprice;
                    const hasDiscount =
                      p.resellerPrice != null && p.resellerPrice < p.price;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProductId(p.id)}
                        disabled={!affordable}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : affordable
                            ? "border-muted hover:border-primary/40 bg-card"
                            : "border-muted bg-muted/20 opacity-50 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-base">
                              {p.durationDays === 0 ? "1 Jam (Trial)" : `${p.durationDays} hari`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{p.name}</div>
                          </div>
                          <div className="text-right">
                            {hasDiscount && (
                              <div className="text-xs text-muted-foreground line-through">
                                {formatRupiah(p.price)}
                              </div>
                            )}
                            <div
                              className={`font-bold text-sm ${
                                hasDiscount ? "text-green-600" : ""
                              } ${isSelected ? "text-primary" : ""}`}
                            >
                              {formatRupiah(eprice)}
                            </div>
                            {!affordable && (
                              <div className="text-xs text-destructive mt-0.5">Saldo kurang</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedProduct && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  canAfford
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  {canAfford ? (
                    <>
                      Saldo kamu akan berkurang{" "}
                      <strong>{formatRupiah(effectivePrice(selectedProduct))}</strong>. Sisa saldo:{" "}
                      <strong>
                        {formatRupiah(balance - effectivePrice(selectedProduct))}
                      </strong>
                      .
                    </>
                  ) : (
                    <>
                      Saldo tidak cukup. Kamu perlu tambah saldo minimal{" "}
                      <strong>
                        {formatRupiah(effectivePrice(selectedProduct) - balance)}
                      </strong>
                      .
                    </>
                  )}
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Batal
              </Button>
              <Button
                onClick={handleRenew}
                disabled={
                  !selectedProductId ||
                  !canAfford ||
                  renewMutation.isPending ||
                  !serverIsActive
                }
                className="gap-2"
              >
                {renewMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Konfirmasi Renew
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

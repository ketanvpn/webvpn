import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { getGetAccountQueryKey, getGetBalanceQueryKey } from "@workspace/api-client-react";
import {
  dynamicDurationOptionLabel,
  isDynamicDurationType,
  type DynamicDurationType,
} from "@/lib/dynamic-duration";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

interface DynamicRenewDialogProps {
  accountId: number;
  protocol: string;
  serverName: string;
  serverFlag: string;
  serverLocation: string;
  supportedTypes: DynamicDurationType[];
}

export function DynamicRenewDialog({
  accountId,
  protocol,
  serverName,
  serverFlag,
  serverLocation,
  supportedTypes,
}: DynamicRenewDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const defaultDurationType: DynamicDurationType = supportedTypes.includes("month")
    ? "month"
    : supportedTypes.includes("week")
    ? "week"
    : "day";
  const [durationType, setDurationType] = useState<DynamicDurationType>(defaultDurationType);
  const [duration, setDuration] = useState("1");
  const [renewedAmount, setRenewedAmount] = useState<number | null>(null);

  const renewMutation = useMutation({
    mutationFn: async () => {
      const parsedDuration = parseInt(duration, 10);
      const res = await fetch(`${API}/accounts/${accountId}/renew-dynamic`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationType, duration: parsedDuration }),
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal renew dynamic");
      return body as { amount?: number; discountAmount?: number };
    },
    onSuccess: (body) => {
      setRenewedAmount(body.amount ?? null);
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(accountId) });
      queryClient.invalidateQueries({ queryKey: getGetBalanceQueryKey() });
      toast({
        title: "Renew dynamic berhasil!",
        description:
          body.amount != null
            ? `${formatRupiah(body.amount)} telah dipotong dari saldo.`
            : "Akun berhasil diperpanjang dari NadiaVPN.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Renew dynamic gagal",
        description: err instanceof Error ? err.message : "Gagal renew dynamic",
        variant: "destructive",
      });
    },
  });

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const parsedDuration = parseInt(duration, 10);
      const res = await fetch(`${API}/accounts/${accountId}/renew-dynamic/quote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationType, duration: parsedDuration }),
      });
      const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
      if (!res.ok) throw new Error(body?.error ?? "Gagal menghitung harga renew");
      return body as {
        amount: number;
        baseAmount: number;
        resellerDiscountAmount: number;
        unitPrice: number;
        durationLabel: string;
      };
    },
  });

  const parsedDuration = parseInt(duration, 10);
  const isValidDuration = Number.isInteger(parsedDuration) && parsedDuration > 0;
  const quote = quoteMutation.data;
  const quoteError = quoteMutation.error instanceof Error ? quoteMutation.error.message : null;

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (val) {
      quoteMutation.mutate();
      return;
    }
    setDurationType(defaultDurationType);
    setDuration("1");
    setRenewedAmount(null);
    renewMutation.reset();
    quoteMutation.reset();
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
          <DialogTitle>Perpanjang Akun Dynamic</DialogTitle>
          <DialogDescription>
            Pilih durasi perpanjangan akun. Pastikan nominal pembayaran sudah sesuai sebelum
            konfirmasi renew.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30 text-sm">
          <span className="text-2xl leading-none">{serverFlag}</span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{serverName}</div>
            <div className="text-xs text-muted-foreground">
              {serverLocation} &bull; {protocol.toUpperCase()} &bull; NadiaVPN
            </div>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            Dynamic
          </Badge>
        </div>

        {renewedAmount != null ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">Renew Berhasil!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Saldo terpotong {formatRupiah(renewedAmount)} dan detail akun sudah disinkronkan
                ulang.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Tutup
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipe Durasi</Label>
                <select
                  value={durationType}
                  onChange={(e) => {
                    if (!isDynamicDurationType(e.target.value)) return;
                    setDurationType(e.target.value);
                    if (e.target.value === "week") setDuration("1");
                    quoteMutation.reset();
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {supportedTypes.map((type) => (
                    <option key={type} value={type}>
                      {dynamicDurationOptionLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  disabled={durationType === "week"}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    quoteMutation.reset();
                  }}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Detail Pembayaran</div>
                  <div className="text-xs text-muted-foreground">
                    Cek nominal sebelum konfirmasi renew.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => quoteMutation.mutate()}
                  disabled={
                    !isValidDuration || quoteMutation.isPending || renewMutation.isPending
                  }
                  className="shrink-0 gap-2"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${quoteMutation.isPending ? "animate-spin" : ""}`}
                  />
                  Cek Harga
                </Button>
              </div>

              {quoteMutation.isPending ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              ) : quote ? (
                <div className="space-y-2 rounded-md border bg-background/60 p-3">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Durasi</span>
                    <span className="font-medium">{quote.durationLabel}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Harga satuan</span>
                    <span className="font-medium">{formatRupiah(quote.unitPrice)}</span>
                  </div>
                  {quote.resellerDiscountAmount > 0 && (
                    <div className="flex justify-between gap-3 text-green-500">
                      <span>Diskon reseller</span>
                      <span>-{formatRupiah(quote.resellerDiscountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between gap-3 text-base font-bold">
                    <span>Total bayar</span>
                    <span className="text-primary">{formatRupiah(quote.amount)}</span>
                  </div>
                </div>
              ) : quoteError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{quoteError}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Klik Cek Harga untuk melihat total bayar.</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Batal
              </Button>
              <Button
                onClick={() => renewMutation.mutate()}
                disabled={
                  !isValidDuration || !quote || quoteMutation.isPending || renewMutation.isPending
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

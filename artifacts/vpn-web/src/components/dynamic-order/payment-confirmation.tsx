import { Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DynamicServer, Quote } from "./types";
import type { CheckoutRequirement } from "@/lib/dynamic-order-policy";
import { Link } from "wouter";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type PaymentConfirmationProps = {
  readonly server: DynamicServer;
  readonly protocol: string;
  readonly quote: Quote | null;
  readonly username: string;
  readonly balance: number;
  readonly isSubmitting: boolean;
  readonly unmetRequirements: readonly CheckoutRequirement[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export function PaymentConfirmation({
  server,
  protocol,
  quote,
  username,
  balance,
  isSubmitting,
  unmetRequirements,
  onConfirm,
  onCancel,
}: PaymentConfirmationProps) {
  const isBalanceInsufficient = quote && balance < quote.amount;
  const canConfirm = unmetRequirements.length === 0 && !isSubmitting && !isBalanceInsufficient;

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-lg border bg-muted/30 divide-y text-sm">
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Server</span>
          <span className="font-semibold">{server.displayName}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Jenis VPN</span>
          <span className="font-semibold">{protocol.toUpperCase()}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Durasi</span>
          <span className="font-semibold">{quote?.durationLabel}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Username</span>
          <span className="font-semibold font-mono">{username}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Saldo saat ini</span>
          <span className="font-medium">{formatRupiah(balance)}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5 bg-primary/5">
          <span className="font-semibold">Total</span>
          <span className="font-bold text-primary">{quote ? formatRupiah(quote.amount) : "-"}</span>
        </div>
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-muted-foreground">Sisa saldo</span>
          <span className={isBalanceInsufficient ? "text-destructive font-semibold" : "text-green-600"}>
            {quote ? formatRupiah(Math.max(0, balance - quote.amount)) : "-"}
          </span>
        </div>
      </div>

      {isBalanceInsufficient && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          Saldo tidak cukup. Kamu butuh {formatRupiah(quote.amount - balance)} lagi.
          <Link href="/balance" className="font-semibold underline block mt-1">
            Top up sekarang →
          </Link>
        </div>
      )}

      <div className="bg-muted/30 p-3 rounded-md border border-white/5 space-y-2">
        <p className="text-xs text-muted-foreground">
          Proses pembayaran biasanya membutuhkan beberapa detik. Mohon tunggu dan jangan membuat order duplikat.
        </p>
        <p className="text-xs text-muted-foreground">
          Jika pembayaran tertunda lebih dari 1 menit, cek halaman Riwayat Order atau hubungi bantuan.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Batal
        </Button>
        <Button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="flex-1 gap-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Konfirmasi & Bayar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

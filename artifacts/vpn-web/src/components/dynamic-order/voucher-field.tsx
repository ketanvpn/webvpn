import { CheckCircle2, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Quote } from "./types";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type VoucherFieldProps = {
  readonly voucherInput: string;
  readonly onVoucherInputChange: (value: string) => void;
  readonly appliedVoucher: string;
  readonly voucherError: string;
  readonly onApplyVoucher: () => void;
  readonly onRemoveVoucher: () => void;
  readonly isFetchingQuote: boolean;
  readonly quote: Quote | null;
};

export function VoucherField(props: VoucherFieldProps) {
  const { voucherInput, onVoucherInputChange, appliedVoucher, voucherError, onApplyVoucher, onRemoveVoucher, isFetchingQuote, quote } = props;

  return (
    <div className="space-y-2">
      <Label htmlFor="voucher" className="flex items-center gap-1.5">
        <Tag className="h-3.5 w-3.5 text-primary" /> Kode Voucher / Promo <span className="text-muted-foreground">(Opsional)</span>
      </Label>
      {appliedVoucher ? (
        <div className="flex items-center justify-between rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span className="font-mono font-semibold text-green-600">{appliedVoucher}</span>
            {quote?.voucherDiscountAmount ? <span className="text-muted-foreground">— hemat {formatRupiah(quote.voucherDiscountAmount)}</span> : null}
          </div>
          <button onClick={onRemoveVoucher} className="text-muted-foreground hover:text-destructive transition-colors ml-2" aria-label="Hapus voucher">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            id="voucher"
            placeholder="Masukkan kode voucher"
            value={voucherInput}
            onChange={(e) => onVoucherInputChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onApplyVoucher()}
            className="font-mono uppercase"
            aria-invalid={!!voucherError}
            aria-describedby={voucherError ? "voucher-error" : undefined}
          />
          <Button variant="outline" onClick={onApplyVoucher} disabled={!voucherInput.trim() || isFetchingQuote} className="shrink-0">
            {isFetchingQuote ? "..." : "Terapkan"}
          </Button>
        </div>
      )}
      {voucherError && <p id="voucher-error" className="text-xs text-destructive" role="alert">{voucherError}</p>}
    </div>
  );
}

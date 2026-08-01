import type { Quote } from "./types";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

type QuoteSummaryProps = {
  readonly quote: Quote | null;
  readonly protocol: string;
};

export function QuoteSummary({ quote, protocol }: QuoteSummaryProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-muted-foreground">{protocol ? protocol.toUpperCase() : "-"} • {quote?.durationLabel ?? "-"}</p>
          <p className="text-xs text-muted-foreground">Harga satuan: {quote ? formatRupiah(quote.unitPrice) : "-"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Total</p>
          <p className="text-2xl font-black text-primary">{quote ? formatRupiah(quote.amount) : "Rp 0"}</p>
        </div>
      </div>
      {quote && (
        <div className="rounded-lg bg-background/60 border border-white/10 p-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Harga dasar</span><span>{formatRupiah(quote.baseAmount)}</span></div>
          {quote.resellerDiscountAmount > 0 && <div className="flex justify-between text-green-600"><span>Diskon reseller</span><span>- {formatRupiah(quote.resellerDiscountAmount)}</span></div>}
          {quote.voucherDiscountAmount > 0 && <div className="flex justify-between text-green-600"><span>Diskon voucher</span><span>- {formatRupiah(quote.voucherDiscountAmount)}</span></div>}
          <div className="flex justify-between pt-2 border-t font-semibold"><span>Total bayar</span><span>{formatRupiah(quote.amount)}</span></div>
        </div>
      )}
    </div>
  );
}

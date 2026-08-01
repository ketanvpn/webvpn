import { CheckCircle2, XCircle } from "lucide-react";
import type { CheckoutRequirement } from "@/lib/dynamic-order-policy";

type CheckoutRequirementsProps = {
  readonly requirements: readonly CheckoutRequirement[];
  readonly className?: string;
};

export function CheckoutRequirements({ requirements, className = "" }: CheckoutRequirementsProps) {
  const count = requirements.length;
  const isReady = count === 0;

  return (
    <div
      className={`rounded-lg border ${isReady ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-background/60"} p-3 space-y-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Syarat Checkout</h3>
        <span className="text-xs text-muted-foreground">
          {isReady ? "Semua syarat terpenuhi" : `${count} syarat belum terpenuhi`}
        </span>
      </div>
      
      {isReady ? (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>Siap untuk checkout</span>
        </div>
      ) : (
        <ul className="space-y-1.5" role="list">
          {requirements.map((req, idx) => (
            <li key={`${req.type}-${idx}`} className="flex items-start gap-2 text-xs">
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-muted-foreground">{req.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

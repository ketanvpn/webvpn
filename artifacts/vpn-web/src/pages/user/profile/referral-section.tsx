import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gift, Copy, Check } from "lucide-react";

interface ReferralSectionProps {
  referralCode: string;
  copiedCode: boolean;
  onCopyReferralCode: () => void;
}

export function ReferralSection({
  referralCode,
  copiedCode,
  onCopyReferralCode,
}: ReferralSectionProps) {
  return (
    <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Program Referral</p>
            <p className="text-xs text-muted-foreground">
              Ajak teman, dapat bonus saldo otomatis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-background rounded-xl border px-4 py-3 shadow-sm">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Kode kamu</p>
            <p className="text-lg font-mono font-bold tracking-[0.2em] text-primary">
              {referralCode}
            </p>
          </div>
          <Button
            size="sm"
            variant={copiedCode ? "default" : "outline"}
            className="gap-1.5 shrink-0"
            onClick={onCopyReferralCode}
          >
            {copiedCode ? (
              <>
                <Check className="h-3.5 w-3.5" /> Tersalin!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Salin
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Bonus masuk otomatis saat temanmu beli produk pertama.
        </p>
      </div>
    </Card>
  );
}

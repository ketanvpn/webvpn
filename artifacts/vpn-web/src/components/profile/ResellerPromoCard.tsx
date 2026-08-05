import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import type { PromoData } from "@/lib/types/profile";
import { Zap, Sparkles, CheckCircle2, Info } from "lucide-react";

type Props = {
  promo: PromoData;
  onRequest: () => void;
  requesting: boolean;
  requested: boolean;
  onNavigateTopup: () => void;
};

export function ResellerPromoCard({ promo, onRequest, requesting, requested, onNavigateTopup }: Props) {
  const isAuto = promo.autoUpgradeEnabled;
  const benefits = [
    `Harga beli VPN lebih murah — diskon ${promo.discountPercent}% dari harga normal`,
    "Bebas jual ke siapa saja dengan harga markup sendiri",
    "Keuntungan 100% masuk ke kantong kamu",
  ];

  return (
    <Card
      className={`overflow-hidden border shadow-sm relative ${
        isAuto
          ? "bg-gradient-to-br from-green-50 to-emerald-50/30 dark:from-green-950/20 border-green-200 dark:border-green-900"
          : "bg-gradient-to-br from-primary/8 to-primary/3"
      }`}
    >
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-50 ${isAuto ? "bg-green-200 dark:bg-green-900/40" : "bg-primary/20"}`} />

      <div className="relative px-5 pt-4 pb-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              isAuto ? "bg-green-100 dark:bg-green-900/50" : "bg-primary/15"
            }`}
          >
            {isAuto ? <Zap className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Sparkles className="h-4 w-4 text-primary" />}
          </div>
          <p className="font-bold text-sm">{promo.promoTitle}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isAuto ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"}`}>
            Hemat {promo.discountPercent}%
          </span>
        </div>

        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${isAuto ? "text-green-700 dark:text-green-400" : "text-primary"}`}>
            Yang kamu dapat
          </p>
          <ul className="space-y-1">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${isAuto ? "text-green-500" : "text-primary/70"}`} />
                <span className="text-xs text-muted-foreground">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 mb-1.5">Syarat</p>
          <ul className="space-y-1">
            <li className="flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
              {isAuto ? (
                <span className="text-xs text-muted-foreground">
                  Topup minimal <span className="font-semibold text-foreground">{formatRupiah(promo.autoUpgradeMinTopup)}</span> — langsung otomatis aktif sebagai reseller
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Ajukan permintaan ke admin untuk diaktifkan</span>
              )}
            </li>
            {promo.targetEnabled && (
              <li className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-500" />
                <span className="text-xs text-muted-foreground">
                  Wajib jual minimal <span className="font-semibold text-foreground">{formatRupiah(promo.monthlyTarget)}</span> per bulan untuk tetap aktif
                </span>
              </li>
            )}
          </ul>
        </div>

        {isAuto ? (
          <Button size="sm" className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white min-h-11" onClick={onNavigateTopup}>
            <Zap className="h-3.5 w-3.5" /> Topup Sekarang →
          </Button>
        ) : requested ? (
          <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            Permintaan terkirim! Admin akan segera menghubungi kamu.
          </div>
        ) : promo.requestEnabled ? (
          <Button onClick={onRequest} disabled={requesting} size="sm" className="w-full gap-2 min-h-11">
            {requesting ? "Mengirim..." : "Ajukan Jadi Reseller →"}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Hubungi admin untuk bergabung sebagai reseller.</p>
        )}
      </div>
    </Card>
  );
}

export function ResellerPromoDisabledCard() {
  return (
    <Card className="overflow-hidden border shadow-sm bg-muted/30">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm text-muted-foreground">Program Reseller</p>
            <p className="text-xs text-muted-foreground">Saat ini program reseller sedang tidak aktif.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

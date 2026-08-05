import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check, Share2, MessageCircle, QrCode as QrIcon } from "lucide-react";
import { useCopyFeedback } from "@/hooks/profile/use-copy-feedback";
import type { ReferralStatus } from "@/lib/types/profile";
import { SimpleQrBox } from "./QrCode";

type Props = {
  referralCode: string;
  status: ReferralStatus | null | undefined;
};

export function ReferralCard({ referralCode, status }: Props) {
  const { copied, copy } = useCopyFeedback(2000);
  const [showQr, setShowQr] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareLink = `${origin}/register?ref=${encodeURIComponent(referralCode)}`;
  const shareText = `Gunakan kode referral aku: ${referralCode} daftar di ${shareLink} dapat bonus!`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const onShareNative = async () => {
    const text = shareText;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Kode Referral", text, url: shareLink });
        return;
      } catch {
        /* user cancelled */
      }
    }
    window.open(waHref, "_blank", "noopener,noreferrer");
  };

  const isDisabled = status ? !status.referralEnabled : false;

  return (
    <Card className="overflow-hidden border shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Gift className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Program Referral</p>
            <p className="text-xs text-muted-foreground truncate">Ajak teman, dapat bonus saldo otomatis</p>
          </div>
          {status && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                status.referralEnabled
                  ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20"
                  : "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:border-yellow-500/20"
              }`}
            >
              {status.referralEnabled ? "Aktif" : "Nonaktif"}
            </span>
          )}
        </div>

        {isDisabled ? (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 px-4 py-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-300">Program referral sedang tidak aktif. Bonus belum bisa diklaim untuk saat ini.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-background rounded-xl border px-4 py-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Kode kamu</p>
                <p className="text-lg font-mono font-bold tracking-widest text-primary break-all">{referralCode}</p>
              </div>
              <Button
                size="sm"
                variant={copied ? "default" : "outline"}
                className="gap-1.5 shrink-0 min-h-11"
                onClick={() => copy(referralCode)}
                aria-label="Salin kode referral"
                aria-live="polite"
              >
                {copied ? (
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

            {showQr && (
              <div className="mt-3 flex justify-center">
                <SimpleQrBox value={referralCode} size={160} />
              </div>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 min-h-11" onClick={() => setShowQr((v) => !v)}>
                <QrIcon className="h-4 w-4" /> {showQr ? "Tutup QR" : "QR"}
              </Button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="block">
                <Button variant="outline" size="sm" className="w-full gap-1.5 min-h-11">
                  <MessageCircle className="h-4 w-4" /> WA
                </Button>
              </a>
              <Button variant="outline" size="sm" className="gap-1.5 min-h-11" onClick={onShareNative}>
                <Share2 className="h-4 w-4" /> Bagikan
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Bonus masuk otomatis saat temanmu beli produk pertama. Scan QR untuk langsung buka link referral <span className="font-mono">{shareLink}</span>
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

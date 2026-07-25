import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, CheckCircle, ExternalLink } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";

interface TelegramNotifSectionProps {
  telegramId: number | null;
  telegramLink: string | null;
  isFetchingLink: boolean;
  onGetTelegramLink: () => void;
  onUnlinkTelegram: () => void;
  onResetTelegramLink: () => void;
  unlinkTelegramMutation: UseMutationResult<unknown, unknown, unknown, unknown>;
}

export function TelegramNotifSection({
  telegramId,
  telegramLink,
  isFetchingLink,
  onGetTelegramLink,
  onUnlinkTelegram,
  onResetTelegramLink,
  unlinkTelegramMutation,
}: TelegramNotifSectionProps) {
  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-sm">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
            <Send className="h-4 w-4 text-sky-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Notifikasi Telegram</p>
            <p className="text-xs text-muted-foreground">Terima notifikasi order & topup</p>
          </div>
          {telegramId && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Terhubung
            </span>
          )}
        </div>

        {telegramId ? (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 flex items-center justify-between">
            <p className="text-xs text-green-700">ID: {telegramId}</p>
            <button
              onClick={onUnlinkTelegram}
              disabled={unlinkTelegramMutation.isPending}
              className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
            >
              {unlinkTelegramMutation.isPending ? "Memutus..." : "Putus koneksi"}
            </button>
          </div>
        ) : !telegramLink ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onGetTelegramLink}
            disabled={isFetchingLink}
            className="gap-2 w-full"
          >
            <Send className="h-4 w-4" />
            {isFetchingLink ? "Membuat link..." : "Hubungkan Telegram"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Klik link berikut untuk menghubungkan akun Telegram:
            </p>
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 rounded-lg px-3 py-2 border border-primary/20"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{telegramLink}</span>
            </a>
            <p className="text-xs text-muted-foreground">Link hanya berlaku sekali.</p>
            <button
              onClick={onResetTelegramLink}
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              Buat link baru
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

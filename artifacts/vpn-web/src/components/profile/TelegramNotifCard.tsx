import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useGetTelegramLink, useUnlinkTelegram, getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { Send, CheckCircle, ExternalLink } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function TelegramNotifCard({ user }: { user: User }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [link, setLink] = useState<string | null>(null);
  const unlink = useUnlinkTelegram();

  const { refetch: fetchLink, isFetching } = useGetTelegramLink({
    query: { enabled: false } as never,
  });

  const handleGetLink = async () => {
    const result = await fetchLink();
    const data = result.data as { url?: string; token?: string } | undefined;
    if (data?.url) {
      setLink(data.url);
    } else if (data?.token) {
      toast({ title: "Token dibuat", description: "Gunakan link dari pengaturan admin bot untuk menghubungkan." });
    } else {
      toast({ title: "Gagal membuat link", description: "Coba lagi nanti.", variant: "destructive" });
    }
  };

  const handleUnlink = () => {
    unlink.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Telegram berhasil diputus" });
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLink(null);
      },
      onError: () => toast({ title: "Gagal memutus Telegram", variant: "destructive" }),
    });
  };

  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-sm">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-sky-100 dark:bg-sky-500/15 flex items-center justify-center shrink-0">
            <Send className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Notifikasi Telegram</p>
            <p className="text-xs text-muted-foreground">Terima notifikasi order & topup otomatis</p>
          </div>
          {user.telegramId ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Terhubung
            </span>
          ) : null}
        </div>

        {user.telegramId ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-3 py-2.5 flex items-center justify-between">
            <p className="text-xs text-green-700 dark:text-green-300">ID: {user.telegramId}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={unlink.isPending}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 min-h-8 px-2"
                >
                  {unlink.isPending ? "Memutus..." : "Putus koneksi"}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Putus Notifikasi Telegram?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Kamu tidak akan menerima notifikasi order, topup, dan akun hampir habis via Telegram. Bisa dihubungkan lagi kapan saja.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlink} className="bg-red-600 hover:bg-red-700">
                    Ya, putuskan
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : !link ? (
          <Button variant="outline" size="sm" onClick={handleGetLink} disabled={isFetching} className="gap-2 w-full min-h-11">
            <Send className="h-4 w-4" />
            {isFetching ? "Membuat link..." : "Hubungkan Telegram"}
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Klik link berikut untuk menghubungkan Telegram:</p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline bg-primary/5 rounded-lg px-3 py-2 border border-primary/20 break-all"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="break-all">{link}</span>
            </a>
            <p className="text-xs text-muted-foreground">Link hanya berlaku sekali dan 30 menit.</p>
            <button
              type="button"
              onClick={() => setLink(null)}
              className="text-xs text-muted-foreground hover:text-primary underline min-h-8"
            >
              Buat link baru
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

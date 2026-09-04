import { getApiError } from "@/lib/utils";
import {
  useAdminListTopups,
  useAdminConfirmTopup,
  useAdminRejectTopup,
  getAdminListTopupsQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah, safeFormatDate } from "@/lib/format";
import { CreditCard, Check, X, CheckCircle, XCircle, Clock, QrCode, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminListTopupsStatus } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending:   { label: "Menunggu",   class: "bg-yellow-500/10 text-yellow-600 border-yellow-200", icon: Clock },
  confirmed: { label: "Dikonfirmasi", class: "bg-green-500/10 text-green-600 border-green-200",   icon: CheckCircle },
  rejected:  { label: "Ditolak",    class: "bg-red-500/10 text-red-600 border-red-200",           icon: XCircle },
};

export default function AdminTopups() {
  const [status, setStatus] = useState<string>("pending");
  const [rejectDialogId, setRejectDialogId] = useState<number | null>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [qrisPreviewUrl, setQrisPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryParams = { status: status === "all" ? undefined : (status as AdminListTopupsStatus) };
  const { data, isLoading } = useAdminListTopups(
    queryParams,
    { query: { queryKey: getAdminListTopupsQueryKey(queryParams), refetchInterval: 30_000 } }
  );

  const confirmTopup = useAdminConfirmTopup();
  const rejectTopup = useAdminRejectTopup();

  const handleConfirm = (id: number) => {
    confirmTopup.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Topup dikonfirmasi" });
          queryClient.invalidateQueries({ queryKey: getAdminListTopupsQueryKey() });
        },
        onError: (err) =>
          toast({ title: "Gagal konfirmasi", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const openRejectDialog = (id: number) => {
    setRejectDialogId(id);
    setRejectionNote("");
  };

  const handleReject = () => {
    if (!rejectDialogId) return;
    rejectTopup.mutate(
      { id: rejectDialogId, data: { rejectionNote: rejectionNote.trim() || null } },
      {
        onSuccess: () => {
          toast({ title: "Topup ditolak" });
          queryClient.invalidateQueries({ queryKey: getAdminListTopupsQueryKey() });
          setRejectDialogId(null);
        },
        onError: (err) =>
          toast({ title: "Gagal tolak", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  const handleExport = () => {
    window.open("/api/admin/export/topups", "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topup Saldo</h1>
          <p className="text-muted-foreground mt-1">Tinjau dan proses permintaan deposit user.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 shrink-0">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-topup-pending">
            <Clock className="h-4 w-4 mr-1.5" /> Menunggu
          </TabsTrigger>
          <TabsTrigger value="confirmed" data-testid="tab-topup-confirmed">
            <CheckCircle className="h-4 w-4 mr-1.5" /> Dikonfirmasi
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-topup-rejected">
            <XCircle className="h-4 w-4 mr-1.5" /> Ditolak
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-topup-all">Semua</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="glass-panel border-white/5">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Permintaan Deposit
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : data && data.length > 0 ? (
            <div className="divide-y divide-white/5">
              {data.map((topup) => {
                const cfg = statusConfig[topup.status] ?? statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <div
                    key={topup.id}
                    className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                    data-testid={`row-topup-${topup.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full ${topup.status === "confirmed" ? "bg-green-100 text-green-600" : topup.status === "rejected" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {topup.username ?? `User #${topup.userId}`}
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${cfg.class}`}
                          >
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {safeFormatDate(topup.createdAt, "d MMM yyyy HH:mm")}
                        </div>
                        {topup.status === "rejected" && topup.rejectionNote && (
                          <div className="text-xs text-red-600/80 mt-1 italic">
                            Alasan: {topup.rejectionNote}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:justify-end flex-wrap">
                      <div className="font-bold text-xl text-primary">
                        {formatRupiah(topup.payableAmount ?? topup.amount)}
                      </div>
                      {topup.status === "pending" && (
                        <div className="flex gap-2 flex-wrap">
                          {topup.qrisUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => setQrisPreviewUrl(topup.qrisUrl ?? null)}
                            >
                              <QrCode className="h-4 w-4" /> Lihat QRIS
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleConfirm(topup.id)}
                            disabled={confirmTopup.isPending}
                            data-testid={`button-confirm-topup-${topup.id}`}
                          >
                            <Check className="h-4 w-4" /> Konfirmasi
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => openRejectDialog(topup.id)}
                            data-testid={`button-reject-topup-${topup.id}`}
                          >
                            <X className="h-4 w-4" /> Tolak
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              Tidak ada permintaan topup {status !== "all" ? `berstatus "${statusConfig[status]?.label ?? status}"` : ""}.
            </div>
          )}
        </CardContent>
      </Card>

      {/* QRIS Preview Dialog */}
      <Dialog open={!!qrisPreviewUrl} onOpenChange={(open) => { if (!open) setQrisPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>QRIS Topup</DialogTitle>
            <DialogDescription>QR code yang digunakan user untuk pembayaran.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4 bg-white rounded-lg my-2">
            {qrisPreviewUrl && (
              <img
                src={qrisPreviewUrl}
                alt="QRIS"
                className="max-w-full h-auto max-h-64 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=qris_invalid";
                }}
              />
            )}
          </div>
          <Button variant="outline" onClick={() => setQrisPreviewUrl(null)}>Tutup</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogId !== null} onOpenChange={(open) => { if (!open) setRejectDialogId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Permintaan Topup</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="reject-note">Alasan penolakan (opsional)</Label>
            <Textarea
              id="reject-note"
              placeholder="Contoh: Bukti pembayaran tidak valid, nominal tidak sesuai..."
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              rows={3}
              maxLength={200}
              data-testid="input-rejection-note"
            />
            <p className="text-xs text-muted-foreground">{rejectionNote.length}/200 karakter</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogId(null)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectTopup.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectTopup.isPending ? "Menolak..." : "Tolak Topup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useLocation, Link } from "wouter";
import { Info } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDynamicOrderCheckout } from "@/hooks/use-dynamic-order-checkout";
import { OrderForm, PaymentConfirmation, ServerList, SuccessBanner } from "@/components/dynamic-order";

export default function DynamicOrderPage() {
  const { state, actions, data } = useDynamicOrderCheckout();
  const [, setLocation] = useLocation();
  const d = data as any;

  return (
    <div className="w-full min-w-0 space-y-4 pb-8 overflow-hidden px-1 sm:px-0">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words">Order VPN</h1>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">
          Pilih server premium, lalu atur jenis VPN dan durasi sesuai kebutuhanmu.
        </p>
      </div>

      <SuccessBanner paidOrderId={state.paidOrderId} />

      {d.paketKind && (
        <Card className={`w-full min-w-0 overflow-hidden border ${d.paketKind === "cloudfront" ? "border-violet-500/30 bg-violet-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
          <CardContent className="py-3 flex w-full min-w-0 flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm overflow-hidden">
            <div className="flex min-w-0 flex-1 items-start gap-2 overflow-hidden">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="font-semibold break-words text-sm">{d.paketKind === "cloudfront" ? `Kamu memilih ${d.presetSlug ?? "Ilmupedia"} - butuh SSH CloudFront` : `Kamu memilih ${d.presetSlug ?? "GameMax"} - SSH Biasa`}</p>
                <p className="text-xs text-muted-foreground mt-0.5 break-words">{d.paketKind === "cloudfront" ? "Pilih server dengan badge CLOUDFRONT seperti SSH CLOUDFRONT REGULER / PREMIUM. Sudah diurutkan di atas." : "Semua server bisa dipakai. SSH biasa cocok untuk GameMax."} {d.recommendedCount ? `Ditemukan ${d.recommendedCount} server ${d.paketKind}.` : ""}</p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none text-xs"><Link href="/converter">← Panduan</Link></Button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/order-vpn")} className="flex-1 sm:flex-none text-xs">Hapus Filter</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ServerList
        servers={data.servers}
        isLoading={data.serversLoading}
        onSelectServer={actions.openOrder}
      />

      <Dialog open={!!state.selectedServer} onOpenChange={(open) => !open && actions.closeOrder()}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-0">
          {state.selectedServer && (
            <OrderForm
              server={state.selectedServer}
              protocol={state.protocol}
              onProtocolChange={actions.setProtocol}
              durationType={state.durationType}
              onDurationTypeChange={(v) => {
                actions.setDurationType(v);
                if (v === "week") actions.setDuration("1");
              }}
              duration={state.duration}
              onDurationChange={actions.setDuration}
              username={state.username}
              onUsernameChange={actions.setUsername}
              password={state.password}
              onPasswordChange={actions.setPassword}
              voucherInput={state.voucherInput}
              onVoucherInputChange={actions.setVoucherInput}
              appliedVoucher={state.appliedVoucher}
              voucherError={state.voucherError}
              onApplyVoucher={actions.applyVoucher}
              onRemoveVoucher={actions.removeVoucher}
              quote={data.quote}
              isFetchingQuote={data.quoteFetching}
              balance={data.balance}
              isSubmitting={data.isSubmitting}
              onSubmit={actions.openPayConfirm}
              unmetRequirements={data.unmetRequirements}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={state.payConfirmOpen} onOpenChange={(open) => !open && actions.closePayConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pembelian</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {state.selectedServer && (
                <PaymentConfirmation
                  server={state.selectedServer}
                  protocol={state.protocol}
                  quote={data.quote}
                  username={state.username}
                  balance={data.balance}
                  isSubmitting={data.isSubmitting}
                  unmetRequirements={data.unmetRequirements}
                  onConfirm={actions.submitOrder}
                  onCancel={actions.closePayConfirm}
                />
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order VPN</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pilih server premium, lalu atur jenis VPN dan durasi sesuai kebutuhanmu.
        </p>
      </div>

      <SuccessBanner paidOrderId={state.paidOrderId} />

      {d.paketKind && (
        <Card className={`border ${d.paketKind === "cloudfront" ? "border-violet-500/30 bg-violet-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
          <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5" />
              <div>
                <p className="font-semibold">{d.paketKind === "cloudfront" ? `Kamu memilih ${d.presetSlug ?? "Ilmupedia"} - butuh SSH CloudFront` : `Kamu memilih ${d.presetSlug ?? "GameMax"} - SSH Biasa`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.paketKind === "cloudfront" ? "Pilih server dengan badge CLOUDFRONT seperti SSH CLOUDFRONT REGULER / PREMIUM. Sudah diurutkan di atas." : "Semua server bisa dipakai. SSH biasa cocok untuk GameMax."} {d.recommendedCount ? `Ditemukan ${d.recommendedCount} server ${d.paketKind}.` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild><Link href="/converter">← Panduan Inject</Link></Button>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/order-vpn")}>Hapus Filter</Button>
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

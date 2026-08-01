import { useLocation, Link } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDynamicOrderCheckout } from "@/hooks/use-dynamic-order-checkout";
import { OrderForm, PaymentConfirmation, ServerList, SuccessBanner } from "@/components/dynamic-order";

export default function DynamicOrderPage() {
  const { state, actions, data } = useDynamicOrderCheckout();

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Order VPN</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Pilih server premium, lalu atur jenis VPN dan durasi sesuai kebutuhanmu.
        </p>
      </div>

      <SuccessBanner paidOrderId={state.paidOrderId} />

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

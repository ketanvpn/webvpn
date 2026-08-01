import { useState } from "react";
import { Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DynamicServer, Quote } from "./types";
import type { CheckoutRequirement } from "@/lib/dynamic-order-policy";
import { CheckoutRequirements } from "./checkout-requirements";
import { OrderOptions } from "./order-options";
import { DurationField, UsernameField, PasswordField } from "./account-fields";
import { VoucherField } from "./voucher-field";
import { QuoteSummary } from "./quote-summary";
import type { DynamicDurationType } from "@/lib/dynamic-duration";
import { validateUsername } from "@/lib/dynamic-order-policy";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getLocationDisplay(location?: string | null): string {
  const loc = (location ?? "").toUpperCase();
  if (loc === "SG" || loc.includes("SINGAPORE") || loc.includes("SG-")) return "SG";
  if (loc === "ID" || loc.includes("INDONESIA") || loc.includes("ID-")) return "ID";
  return loc || "UNK";
}

type OrderFormProps = {
  readonly server: DynamicServer;
  readonly protocol: string;
  readonly onProtocolChange: (value: string) => void;
  readonly durationType: DynamicDurationType;
  readonly onDurationTypeChange: (value: DynamicDurationType) => void;
  readonly duration: string;
  readonly onDurationChange: (value: string) => void;
  readonly username: string;
  readonly onUsernameChange: (value: string) => void;
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly voucherInput: string;
  readonly onVoucherInputChange: (value: string) => void;
  readonly appliedVoucher: string;
  readonly voucherError: string;
  readonly onApplyVoucher: () => void;
  readonly onRemoveVoucher: () => void;
  readonly quote: Quote | null;
  readonly isFetchingQuote: boolean;
  readonly balance: number;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
  readonly unmetRequirements: readonly CheckoutRequirement[];
};

export function OrderForm(props: OrderFormProps) {
  const {
    server,
    protocol,
    onProtocolChange,
    durationType,
    onDurationTypeChange,
    duration,
    onDurationChange,
    username,
    onUsernameChange,
    password,
    onPasswordChange,
    voucherInput,
    onVoucherInputChange,
    appliedVoucher,
    voucherError,
    onApplyVoucher,
    onRemoveVoucher,
    quote,
    isFetchingQuote,
    balance,
    isSubmitting,
    onSubmit,
    unmetRequirements,
  } = props;

  const [showPassword, setShowPassword] = useState(false);
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const isUsernameValid = validateUsername(username);
  const usernameError = touchedUsername && !isUsernameValid;
  const passwordError = touchedPassword && protocol === "ssh" && password.length < 6;
  const canSubmit = unmetRequirements.length === 0 && !isSubmitting;

  return (
    <>
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/70 p-5">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="relative text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/90 flex items-center justify-center text-sm font-bold shadow-lg">
              {getLocationDisplay(server.location)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{server.displayName}</h2>
              <p className="text-sm text-muted-foreground">Atur detail akun VPN kamu.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <OrderOptions
          server={server}
          protocol={protocol}
          onProtocolChange={onProtocolChange}
          durationType={durationType}
          onDurationTypeChange={onDurationTypeChange}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <DurationField
            durationType={durationType}
            duration={duration}
            onDurationChange={onDurationChange}
            server={server}
          />
          <UsernameField
            username={username}
            onUsernameChange={(v) => { onUsernameChange(v); setTouchedUsername(true); }}
            usernameError={usernameError}
          />
        </div>

        {protocol === "ssh" && (
          <PasswordField
            password={password}
            onPasswordChange={(v) => { onPasswordChange(v); setTouchedPassword(true); }}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            passwordError={passwordError}
          />
        )}

        <VoucherField
          voucherInput={voucherInput}
          onVoucherInputChange={onVoucherInputChange}
          appliedVoucher={appliedVoucher}
          voucherError={voucherError}
          onApplyVoucher={onApplyVoucher}
          onRemoveVoucher={onRemoveVoucher}
          isFetchingQuote={isFetchingQuote}
          quote={quote}
        />

        <QuoteSummary quote={quote} protocol={protocol} />

        <CheckoutRequirements requirements={unmetRequirements} />

        <Button
          className="w-full gap-2"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Bayar Pakai Saldo
            </>
          )}
        </Button>
        
        {quote && balance < quote.amount && (
          <p className="text-xs text-destructive text-center">
            Saldo tidak cukup. Kurang {formatRupiah(quote.amount - balance)}.
          </p>
        )}
      </div>
    </>
  );
}

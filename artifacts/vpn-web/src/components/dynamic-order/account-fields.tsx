import { Eye, EyeOff, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DynamicDurationType } from "@/lib/dynamic-duration";
import { getDurationFieldLabel } from "@/lib/dynamic-order-policy";
import type { DynamicServer } from "./types";

type DurationFieldProps = {
  readonly durationType: DynamicDurationType;
  readonly duration: string;
  readonly onDurationChange: (value: string) => void;
  readonly server: DynamicServer;
};

export function DurationField({ durationType, duration, onDurationChange, server }: DurationFieldProps) {
  const helpText = durationType === "day"
    ? `Batas ${server.minDays}-${server.maxDays} hari`
    : durationType === "week"
      ? "Paket berlaku tepat 1 minggu"
      : `Batas ${server.minMonths}-${server.maxMonths} bulan`;

  return (
    <div className="grid gap-2">
      <Label htmlFor="duration">
        {getDurationFieldLabel(durationType)} <span className="text-destructive">(Wajib)</span>
      </Label>
      <Input
        id="duration"
        type="number"
        min={1}
        value={duration}
        disabled={durationType === "week"}
        onChange={(e) => onDurationChange(e.target.value)}
        aria-describedby="duration-help"
        aria-required="true"
        required
      />
      <p id="duration-help" className="text-xs text-muted-foreground">
        {helpText}
      </p>
    </div>
  );
}

type UsernameFieldProps = {
  readonly username: string;
  readonly onUsernameChange: (value: string) => void;
  readonly usernameError: boolean;
};

export function UsernameField({ username, onUsernameChange, usernameError }: UsernameFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="username">
        Username VPN <span className="text-destructive">(Wajib)</span>
      </Label>
      <div className="relative">
        <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="username"
          className={`pl-9 ${usernameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
          value={username}
          onChange={(e) => onUsernameChange(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
          placeholder="contoh: ketan123"
          aria-invalid={usernameError ? true : undefined}
          aria-describedby={usernameError ? "username-error" : "username-help"}
          aria-required="true"
          required
        />
      </div>
      <p
        id={usernameError ? "username-error" : "username-help"}
        className={`text-xs ${usernameError ? "text-destructive" : "text-muted-foreground"}`}
        role={usernameError ? "alert" : undefined}
      >
        Minimal 5 karakter dan minimal 2 angka.
      </p>
    </div>
  );
}

type PasswordFieldProps = {
  readonly password: string;
  readonly onPasswordChange: (value: string) => void;
  readonly showPassword: boolean;
  readonly onTogglePassword: () => void;
  readonly passwordError: boolean;
};

export function PasswordField({ password, onPasswordChange, showPassword, onTogglePassword, passwordError }: PasswordFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="password">
        Password SSH <span className="text-destructive">(Wajib)</span>
      </Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Minimal 6 karakter"
          className="pr-10"
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-error" : "password-help"}
          aria-required="true"
          required
        />
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p
        id={passwordError ? "password-error" : "password-help"}
        className={`text-xs ${passwordError ? "text-destructive" : "text-muted-foreground"}`}
        role={passwordError ? "alert" : undefined}
      >
        Wajib untuk akun SSH. Password akan disimpan agar user bisa melihatnya di Akun VPN.
      </p>
    </div>
  );
}

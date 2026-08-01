import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DynamicDurationType } from "@/lib/dynamic-duration";
import { dynamicDurationOptionLabel, isDynamicDurationType } from "@/lib/dynamic-duration";
import type { DynamicServer } from "./types";

type OrderOptionsProps = {
  readonly server: DynamicServer;
  readonly protocol: string;
  readonly onProtocolChange: (value: string) => void;
  readonly durationType: DynamicDurationType;
  readonly onDurationTypeChange: (value: DynamicDurationType) => void;
};

export function OrderOptions({ server, protocol, onProtocolChange, durationType, onDurationTypeChange }: OrderOptionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="protocol">
          Jenis VPN <span className="text-destructive">(Wajib)</span>
        </Label>
        <Select value={protocol} onValueChange={onProtocolChange}>
          <SelectTrigger id="protocol" aria-required="true">
            <SelectValue placeholder="Pilih jenis VPN" />
          </SelectTrigger>
          <SelectContent>
            {server.enabledProtocols.map((p) => (
              <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="durationType">
          Tipe Durasi <span className="text-destructive">(Wajib)</span>
        </Label>
        <Select value={durationType} onValueChange={(v) => isDynamicDurationType(v) && onDurationTypeChange(v)}>
          <SelectTrigger id="durationType" aria-required="true">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {server.supportedTypes.filter(isDynamicDurationType).map((type) => (
              <SelectItem key={type} value={type}>{dynamicDurationOptionLabel(type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

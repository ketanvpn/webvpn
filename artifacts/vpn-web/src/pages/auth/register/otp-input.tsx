import { useRef } from "react";
import { Input } from "@/components/ui/input";

interface OtpInputProps {
  otpInputs: string[];
  onOtpInput: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent) => void;
  onOtpPaste: (e: React.ClipboardEvent) => void;
}

export function OtpInput({
  otpInputs,
  onOtpInput,
  onOtpKeyDown,
  onOtpPaste,
}: OtpInputProps) {
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="flex gap-2 justify-center">
      {otpInputs.map((digit, idx) => (
        <Input
          key={idx}
          ref={(el) => (otpRefs.current[idx] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onOtpInput(idx, e.target.value)}
          onKeyDown={(e) => onOtpKeyDown(idx, e)}
          onPaste={idx === 0 ? onOtpPaste : undefined}
          className="h-12 w-12 text-center text-lg font-bold"
        />
      ))}
    </div>
  );
}

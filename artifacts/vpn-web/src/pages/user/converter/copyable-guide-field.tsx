import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy } from "lucide-react";

type CopyableGuideFieldProps = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  multiline?: boolean;
  copied: boolean;
  onCopy: (id: string, value: string, label: string) => void;
};

export function CopyableGuideField({
  id,
  label,
  value,
  hint,
  multiline = false,
  copied,
  onCopy,
}: CopyableGuideFieldProps) {
  return (
    <div className={`min-w-0 space-y-2 ${multiline ? "sm:col-span-2" : ""}`}>
      <div>
        <Label>{label}</Label>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className={`flex min-w-0 gap-2 ${multiline ? "items-start" : "items-center"}`}>
        <pre
          className={`min-w-0 flex-1 select-all whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs leading-relaxed ${
            multiline ? "min-h-[112px]" : ""
          }`}
        >
          {value}
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 gap-2 px-3"
          aria-label={`Salin ${label}`}
          onClick={() => onCopy(id, value, label)}
        >
          {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Tersalin" : "Salin"}</span>
        </Button>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Copy,
  ShieldPlus,
  Smartphone,
} from "lucide-react";
import type { EasyInjectPreset } from "@/lib/darktunnel";
import type { EasyApp } from "./types";

export type CopyableGuideFieldProps = {
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
    <div className={`flex min-w-0 w-full flex-col space-y-2 overflow-hidden ${multiline ? "sm:col-span-2" : ""}`}>
      <div className="min-w-0">
        <Label className="break-words">{label}</Label>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground break-words">{hint}</p>}
      </div>
      <div className={`flex w-full min-w-0 gap-2 overflow-hidden ${multiline ? "flex-col sm:flex-row sm:items-start" : "flex-col sm:flex-row sm:items-center"}`}>
        <pre
          className={`min-w-0 w-full flex-1 select-all overflow-hidden whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] sm:text-xs leading-relaxed ${
            multiline ? "min-h-[112px] max-h-[200px] overflow-y-auto" : "max-h-[150px] overflow-y-auto"
          }`}
        >
          {value}
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-10 sm:h-11 w-full sm:w-auto shrink-0 gap-2 px-3"
          aria-label={`Salin ${label}`}
          onClick={() => onCopy(id, value, label)}
        >
          {copied ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
          <span className="text-xs sm:text-sm">{copied ? "Tersalin" : "Salin"}</span>
        </Button>
      </div>
    </div>
  );
}

export type EasyAppSelectorProps = {
  value: EasyApp | null;
  preset: EasyInjectPreset;
  onChange: (app: EasyApp) => void;
};

export function EasyAppSelector({ value, preset, onChange }: EasyAppSelectorProps) {
  const applications = [
    ...(preset.supportsDarkTunnel
      ? [{
          id: "darktunnel" as const,
          label: "DarkTunnel",
          description: "Otomatis: download file .dark atau import melalui link.",
          icon: ShieldPlus,
          iconClass: "text-emerald-300",
        }]
      : []),
    ...(preset.supportsHttpCustom
      ? [{
          id: "http-custom" as const,
          label: "HTTP Custom",
          description: "Panduan: salin data SSH, proxy, payload, dan SNI secara bertahap.",
          icon: Smartphone,
          iconClass: "text-cyan-300",
        }]
      : []),
  ];

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {applications.map((application) => {
        const Icon = application.icon;
        const active = value === application.id;
        return (
          <button
            key={application.id}
            type="button"
            onClick={() => onChange(application.id)}
            className={`flex min-h-[128px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border p-4 sm:p-5 text-left transition-all ${
              active
                ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                : "border-white/10 bg-background/40 hover:border-primary/40"
            }`}
          >
            <div className="flex w-full min-w-0 items-start justify-between gap-2">
              <Icon className={`h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${application.iconClass}`} />
              {application.id === "http-custom" && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200 shrink-0 text-[10px]">
                  Beta
                </Badge>
              )}
            </div>
            <div className="mt-3 text-sm sm:text-lg font-bold break-words min-w-0">{application.label}</div>
            <p className="mt-1 text-xs text-muted-foreground break-words line-clamp-3 min-w-0">
              {application.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

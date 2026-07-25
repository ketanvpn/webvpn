import { Badge } from "@/components/ui/badge";
import { ShieldPlus, Smartphone } from "lucide-react";
import type { EasyApp } from "./types";
import type { EasyInjectPreset } from "@/lib/darktunnel";

type EasyAppSelectorProps = {
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
    <div className="grid gap-3 sm:grid-cols-2">
      {applications.map((application) => {
        const Icon = application.icon;
        const active = value === application.id;
        return (
          <button
            key={application.id}
            type="button"
            onClick={() => onChange(application.id)}
            className={`min-h-[128px] rounded-2xl border p-5 text-left transition-all ${
              active
                ? "border-primary bg-primary/15 ring-2 ring-primary/30"
                : "border-white/10 bg-background/40 hover:border-primary/40"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <Icon className={`h-8 w-8 ${application.iconClass}`} />
              {application.id === "http-custom" && (
                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                  Beta
                </Badge>
              )}
            </div>
            <div className="mt-3 text-lg font-bold">{application.label}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {application.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

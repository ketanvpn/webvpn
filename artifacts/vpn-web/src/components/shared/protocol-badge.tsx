interface ProtocolBadgeProps {
  protocol: string;
  size?: "sm" | "default";
  className?: string;
}

const PROTOCOL_LABELS: Record<string, string> = {
  ssh: "SSH",
  vmess: "VMess",
  vless: "VLess",
  trojan: "Trojan",
  shadowsocks: "SS",
};

const PROTOCOL_COLORS: Record<string, string> = {
  ssh: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  vmess: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  vless: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trojan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  shadowsocks: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

export function ProtocolBadge({ protocol, size = "default", className = "" }: ProtocolBadgeProps) {
  const normalized = (protocol || "").toLowerCase();
  const label = PROTOCOL_LABELS[normalized] ?? protocol.toUpperCase();
  const color = PROTOCOL_COLORS[normalized] ?? "bg-muted/40 text-muted-foreground border-white/10";

  const sizeClasses = size === "sm"
    ? "text-[9px] px-1.5 py-0.5"
    : "text-[10px] px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-bold tracking-wider uppercase shadow-sm ${color} ${sizeClasses} ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * Export color map for cases where custom rendering is needed
 */
export { PROTOCOL_COLORS, PROTOCOL_LABELS };

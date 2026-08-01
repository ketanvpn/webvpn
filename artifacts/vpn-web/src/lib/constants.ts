/**
 * Constants untuk VPN Protocol types
 */

export const protocolLabel: Record<string, string> = {
  ssh: "SSH",
  vmess: "VMess",
  vless: "VLess",
  trojan: "Trojan",
  shadowsocks: "SS",
};

export const protocolColor: Record<string, string> = {
  ssh: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  vmess: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  vless: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  trojan: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  shadowsocks: "bg-pink-500/15 text-pink-400 border-pink-500/30",
};

export type ProtocolType = keyof typeof protocolLabel;

/**
 * Status badge styling untuk announcement/pengumuman
 */

export const ANNOUNCE_STYLE: Record<string, { icon: string; bg: string; border: string; iconColor: string }> = {
  info: { 
    icon: "Info", 
    bg: "bg-blue-500/10", 
    border: "border-blue-500/30", 
    iconColor: "text-blue-400" 
  },
  warning: { 
    icon: "AlertTriangle", 
    bg: "bg-yellow-500/10", 
    border: "border-yellow-500/30", 
    iconColor: "text-yellow-400" 
  },
  success: { 
    icon: "CheckCircle2", 
    bg: "bg-green-500/10", 
    border: "border-green-500/30", 
    iconColor: "text-green-400" 
  },
  error: { 
    icon: "AlertCircle", 
    bg: "bg-red-500/10", 
    border: "border-red-500/30", 
    iconColor: "text-red-400" 
  },
};

export type AnnouncementType = keyof typeof ANNOUNCE_STYLE;

/**
 * Status order untuk badges
 */

export const ORDER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Berhasil", variant: "default" },
  pending: { label: "Menunggu Diproses", variant: "secondary" },
  processing: { label: "Sedang Diproses", variant: "secondary" },
  failed: { label: "Gagal", variant: "destructive" },
  expired: { label: "Kedaluwarsa", variant: "destructive" },
};

export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS[status?.toLowerCase()]?.label ?? status;
}

export function getOrderStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  return ORDER_STATUS[status?.toLowerCase()]?.variant ?? "outline";
}

/**
 * Role colors for consistent styling across the app
 * user: blue, reseller: emerald (primary), admin: amber
 */

export const ROLE_COLORS: Record<string, { badge: string; icon: string; glow: string }> = {
  user: {
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: "text-blue-400",
    glow: "shadow-blue-500/20",
  },
  reseller: {
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: "text-emerald-400",
    glow: "shadow-emerald-500/20",
  },
  admin: {
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: "text-amber-400",
    glow: "shadow-amber-500/20",
  },
};

export type UserRole = keyof typeof ROLE_COLORS;

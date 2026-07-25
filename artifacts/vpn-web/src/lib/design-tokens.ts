/**
 * KETANTECH VPN Design Tokens
 * 
 * Centralized design system for consistent UI/UX across the application.
 * Based on "Sultan/Glassmorphism" theme with emerald accent.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Color Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const colors = {
  // Primary brand color (emerald)
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },

  // Status colors
  status: {
    success: {
      light: "bg-green-50 text-green-700 border-green-200",
      DEFAULT: "bg-green-100 text-green-700",
      dark: "bg-green-600 text-white",
    },
    warning: {
      light: "bg-amber-50 text-amber-800 border-amber-200",
      DEFAULT: "bg-amber-100 text-amber-800",
      dark: "bg-amber-600 text-white",
    },
    error: {
      light: "bg-red-50 text-red-700 border-red-200",
      DEFAULT: "bg-red-100 text-red-700",
      dark: "bg-red-600 text-white",
    },
    info: {
      light: "bg-blue-50 text-blue-800 border-blue-200",
      DEFAULT: "bg-blue-100 text-blue-700",
      dark: "bg-blue-600 text-white",
    },
  },

  // Account status badges
  accountStatus: {
    active: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    processing: "bg-blue-100 text-blue-700",
    failed: "bg-red-100 text-red-700",
    expired: "bg-gray-100 text-gray-600",
    inactive: "bg-gray-100 text-gray-600",
    suspended: "bg-red-100 text-red-700",
  },

  // Protocol badges
  protocol: {
    ssh: "bg-blue-100 text-blue-700",
    vmess: "bg-purple-100 text-purple-700",
    vless: "bg-indigo-100 text-indigo-700",
    trojan: "bg-red-100 text-red-700",
    shadowsocks: "bg-cyan-100 text-cyan-700",
  },

  // Role badges
  role: {
    user: "bg-blue-100 text-blue-700",
    reseller: "bg-purple-100 text-purple-700",
    admin: "bg-orange-100 text-orange-700",
  },

  // Glassmorphism background gradients
  glass: {
    primary: "bg-gradient-to-br from-primary/5 via-transparent to-transparent",
    blue: "bg-gradient-to-br from-blue-50/80 via-transparent to-transparent dark:from-blue-950/20",
    green: "bg-gradient-to-br from-green-50 to-emerald-50/30 dark:from-green-950/20",
    purple: "bg-gradient-to-br from-primary/8 to-primary/3",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Spacing Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const spacing = {
  // Card padding
  card: {
    sm: "px-4 py-3",
    DEFAULT: "px-5 py-4",
    lg: "px-6 py-5",
  },

  // Section spacing
  section: {
    sm: "space-y-2",
    DEFAULT: "space-y-4",
    lg: "space-y-6",
  },

  // Gap between elements
  gap: {
    xs: "gap-1",
    sm: "gap-2",
    DEFAULT: "gap-3",
    lg: "gap-4",
    xl: "gap-6",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Typography Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const typography = {
  // Heading styles
  heading: {
    h1: "text-2xl font-bold",
    h2: "text-xl font-bold",
    h3: "text-lg font-semibold",
    h4: "text-base font-semibold",
  },

  // Body text
  body: {
    sm: "text-xs",
    DEFAULT: "text-sm",
    lg: "text-base",
  },

  // Labels
  label: {
    sm: "text-xs font-medium",
    DEFAULT: "text-sm font-medium",
    lg: "text-base font-medium",
  },

  // Muted text
  muted: {
    sm: "text-xs text-muted-foreground",
    DEFAULT: "text-sm text-muted-foreground",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Border & Shadow Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const borders = {
  DEFAULT: "border",
  glass: "border border-white/5",
  light: "border border-border/50",
  strong: "border-2",
} as const;

export const shadows = {
  glass: "shadow-lg",
  card: "shadow-sm",
  DEFAULT: "shadow",
  none: "shadow-none",
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Component Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const components = {
  // Glass panel (common card style)
  glassPanel: "glass-panel border-white/5 overflow-hidden shadow-sm",

  // Icon container
  iconContainer: {
    sm: "h-8 w-8 rounded-full flex items-center justify-center",
    DEFAULT: "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
    lg: "h-12 w-12 rounded-full flex items-center justify-center",
  },

  // Avatar/Profile pic placeholder
  avatar: {
    sm: "h-8 w-8 rounded-full",
    DEFAULT: "h-10 w-10 rounded-full",
    lg: "h-16 w-16 rounded-2xl",
    xl: "h-20 w-20 rounded-2xl",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Animation Tokens
// ──────────────────────────────────────────────────────────────────────────────

export const animations = {
  transition: {
    fast: "transition-colors duration-150",
    DEFAULT: "transition-colors duration-200",
    slow: "transition-all duration-300",
  },

  hover: {
    scale: "hover:scale-105 transition-transform",
    brightness: "hover:brightness-110 transition-all",
    background: "hover:bg-muted/50 transition-colors",
  },
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get status badge classes based on status string
 */
export function getStatusBadge(status: string): string {
  const normalized = status.toLowerCase();
  
  if (normalized === "active" || normalized === "paid" || normalized === "success") {
    return colors.accountStatus.active;
  }
  if (normalized === "pending" || normalized === "waiting") {
    return colors.accountStatus.pending;
  }
  if (normalized === "processing") {
    return colors.accountStatus.processing;
  }
  if (normalized === "failed" || normalized === "error") {
    return colors.accountStatus.failed;
  }
  if (normalized === "expired") {
    return colors.accountStatus.expired;
  }
  if (normalized === "inactive" || normalized === "suspended") {
    return colors.accountStatus.suspended;
  }
  
  return colors.accountStatus.inactive;
}

/**
 * Get protocol badge classes
 */
export function getProtocolBadge(protocol: string): string {
  const normalized = protocol.toLowerCase();
  
  if (normalized === "ssh") return colors.protocol.ssh;
  if (normalized === "vmess") return colors.protocol.vmess;
  if (normalized === "vless") return colors.protocol.vless;
  if (normalized === "trojan") return colors.protocol.trojan;
  if (normalized === "shadowsocks") return colors.protocol.shadowsocks;
  
  return "bg-gray-100 text-gray-700";
}

/**
 * Get role badge classes
 */
export function getRoleBadge(role: string): string {
  const normalized = role.toLowerCase();
  
  if (normalized === "admin") return colors.role.admin;
  if (normalized === "reseller") return colors.role.reseller;
  if (normalized === "user") return colors.role.user;
  
  return "bg-muted text-muted-foreground";
}

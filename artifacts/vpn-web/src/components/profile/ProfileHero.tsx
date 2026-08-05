import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Edit2 } from "lucide-react";
import type { User } from "@workspace/api-client-react";

type Props = {
  user: User;
  onEdit: () => void;
  editMode: boolean;
};

const roleLabel: Record<string, string> = {
  user: "Pengguna",
  reseller: "Reseller",
  admin: "Admin",
};
const roleColor: Record<string, string> = {
  user: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30",
  reseller:
    "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30",
  admin:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30",
};

function getInitials(raw: string): string {
  const s = raw.trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

function getAvatarGradientStyle(seed: string): React.CSSProperties {
  const h = hashHue(seed);
  const h2 = (h + 38) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${h} 78% 60%) 0%, hsl(${h2} 72% 48%) 100%)`,
  };
}

export function ProfileHero({ user, onEdit, editMode }: Props) {
  const displayName = user.fullName?.trim() || user.username;
  const initials = getInitials(displayName);
  const gradientStyle = getAvatarGradientStyle(user.username + (user.id ? String(user.id) : ""));

  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-lg">
      <div className="h-24 bg-gradient-to-br from-primary to-primary/70 relative" />
      <CardContent className="px-5 pb-5 pt-0">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="relative">
            <Avatar className="h-20 w-20 rounded-2xl border-4 border-background shadow-xl text-white font-bold text-2xl ring-2 ring-white/20">
              <AvatarFallback
                className="rounded-2xl text-2xl font-bold text-white tracking-wide"
                style={gradientStyle}
              >
                <span className="drop-shadow-sm">{initials}</span>
              </AvatarFallback>
            </Avatar>
            {user.isActive && (
              <span
                className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background shadow-sm"
                aria-label="Status aktif"
              />
            )}
          </div>
          {!editMode && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 mb-1 min-h-9"
              onClick={onEdit}
              aria-label="Edit profil"
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>

        <div className="mb-1">
          <h2 className="text-xl font-bold leading-tight">{user.fullName || user.username}</h2>
          {user.fullName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleColor[user.role] ?? "bg-muted text-muted-foreground border"}`}
          >
            {roleLabel[user.role] ?? user.role}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
              user.isActive
                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/20"
                : "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
            }`}
          >
            {user.isActive ? "Aktif" : "Disuspend"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

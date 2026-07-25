import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCircle, Mail, Calendar, Edit2, Phone, LogOut, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { InfoRow } from "./info-row";
import { ProfileEditForm } from "./profile-edit-form";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { profileSchema } from "./schemas";

interface User {
  fullName: string | null;
  username: string;
  email: string | null;
  whatsapp: string | null;
  createdAt: string;
  role: string;
  isActive: boolean;
}

interface ProfileHeroCardProps {
  user: User;
  editMode: boolean;
  profileForm: UseFormReturn<z.infer<typeof profileSchema>>;
  isUpdating: boolean;
  onSaveProfile: (values: z.infer<typeof profileSchema>) => void;
  onToggleEditMode: () => void;
  onCancelEdit: () => void;
}

export function ProfileHeroCard({
  user,
  editMode,
  profileForm,
  isUpdating,
  onSaveProfile,
  onToggleEditMode,
  onCancelEdit,
}: ProfileHeroCardProps) {
  const initials = (user.fullName || user.username).slice(0, 2).toUpperCase();

  const roleLabel: Record<string, string> = {
    user: "Pengguna",
    reseller: "Reseller",
    admin: "Admin",
  };
  const roleColor: Record<string, string> = {
    user: "bg-blue-100 text-blue-700",
    reseller: "bg-purple-100 text-purple-700",
    admin: "bg-orange-100 text-orange-700",
  };

  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-lg">
      <div className="h-24 bg-gradient-to-br from-primary to-primary/70 relative" />

      <CardContent className="px-5 pb-5 pt-0">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="h-20 w-20 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center text-primary font-bold text-2xl select-none">
            {initials}
          </div>
          {!editMode && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 mb-1"
              onClick={onToggleEditMode}
            >
              <Edit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>

        <div className="mb-1">
          <h2 className="text-xl font-bold leading-tight">{user.fullName || user.username}</h2>
          {user.fullName && <p className="text-sm text-muted-foreground">@{user.username}</p>}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              roleColor[user.role] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {roleLabel[user.role] ?? user.role}
          </span>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
            }`}
          >
            {user.isActive ? "Aktif" : "Disuspend"}
          </span>
        </div>

        {editMode ? (
          <ProfileEditForm
            profileForm={profileForm}
            isUpdating={isUpdating}
            onSaveProfile={onSaveProfile}
            onCancel={onCancelEdit}
          />
        ) : (
          <div className="divide-y divide-border rounded-xl border bg-muted/20 overflow-hidden">
            <div className="px-4">
              <InfoRow icon={UserCircle} label="Username" value={`@${user.username}`} />
            </div>
            <div className="px-4">
              <InfoRow
                icon={Mail}
                label="Email"
                value={
                  user.email || (
                    <span className="text-muted-foreground italic text-sm">Belum diisi</span>
                  )
                }
              />
            </div>
            {user.whatsapp && (
              <div className="px-4">
                <InfoRow icon={Phone} label="No. WhatsApp" value={user.whatsapp} />
              </div>
            )}
            <div className="px-4">
              <InfoRow
                icon={Calendar}
                label="Bergabung"
                value={format(new Date(user.createdAt), "d MMMM yyyy")}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="md:hidden">
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-3 px-5 py-4 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
      >
        <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <LogOut className="h-4 w-4 text-red-500" />
        </div>
        <span className="font-semibold text-sm">Keluar dari Akun</span>
        <ChevronRight className="h-4 w-4 ml-auto" />
      </button>
    </div>
  );
}

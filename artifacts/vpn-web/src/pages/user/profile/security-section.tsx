import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Lock, ChevronRight, KeyRound, X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { passwordSchema } from "./schemas";

interface SecuritySectionProps {
  showPasswordForm: boolean;
  passwordForm: UseFormReturn<z.infer<typeof passwordSchema>>;
  isChangingPassword: boolean;
  onTogglePasswordForm: () => void;
  onChangePassword: (values: z.infer<typeof passwordSchema>) => void;
  onCancelPasswordForm: () => void;
}

export function SecuritySection({
  showPasswordForm,
  passwordForm,
  isChangingPassword,
  onTogglePasswordForm,
  onChangePassword,
  onCancelPasswordForm,
}: SecuritySectionProps) {
  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-sm">
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
          <Lock className="h-4 w-4 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Keamanan</p>
          <p className="text-xs text-muted-foreground">Kelola password akun</p>
        </div>
        {!showPasswordForm && (
          <button
            onClick={onTogglePasswordForm}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
      {showPasswordForm && (
        <>
          <Separator />
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> Ubah Password
              </p>
              <button
                onClick={onCancelPasswordForm}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-3">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Saat Ini</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 6 karakter" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Konfirmasi Password Baru</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Ulangi password baru" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={isChangingPassword}
                    className="flex-1"
                  >
                    {isChangingPassword ? "Mengubah..." : "Ubah Password"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onCancelPasswordForm}
                  >
                    Batal
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </>
      )}
    </Card>
  );
}

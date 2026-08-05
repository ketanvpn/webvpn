import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useChangePassword } from "@workspace/api-client-react";
import { getApiError } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Lock, ChevronRight, X, KeyRound, Eye, EyeOff } from "lucide-react";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Wajib diisi"),
    newPassword: z.string().min(6, "Minimal 6 karakter").max(128, "Terlalu panjang"),
    confirmPassword: z.string().min(1, "Wajib diisi"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export function SecurityCard() {
  const [open, setOpen] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();
  const changePassword = useChangePassword();

  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = (values: z.infer<typeof passwordSchema>) => {
    changePassword.mutate(
      { data: { currentPassword: values.currentPassword, newPassword: values.newPassword } },
      {
        onSuccess: () => {
          toast({ title: "Password berhasil diubah" });
          form.reset();
          setOpen(false);
        },
        onError: (err) =>
          toast({ title: "Gagal ubah password", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  return (
    <Card className="glass-panel border-white/5 overflow-hidden shadow-sm">
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center shrink-0">
          <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Keamanan</p>
          <p className="text-xs text-muted-foreground">Kelola password akun</p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-muted-foreground hover:text-primary transition-colors p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md"
            aria-label="Buka ubah password"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
      {open && (
        <>
          <Separator />
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> Ubah Password
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                }}
                className="text-muted-foreground hover:text-foreground p-2 min-h-11 min-w-11 flex items-center justify-center rounded-md"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Saat Ini</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showCurrent ? "text" : "password"} placeholder="••••••••" {...field} className="pr-10" />
                          <button
                            type="button"
                            onClick={() => setShowCurrent((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            aria-label={showCurrent ? "Sembunyikan password" : "Tampilkan password"}
                          >
                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Password Baru</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showNew ? "text" : "password"} placeholder="Min. 6 karakter" {...field} className="pr-10" />
                          <button
                            type="button"
                            onClick={() => setShowNew((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            aria-label={showNew ? "Sembunyikan password" : "Tampilkan password"}
                          >
                            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground mt-1">Minimal 6 karakter, kombinasi lebih aman.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Konfirmasi Password Baru</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showConfirm ? "text" : "password"} placeholder="Ulangi password baru" {...field} className="pr-10" />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            aria-label={showConfirm ? "Sembunyikan password" : "Tampilkan password"}
                          >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-1">
                  <Button type="submit" size="sm" variant="destructive" disabled={changePassword.isPending} className="flex-1 min-h-11">
                    {changePassword.isPending ? "Mengubah..." : "Ubah Password"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setOpen(false);
                      form.reset();
                    }}
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

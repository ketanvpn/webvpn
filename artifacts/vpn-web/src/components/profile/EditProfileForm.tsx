import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateProfile, getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { getApiError } from "@/lib/utils";
import { X } from "lucide-react";

const schema = z.object({
  fullName: z.string().trim().max(100, "Maksimal 100 karakter").optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "Email tidak valid" }),
});

type Props = {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
};

export function EditProfileForm({ user, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const updateProfile = useUpdateProfile();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user.fullName ?? "",
      email: user.email ?? "",
    },
  });

  const onSave = (values: z.infer<typeof schema>) => {
    const fullName = values.fullName?.trim() ? values.fullName.trim() : null;
    const email = values.email?.trim() ? values.email.trim().toLowerCase() : null;

    updateProfile.mutate(
      { data: { fullName, email: email as any } },
      {
        onSuccess: () => {
          toast({ title: "Profil berhasil diperbarui" });
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
          onSuccess();
        },
        onError: (err) =>
          toast({ title: "Gagal memperbarui profil", description: getApiError(err), variant: "destructive" }),
      }
    );
  };

  return (
    <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Edit Profil</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            form.reset();
          }}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md min-h-[32px] min-w-[32px] flex items-center justify-center"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Nama Lengkap</FormLabel>
                <FormControl>
                  <Input placeholder="Nama lengkap kamu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email (opsional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@contoh.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={updateProfile.isPending} className="flex-1 min-h-11">
              {updateProfile.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => {
                onClose();
                form.reset();
              }}
            >
              Batal
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

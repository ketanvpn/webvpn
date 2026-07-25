import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { X } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { profileSchema } from "./schemas";

interface ProfileEditFormProps {
  profileForm: UseFormReturn<z.infer<typeof profileSchema>>;
  isUpdating: boolean;
  onSaveProfile: (values: z.infer<typeof profileSchema>) => void;
  onCancel: () => void;
}

export function ProfileEditForm({
  profileForm,
  isUpdating,
  onSaveProfile,
  onCancel,
}: ProfileEditFormProps) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Edit Profil</p>
        <button
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-3">
          <FormField
            control={profileForm.control}
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
            control={profileForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@contoh.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={isUpdating} className="flex-1">
              {isUpdating ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Batal
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

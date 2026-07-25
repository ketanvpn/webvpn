import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Smartphone, Loader2 } from "lucide-react";
import { Link } from "wouter";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { waSchema } from "./schemas";

interface WhatsappStepProps {
  waForm: UseFormReturn<z.infer<typeof waSchema>>;
  isInitiating: boolean;
  onSubmitWa: (values: z.infer<typeof waSchema>) => void;
}

export function WhatsappStep({ waForm, isInitiating, onSubmitWa }: WhatsappStepProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Smartphone className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Daftar Akun Baru</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan nomor WhatsApp untuk verifikasi
        </p>
      </div>

      <Form {...waForm}>
        <form onSubmit={waForm.handleSubmit(onSubmitWa)} className="space-y-4">
          <FormField
            control={waForm.control}
            name="whatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="Contoh: 6281234567890"
                    {...field}
                    disabled={isInitiating}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="w-full" disabled={isInitiating}>
            {isInitiating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Memproses...
              </>
            ) : (
              "Lanjutkan"
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}

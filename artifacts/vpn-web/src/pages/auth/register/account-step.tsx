import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, X, Loader2, Gift, Check } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { accountSchema, UsernameStatus } from "./schemas";

interface AccountStepProps {
  accountForm: UseFormReturn<z.infer<typeof accountSchema>>;
  usernameStatus: UsernameStatus;
  onUsernameChange: (value: string) => void;
  onAccountSubmit: (values: z.infer<typeof accountSchema>) => void;
  isSubmitting: boolean;
}

export function AccountStep({
  accountForm,
  usernameStatus,
  onUsernameChange,
  onAccountSubmit,
  isSubmitting,
}: AccountStepProps) {
  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold">Buat Akun</h1>
        <p className="text-sm text-muted-foreground">Lengkapi data akun kamu</p>
      </div>

      <Form {...accountForm}>
        <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
          <FormField
            control={accountForm.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="username"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        onUsernameChange(e.target.value);
                      }}
                      disabled={isSubmitting}
                    />
                    {usernameStatus === "checking" && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {usernameStatus && typeof usernameStatus === "object" && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus.available ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                </FormControl>
                {usernameStatus && typeof usernameStatus === "object" && !usernameStatus.available && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-destructive">Username sudah dipakai</p>
                    {usernameStatus.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Saran username:</p>
                        <div className="flex flex-wrap gap-1">
                          {usernameStatus.suggestions.map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary/10"
                              onClick={() => {
                                accountForm.setValue("username", s);
                                onUsernameChange(s);
                              }}
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={accountForm.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="Min. 6 karakter"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={accountForm.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Nama Lengkap <span className="text-muted-foreground">(opsional)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Nama lengkap kamu" {...field} disabled={isSubmitting} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={accountForm.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email <span className="text-muted-foreground">(opsional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="email@contoh.com"
                    {...field}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={accountForm.control}
            name="referralCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  Kode Referral{" "}
                  <span className="text-muted-foreground">(opsional, dapat bonus)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Masukkan kode referral"
                    {...field}
                    disabled={isSubmitting}
                    className="uppercase"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              isSubmitting ||
              (usernameStatus !== null &&
                typeof usernameStatus === "object" &&
                !usernameStatus.available)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Membuat Akun...
              </>
            ) : (
              <>
                <Check className="h-5 w-5 mr-2" />
                Daftar Sekarang
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

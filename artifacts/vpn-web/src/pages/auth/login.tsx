import { getApiError } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Shield } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  turnstileToken: z.string().optional(),
});

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void;
    onTurnstileExpired?: () => void;
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      turnstileToken: "",
    },
  });

  useEffect(() => {
    if (!siteKey) return;

    window.onTurnstileSuccess = (token: string) => {
      form.setValue("turnstileToken", token, { shouldValidate: true });
    };
    window.onTurnstileExpired = () => {
      form.setValue("turnstileToken", "", { shouldValidate: true });
    };

    const existing = document.querySelector('script[data-turnstile="true"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-turnstile", "true");
      document.head.appendChild(script);
    }

    return () => {
      window.onTurnstileSuccess = undefined;
      window.onTurnstileExpired = undefined;
    };
  }, [form, siteKey]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    if (siteKey && !values.turnstileToken) {
      toast({
        title: "Verifikasi diperlukan",
        description: "Selesaikan verifikasi keamanan terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    login.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({
            title: "Berhasil masuk",
            description: "Selamat datang kembali!",
          });
          const destination = data.user.role === "admin" ? "/admin" : "/dashboard";
          setLocation(destination);
          window.location.reload();
        },
        onError: (error) => {
          toast({
            title: "Gagal masuk",
            description: getApiError(error) || "Username atau password salah",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm space-y-8 rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            KETANTECH
          </h1>
          <p className="text-sm text-muted-foreground">
            Masuk ke akunmu
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username / No. WhatsApp</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Username atau 08xxxx..."
                      autoComplete="username"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Masukkan password"
                        autoComplete="current-password"
                        className="pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Lupa password?
              </Link>
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={login.isPending}
            >
              {login.isPending ? "Memproses..." : "Masuk"}
            </Button>
            {siteKey ? (
              <div className="pt-2">
                <div
                  className="cf-turnstile"
                  data-sitekey={siteKey}
                  data-callback="onTurnstileSuccess"
                  data-expired-callback="onTurnstileExpired"
                />
                {!form.watch("turnstileToken") ? (
                  <p className="text-xs text-muted-foreground mt-2">Selesaikan verifikasi keamanan sebelum login.</p>
                ) : null}
              </div>
            ) : null}
          </form>
        </Form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Belum punya akun? </span>
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Daftar
          </Link>
        </div>
      </div>
    </div>
  );
}

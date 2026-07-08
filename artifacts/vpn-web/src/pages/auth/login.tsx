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
import { useEffect, useState, useCallback, useRef } from "react";
import { Eye, EyeOff, Shield, AlertTriangle, RefreshCw } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(3, "Username minimal 3 karakter"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  turnstileToken: z.string().optional(),
});

declare global {
  interface Window {
    turnstile?: {
      reset: (container?: string | HTMLElement) => void;
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
    };
  }
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Turnstile load state
  const [turnstileStatus, setTurnstileStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      turnstileToken: "",
    },
  });

  const resetTurnstile = () => {
    form.setValue("turnstileToken", "", { shouldValidate: true });
    try {
      window.turnstile?.reset();
    } catch {
      // noop
    }
  };

  const loadTurnstileScript = useCallback(() => {
    if (!siteKey) return;

    setTurnstileStatus("loading");

    // Hapus script lama jika ada (untuk retry)
    const oldScript = document.querySelector('script[data-turnstile="true"]');
    if (oldScript) oldScript.remove();

    // Hapus widget container lama
    const container = document.getElementById("turnstile-container");
    if (container) container.innerHTML = "";

    // Clear timeout lama
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

    // Timeout 10 detik — jika Turnstile belum render, anggap gagal
    loadTimeoutRef.current = setTimeout(() => {
      setTurnstileStatus((prev) => (prev === "ready" ? prev : "error"));
    }, 10000);

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad";
    script.async = true;
    script.defer = true;
    script.setAttribute("data-turnstile", "true");

    // Tangkap error saat script gagal load (network block, adblock)
    script.onerror = () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      setTurnstileStatus("error");
    };

    // Callback setelah script loaded — render widget manual
    (window as any).onTurnstileLoad = () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      setTurnstileStatus("ready");
      const el = document.getElementById("turnstile-container");
      if (el && window.turnstile && siteKey) {
        el.innerHTML = "";
        window.turnstile.render(el, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
            form.setValue("turnstileToken", token, { shouldValidate: true });
            setTurnstileStatus("ready");
          },
          "expired-callback": () => {
            form.setValue("turnstileToken", "", { shouldValidate: true });
          },
        });
      }
    };

    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  useEffect(() => {
    loadTurnstileScript();

    return () => {
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      (window as any).onTurnstileLoad = undefined;
    };
  }, [retryCount, loadTurnstileScript]);

  const handleRetryTurnstile = () => {
    form.setValue("turnstileToken", "", { shouldValidate: true });
    setRetryCount((c) => c + 1);
  };

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
          if (siteKey) resetTurnstile();
          toast({
            title: "Berhasil masuk",
            description: "Selamat datang kembali!",
          });
          const destination = data.user.role === "admin" ? "/admin" : "/dashboard";
          setLocation(destination);
          window.location.reload();
        },
        onError: (error) => {
          if (siteKey) resetTurnstile();
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
              disabled={login.isPending || (!!siteKey && !form.watch("turnstileToken"))}
            >
              {login.isPending ? "Memproses..." : "Masuk"}
            </Button>
            {siteKey ? (
              <div className="pt-2">
                {turnstileStatus === "error" ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Verifikasi keamanan gagal dimuat</p>
                        <p className="text-xs text-muted-foreground">
                          Cek hal berikut:
                        </p>
                        <ul className="text-xs text-muted-foreground list-disc ml-4 space-y-0.5">
                          <li>Matikan <b>Adblock</b> atau <b>Brave Shield</b></li>
                          <li>Pastikan koneksi internet stabil</li>
                          <li>Coba browser lain (Chrome/Firefox)</li>
                          <li>Coba gunakan jaringan WiFi/data lain</li>
                        </ul>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleRetryTurnstile}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Coba Muat Ulang
                    </Button>
                  </div>
                ) : (
                  <>
                    <div id="turnstile-container" />
                    {turnstileStatus === "loading" && (
                      <p className="text-xs text-muted-foreground mt-2 animate-pulse">Memuat verifikasi keamanan...</p>
                    )}
                    {turnstileStatus === "ready" && !form.watch("turnstileToken") && (
                      <p className="text-xs text-muted-foreground mt-2">Selesaikan verifikasi keamanan sebelum login.</p>
                    )}
                  </>
                )}
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

import { useState, useEffect, useCallback } from "react";
import { X, Download, Smartphone, Zap, WifiOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7; // Tampilkan lagi setelah 7 hari

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

function isDismissed(): boolean {
  const val = localStorage.getItem(DISMISS_KEY);
  if (!val) return false;
  const dismissedAt = parseInt(val, 10);
  if (isNaN(dismissedAt)) return false;
  const daysPassed = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysPassed < DISMISS_DAYS;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Jangan tampilkan jika sudah diinstal atau baru di-dismiss
    if (isStandalone() || isDismissed()) return;

    // Deteksi iOS (Safari tidak support beforeinstallprompt)
    const ua = navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIos(iosDevice);

    // iOS: langsung tampilkan banner (karena tidak ada prompt event)
    if (iosDevice) {
      // Delay sedikit agar tidak langsung muncul
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: tunggu event beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay sedikit
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
    } catch {
      // noop
    }
    setInstalling(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-full duration-500">
      <div className="mx-auto max-w-md rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-[0_-8px_40px_rgba(16,185,129,0.15)] overflow-hidden">
        {/* Glow accent line */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">Pasang Aplikasi</h3>
                <p className="text-xs text-muted-foreground">Akses lebih cepat dari layar HP</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors shrink-0"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { icon: Zap, text: "Akses Instan" },
              { icon: WifiOff, text: "Mode Offline" },
              { icon: Bell, text: "Notifikasi" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl bg-white/5">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-medium text-muted-foreground text-center leading-tight">{text}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          {isIos ? (
            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ketuk <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold text-[10px]">
                  <svg className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  Share
                </span> di Safari, lalu pilih <b>"Add to Home Screen"</b>
              </p>
            </div>
          ) : (
            <Button
              onClick={handleInstall}
              disabled={installing || !deferredPrompt}
              className="w-full h-11 text-sm font-semibold glow-primary hover:scale-[1.02] transition-all"
            >
              <Download className="h-4 w-4 mr-2" />
              {installing ? "Menginstal..." : "Instal Gratis — Tanpa App Store"}
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground/50 text-center mt-3">
            Ringan, tidak makan memori. Bisa dihapus kapan saja.
          </p>
        </div>
      </div>
    </div>
  );
}

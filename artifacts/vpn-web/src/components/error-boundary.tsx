import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for lazy-loaded pages.
 * Catches chunk load failures (stale cache after deploy, network errors)
 * and shows a retry UI instead of blank white screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Loading chunk") ||
        this.state.error?.message?.includes("Loading CSS chunk") ||
        this.state.error?.message?.includes("Importing a module script failed");

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center max-w-md space-y-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">
              {isChunkError ? "Versi Baru Tersedia" : "Terjadi Kesalahan"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {isChunkError
                ? "Aplikasi telah diperbarui. Silakan refresh halaman untuk mendapatkan versi terbaru."
                : "Terjadi kesalahan saat memuat halaman. Silakan coba lagi."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={this.handleRetry} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" /> Coba Lagi
              </Button>
              <Button onClick={this.handleReload} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh Halaman
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

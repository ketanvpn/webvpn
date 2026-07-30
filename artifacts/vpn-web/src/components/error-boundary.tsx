import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary untuk catch unexpected errors di React tree.
 * Menampilkan UI yang user-friendly ketika terjadi error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log error ke console untuk debugging
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack:", errorInfo.componentStack);
    
    // TODO: Bisa ditambahkan error reporting service seperti Sentry
    // if (typeof window !== "undefined" && (window as any).Sentry) {
    //   (window as any).Sentry.captureException(error);
    // }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Gunakan custom fallback jika disediakan
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-6 max-w-md">
            <div className="flex justify-center">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Terjadi Kesalahan
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Maaf, terjadi kesalahan yang tidak terduga. 
                Silakan coba lagi atau kembali ke halaman utama.
              </p>
            </div>

            {/* Error details - hanya di development */}
            {import.meta.env.DEV && error && (
              <div className="text-left bg-muted/50 rounded-lg p-4 overflow-auto max-h-40">
                <p className="text-xs font-mono text-destructive">{error.message}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={this.handleRetry} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Coba Lagi
              </Button>
              <Button variant="outline" onClick={this.handleGoHome} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Kembali ke Beranda
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook untuk trigger error boundary secara manual.
 * Contoh penggunaan:
 * const throwError = useErrorBoundary();
 * if (someError) throwError(new Error("Something went wrong"));
 */
export function useErrorBoundary(): (error: Error) => void {
  const [, setError] = React.useState<Error | null>(null);

  return (error: Error) => {
    setError(() => {
      throw error;
    });
  };
}

export default ErrorBoundary;

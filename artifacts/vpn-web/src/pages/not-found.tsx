import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-6xl font-extrabold text-primary">404</h1>
          <h2 className="text-xl font-bold text-foreground">Halaman Tidak Ditemukan</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Halaman yang kamu cari tidak tersedia atau sudah dihapus.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Halaman Utama</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

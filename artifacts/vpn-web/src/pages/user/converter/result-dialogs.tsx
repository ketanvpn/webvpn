import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Copy, Download, ExternalLink } from "lucide-react";
import type { DarkTunnelBuildResult } from "@/lib/darktunnel";

interface EasyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: DarkTunnelBuildResult | null;
  isCopied: boolean;
  onDownload: () => void;
  onOpen: () => void;
  onCopy: () => void;
}

export function EasyResultDialog({
  open,
  onOpenChange,
  result,
  isCopied,
  onDownload,
  onOpen,
  onCopy,
}: EasyResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">Config DarkTunnel Siap</DialogTitle>
          <DialogDescription>
            Download file adalah cara paling mudah. Jika tidak terbuka otomatis, import file dari aplikasi DarkTunnel.
          </DialogDescription>
        </DialogHeader>
        {result && (
          <>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
              <div className="font-semibold">{result.config.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">File: {result.filename}</div>
            </div>
            <div className="grid gap-2">
              <Button size="lg" className="gap-2" onClick={onDownload}>
                <Download className="h-4 w-4" /> Download File .dark
              </Button>
              <Button variant="outline" className="gap-2" onClick={onOpen}>
                <ExternalLink className="h-4 w-4" /> Buka di DarkTunnel
              </Button>
              <Button variant="outline" className="gap-2" onClick={onCopy}>
                {isCopied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Link Tersalin" : "Salin Link"}
              </Button>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SshResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sshLink: string;
  isCopied: boolean;
  onCopy: () => void;
}

export function SshResultDialog({
  open,
  onOpenChange,
  sshLink,
  isCopied,
  onCopy,
}: SshResultDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-400">Link DarkTunnel Berhasil Dibuat</DialogTitle>
          <DialogDescription>Salin link lalu import ke DarkTunnel.</DialogDescription>
        </DialogHeader>
        <Textarea readOnly value={sshLink} className="min-h-[100px] font-mono text-xs" />
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={onCopy} className="gap-2">
            <Copy className="h-4 w-4" /> Salin Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

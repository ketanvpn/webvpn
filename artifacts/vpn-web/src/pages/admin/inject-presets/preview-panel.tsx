import { Code2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PresetForm } from "./types";

export function PreviewPanel({ form }: { form: PresetForm }) {
  const sshPortNumber = Number(form.sshPort);
  const proxyPortNumber = Number(form.proxyPort);
  const sshPort = Number.isInteger(sshPortNumber) ? sshPortNumber : form.sshPort || "PORT";
  const proxyPort = Number.isInteger(proxyPortNumber)
    ? proxyPortNumber
    : form.proxyPort || "PORT";
  const resolvedSni =
    form.sniPolicy === "account_host"
      ? "dummy.example.com"
      : form.sniPolicy === "custom"
        ? (form.customSni.trim() || "(custom SNI belum diisi)").replaceAll(
            "[host]",
            "dummy.example.com",
          )
        : null;
  const payload = form.payload || "(payload belum diisi)";
  const darkTunnelPreview = {
    type: "SSH",
    name: form.name.trim() || "Preview Preset",
    sshTunnelConfig: {
      sshConfig: {
        host: "dummy.example.com",
        port: sshPort,
        username: "contoh",
        password: "password-contoh",
      },
      injectConfig: {
        mode: form.mode,
        proxyHost: form.proxyHost.trim() || "(host proxy belum diisi)",
        proxyPort,
        ...(form.usePayload ? { payload } : {}),
        ...(resolvedSni ? { serverNameIndication: resolvedSni } : {}),
      },
    },
  };

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Code2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold">Preview struktural</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Semua kredensial di bawah adalah data dummy, bukan data akun pengguna.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">SSH Login</p>
          <code className="break-all text-xs sm:text-sm">
            dummy.example.com:{sshPort}@contoh:password-contoh
          </code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">Remote Proxy</p>
          <code className="break-all text-xs sm:text-sm">
            {form.proxyHost.trim() || "(host belum diisi)"}:{proxyPort}
          </code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">Resolved SNI</p>
          <code className="break-all text-xs sm:text-sm">{resolvedSni ?? "Tidak digunakan"}</code>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground mb-1">SSL</p>
          <span>{form.ssl ? "Aktif (TLS/SSL)" : "Nonaktif"}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Payload</p>
          <Badge variant="outline" className="text-[10px]">
            {form.usePayload ? "Digunakan" : "Tidak dikirim"}
          </Badge>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-white/5 bg-background/70 p-3 text-xs font-mono">
          {payload}
        </pre>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Output DarkTunnel (JSON-like)</p>
          {!form.supportsDarkTunnel && (
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
              Dukungan app nonaktif
            </Badge>
          )}
        </div>
        <pre className="max-h-72 overflow-auto rounded-lg border border-white/5 bg-slate-950/80 p-3 text-[11px] leading-relaxed text-slate-200 font-mono">
          {JSON.stringify(darkTunnelPreview, null, 2)}
        </pre>
      </div>

      <Alert className="border-amber-500/25 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-xs text-muted-foreground">
          Preview ini hanya memeriksa bentuk konfigurasi dan tidak menguji konektivitas operator secara live.
        </AlertDescription>
      </Alert>
    </section>
  );
}

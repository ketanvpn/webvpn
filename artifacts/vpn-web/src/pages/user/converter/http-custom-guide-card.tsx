import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Smartphone, ExternalLink, AlertCircle } from "lucide-react";
import type { HttpCustomGuide } from "@/lib/darktunnel";
import { CopyableGuideField } from "./copyable-guide-field";

type HttpCustomGuideCardProps = {
  guide: HttpCustomGuide;
  copiedField: string | null;
  onCopy: (id: string, value: string, label: string) => void;
};

export function HttpCustomGuideCard({
  guide,
  copiedField,
  onCopy,
}: HttpCustomGuideCardProps) {
  const steps = [
    "Pilih mode SSH di HTTP Custom, lalu tempel SSH Login.",
    "Ketuk ikon tiga garis (☰) di kiri atas, lalu pilih menu Payload.",
    guide.usePayload
      ? "Di kolom Payload, tempel Payload. Di kolom tepat di bawahnya, tempel Remote Proxy, lalu pilih Apply."
      : "Biarkan kolom Payload kosong. Tempel Remote Proxy pada kolom yang tersedia, lalu pilih Apply.",
    guide.usePayload
      ? "Aktifkan Use Payload."
      : "Biarkan Use Payload nonaktif sesuai pengaturan preset.",
    guide.ssl
      ? "Ketuk ikon tiga garis (☰) lagi, pilih menu SNI yang berada di bawah Payload, tempel Server Name Indication, lalu aktifkan SSL."
      : "Biarkan SSL mati dan SNI kosong sesuai pengaturan preset.",
    "Tekan CONNECT. Jika gagal, buka tab LOG dan kirim screenshot error ke admin.",
  ];

  return (
    <Card className="glass-panel overflow-hidden border-cyan-500/25">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-cyan-300" />
            4. Panduan HTTP Custom
          </CardTitle>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
            Beta
          </Badge>
        </div>
        <CardDescription>
          Salin nilai satu per satu ke field yang sama di HTTP Custom. Posisi menu dapat sedikit berbeda menurut versi aplikasi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Belum berupa file import</AlertTitle>
          <AlertDescription>
            Panduan ini menyiapkan data dari akunmu. Jangan ubah teks [host], [ua], atau [crlf] di dalam payload.
          </AlertDescription>
        </Alert>

        <Button variant="outline" className="w-full gap-2" asChild>
          <a
            href="https://play.google.com/store/apps/details?id=xyz.easypro.httpcustom"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" /> Install / Buka HTTP Custom
          </a>
        </Button>

        <div className="flex flex-wrap gap-2">
          <Badge className={guide.usePayload ? "bg-emerald-600" : "bg-slate-600"}>
            Use Payload: {guide.usePayload ? "ON" : "OFF"}
          </Badge>
          <Badge className={guide.ssl ? "bg-emerald-600" : "bg-slate-600"}>
            SSL: {guide.ssl ? "ON" : "OFF"}
          </Badge>
          <Badge variant="outline">Mode: {guide.mode}</Badge>
        </div>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">A. Data utama</h3>
            <p className="text-xs text-muted-foreground">
              Tampilan standar HTTP Custom memakai format ip:port@user:pass.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <CopyableGuideField
              id="ssh-login"
              label="SSH Login"
              value={guide.ssh.login}
              hint="Tempel ke field ip:port@user:pass"
              multiline
              copied={copiedField === "ssh-login"}
              onCopy={onCopy}
            />
            {guide.usePayload && (
              <CopyableGuideField
                id="payload"
                label="Payload"
                value={guide.payload}
                hint="☰ kiri atas → Payload → kolom Payload. Tempel persis; jangan ganti placeholder."
                multiline
                copied={copiedField === "payload"}
                onCopy={onCopy}
              />
            )}
            <CopyableGuideField
              id="remote-proxy"
              label="Remote Proxy"
              value={guide.proxy.address}
              hint="Di menu Payload, tempel pada kolom Remote Proxy tepat di bawah kolom Payload."
              copied={copiedField === "remote-proxy"}
              onCopy={onCopy}
            />
            {guide.sni && (
              <CopyableGuideField
                id="sni"
                label="SNI / Server Name Indication"
                value={guide.sni}
                hint="☰ kiri atas → SNI (di bawah menu Payload); tempel lalu aktifkan SSL."
                copied={copiedField === "sni"}
                onCopy={onCopy}
              />
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/10 bg-background/30 p-4">
          <h3 className="font-semibold">B. Langkah di aplikasi</h3>
          <ol className="space-y-3 text-sm">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">C. Jika versi aplikasi meminta field terpisah</h3>
            <p className="text-xs text-muted-foreground">
              Gunakan data berikut, bukan SSH Login gabungan.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["ssh-host", "SSH Host", guide.ssh.host],
              ["ssh-port", "SSH Port", String(guide.ssh.port)],
              ["ssh-username", "Username", guide.ssh.username],
              ["ssh-password", "Password", guide.ssh.password],
            ].map(([id, label, value]) => (
              <CopyableGuideField
                key={id}
                id={id}
                label={label}
                value={value}
                copied={copiedField === id}
                onCopy={onCopy}
              />
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

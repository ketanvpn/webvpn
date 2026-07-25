import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Code2, Smartphone } from "lucide-react";
import type { InjectMode, PresetForm, RequiredAccountKind, SniPolicy, FormErrors } from "./types";
import { FieldError } from "./field-error";

interface PresetFormFieldsProps {
  form: PresetForm;
  formErrors: FormErrors;
  formMode: "create" | "edit" | "duplicate";
  updateForm: <K extends keyof PresetForm>(key: K, value: PresetForm[K]) => void;
}

export function PresetFormFields({
  form,
  formErrors,
  formMode,
  updateForm,
}: PresetFormFieldsProps) {
  return (
    <>
      {/* ── Identitas & Akun ── */}
      <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Identitas & akun</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Informasi yang membantu admin dan pengguna mengenali kegunaan preset.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="inject-name">Nama preset *</Label>
            <Input
              id="inject-name"
              value={form.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="Contoh: CloudFront Opok"
              aria-invalid={!!formErrors.name}
            />
            <FieldError message={formErrors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inject-slug">Slug unik *</Label>
            <Input
              id="inject-slug"
              value={form.slug}
              onChange={(e) => updateForm("slug", e.target.value.toLowerCase())}
              placeholder="cloudfront-opok"
              className="font-mono"
              disabled={formMode === "edit"}
              aria-invalid={!!formErrors.slug}
            />
            <FieldError message={formErrors.slug} />
            {!formErrors.slug && (
              <p className="text-[11px] text-muted-foreground">
                {formMode === "edit"
                  ? "Slug adalah identitas stabil dan tidak dapat diubah setelah preset dibuat."
                  : "Huruf kecil, angka, dan tanda hubung; dipakai sebagai identitas stabil."}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="inject-description">Deskripsi</Label>
          <Textarea
            id="inject-description"
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
            placeholder="Jelaskan paket/operator atau skenario penggunaan preset."
            rows={2}
            aria-invalid={!!formErrors.description}
          />
          <FieldError message={formErrors.description} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="inject-account-label">Label akun *</Label>
            <Input
              id="inject-account-label"
              value={form.accountLabel}
              onChange={(e) => updateForm("accountLabel", e.target.value)}
              placeholder="SSH biasa"
              aria-invalid={!!formErrors.accountLabel}
            />
            <FieldError message={formErrors.accountLabel} />
          </div>
          <div className="space-y-1.5">
            <Label>Jenis akun wajib</Label>
            <Select
              value={form.requiredAccountKind}
              onValueChange={(v) => updateForm("requiredAccountKind", v as RequiredAccountKind)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="cloudfront">CloudFront</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inject-sort-order">Urutan tampil</Label>
            <Input
              id="inject-sort-order"
              type="number"
              min={0}
              step={1}
              value={form.sortOrder}
              onChange={(e) => updateForm("sortOrder", e.target.value)}
              aria-invalid={!!formErrors.sortOrder}
            />
            <FieldError message={formErrors.sortOrder} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
          <div>
            <Label htmlFor="inject-form-active">Preset aktif</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preset aktif dapat muncul pada pilihan pengguna.
            </p>
          </div>
          <Switch
            id="inject-form-active"
            checked={form.isActive}
            onCheckedChange={(v) => updateForm("isActive", v)}
          />
        </div>
      </section>

      {/* ── Koneksi & Inject ── */}
      <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Koneksi & inject</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Tentukan mode SSH, remote proxy, payload, dan resolusi SNI.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="inject-ssh-port">Port SSH *</Label>
            <Input
              id="inject-ssh-port"
              type="number"
              min={1}
              max={65535}
              value={form.sshPort}
              onChange={(e) => updateForm("sshPort", e.target.value)}
              aria-invalid={!!formErrors.sshPort}
            />
            <FieldError message={formErrors.sshPort} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select
              value={form.mode}
              onValueChange={(v) => updateForm("mode", v as InjectMode)}
            >
              <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROXY">PROXY</SelectItem>
                <SelectItem value="PROXY_SNI">PROXY_SNI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <Label htmlFor="inject-proxy-host">Remote proxy host *</Label>
            <Input
              id="inject-proxy-host"
              value={form.proxyHost}
              onChange={(e) => updateForm("proxyHost", e.target.value)}
              placeholder="proxy.example.com"
              className="font-mono"
              aria-invalid={!!formErrors.proxyHost}
            />
            <FieldError message={formErrors.proxyHost} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inject-proxy-port">Port proxy *</Label>
            <Input
              id="inject-proxy-port"
              type="number"
              min={1}
              max={65535}
              value={form.proxyPort}
              onChange={(e) => updateForm("proxyPort", e.target.value)}
              aria-invalid={!!formErrors.proxyPort}
            />
            <FieldError message={formErrors.proxyPort} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Kebijakan SNI</Label>
            <Select
              value={form.sniPolicy}
              onValueChange={(v) => updateForm("sniPolicy", v as SniPolicy)}
            >
              <SelectTrigger aria-invalid={!!formErrors.sniPolicy}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa SNI</SelectItem>
                <SelectItem value="account_host">Host akun</SelectItem>
                <SelectItem value="custom">Custom SNI</SelectItem>
              </SelectContent>
            </Select>
            <FieldError message={formErrors.sniPolicy} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inject-custom-sni">Custom SNI</Label>
            <Input
              id="inject-custom-sni"
              value={form.customSni}
              onChange={(e) => updateForm("customSni", e.target.value)}
              placeholder="sni.example.com"
              className="font-mono"
              disabled={form.sniPolicy !== "custom"}
              aria-invalid={!!formErrors.customSni}
            />
            <FieldError message={formErrors.customSni} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="inject-payload">Payload {form.usePayload ? "*" : ""}</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="inject-use-payload" className="text-xs text-muted-foreground">
                Use Payload
              </Label>
              <Switch
                id="inject-use-payload"
                checked={form.usePayload}
                onCheckedChange={(v) => updateForm("usePayload", v)}
              />
            </div>
          </div>
          <Textarea
            id="inject-payload"
            value={form.payload}
            onChange={(e) => updateForm("payload", e.target.value)}
            placeholder={"GET / HTTP/1.1[crlf]\nHost: [host][crlf]\nConnection: Upgrade[crlf][crlf]"}
            className="min-h-36 font-mono text-xs"
            aria-invalid={!!formErrors.payload}
          />
          <FieldError message={formErrors.payload} />
          <p className="text-[11px] text-muted-foreground">
            Placeholder runtime seperti <code>[host]</code> tetap ditampilkan pada preview payload.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
          <div>
            <Label htmlFor="inject-ssl">SSL/TLS</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mengaktifkan koneksi aman pada konfigurasi hasil.
            </p>
          </div>
          <Switch
            id="inject-ssl"
            checked={form.ssl}
            onCheckedChange={(v) => updateForm("ssl", v)}
          />
        </div>
        <FieldError message={formErrors.ssl} />
      </section>

      {/* ── Dukungan Aplikasi ── */}
      <section className="rounded-xl border border-white/5 bg-muted/10 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Dukungan aplikasi</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih aplikasi yang boleh menawarkan preset ini kepada pengguna.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
            <div className="flex items-center gap-3">
              <Code2 className="h-5 w-5 text-blue-400" />
              <div>
                <Label htmlFor="inject-dark-tunnel">DarkTunnel</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Output konfigurasi terstruktur</p>
              </div>
            </div>
            <Switch
              id="inject-dark-tunnel"
              checked={form.supportsDarkTunnel}
              onCheckedChange={(v) => updateForm("supportsDarkTunnel", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-3">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-violet-400" />
              <div>
                <Label htmlFor="inject-http-custom">HTTP Custom</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Format inject untuk aplikasi</p>
              </div>
            </div>
            <Switch
              id="inject-http-custom"
              checked={form.supportsHttpCustom}
              onCheckedChange={(v) => updateForm("supportsHttpCustom", v)}
            />
          </div>
        </div>
        <FieldError message={formErrors.supportsDarkTunnel} />
      </section>
    </>
  );
}

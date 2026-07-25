import type { EasyInjectPresetInput, FormErrors, PresetForm } from "./types";

export function validateForm(form: PresetForm): FormErrors {
  const errors: FormErrors = {};
  const slug = form.slug.trim();
  const sshPort = Number(form.sshPort);
  const proxyPort = Number(form.proxyPort);
  const sortOrder = Number(form.sortOrder);

  if (!slug) {
    errors.slug = "Slug wajib diisi.";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = "Gunakan huruf kecil, angka, dan tanda hubung saja.";
  }
  if (!form.name.trim()) errors.name = "Nama preset wajib diisi.";
  if (!form.description.trim()) errors.description = "Deskripsi pengguna wajib diisi.";
  if (!form.accountLabel.trim()) errors.accountLabel = "Label akun wajib diisi.";
  if (!Number.isInteger(sshPort) || sshPort < 1 || sshPort > 65535) {
    errors.sshPort = "Port SSH harus bilangan 1–65535.";
  }
  if (!form.proxyHost.trim()) errors.proxyHost = "Host remote proxy wajib diisi.";
  if (!Number.isInteger(proxyPort) || proxyPort < 1 || proxyPort > 65535) {
    errors.proxyPort = "Port proxy harus bilangan 1–65535.";
  }
  if (!form.payload.trim()) {
    errors.payload = "Payload wajib diisi agar preset dapat dibuat dengan aman.";
  }
  if (form.mode === "PROXY_SNI" && form.sniPolicy === "none") {
    errors.sniPolicy = "Mode PROXY_SNI wajib memakai Host akun atau Custom SNI.";
  }
  if (form.sniPolicy === "custom" && !form.customSni.trim()) {
    errors.customSni = "Custom SNI wajib diisi untuk kebijakan ini.";
  }
  if (form.sniPolicy === "none" && form.ssl) {
    errors.ssl = "Matikan SSL atau pilih kebijakan SNI terlebih dahulu.";
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    errors.sortOrder = "Urutan tampil harus bilangan bulat 0 atau lebih.";
  }
  if (!form.supportsDarkTunnel && !form.supportsHttpCustom) {
    errors.supportsDarkTunnel = "Aktifkan minimal satu aplikasi agar preset dapat digunakan.";
  }

  return errors;
}

export function toRequestBody(form: PresetForm): EasyInjectPresetInput {
  return {
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    accountLabel: form.accountLabel.trim(),
    requiredAccountKind: form.requiredAccountKind,
    sshPort: Number(form.sshPort),
    mode: form.mode,
    proxyHost: form.proxyHost.trim(),
    proxyPort: Number(form.proxyPort),
    payload: form.payload,
    sniPolicy: form.sniPolicy,
    customSni: form.sniPolicy === "custom" ? form.customSni.trim() : null,
    usePayload: form.usePayload,
    ssl: form.ssl,
    supportsDarkTunnel: form.supportsDarkTunnel,
    supportsHttpCustom: form.supportsHttpCustom,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder),
  };
}

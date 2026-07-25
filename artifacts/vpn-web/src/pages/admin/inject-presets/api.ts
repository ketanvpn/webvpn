import type { ApiListResponse, EasyInjectPreset, PresetForm } from "./types";

const BASE_URL = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API_BASE = `${BASE_URL}/api`.replace(/\/+/g, "/");

export const ADMIN_PRESETS_QUERY_KEY = ["admin-easy-inject-presets"] as const;
export const USER_PRESETS_QUERY_KEY = ["easy-inject-presets"] as const;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  const text = await response.text();
  let body: unknown;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const errorBody = body as
      | { error?: string | { message?: string }; message?: string }
      | undefined;
    const message =
      typeof errorBody?.error === "string"
        ? errorBody.error
        : errorBody?.error?.message ??
          errorBody?.message ??
          (typeof body === "string" ? body : `HTTP ${response.status}`);
    throw new Error(message || "Terjadi kesalahan saat menghubungi server.");
  }

  return body as T;
}

export function unwrapList<T>(response: ApiListResponse<T>): T[] {
  return Array.isArray(response) ? response : response.data;
}

export function createBlankForm(): PresetForm {
  return {
    slug: "",
    name: "",
    description: "",
    accountLabel: "SSH biasa",
    requiredAccountKind: "normal",
    sshPort: "443",
    mode: "PROXY",
    proxyHost: "",
    proxyPort: "443",
    payload: "",
    sniPolicy: "none",
    customSni: "",
    usePayload: true,
    ssl: false,
    supportsDarkTunnel: true,
    supportsHttpCustom: true,
    isActive: true,
    sortOrder: "0",
  };
}

export function presetToForm(preset: EasyInjectPreset): PresetForm {
  return {
    slug: preset.slug,
    name: preset.name,
    description: preset.description ?? "",
    accountLabel: preset.accountLabel,
    requiredAccountKind: preset.requiredAccountKind,
    sshPort: String(preset.sshPort),
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: String(preset.proxyPort),
    payload: preset.payload,
    sniPolicy: preset.sniPolicy,
    customSni: preset.customSni ?? "",
    usePayload: preset.usePayload,
    ssl: preset.ssl,
    supportsDarkTunnel: preset.supportsDarkTunnel,
    supportsHttpCustom: preset.supportsHttpCustom,
    isActive: preset.isActive,
    sortOrder: String(preset.sortOrder),
  };
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

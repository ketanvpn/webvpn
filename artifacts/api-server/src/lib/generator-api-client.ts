/**
 * Client untuk Generator API eksternal
 * Dokumentasi: https://api.example.com/api/config
 * 
 * Mendukung:
 * - POST /hc/generate - Membuat config HC locked dari template
 * - POST /hc/unlock - Membuka lock config HC
 * - POST /hc/inspect - Membaca metadata dan field config HC
 * - POST /dark/generate - Membuat config Dark Tunnel locked
 * - POST /dark/unlock - Membuka config Dark Tunnel
 */

import { logger } from "./logger";

// ============================================================================
// Types
// ============================================================================

export type GeneratorApiScope = "generate" | "unlock" | "inspect";

export type GeneratorApiResponse<T> = {
  success: true;
  data: T;
};

export type GeneratorApiErrorResponse = {
  success: false;
  error: string;
  message: string;
};

export type HcGenerateRequest = {
  templateBase64?: string;
  template?: string;
  method?: "ssh" | "xray";
  accountText?: string;
  account?: {
    sshField?: string;
    xrayConfig?: unknown;
  };
  name?: string;
  templateName?: string;
  payload?: string;
  proxy?: string;
  sni?: string;
  noteHtml?: string;
  options?: {
    method?: "ssh" | "xray";
    name?: string;
    templateName?: string;
    payload?: string;
    proxy?: string;
    sni?: string;
    connectionMode?: string | number;
    noteHtml?: string;
  };
};

export type HcGenerateResult = {
  format: "hc";
  variant: "locked";
  method: "ssh" | "xray";
  content: string;
  contentBase64: string;
};

export type HcUnlockRequest = {
  templateBase64: string;
};

export type HcUnlockResult = {
  format: "hc";
  variant: "unlocked";
  content: string;
  contentBase64: string;
};

export type HcInspectRequest = {
  templateBase64: string;
};

export type HcInspectResult = {
  format: "hc";
  info: {
    type: string;
    partCount?: number;
    separator?: string;
    name?: string;
    payload?: string;
    sshField?: string;
    xrayConfig?: string;
    proxy?: string;
    sni?: string;
    noteEnabled?: string;
    notes?: string;
    lockAll?: string;
    lockPayloadAndServers?: string;
    lockPayload?: string;
    unlockRemoteProxy?: string;
    unlockUserAndPassword?: string;
    expiryTime?: string;
    wrapperExpiryTime?: string;
    connectionMode?: string;
    v2rayEnabled?: string;
    [key: string]: unknown;
  };
};

export type DarkGenerateRequest = {
  template?: string;
  templateBase64?: string;
  templateObject?: unknown;
  method?: "ssh" | "vmess" | "vless" | "trojan";
  accountText?: string;
  account?: unknown;
  ssh?: unknown;
  vmess?: unknown;
  vless?: unknown;
  trojan?: unknown;
  name?: string;
  noteSetting?: {
    enabled: boolean;
    html?: string;
  };
  noteHtml?: string;
  noteText?: string;
  note?: string;
  options?: {
    method?: "ssh" | "vmess" | "vless" | "trojan";
    name?: string;
    noteSetting?: {
      enabled: boolean;
      html?: string;
    };
  };
};

export type DarkGenerateResult = {
  format: "dark";
  variant: "locked";
  method: "ssh" | "vmess" | "vless" | "trojan";
  content: string;
  config: {
    type: string;
    name: string;
    encryptedLockedConfig: string;
    [key: string]: unknown;
  };
};

export type DarkUnlockRequest = {
  template?: string;
  templateBase64?: string;
  templateObject?: unknown;
};

export type DarkUnlockResult = {
  format: "dark";
  variant: "unlocked";
  content: string;
  config: {
    type: string;
    name: string;
    [key: string]: unknown;
  };
  wasLocked: boolean;
  fullyUnlocked: boolean;
  warning: string;
};

// ============================================================================
// Error Classes
// ============================================================================

export class GeneratorApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "GeneratorApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ============================================================================
// Client Implementation
// ============================================================================

type GeneratorApiClientConfig = {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
};

/**
 * Client untuk berkomunikasi dengan Generator API eksternal
 */
export class GeneratorApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: GeneratorApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 15000;
  }

  /**
   * Cek kesehatan service Generator API
   */
  async health(): Promise<{ status: string; endpoints: string[] }> {
    const response = await this.request<{ status: string; endpoints: string[] }>(
      "GET",
      "/health"
    );
    return response;
  }

  /**
   * Verifikasi API key dan ambil info key
   */
  async me(): Promise<{
    id: string;
    label: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
    lastUsedAt: number | null;
    usageCount: number;
    lastIp: string | null;
    scopes: GeneratorApiScope[];
    expiresAt: number | null;
    dailyLimit: number;
    dailyUsageDate: string | null;
    dailyUsage: number;
  }> {
    const response = await this.request<{
      id: string;
      label: string;
      enabled: boolean;
      createdAt: number;
      updatedAt: number;
      lastUsedAt: number | null;
      usageCount: number;
      lastIp: string | null;
      scopes: GeneratorApiScope[];
      expiresAt: number | null;
      dailyLimit: number;
      dailyUsageDate: string | null;
      dailyUsage: number;
    }>("GET", "/me");
    return response;
  }

  /**
   * Generate config HC locked dari template
   */
  async hcGenerate(
    request: HcGenerateRequest
  ): Promise<HcGenerateResult> {
    return this.request<HcGenerateResult>("POST", "/hc/generate", request);
  }

  /**
   * Unlock config HC
   */
  async hcUnlock(request: HcUnlockRequest): Promise<HcUnlockResult> {
    return this.request<HcUnlockResult>("POST", "/hc/unlock", request);
  }

  /**
   * Inspect metadata config HC
   */
  async hcInspect(request: HcInspectRequest): Promise<HcInspectResult> {
    return this.request<HcInspectResult>("POST", "/hc/inspect", request);
  }

  /**
   * Generate config Dark Tunnel locked
   */
  async darkGenerate(
    request: DarkGenerateRequest
  ): Promise<DarkGenerateResult> {
    return this.request<DarkGenerateResult>("POST", "/dark/generate", request);
  }

  /**
   * Unlock config Dark Tunnel
   */
  async darkUnlock(request: DarkUnlockRequest): Promise<DarkUnlockResult> {
    return this.request<DarkUnlockResult>("POST", "/dark/unlock", request);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error = data as GeneratorApiErrorResponse;
        throw new GeneratorApiError(
          error.message ?? `HTTP ${response.status}`,
          error.error ?? "unknown_error",
          response.status
        );
      }

      const success = data as GeneratorApiResponse<T>;
      return success.data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof GeneratorApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new GeneratorApiError(
            "Request timeout",
            "timeout",
            504
          );
        }
        throw new GeneratorApiError(
          error.message,
          "network_error",
          502
        );
      }

      throw new GeneratorApiError(
        "Unknown error",
        "unknown_error",
          500
      );
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let defaultClient: GeneratorApiClient | null = null;

/**
 * Dapatkan instance default Generator API client
 * Menggunakan environment variables:
 * - GENERATOR_API_BASE_URL: Base URL API (contoh: https://api.example.com/api/config)
 * - GENERATOR_API_KEY: API key untuk autentikasi
 */
export function getGeneratorApiClient(): GeneratorApiClient | null {
  const baseUrl = process.env.GENERATOR_API_BASE_URL;
  const apiKey = process.env.GENERATOR_API_KEY;

  if (!baseUrl || !apiKey) {
    logger.debug(
      "Generator API client not configured: missing GENERATOR_API_BASE_URL or GENERATOR_API_KEY"
    );
    return null;
  }

  if (
    !defaultClient ||
    defaultClient["baseUrl"] !== baseUrl ||
    defaultClient["apiKey"] !== apiKey
  ) {
    defaultClient = new GeneratorApiClient({ baseUrl, apiKey });
  }

  return defaultClient;
}

/**
 * Buat client baru dengan konfigurasi custom
 */
export function createGeneratorApiClient(
  config: GeneratorApiClientConfig
): GeneratorApiClient {
  return new GeneratorApiClient(config);
}

/**
 * Helper untuk generate SSH config HC dari akun dan preset
 */
export async function generateHcFromSshAccount(params: {
  client: GeneratorApiClient;
  templateBase64: string;
  host: string;
  port: number;
  username: string;
  password: string;
  name?: string;
  payload?: string;
  proxyHost?: string;
  proxyPort?: number;
  sni?: string;
  noteHtml?: string;
}): Promise<HcGenerateResult> {
  const {
    client,
    templateBase64,
    host,
    port,
    username,
    password,
    name,
    payload,
    proxyHost,
    proxyPort,
    sni,
    noteHtml,
  } = params;

  const accountText = `${host}:${port}@${username}:${password}`;
  const proxy = proxyHost && proxyPort ? `${proxyHost}:${proxyPort}` : undefined;

  return client.hcGenerate({
    templateBase64,
    method: "ssh",
    accountText,
    name,
    payload,
    proxy,
    sni,
    noteHtml,
  });
}

/**
 * Helper untuk generate Dark Tunnel config dari akun SSH dan preset
 */
export async function generateDarkFromSshAccount(params: {
  client: GeneratorApiClient;
  template: string;
  host: string;
  port: number;
  username: string;
  password: string;
  name?: string;
  noteHtml?: string;
}): Promise<DarkGenerateResult> {
  const { client, template, host, port, username, password, name, noteHtml } =
    params;

  return client.darkGenerate({
    template,
    method: "ssh",
    account: {
      host,
      port,
      username,
      password,
    },
    name,
    ...(noteHtml
      ? {
          noteSetting: {
            enabled: true,
            html: noteHtml,
          },
        }
      : {}),
  });
}

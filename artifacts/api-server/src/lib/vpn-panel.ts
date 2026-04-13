/**
 * VPN Panel API Client
 * Compatible with the KETANTECH VPN panel API
 * Docs: /vps/docs/index.html
 */

import axios, { AxiosError } from "axios";

export interface VpnProvisionResult {
  username: string;
  password?: string;
  uuid?: string;
  configLink?: string;
  allLinks?: Record<string, string | undefined>;
  hostname?: string;
  expiryInfo?: string;
}

function buildHeaders(apiToken: string) {
  return {
    Authorization: apiToken.startsWith("Bearer ")
      ? apiToken
      : `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Sanitize username to alphanumeric only (panel requirement) */
export function sanitizeVpnUsername(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30);
}

/**
 * Create a VPN account on the panel server.
 * Throws if the panel returns an error or is unreachable.
 */
export async function createPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
  password?: string;
  durationDays: number;
  quota?: number | null;
  maxConnections?: number | null;
  uuid?: string;
}): Promise<VpnProvisionResult> {
  const { apiUrl, apiToken, protocol, username, password, durationDays, quota, maxConnections, uuid } =
    params;

  const baseUrl = apiUrl.replace(/\/+$/, "");
  const headers = buildHeaders(apiToken);
  const kuota = quota ? Math.round(Number(quota)) : 0;
  const limitip = maxConnections ? Number(maxConnections) : 0;

  if (protocol === "ssh") {
    const { data } = await axios.post(
      `${baseUrl}/vps/sshvpn`,
      {
        username,
        password: password ?? "Ketan@1234",
        expired: durationDays,
        limitip: String(limitip),
      },
      { headers, timeout: 20000 }
    );

    if (data?.meta?.code !== 200 || !data.data) {
      throw new Error(
        data?.meta?.message ?? data?.message ?? "SSH account creation failed"
      );
    }

    const s = data.data;
    return {
      username: s.username,
      password: s.password,
      hostname: s.hostname,
      expiryInfo: `${s.exp} (${s.time})`,
      configLink: `${s.hostname}:${s.port?.tls ?? 443}@${s.username}:${s.password}`,
      allLinks: {
        ws: `${s.hostname}:80@${s.username}:${s.password}`,
        tls: `${s.hostname}:${s.port?.tls ?? 443}@${s.username}:${s.password}`,
        udp: `${s.hostname}:1-65535@${s.username}:${s.password}`,
      },
    };
  }

  if (protocol === "vmess" || protocol === "vless" || protocol === "trojan") {
    const endpointMap: Record<string, string> = {
      vmess: "vmessall",
      vless: "vlessall",
      trojan: "trojanall",
    };

    const { data } = await axios.post(
      `${baseUrl}/vps/${endpointMap[protocol]}`,
      {
        username,
        expired: durationDays,
        kuota,
        limitip,
        ...(uuid ? { uuidv2: uuid } : {}),
      },
      { headers, timeout: 20000 }
    );

    if (data?.meta?.code !== 200 || !data.data) {
      throw new Error(
        data?.meta?.message ?? data?.message ?? `${protocol} account creation failed`
      );
    }

    const s = data.data;
    return {
      username: s.username,
      uuid: s.uuid,
      hostname: s.hostname,
      expiryInfo: `${s.expired} (${s.time})`,
      configLink: s.link?.tls ?? s.link?.none ?? undefined,
      allLinks: {
        tls: s.link?.tls,
        none: s.link?.none,
        grpc: s.link?.grpc,
        upntls: s.link?.upntls,
        uptls: s.link?.uptls,
      },
    };
  }

  throw new Error(
    `Protocol "${protocol}" is not supported for automatic provisioning via panel API`
  );
}

/**
 * Delete a VPN account from the panel server.
 * Swallows errors silently (best-effort cleanup).
 */
export async function deletePanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}): Promise<void> {
  const { apiUrl, apiToken, protocol, username } = params;
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const headers = buildHeaders(apiToken);

  const endpointMap: Record<string, string> = {
    ssh: "sshvpn",
    vmess: "vmess",
    vless: "vless",
    trojan: "trojan",
  };

  const endpoint = endpointMap[protocol];
  if (!endpoint) return;

  try {
    await axios.delete(`${baseUrl}/vps/delete${endpoint}/${username}`, {
      headers,
      timeout: 10000,
    });
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to delete ${protocol} account ${username}: ${err.message}`);
  }
}

/**
 * Lock a VPN account on the panel (disable without deleting).
 */
export async function lockPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}): Promise<void> {
  const { apiUrl, apiToken, protocol, username } = params;
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const headers = buildHeaders(apiToken);

  const endpointMap: Record<string, string> = {
    ssh: "sshvpn",
    vmess: "vmess",
    vless: "vless",
    trojan: "trojan",
  };

  const endpoint = endpointMap[protocol];
  if (!endpoint) return;

  try {
    await axios.patch(`${baseUrl}/vps/lock${endpoint}/${username}`, null, {
      headers,
      timeout: 10000,
    });
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to lock ${protocol} account ${username}: ${err.message}`);
  }
}

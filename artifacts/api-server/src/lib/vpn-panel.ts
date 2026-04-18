/**
 * VPN Panel API Client
 * Compatible with the KETANTECH VPN panel API
 * Docs: /vps/docs/index.html
 */

import axios, { AxiosError } from "axios";
import https from "https";

export interface VpnProvisionResult {
  username: string;
  password?: string;
  uuid?: string;
  configLink?: string;
  allLinks?: Record<string, string | undefined>;
  hostname?: string;
  expiryInfo?: string;
}

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function buildHeaders(apiToken: string) {
  return {
    Authorization: apiToken.startsWith("Bearer ")
      ? apiToken
      : `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Sanitize username to lowercase alphanumeric only (panel requirement) */
export function sanitizeVpnUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
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
    try {
      const { data } = await axios.post(
        `${baseUrl}/vps/sshvpn`,
        {
          username,
          password: password ?? "Ketan@1234",
          expired: durationDays,
          limitip: String(limitip),
        },
        { headers, timeout: 20000, httpsAgent }
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
    } catch (e) {
      if (axios.isAxiosError(e)) {
        throw new Error(`Panel API Error (SSH): ${e.response?.data?.message || e.response?.data?.meta?.message || e.message}`);
      }
      throw e;
    }
  }

  if (protocol === "vmess" || protocol === "vless" || protocol === "trojan") {
    const endpointMap: Record<string, string> = {
      vmess: "vmessall",
      vless: "vlessall",
      trojan: "trojanall",
    };

    try {
      const { data } = await axios.post(
        `${baseUrl}/vps/${endpointMap[protocol]}`,
        {
          username,
          expired: durationDays,
          kuota,
          limitip,
          ...(uuid ? { uuidv2: uuid } : {}),
        },
        { headers, timeout: 20000, httpsAgent }
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
    } catch (e) {
      if (axios.isAxiosError(e)) {
        throw new Error(`Panel API Error (${protocol}): ${e.response?.data?.message || e.response?.data?.meta?.message || e.message}`);
      }
      throw e;
    }
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
      httpsAgent,
    });
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to delete ${protocol} account ${username}: ${err.message}`);
  }
}

/**
 * Renew (extend) a VPN account on the panel server.
 * Calls PATCH /vps/renew{protocol}/{username}/{days}
 * Swallows errors silently (best-effort) — DB is already updated.
 */
export async function renewPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
  durationDays: number;
  quota?: number | null;
}): Promise<void> {
  const { apiUrl, apiToken, protocol, username, durationDays, quota } = params;
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

  const body: Record<string, unknown> = {};
  if (quota != null) body.kuota = Math.round(Number(quota));

  try {
    await axios.patch(
      `${baseUrl}/vps/renew${endpoint}/${username}/${durationDays}`,
      body,
      { headers, timeout: 15000, httpsAgent }
    );
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to renew ${protocol} account ${username}: ${err.message}`);
  }
}

/**
 * Check if VPS panel is reachable by hitting the docs endpoint.
 * Returns latency in ms or null if unreachable.
 */
export async function checkPanelHealth(params: {
  apiUrl: string;
  apiToken: string;
}): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
  const { apiUrl, apiToken } = params;
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const headers = buildHeaders(apiToken);
  const start = Date.now();
  try {
    await axios.get(`${baseUrl}/vps/checkconfigvmess/__healthcheck__`, {
      headers,
      timeout: 8000,
      httpsAgent,
      validateStatus: () => true,
    });
    return { online: true, latencyMs: Date.now() - start };
  } catch (e) {
    const err = e as AxiosError;
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
      return { online: false, error: "Tidak dapat terhubung ke server panel" };
    }
    // Got a response (even 401/404) — server is up
    return { online: true, latencyMs: Date.now() - start };
  }
}

export interface PanelAccountInfo {
  username?: string;
  uuid?: string;
  hostname?: string;
  expired?: string;
  configLink?: string;
  allLinks?: Record<string, string | null | undefined>;
}

/**
 * Fetch current account details from the VPS panel via checkconfig.
 * Returns parsed account info or null if not found / unsupported.
 */
export async function syncPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}): Promise<PanelAccountInfo | null> {
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
  if (!endpoint) return null;

  try {
    const { data } = await axios.get(
      `${baseUrl}/vps/checkconfig${endpoint}/${username}`,
      { headers, timeout: 10000, httpsAgent }
    );

    if (data?.meta?.code !== 200 || !data.data) return null;

    const s = data.data;
    return {
      username: s.username,
      uuid: s.uuid,
      hostname: s.hostname,
      expired: s.expired ?? s.time,
      configLink: s.link?.tls ?? s.link?.none ?? undefined,
      allLinks: s.link
        ? {
            tls: s.link.tls,
            none: s.link.none,
            grpc: s.link.grpc,
            upntls: s.link.upntls,
            uptls: s.link.uptls,
          }
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Modify (recover) a VPN account on the panel by re-submitting username + UUID.
 * Used for expired accounts that entered "recovery mode" on the panel.
 * Calls PATCH /vps/modify{protocol} with { username, pass_uuid }.
 * SSH accounts don't have a UUID — this is a no-op for them.
 * Returns true if the panel responded with success, false otherwise.
 */
export async function modifyPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
  uuid?: string | null;
}): Promise<boolean> {
  const { apiUrl, apiToken, protocol, username, uuid } = params;

  if (protocol === "ssh" || !uuid) {
    return false;
  }

  const baseUrl = apiUrl.replace(/\/+$/, "");
  const headers = buildHeaders(apiToken);

  const endpointMap: Record<string, string> = {
    vmess: "vmess",
    vless: "vless",
    trojan: "trojan",
  };

  const endpoint = endpointMap[protocol];
  if (!endpoint) return false;

  try {
    const { data } = await axios.patch(
      `${baseUrl}/vps/modify${endpoint}`,
      { username, pass_uuid: uuid },
      { headers, timeout: 15000, httpsAgent }
    );
    const ok = data?.meta?.code === 200;
    if (ok) {
      console.log(`[vpn-panel] modify${endpoint} success for ${username}`);
    } else {
      console.warn(`[vpn-panel] modify${endpoint} returned non-200 for ${username}:`, data?.meta?.message);
    }
    return ok;
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to modify ${protocol} account ${username}: ${err.message}`);
    return false;
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
      httpsAgent,
    });
  } catch (e) {
    const err = e as AxiosError;
    console.warn(`[vpn-panel] Failed to lock ${protocol} account ${username}: ${err.message}`);
  }
}

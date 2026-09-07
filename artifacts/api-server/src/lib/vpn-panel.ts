/**
 * VPN Panel API Client
 * Compatible with the KETANTECH VPN panel API
 * Docs: /vps/docs/index.html
 */

import axios from "axios";
import https from "https";
import { randomBytes } from "crypto";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VpnProvisionResult {
  username: string;
  password?: string;
  uuid?: string;
  configLink?: string;
  allLinks?: Record<string, string | undefined>;
  hostname?: string;
  expiryInfo?: string;
}

export interface PanelAccountInfo {
  username?: string;
  uuid?: string;
  hostname?: string;
  expired?: string;
  configLink?: string;
  allLinks?: Record<string, string | null | undefined>;
}

// ---------------------------------------------------------------------------
// Shared constants & helpers
// ---------------------------------------------------------------------------

/** Panel endpoint slugs per protocol */
const PROTOCOL_ENDPOINTS: Record<string, string> = {
  ssh: "sshvpn",
  vmess: "vmess",
  vless: "vless",
  trojan: "trojan",
};

/** Panel trial endpoint slugs per protocol */
const TRIAL_ENDPOINTS: Record<string, string> = {
  ssh: "trialsshvpn",
  vmess: "trialvmessall",
  vless: "trialvlessall",
  trojan: "trialtrojanall",
};

/** Panel "all" create endpoint slugs per protocol (vmess/vless/trojan) */
const CREATE_ALL_ENDPOINTS: Record<string, string> = {
  vmess: "vmessall",
  vless: "vlessall",
  trojan: "trojanall",
};

// -- TLS security guard --

const allowInsecurePanelTls = process.env.ALLOW_INSECURE_PANEL_TLS === "true";

if (allowInsecurePanelTls) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[vpn-panel] FATAL: ALLOW_INSECURE_PANEL_TLS=true is FORBIDDEN in production. " +
        "This disables TLS certificate verification, exposing all panel traffic to MITM attacks. " +
        "Remove this env var or set it to 'false'."
    );
  }
  logger.warn(
    "[vpn-panel] WARNING: ALLOW_INSECURE_PANEL_TLS=true — TLS certificate verification is disabled (dev only)"
  );
}

const httpsAgent = new https.Agent({ rejectUnauthorized: !allowInsecurePanelTls });

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT = 20_000;
const SHORT_TIMEOUT = 10_000;
const HEALTH_TIMEOUT = 8_000;

function buildHeaders(apiToken: string) {
  return {
    Authorization: apiToken.startsWith("Bearer ")
      ? apiToken
      : `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Normalize base URL (strip trailing slashes) */
function normalizeBaseUrl(apiUrl: string): string {
  return apiUrl.replace(/\/+$/, "");
}

/**
 * Resolve the panel endpoint slug for a given protocol.
 * Returns `null` if the protocol is not supported.
 */
function resolveEndpoint(protocol: string): string | null {
  return PROTOCOL_ENDPOINTS[protocol] ?? null;
}

/**
 * Wrap an axios panel call and rethrow with a descriptive message.
 * Normalizes both AxiosError and generic errors into a single Error shape.
 */
function wrapPanelError(context: string, e: unknown): never {
  if (axios.isAxiosError(e)) {
    const detail =
      e.response?.data?.message ||
      e.response?.data?.meta?.message ||
      e.message;
    throw new Error(`Panel API Error (${context}): ${detail}`);
  }
  throw e;
}

// ---------------------------------------------------------------------------
// Response parsers (SSH vs xray protocols)
// ---------------------------------------------------------------------------

/** Parse SSH-style panel response into VpnProvisionResult */
function parseSshResponse(
  data: Record<string, unknown>,
  password: string
): VpnProvisionResult {
  const s = data as Record<string, any>;
  return {
    username: s.username,
    password: s.password ?? password,
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

/** Parse xray-style (vmess/vless/trojan) panel response into VpnProvisionResult */
function parseXrayResponse(
  data: Record<string, unknown>,
  expiryOverride?: string
): VpnProvisionResult {
  const s = data as Record<string, any>;
  return {
    username: s.username,
    uuid: s.uuid,
    hostname: s.hostname,
    expiryInfo: expiryOverride ?? `${s.expired} (${s.time})`,
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

/** Validate panel response shape (meta.code + data) */
function assertPanelSuccess(
  data: Record<string, any>,
  fallbackMessage: string
): asserts data is { data: Record<string, any>; meta: { code: number } } {
  if (data?.meta?.code !== 200 || !data.data) {
    throw new Error(data?.meta?.message ?? data?.message ?? fallbackMessage);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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
  const {
    apiUrl, apiToken, protocol, username, password,
    durationDays, quota, maxConnections, uuid,
  } = params;

  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);
  const kuota = quota ? Math.round(Number(quota)) : 0;
  const limitip = maxConnections ? Number(maxConnections) : 0;

  // -- SSH protocol --
  if (protocol === "ssh") {
    // Generate a random password if none provided (never use a hardcoded default)
    const sshPassword = password ?? randomBytes(12).toString("base64url");
    if (!password) {
      logger.warn(
        { username },
        "[vpn-panel] No password provided for SSH account — generated random password"
      );
    }

    try {
      const { data } = await axios.post(
        `${baseUrl}/vps/sshvpn`,
        {
          username,
          password: sshPassword,
          expired: durationDays,
          limitip: String(limitip),
        },
        { headers, timeout: DEFAULT_TIMEOUT, httpsAgent }
      );

      assertPanelSuccess(data, "SSH account creation failed");
      return parseSshResponse(data.data, sshPassword);
    } catch (e) {
      wrapPanelError("SSH", e);
    }
  }

  // -- xray protocols (vmess / vless / trojan) --
  const createEndpoint = CREATE_ALL_ENDPOINTS[protocol];
  if (!createEndpoint) {
    throw new Error(
      `Protocol "${protocol}" is not supported for automatic provisioning via panel API`
    );
  }

  try {
    const { data } = await axios.post(
      `${baseUrl}/vps/${createEndpoint}`,
      {
        username,
        expired: durationDays,
        kuota,
        limitip,
        ...(uuid ? { uuidv2: uuid } : {}),
      },
      { headers, timeout: DEFAULT_TIMEOUT, httpsAgent }
    );

    assertPanelSuccess(data, `${protocol} account creation failed`);
    return parseXrayResponse(data.data);
  } catch (e) {
    wrapPanelError(protocol, e);
  }
}

/**
 * Create a TRIAL VPN account on the panel server.
 * Uses the panel's native trial endpoints (/vps/trialvmessall, etc.)
 * which handle auto-expiry internally (no need for scheduler cleanup).
 * @param timelimit - duration in minutes (e.g. "60" for 1 hour)
 */
export async function createTrialPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  timelimit: string; // in minutes, e.g. "60"
}): Promise<VpnProvisionResult> {
  const { apiUrl, apiToken, protocol, timelimit } = params;
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = TRIAL_ENDPOINTS[protocol];
  if (!endpoint) {
    throw new Error(`Protocol "${protocol}" tidak mendukung fitur Trial`);
  }

  try {
    const { data } = await axios.post(
      `${baseUrl}/vps/${endpoint}`,
      { timelimit },
      { headers, timeout: DEFAULT_TIMEOUT, httpsAgent }
    );

    assertPanelSuccess(data, `Trial ${protocol} account creation failed`);

    const expiryLabel = `Trial ${timelimit} menit`;

    if (protocol === "ssh") {
      const s = data.data;
      return {
        username: s.username,
        password: s.password,
        hostname: s.hostname,
        expiryInfo: expiryLabel,
        configLink: s.hostname
          ? `${s.hostname}:${s.port?.tls ?? 443}@${s.username}:${s.password}`
          : undefined,
        allLinks: s.hostname
          ? {
              ws: `${s.hostname}:80@${s.username}:${s.password}`,
              tls: `${s.hostname}:${s.port?.tls ?? 443}@${s.username}:${s.password}`,
            }
          : undefined,
      };
    }

    // vmess / vless / trojan
    return parseXrayResponse(data.data, expiryLabel);
  } catch (e) {
    wrapPanelError(`Trial ${protocol}`, e);
  }
}

/**
 * Delete a VPN account from the panel server.
 * Swallows errors silently when bestEffort=true (default).
 */
export async function deletePanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
  bestEffort?: boolean;
}): Promise<void> {
  const { apiUrl, apiToken, protocol, username, bestEffort = true } = params;
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) return;

  try {
    await axios.delete(`${baseUrl}/vps/delete${endpoint}/${username}`, {
      headers,
      timeout: SHORT_TIMEOUT,
      httpsAgent,
    });
  } catch (e) {
    const detail = axios.isAxiosError(e) ? e.message : String(e);
    const msg = `Failed to delete ${protocol} account ${username}: ${detail}`;
    if (bestEffort) {
      logger.warn({ protocol, username }, `[vpn-panel] ${msg}`);
      return;
    }
    throw new Error(`[vpn-panel] ${msg}`);
  }
}

/**
 * Renew (extend) a VPN account on the panel server.
 * Calls PATCH /vps/renew{protocol}/{username}/{days}
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
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) {
    throw new Error(`Protocol "${protocol}" is not supported for renewal`);
  }

  const body: Record<string, unknown> = {};
  if (quota != null) body.kuota = Math.round(Number(quota));

  try {
    const { data } = await axios.patch(
      `${baseUrl}/vps/renew${endpoint}/${username}/${durationDays}`,
      body,
      { headers, timeout: 15_000, httpsAgent }
    );

    if (data?.meta && data.meta.code !== 200) {
      throw new Error(data.meta.message || "Failed to renew account on panel");
    }
  } catch (e) {
    wrapPanelError(protocol, e);
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
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);
  const start = Date.now();

  try {
    await axios.get(`${baseUrl}/vps/checkconfigvmess/__healthcheck__`, {
      headers,
      timeout: HEALTH_TIMEOUT,
      httpsAgent,
      validateStatus: () => true,
    });
    return { online: true, latencyMs: Date.now() - start };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const code = e.code;
      if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") {
        return { online: false, error: "Tidak dapat terhubung ke server panel" };
      }
    }
    // Got a response (even 401/404) — server is up
    return { online: true, latencyMs: Date.now() - start };
  }
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
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) return null;

  try {
    const { data } = await axios.get(
      `${baseUrl}/vps/checkconfig${endpoint}/${username}`,
      { headers, timeout: SHORT_TIMEOUT, httpsAgent }
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

  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) return false;

  try {
    const { data } = await axios.patch(
      `${baseUrl}/vps/modify${endpoint}`,
      { username, pass_uuid: uuid },
      { headers, timeout: 15_000, httpsAgent }
    );
    const ok = data?.meta?.code === 200;
    if (ok) {
      logger.info({ protocol, username }, `[vpn-panel] modify${endpoint} success`);
    } else {
      logger.warn(
        { protocol, username, panelMessage: data?.meta?.message },
        `[vpn-panel] modify${endpoint} returned non-200`
      );
    }
    return ok;
  } catch (e) {
    const detail = axios.isAxiosError(e) ? e.message : String(e);
    logger.warn(
      { protocol, username, error: detail },
      `[vpn-panel] Failed to modify ${protocol} account`
    );
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
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) return;

  try {
    await axios.patch(`${baseUrl}/vps/lock${endpoint}/${username}`, null, {
      headers,
      timeout: SHORT_TIMEOUT,
      httpsAgent,
    });
  } catch (e) {
    const detail = axios.isAxiosError(e) ? e.message : String(e);
    throw new Error(`[vpn-panel] Failed to lock ${protocol} account ${username}: ${detail}`);
  }
}

/**
 * Unlock a VPN account on the panel (enable without recreating).
 */
export async function unlockPanelAccount(params: {
  apiUrl: string;
  apiToken: string;
  protocol: string;
  username: string;
}): Promise<void> {
  const { apiUrl, apiToken, protocol, username } = params;
  const baseUrl = normalizeBaseUrl(apiUrl);
  const headers = buildHeaders(apiToken);

  const endpoint = resolveEndpoint(protocol);
  if (!endpoint) return;

  try {
    await axios.patch(`${baseUrl}/vps/unlock${endpoint}/${username}`, null, {
      headers,
      timeout: SHORT_TIMEOUT,
      httpsAgent,
    });
  } catch (e) {
    const detail = axios.isAxiosError(e) ? e.message : String(e);
    throw new Error(`[vpn-panel] Failed to unlock ${protocol} account ${username}: ${detail}`);
  }
}

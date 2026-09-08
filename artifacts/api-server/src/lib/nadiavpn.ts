import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";

const DEFAULT_BASE_URL = "https://www.nadiavpn.web.id/api/v1";
const REQUEST_TIMEOUT_MS = 20000;

export type NadiaVpnProtocol = "ssh" | "vmess" | "vless" | "trojan" | "zivpn" | string;
export type NadiaVpnDurationType = "day" | "week" | "month";

// ─── Request Payloads ─────────────────────────────────────────────────────────

export interface NadiaVpnTrialPayload {
  server_id: string;
  protocol: NadiaVpnProtocol;
}

export interface NadiaVpnOrderPayload {
  server_id: string;
  protocol: NadiaVpnProtocol;
  type: NadiaVpnDurationType;
  duration: number;
  username: string;
  password?: string;
}

export interface NadiaVpnRenewPayload {
  account_id: string;
  type: NadiaVpnDurationType;
  duration: number;
}

export interface NadiaVpnMigratePayload {
  account_id: string;
  new_server_id: string;
}

export interface NadiaVpnChangeProtocolPayload {
  account_id: string;
  target_protocol: NadiaVpnProtocol;
  ssh_password?: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export interface NadiaVpnApiResponse<T = unknown> {
  status: boolean;
  code: number;
  message: string;
  data: T;
}

export interface NadiaVpnServerPricing {
  per_day: number;
  per_week: number;
  per_month: number;
}

export interface NadiaVpnServerData {
  server_id: string;
  name?: string;
  domain?: string;
  flag?: string;
  supported_protocols: string[];
  supported_types: string[];
  pricing: NadiaVpnServerPricing;
  status?: string;
  max_accounts?: number;
  current_accounts?: number;
  [key: string]: unknown;
}

export interface NadiaVpnServersData {
  servers: NadiaVpnServerData[];
}

export interface NadiaVpnBalanceData {
  balance: number;
  username?: string;
  email?: string;
  [key: string]: unknown;
}

export interface NadiaVpnAccountConfig {
  hostname?: string;
  servername?: string;
  host?: string;
  domain?: string;
  server?: string;
  sni?: string;
  cloudfront?: string;
  uuid?: string;
  username?: string;
  password?: string;
  ip?: string;
  pubkey?: string;
  ISP?: string;
  CITY?: string;
  port?: Record<string, unknown>;
  payloadws?: Record<string, unknown>;
  link?: Record<string, string>;
  squid_proxy?: string;
  http_proxy?: string;
  http_custom?: string;
  ovpn_tcp?: string;
  ovpn_url?: string;
  [key: string]: unknown;
}

export interface NadiaVpnAccountData {
  account_id: string;
  username: string;
  protocol: string;
  uuid?: string;
  password?: string;
  expire_at?: string;
  trial_duration?: string;
  config?: NadiaVpnAccountConfig;
  config_data?: NadiaVpnAccountConfig;
  server?: { domain?: string; [key: string]: unknown };
  hostname?: string;
  servername?: string;
  host?: string;
  domain?: string;
  cloudfront?: string;
  sni?: string;
  ip?: string;
  [key: string]: unknown;
}

export type NadiaVpnServersResponse = NadiaVpnApiResponse<NadiaVpnServersData>;
export type NadiaVpnBalanceResponse = NadiaVpnApiResponse<NadiaVpnBalanceData>;
export type NadiaVpnOrderResponse = NadiaVpnApiResponse<NadiaVpnAccountData>;
export type NadiaVpnTrialResponse = NadiaVpnApiResponse<NadiaVpnAccountData>;
export type NadiaVpnAccountDetailResponse = NadiaVpnApiResponse<NadiaVpnAccountData>;
export type NadiaVpnAccountsResponse = NadiaVpnApiResponse<NadiaVpnAccountData[]>;

export class NadiaVpnConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NadiaVpnConfigError";
  }
}

export class NadiaVpnApiError extends Error {
  status?: number;
  upstreamData?: unknown;

  constructor(message: string, status?: number, upstreamData?: unknown) {
    super(message);
    this.name = "NadiaVpnApiError";
    this.status = status;
    this.upstreamData = upstreamData;
  }
}

function getBaseUrl() {
  return (process.env.NADIAVPN_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getApiToken() {
  const token = process.env.NADIAVPN_API_TOKEN?.trim();
  if (!token) {
    throw new NadiaVpnConfigError("NADIAVPN_API_TOKEN belum diset di environment server");
  }
  return token;
}

function buildHeaders() {
  const token = getApiToken();
  return {
    Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function extractUpstreamMessage(data: unknown, fallback: string) {
  const obj = data as Record<string, unknown> | null | undefined;
  return (
    (obj?.message as string) ||
    (obj?.error as string) ||
    ((obj?.meta as Record<string, unknown> | undefined)?.message as string) ||
    ((obj?.data as Record<string, unknown> | undefined)?.message as string) ||
    fallback
  );
}

async function requestNadiaVpn<T = unknown>(
  method: Method,
  path: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const { data } = await axios.request<T>({
      method,
      url: `${getBaseUrl()}${path}`,
      headers: buildHeaders(),
      data: body,
      timeout: REQUEST_TIMEOUT_MS,
      ...config,
    });

    return data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const err = e as AxiosError<unknown>;
      const status = err.response?.status;
      const message = extractUpstreamMessage(err.response?.data, err.message || "NadiaVPN API error");
      throw new NadiaVpnApiError(message, status, err.response?.data);
    }
    throw e;
  }
}

export function getNadiaVpnBalance() {
  return requestNadiaVpn<NadiaVpnBalanceResponse>("GET", "/user/balance");
}

export function getNadiaVpnServers() {
  return requestNadiaVpn<NadiaVpnServersResponse>("GET", "/servers");
}

export function createNadiaVpnTrial(payload: NadiaVpnTrialPayload) {
  return requestNadiaVpn<NadiaVpnTrialResponse>("POST", "/vpn/trial", payload);
}

export function createNadiaVpnOrder(payload: NadiaVpnOrderPayload) {
  return requestNadiaVpn<NadiaVpnOrderResponse>("POST", "/vpn/order", payload);
}

export function renewNadiaVpnAccount(payload: NadiaVpnRenewPayload) {
  return requestNadiaVpn<NadiaVpnApiResponse>("POST", "/vpn/renew", payload);
}

export function migrateNadiaVpnAccount(payload: NadiaVpnMigratePayload) {
  return requestNadiaVpn<NadiaVpnApiResponse>("POST", "/vpn/migrate", payload);
}

export function changeNadiaVpnProtocol(payload: NadiaVpnChangeProtocolPayload) {
  return requestNadiaVpn<NadiaVpnApiResponse>("POST", "/vpn/change-protocol", payload);
}

export function getNadiaVpnAccounts() {
  return requestNadiaVpn<NadiaVpnAccountsResponse>("GET", "/vpn/accounts");
}

export function getNadiaVpnAccountDetails(accountId: string) {
  return requestNadiaVpn<NadiaVpnAccountDetailResponse>("POST", "/vpn/account/details", { account_id: accountId });
}

export function syncNadiaVpnAccount(accountId: string) {
  return requestNadiaVpn<NadiaVpnApiResponse>("POST", "/vpn/account/sync", { account_id: accountId });
}

export function deleteNadiaVpnAccount(accountId: string) {
  return requestNadiaVpn<NadiaVpnApiResponse>("DELETE", "/vpn/account/delete", { account_id: accountId });
}

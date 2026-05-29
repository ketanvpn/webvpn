import axios, { AxiosError, type AxiosRequestConfig, type Method } from "axios";

const DEFAULT_BASE_URL = "https://www.nadiavpn.web.id/api/v1";
const REQUEST_TIMEOUT_MS = 20000;

export type NadiaVpnProtocol = "ssh" | "vmess" | "vless" | "trojan" | "zivpn" | string;
export type NadiaVpnDurationType = "day" | "month" | string;

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

function extractUpstreamMessage(data: any, fallback: string) {
  return (
    data?.message ||
    data?.error ||
    data?.meta?.message ||
    data?.data?.message ||
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
      const err = e as AxiosError<any>;
      const status = err.response?.status;
      const message = extractUpstreamMessage(err.response?.data, err.message || "NadiaVPN API error");
      throw new NadiaVpnApiError(message, status, err.response?.data);
    }
    throw e;
  }
}

export function getNadiaVpnBalance() {
  return requestNadiaVpn("GET", "/user/balance");
}

export function getNadiaVpnServers() {
  return requestNadiaVpn("GET", "/servers");
}

export function createNadiaVpnTrial(payload: NadiaVpnTrialPayload) {
  return requestNadiaVpn("POST", "/vpn/trial", payload);
}

export function createNadiaVpnOrder(payload: NadiaVpnOrderPayload) {
  return requestNadiaVpn("POST", "/vpn/order", payload);
}

export function renewNadiaVpnAccount(payload: NadiaVpnRenewPayload) {
  return requestNadiaVpn("POST", "/vpn/renew", payload);
}

export function migrateNadiaVpnAccount(payload: NadiaVpnMigratePayload) {
  return requestNadiaVpn("POST", "/vpn/migrate", payload);
}

export function getNadiaVpnAccounts() {
  return requestNadiaVpn("GET", "/vpn/accounts");
}

export function getNadiaVpnAccountDetails(accountId: string) {
  return requestNadiaVpn("POST", "/vpn/account/details", { account_id: accountId });
}

export function syncNadiaVpnAccount(accountId: string) {
  return requestNadiaVpn("POST", "/vpn/account/sync", { account_id: accountId });
}

export function deleteNadiaVpnAccount(accountId: string) {
  return requestNadiaVpn("DELETE", "/vpn/account/delete", { account_id: accountId });
}

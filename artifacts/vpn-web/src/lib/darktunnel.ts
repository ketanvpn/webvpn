export type EasyInjectAccountKind = "normal" | "cloudfront";
export type EasyInjectMode = "PROXY" | "PROXY_SNI";
export type EasyInjectSniPolicy = "none" | "account_host" | "custom";

export type EasyInjectPurchaseOption = {
  id: string;
  label: string;
  quotaText?: string;
  priceText?: string;
  url: string;
  isActive: boolean;
  sortOrder: number;
}

export type EasyInjectPreset = {
  id: number;
  slug: string;
  name: string;
  description: string;
  accountLabel: string;
  requiredAccountKind: EasyInjectAccountKind;
  sshPort: number;
  mode: EasyInjectMode;
  proxyHost: string;
  proxyPort: number;
  payload: string;
  sniPolicy: EasyInjectSniPolicy;
  customSni: string | null;
  usePayload: boolean;
  ssl: boolean;
  supportsDarkTunnel: boolean;
  supportsHttpCustom: boolean;
  version: number;
  isActive?: boolean;
  isBuiltIn?: boolean;
  sortOrder?: number;
  purchaseOptions?: EasyInjectPurchaseOption[];
  createdAt?: string;
  updatedAt?: string;
};

export type SshAccountKind = EasyInjectAccountKind | "unknown";

type NullableString = string | null | undefined;

export type DarkTunnelAccount = {
  id: number;
  orderId?: number | null;
  protocol: string;
  username: string;
  password?: string | null;
  configLink?: string | null;
  expiresAt: string | Date;
  isActive: boolean;
  allLinks?: Record<string, NullableString> | null;
  dynamicOrder?: {
    provider?: string | null;
  } | null;
  server?: {
    host?: string | null;
    originalHost?: string | null;
    name?: string | null;
    isActive?: boolean;
  } | null;
};

export type DarkTunnelBuildResult = {
  link: string;
  filename: string;
  config: {
    type: "SSH";
    name: string;
    sshTunnelConfig: {
      sshConfig: {
        host: string;
        port: number;
        username: string;
        password: string;
      };
      injectConfig: Record<string, unknown>;
    };
  };
};

export type HttpCustomGuide = {
  presetId: number;
  presetSlug: string;
  targetLabel: string;
  mode: EasyInjectMode;
  ssh: {
    host: string;
    port: number;
    username: string;
    password: string;
    login: string;
  };
  proxy: {
    host: string;
    port: number;
    address: string;
  };
  payload: string;
  sni: string | null;
  usePayload: boolean;
  ssl: boolean;
};

const EMPTY_VALUES = new Set([
  "",
  "no",
  "none",
  "null",
  "undefined",
  "-",
  "false",
  "0",
  "off",
]);

function usableString(value: NullableString): string | null {
  const normalized = String(value ?? "").trim();
  return EMPTY_VALUES.has(normalized.toLowerCase()) ? null : normalized;
}

function firstUsable(...values: NullableString[]): string | null {
  for (const value of values) {
    const usable = usableString(value);
    if (usable) return usable;
  }
  return null;
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function extractHostFromConnectionValue(value: NullableString): string | null {
  const usable = usableString(value);
  if (!usable) return null;

  let candidate = usable;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    try {
      return new URL(candidate).hostname || null;
    } catch {
      return null;
    }
  }

  candidate = candidate.split("@")[0]?.trim() ?? "";
  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    return closingBracket > 1 ? candidate.slice(1, closingBracket) : null;
  }

  return usableString(candidate.split(":")[0]);
}

function isCloudFrontHostname(value: NullableString): boolean {
  const host = extractHostFromConnectionValue(value)?.toLowerCase();
  return Boolean(
    host &&
      (host === "cloudfront.net" || host.endsWith(".cloudfront.net")),
  );
}

function getExplicitCloudFrontHost(account: DarkTunnelAccount): string | null {
  const links = account.allLinks ?? {};
  const providerCloudFront = extractHostFromConnectionValue(links.cloudfront);
  if (providerCloudFront?.includes(".")) return providerCloudFront;

  const candidates = [
    links.domain,
    links.host,
    links.server,
    links.sni,
    links.servername,
    links.hostname,
    account.configLink,
    links.tls,
    links.ws,
    links.udp,
    account.server?.originalHost,
    account.server?.host,
  ];

  for (const candidate of candidates) {
    if (isCloudFrontHostname(candidate)) {
      return extractHostFromConnectionValue(candidate);
    }
  }

  return null;
}

export function classifySshAccount(account: DarkTunnelAccount): SshAccountKind {
  if (account.protocol.toLowerCase() !== "ssh") return "unknown";

  const links = account.allLinks ?? {};
  if (getExplicitCloudFrontHost(account)) return "cloudfront";

  if (account.dynamicOrder?.provider === "local_panel" || account.orderId != null) {
    return "normal";
  }

  if (
    account.dynamicOrder?.provider === "nadiavpn" &&
    hasOwn(links, "cloudfront")
  ) {
    return "normal";
  }

  return "unknown";
}

export function isActiveSshAccount(
  account: DarkTunnelAccount,
  now = new Date(),
): boolean {
  const expiresAt = new Date(account.expiresAt);
  return (
    account.protocol.toLowerCase() === "ssh" &&
    account.isActive &&
    account.server?.isActive !== false &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime()
  );
}

export function getEasyInjectAccountHost(
  account: DarkTunnelAccount,
  preset: Pick<EasyInjectPreset, "requiredAccountKind">,
): string | null {
  if (preset.requiredAccountKind === "cloudfront") {
    return getExplicitCloudFrontHost(account);
  }

  const links = account.allLinks ?? {};
  return firstUsable(
    links.domain,
    links.host,
    links.server,
    links.sni,
    links.servername,
    links.hostname,
    extractHostFromConnectionValue(account.configLink),
    extractHostFromConnectionValue(links.tls),
    extractHostFromConnectionValue(links.ws),
    extractHostFromConnectionValue(links.udp),
    account.server?.originalHost,
    account.server?.host,
  );
}

export function isAccountCompatibleWithPreset(
  account: DarkTunnelAccount,
  preset: EasyInjectPreset,
): boolean {
  return (
    isActiveSshAccount(account) &&
    classifySshAccount(account) === preset.requiredAccountKind &&
    Boolean(getEasyInjectAccountHost(account, preset)) &&
    Boolean(usableString(account.username)) &&
    Boolean(usableString(account.password))
  );
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function sanitizeDarkTunnelFilename(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${base || "config-darktunnel"}.dark`;
}

export function resolveEasyInjectSni(
  preset: Pick<EasyInjectPreset, "sniPolicy" | "customSni">,
  accountHost: string,
): string | null {
  if (preset.sniPolicy === "none") return null;
  if (preset.sniPolicy === "account_host") return accountHost;

  const customSni = usableString(preset.customSni);
  if (!customSni) {
    throw new Error("SNI custom pada preset belum diisi.");
  }
  return customSni.replaceAll("[host]", accountHost);
}

function validatePresetRuntime(preset: EasyInjectPreset): void {
  if (!Number.isInteger(preset.sshPort) || preset.sshPort < 1 || preset.sshPort > 65535) {
    throw new Error("Port SSH pada preset tidak valid.");
  }
  if (!Number.isInteger(preset.proxyPort) || preset.proxyPort < 1 || preset.proxyPort > 65535) {
    throw new Error("Port Remote Proxy pada preset tidak valid.");
  }
  if (!usableString(preset.proxyHost) || !usableString(preset.payload)) {
    throw new Error("Remote Proxy atau payload pada preset belum lengkap.");
  }
  if (preset.mode === "PROXY_SNI" && preset.sniPolicy === "none") {
    throw new Error("Mode PROXY_SNI membutuhkan pengaturan SNI.");
  }
}

function resolveSshInjectValues(params: {
  account: DarkTunnelAccount;
  preset: EasyInjectPreset;
  name?: string;
}) {
  const { account, preset } = params;
  validatePresetRuntime(preset);

  if (!isActiveSshAccount(account)) {
    throw new Error("Akun SSH tidak aktif atau sudah kedaluwarsa.");
  }

  const kind = classifySshAccount(account);
  if (kind !== preset.requiredAccountKind) {
    throw new Error(`${preset.name} membutuhkan akun ${preset.accountLabel}.`);
  }

  const host = getEasyInjectAccountHost(account, preset);
  const username = usableString(account.username);
  const password = usableString(account.password);

  if (!host || !username || !password) {
    throw new Error("Data host, username, atau password akun belum lengkap.");
  }

  return {
    host,
    username,
    password,
    sni: resolveEasyInjectSni(preset, host),
    name: params.name?.trim() || `${preset.name} - ${account.username}`,
  };
}

export function buildHttpCustomGuide(params: {
  account: DarkTunnelAccount;
  preset: EasyInjectPreset;
}): HttpCustomGuide {
  if (!params.preset.supportsHttpCustom) {
    throw new Error("HTTP Custom sedang dinonaktifkan untuk preset ini.");
  }

  const { host, username, password, sni } = resolveSshInjectValues(params);
  const { preset } = params;

  return {
    presetId: preset.id,
    presetSlug: preset.slug,
    targetLabel: preset.name,
    mode: preset.mode,
    ssh: {
      host,
      port: preset.sshPort,
      username,
      password,
      login: `${host}:${preset.sshPort}@${username}:${password}`,
    },
    proxy: {
      host: preset.proxyHost,
      port: preset.proxyPort,
      address: `${preset.proxyHost}:${preset.proxyPort}`,
    },
    payload: preset.usePayload ? preset.payload : "",
    sni,
    usePayload: preset.usePayload,
    ssl: preset.ssl,
  };
}

export function buildDarkTunnelConfig(params: {
  account: DarkTunnelAccount;
  preset: EasyInjectPreset;
  name?: string;
}): DarkTunnelBuildResult {
  if (!params.preset.supportsDarkTunnel) {
    throw new Error("DarkTunnel sedang dinonaktifkan untuk preset ini.");
  }

  const { account, preset } = params;
  const { host, username, password, sni, name } = resolveSshInjectValues(params);
  const injectConfig: Record<string, unknown> = {
    mode: preset.mode,
    proxyHost: preset.proxyHost,
    proxyPort: preset.proxyPort,
    ...(preset.usePayload ? { payload: preset.payload } : {}),
    ...(sni ? { serverNameIndication: sni } : {}),
  };

  const config: DarkTunnelBuildResult["config"] = {
    type: "SSH",
    name,
    sshTunnelConfig: {
      sshConfig: {
        host,
        port: preset.sshPort,
        username,
        password,
      },
      injectConfig,
    },
  };

  return {
    link: `darktunnel://${encodeBase64Utf8(JSON.stringify(config))}`,
    filename: sanitizeDarkTunnelFilename(`${preset.name}-${account.username}`),
    config,
  };
}

export function isCloudfrontCapableServerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /cloudfront/i.test(name);
}

export function isPremiumServerName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /premium/i.test(name);
}

export function isCloudfrontCapableServer(server: { name?: string | null; displayName?: string | null; serverName?: string | null; serverDisplayName?: string | null } | null | undefined): boolean {
  if (!server) return false;
  const candidates = [server.name, server.displayName, server.serverName, server.serverDisplayName].filter(Boolean) as string[];
  return candidates.some(n => isCloudfrontCapableServerName(n));
}

export function isPremiumServer(server: { name?: string | null; displayName?: string | null; serverName?: string | null; serverDisplayName?: string | null } | null | undefined): boolean {
  if (!server) return false;
  const candidates = [server.name, server.displayName, server.serverName, server.serverDisplayName].filter(Boolean) as string[];
  return candidates.some(n => isPremiumServerName(n));
}

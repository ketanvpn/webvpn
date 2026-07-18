export const DARKTUNNEL_TARGETS = {
  gamemax: {
    label: "GameMax",
    accountLabel: "SSH biasa",
    description: "Untuk paket GameMax menggunakan akun SSH biasa.",
    requiredKind: "normal",
    sshPort: 80,
    injectConfig: {
      mode: "PROXY",
      proxyHost: "ir.huya.com",
      proxyPort: 80,
      payload:
        "GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
    },
  },
  ilmupedia: {
    label: "Ilmupedia",
    accountLabel: "SSH CloudFront",
    description: "Untuk paket Ilmupedia menggunakan akun SSH CloudFront.",
    requiredKind: "cloudfront",
    sshPort: 443,
    injectConfig: {
      mode: "PROXY_SNI",
      proxyHost: "wpassets.kuncie.com",
      proxyPort: 443,
      payload:
        "GET / HTTP/1.1[crlf]Host: [host][crlf]Connection: Upgrade[crlf]User-Agent: [ua][crlf]Upgrade: websocket[crlf][crlf]",
    },
  },
} as const;

export type DarkTunnelTarget = keyof typeof DARKTUNNEL_TARGETS;
export type SshAccountKind = "normal" | "cloudfront" | "unknown";

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

export function isAccountCompatibleWithTarget(
  account: DarkTunnelAccount,
  target: DarkTunnelTarget,
): boolean {
  return (
    isActiveSshAccount(account) &&
    classifySshAccount(account) === DARKTUNNEL_TARGETS[target].requiredKind &&
    Boolean(getDarkTunnelAccountHost(account, target)) &&
    Boolean(usableString(account.username)) &&
    Boolean(usableString(account.password))
  );
}

export function getDarkTunnelAccountHost(
  account: DarkTunnelAccount,
  target: DarkTunnelTarget,
): string | null {
  const links = account.allLinks ?? {};

  if (target === "ilmupedia") {
    return getExplicitCloudFrontHost(account);
  }

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

export function buildDarkTunnelConfig(params: {
  account: DarkTunnelAccount;
  target: DarkTunnelTarget;
  name?: string;
}): DarkTunnelBuildResult {
  const { account, target } = params;
  const definition = DARKTUNNEL_TARGETS[target];

  if (!isActiveSshAccount(account)) {
    throw new Error("Akun SSH tidak aktif atau sudah kedaluwarsa.");
  }

  const kind = classifySshAccount(account);
  if (kind !== definition.requiredKind) {
    throw new Error(
      `${definition.label} membutuhkan akun ${definition.accountLabel}.`,
    );
  }

  const host = getDarkTunnelAccountHost(account, target);
  const username = usableString(account.username);
  const password = usableString(account.password);

  if (!host || !username || !password) {
    throw new Error("Data host, username, atau password akun belum lengkap.");
  }

  const name =
    params.name?.trim() || `${definition.label} - ${account.username}`;
  const injectConfig: Record<string, unknown> = {
    ...definition.injectConfig,
    ...(target === "ilmupedia" ? { serverNameIndication: host } : {}),
  };

  const config: DarkTunnelBuildResult["config"] = {
    type: "SSH",
    name,
    sshTunnelConfig: {
      sshConfig: {
        host,
        port: definition.sshPort,
        username,
        password,
      },
      injectConfig,
    },
  };

  return {
    link: `darktunnel://${encodeBase64Utf8(JSON.stringify(config))}`,
    filename: sanitizeDarkTunnelFilename(`${definition.label}-${account.username}`),
    config,
  };
}

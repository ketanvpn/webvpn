import type { BugPreset } from "./types";

const API = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    ...options,
  });
  const body = await res.json().catch(() => ({ error: "Response tidak valid" }));
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body;
}

export async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) throw new Error("Clipboard tidak tersedia");
}

export function formatExpiry(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function convertVmess(raw: string, bug: BugPreset) {
  try {
    const b64 = raw.replace("vmess://", "");
    const decoded = atob(b64);
    const json = JSON.parse(decoded);
    const originalHost = json.host || json.add;

    if (bug.mode === "wildcard") {
      json.add = bug.bugDomain;
      json.host = `${bug.bugDomain}.${originalHost}`;
      json.sni = `${bug.bugDomain}.${originalHost}`;
    } else if (bug.mode === "sni") {
      json.sni = bug.bugDomain;
    } else if (bug.mode === "host") {
      json.host = bug.bugDomain;
    }

    return "vmess://" + btoa(JSON.stringify(json));
  } catch {
    return null;
  }
}

export function convertVlessOrTrojan(raw: string, bug: BugPreset) {
  try {
    const url = new URL(raw);
    const params = new URLSearchParams(url.search);
    const originalHost = url.hostname;
    const originalSni = params.get("sni") || originalHost;
    const originalHostParam = params.get("host") || originalHost;

    if (bug.mode === "wildcard") {
      url.hostname = bug.bugDomain;
      params.set("host", `${bug.bugDomain}.${originalHostParam}`);
      params.set("sni", `${bug.bugDomain}.${originalSni}`);
    } else if (bug.mode === "sni") {
      params.set("sni", bug.bugDomain);
    } else if (bug.mode === "host") {
      params.set("host", bug.bugDomain);
    }

    url.search = params.toString();
    return url.toString().replace(/%2F/g, "/").replace(/%3A/g, ":");
  } catch {
    return null;
  }
}

export function convertShadowsocks(raw: string, bug: BugPreset) {
  try {
    const config = raw.trim();
    if (!config.startsWith("ss://")) return null;

    let body = config.slice(5);
    let remark = "";
    const hashPos = body.indexOf("#");
    if (hashPos !== -1) {
      remark = body.slice(hashPos);
      body = body.slice(0, hashPos);
    }

    let userinfo: string;
    let hostPort: string;
    if (body.includes("@")) {
      const atPos = body.lastIndexOf("@");
      userinfo = body.slice(0, atPos);
      hostPort = body.slice(atPos + 1);
    } else {
      const decoded = atob(body);
      if (!decoded.includes("@")) return null;
      const atPos = decoded.lastIndexOf("@");
      userinfo = decoded.slice(0, atPos);
      hostPort = decoded.slice(atPos + 1);
    }

    const [host, ...portParts] = hostPort.split(":");
    const portRest = portParts.join(":");
    const newHost = bug.mode === "wildcard" ? bug.bugDomain : bug.bugDomain;
    return `ss://${userinfo}@${newHost}:${portRest}${remark}`;
  } catch {
    return null;
  }
}

export function convertSshOrText(raw: string, bug: BugPreset) {
  try {
    return raw.replace(/BUG/gi, bug.bugDomain);
  } catch {
    return raw;
  }
}

// Dalam payload DarkTunnel, [host] adalah placeholder runtime dan harus tetap utuh.
// Pada field lain (misalnya serverNameIndication), [host] berarti host SSH akun.
function replaceInjectPlaceholders(value: unknown, sshHost: string, key = ""): unknown {
  if (typeof value === "string") {
    return key === "payload" ? value : value.replace(/\[host\]/gi, sshHost);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceInjectPlaceholders(item, sshHost, key));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        replaceInjectPlaceholders(childValue, sshHost, childKey),
      ]),
    );
  }
  return value;
}

export function buildAdvancedDarkTunnelSsh(
  ssh: { host: string; port: number; username: string; password: string },
  inject: Record<string, unknown>,
  name?: string,
) {
  const config = {
    type: "SSH",
    name: name || "SSH Injek",
    sshTunnelConfig: {
      sshConfig: ssh,
      injectConfig: replaceInjectPlaceholders(inject, ssh.host),
    },
  };

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(config));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `darktunnel://${btoa(binary)}`;
  } catch {
    return "";
  }
}

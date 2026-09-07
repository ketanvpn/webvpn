import type { ReactNode } from "react";
import type { EasyInjectPreset } from "@/lib/darktunnel";
import type { BugPreset } from "./types";

export function getActivePurchaseOptions(preset: EasyInjectPreset) {
  const opts = (preset.purchaseOptions ?? []).filter((o) => o.isActive);
  return [...opts].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function presetIcon(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes("gamemax") || s.includes("game")) return "🎮";
  if (s.includes("ilmupedia") || s.includes("ilmu")) return "📚";
  return "🧩";
}

export function parseBoldText(text: string): ReactNode[] {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-white">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
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

    const [_host, ...portParts] = hostPort.split(":");
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
export function replaceInjectPlaceholders(value: unknown, sshHost: string, key = ""): unknown {
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

export function formatExpiry(value: string | Date): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

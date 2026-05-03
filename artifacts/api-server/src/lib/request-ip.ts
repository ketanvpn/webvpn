import type { Request } from "express";

function normalizeIp(ip: string | undefined | null): string {
  if (!ip) return "unknown";

  const trimmed = ip.trim();
  if (!trimmed) return "unknown";

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice(7);
  }

  return trimmed;
}

export function getSocketIp(req: Request): string {
  return normalizeIp(req.socket?.remoteAddress);
}

export function getClientIp(req: Request): string {
  const trustProxy = req.app.get("trust proxy");
  const proxyAware = trustProxy !== false && trustProxy !== undefined && trustProxy !== null;

  if (!proxyAware) {
    return getSocketIp(req);
  }

  return normalizeIp(req.ip) || getSocketIp(req);
}

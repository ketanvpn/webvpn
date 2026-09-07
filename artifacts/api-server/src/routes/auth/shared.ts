import type { Request } from "express";
import type { User } from "@workspace/db";
import { getClientIp } from "../../lib/request-ip";
import rateLimit from "express-rate-limit";

// ─── User Response Shape ──────────────────────────────────────────────────────

/** Canonical user response shape used across register, login, profile, and me endpoints. */
export function toUserResponse(user: User, opts?: { includeVpnTelegramId?: boolean }) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    balance: Number(user.balance),
    isActive: user.isActive,
    isVerified: user.isVerified,
    whatsapp: user.whatsapp,
    referralCode: user.referralCode,
    telegramId: user.telegramId ?? null,
    ...(opts?.includeVpnTelegramId ? { vpnTelegramId: user.vpnTelegramId ?? null } : {}),
    createdAt: user.createdAt,
  };
}

// ─── Rate Limit Key Generators ────────────────────────────────────────────────

export function authRateLimitKey(req: Request): string {
  return getClientIp(req);
}

export function loginRateLimitKey(req: Request): string {
  const ip = getClientIp(req);
  const identifier = typeof req.body?.username === "string"
    ? req.body.username.trim().toLowerCase()
    : "";
  if (!identifier) return ip;
  return `${ip}:${identifier}`;
}

export function userIdOrIpKey(req: Request): string {
  const uid = req.user?.userId ?? null;
  if (uid) return `uid:${String(uid)}`;
  return getClientIp(req);
}

// ─── Rate Limiter Factory ─────────────────────────────────────────────────────

interface RateLimitOpts {
  windowMs?: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}

export function createLimiter({
  windowMs = 15 * 60 * 1000,
  max,
  message,
  keyGenerator = authRateLimitKey,
}: RateLimitOpts) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { error: message },
  });
}

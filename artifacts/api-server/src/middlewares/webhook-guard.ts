import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { getSocketIp } from "../lib/request-ip";

/**
 * Middleware pengaman: memastikan hanya endpoint webhook yang bisa diakses
 * langsung (tanpa melewati reverse proxy Nginx/Cloudflare).
 *
 * Cara kerja:
 * 1. Jika request masuk dari loopback (127.0.0.1/::1) → berarti lewat Nginx → loloskan semua.
 * 2. Jika request masuk langsung (IP bukan loopback) → hanya izinkan path webhook.
 *    Ini mencegah bypass Nginx untuk endpoint sensitif (auth, admin, dsb.).
 *
 * Webhook path yang diizinkan:
 * - /api/webhooks/fonnte     (Fonnte WhatsApp)
 * - /api/webhooks/autogopay  (AutoGoPay payment)
 * - /api/webhooks/ketantechpay (KetantechPay payment)
 * - /api/telegram/webhook    (Telegram bot)
 * - /api/health              (Health check — berguna untuk monitoring)
 *
 * Catatan: Middleware ini adalah lapisan pertahanan tambahan (defense in depth).
 * Proteksi utama tetap di level firewall (UFW) dan Nginx config.
 * Di production yang benar, port Express tidak terpapar ke internet sama sekali.
 */

const ALLOWED_DIRECT_PATHS = new Set([
  "/api/webhooks/fonnte",
  "/api/webhooks/autogopay",
  "/api/webhooks/ketantechpay",
  "/api/telegram/webhook",
  "/api/health",
]);

export function webhookGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Cek apakah request datang dari loopback (Nginx proxy di server yang sama).
  // TIDAK mengandalkan header X-Forwarded-For karena bisa di-spoof oleh attacker.
  const socketIp = getSocketIp(req);
  const isLoopback =
    socketIp === "127.0.0.1" ||
    socketIp === "::1" ||
    socketIp === "::ffff:127.0.0.1";

  if (isLoopback) {
    // Request melalui Nginx di localhost → aman, loloskan semua
    next();
    return;
  }

  const path = req.path.toLowerCase().replace(/\/+$/, "");

  if (ALLOWED_DIRECT_PATHS.has(path)) {
    next();
    return;
  }

  logger.warn(
    { ip: socketIp, method: req.method, path: req.path },
    "webhookGuard: blocked direct access to non-webhook endpoint (bypassing Nginx)",
  );

  res.status(403).json({
    error: "Direct access not allowed. Use the domain URL.",
  });
}

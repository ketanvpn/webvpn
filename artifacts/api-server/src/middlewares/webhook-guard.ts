import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { getSocketIp } from "../lib/request-ip";

/**
 * Middleware pengaman: memastikan hanya endpoint webhook yang bisa diakses
 * langsung (tanpa melewati reverse proxy Nginx/Cloudflare).
 *
 * Cara kerja:
 * 1. Jika request masuk melalui Nginx → header `X-Forwarded-For` ada → loloskan semua.
 * 2. Jika request masuk langsung (tanpa proxy) → hanya izinkan path webhook.
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
  // Jika request melalui reverse proxy (Nginx), X-Forwarded-For pasti ada
  // karena konfigurasi Nginx kita selalu set header ini.
  const forwardedFor = req.headers["x-forwarded-for"];
  const hasProxy = Boolean(forwardedFor);

  if (hasProxy) {
    // Request melalui Nginx → aman, loloskan semua
    next();
    return;
  }

  // Request langsung (tanpa proxy) → cek apakah path diizinkan
  const path = req.path.toLowerCase().replace(/\/+$/, ""); // normalize trailing slash

  if (ALLOWED_DIRECT_PATHS.has(path)) {
    // Webhook endpoint → izinkan
    next();
    return;
  }

  // Non-webhook endpoint diakses langsung → tolak
  const socketIp = getSocketIp(req);
  logger.warn(
    { ip: socketIp, method: req.method, path: req.path },
    "webhookGuard: blocked direct access to non-webhook endpoint (bypassing Nginx)",
  );

  res.status(403).json({
    error: "Direct access not allowed. Use the domain URL.",
  });
}

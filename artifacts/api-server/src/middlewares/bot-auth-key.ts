import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Middleware untuk memproteksi endpoint khusus Bot Telegram (BotVPN repo).
 *
 * Bot Telegram tidak punya cookie/JWT user, jadi dia auth pakai shared secret
 * di header `X-Bot-API-Key`. Secret di-set di environment variable
 * `BOT_API_KEY` saat deploy api-server.
 *
 * Kalau env `BOT_API_KEY` belum di-set ATAU header tidak cocok → tolak 401.
 *
 * Pemakaian (di routes/telegram-bot-api.ts):
 *   router.post("/telegram/verify-link-token", requireBotApiKey, handler);
 */
export function requireBotApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = (process.env.BOT_API_KEY || "").trim();

  // Hard-fail saat env kosong: jangan biarkan endpoint terbuka.
  if (!expected) {
    logger.warn("requireBotApiKey: BOT_API_KEY env tidak di-set, tolak request");
    res.status(503).json({ error: "BOT_API_KEY belum dikonfigurasi di server." });
    return;
  }

  const provided = String(req.header("x-bot-api-key") || "").trim();
  if (!provided) {
    res.status(401).json({ error: "Missing X-Bot-API-Key header" });
    return;
  }

  if (!safeCompare(expected, provided)) {
    logger.warn(
      { ip: req.ip, path: req.path },
      "requireBotApiKey: invalid X-Bot-API-Key",
    );
    res.status(401).json({ error: "Invalid bot API key" });
    return;
  }

  next();
}

/**
 * Comparison string panjang sama tanpa kebocoran timing.
 * Tidak pakai `crypto.timingSafeEqual` langsung supaya beda panjang tidak crash.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

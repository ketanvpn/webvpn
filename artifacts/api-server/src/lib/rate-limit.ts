import rateLimit from "express-rate-limit";
import { getClientIp } from "./request-ip";

export const createOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const ip = getClientIp(req);
    const userId = req.user?.userId;
    return userId ? `${ip}:user:${userId}` : ip;
  },
  message: { error: "Terlalu banyak percobaan membuat order. Coba lagi dalam 15 menit." },
});

export const topupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const ip = getClientIp(req);
    const userId = req.user?.userId;
    return userId ? `${ip}:user:${userId}` : ip;
  },
  message: { error: "Terlalu banyak percobaan topup. Coba lagi dalam 15 menit." },
});

export const dynamicOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const ip = getClientIp(req);
    const userId = req.user?.userId;
    return userId ? `${ip}:user:${userId}` : ip;
  },
  message: { error: "Terlalu banyak percobaan order dynamic VPN. Coba lagi dalam 10 menit." },
});

export const accountActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const ip = getClientIp(req);
    const userId = req.user?.userId;
    return userId ? `${ip}:user:${userId}` : ip;
  },
  message: { error: "Terlalu banyak aksi pada akun. Coba lagi dalam 15 menit." },
});

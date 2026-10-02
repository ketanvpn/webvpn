import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// ─── JWT Secret ───────────────────────────────────────────────────────────────
// WAJIB di-set di SEMUA environment. Tidak ada fallback.
// Lebih baik aplikasi mati daripada jalan dengan secret lemah.

const _envSecret = process.env.SESSION_SECRET;

if (!_envSecret || _envSecret.length < 32) {
  throw new Error(
    "FATAL: SESSION_SECRET wajib diset (min 32 karakter). " +
    "Jalankan: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\" " +
    "lalu set di .env atau environment variable.",
  );
}

const JWT_SECRET: string = _envSecret;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  sessionVersion: number;
}

interface DbUserFields {
  id: number;
  role: string;
  isActive: boolean;
  sessionVersion: number;
}

type SessionResult =
  | { valid: true; dbUser: DbUserFields }
  | { valid: false; reason: string; status: number };

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const JWT_ALGORITHM = "HS256" as const;

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: JWT_ALGORITHM,
    expiresIn: "7d",
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: [JWT_ALGORITHM],
  }) as unknown as JwtPayload;
}

/**
 * Validasi sesi user terhadap database.
 * Mengecek: user ada, aktif, dan sessionVersion cocok.
 */
async function validateSession(payload: JwtPayload): Promise<SessionResult> {
  const [dbUser] = await db
    .select({
      id: usersTable.id,
      role: usersTable.role,
      isActive: usersTable.isActive,
      sessionVersion: usersTable.sessionVersion,
    })
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!dbUser || !dbUser.isActive) {
    return { valid: false, reason: "Akun tidak aktif atau tidak ditemukan", status: 401 };
  }

  if (payload.sessionVersion !== dbUser.sessionVersion) {
    return { valid: false, reason: "Sesi tidak valid. Silakan login ulang.", status: 401 };
  }

  return { valid: true, dbUser };
}

// ─── Middlewares ───────────────────────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyToken(token);
    const result = await validateSession(payload);

    if (!result.valid) {
      res.status(result.status).json({ error: result.reason });
      return;
    }

    // Gunakan role dari DB (bukan dari token) untuk keamanan
    payload.role = result.dbUser.role;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Invalid or expired token" });
    } else {
      logger.error({ err }, "requireAuth: unexpected error (possible DB outage)");
      res.status(500).json({ error: "Terjadi kesalahan server, silakan coba lagi." });
    }
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (token) {
    try {
      const payload = verifyToken(token);
      const result = await validateSession(payload);

      if (result.valid) {
        payload.role = result.dbUser.role;
        (req as Request & { user: JwtPayload }).user = payload;
      }
      // Jika tidak valid (suspended/session expired) → lanjut sebagai guest
    } catch (err) {
      // Token invalid atau DB error → lanjut sebagai guest
      if (!(err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError)) {
        logger.warn({ err }, "optionalAuth: DB validation failed, continuing as guest");
      }
    }
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = verifyToken(token);
    const result = await validateSession(payload);

    if (!result.valid) {
      res.status(result.status).json({ error: result.reason });
      return;
    }

    if (result.dbUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }

    payload.role = result.dbUser.role;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Invalid or expired token" });
    } else {
      logger.error({ err }, "requireAdmin: unexpected error (possible DB outage)");
      res.status(500).json({ error: "Terjadi kesalahan server, silakan coba lagi." });
    }
  }
}

// ─── Global Type Augmentation ─────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

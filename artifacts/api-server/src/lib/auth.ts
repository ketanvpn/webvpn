import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const envSecret = process.env.SESSION_SECRET;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!envSecret || envSecret.length < 32)) {
  throw new Error("SESSION_SECRET wajib diset dan minimal 32 karakter di production");
}

const JWT_SECRET = envSecret ?? "dev-secret-change-in-production";

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
  sessionVersion: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = verifyToken(token);

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
      res.status(401).json({ error: "Akun tidak aktif atau tidak ditemukan" });
      return;
    }

    if (payload.sessionVersion !== dbUser.sessionVersion) {
      res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
      return;
    }

    payload.role = dbUser.role;
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (token) {
    try {
      const payload = verifyToken(token);
      (req as Request & { user: JwtPayload }).user = payload;
    } catch {
      // token invalid, abaikan saja — lanjut sebagai guest
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
    
    // Cek database untuk memastikan user masih berstatus admin
    const [dbUser] = await db
      .select({ role: usersTable.role, isActive: usersTable.isActive, sessionVersion: usersTable.sessionVersion })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!dbUser || !dbUser.isActive || dbUser.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }

    if (payload.sessionVersion !== dbUser.sessionVersion) {
      res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
      return;
    }
    
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

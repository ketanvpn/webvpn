import type { Request } from "express";
import { usersTable } from "@workspace/db";

export function formatUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    balance: Number(u.balance),
    isActive: u.isActive,
    referralCode: u.referralCode,
    whatsapp: u.whatsapp ?? null,
    telegramId: u.telegramId ?? null,
    telegramUsername: (u as any).telegramUsername ?? null,
    referredBy: u.referredBy ?? null,
    createdAt: u.createdAt,
  };
}

export function getAdminId(req: Request): number {
  return req.user!.userId;
}

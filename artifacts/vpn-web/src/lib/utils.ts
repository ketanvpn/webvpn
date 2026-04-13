import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiError(err: unknown, fallback = "Terjadi kesalahan"): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string; message?: string } }).data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

import { z } from "zod";

export const profileSchema = z.object({
  fullName: z.string().optional(),
  email: z.string().email("Email tidak valid"),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Wajib diisi"),
    newPassword: z.string().min(6, "Minimal 6 karakter"),
    confirmPassword: z.string().min(1, "Wajib diisi"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

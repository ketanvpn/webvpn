import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { logger } from "./logger";

export async function seedDefaultAdmin() {
  try {
    const [existingAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existingAdmin) {
      return;
    }

    const passwordHash = await bcrypt.hash("admin123", 12);
    const referralCode = randomBytes(4).toString("hex").toUpperCase();

    await db.insert(usersTable).values({
      username: "admin",
      email: "admin@ketantech.id",
      passwordHash,
      fullName: "Administrator",
      whatsapp: null,
      isVerified: true,
      role: "admin",
      referralCode,
    });

    logger.info("Default admin created — username: admin, password: admin123");
    logger.warn("PENTING: Segera ganti password admin default setelah login pertama!");
  } catch (err) {
    logger.error({ err }, "Gagal membuat admin default");
  }
}

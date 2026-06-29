import { Router } from "express";
import { db } from "@workspace/db";
import { waVerificationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { sendOtp, normalizeWhatsapp } from "../lib/fonnte";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Fonnte Webhook: GET handler untuk verifikasi URL.
 * Fonnte mengecek apakah webhook URL valid dengan mengirim GET request.
 * Tanpa handler ini, Fonnte menganggap URL invalid dan tidak mengirim pesan.
 */
router.get("/webhooks/fonnte", (_req, res) => {
  logger.info("Fonnte webhook: GET verification request received");
  res.json({ status: true, message: "Fonnte webhook is active" });
});

/**
 * Fonnte Webhook: menerima pesan masuk dari user.
 *
 * Ketika user mengirim pesan yang mengandung "DAFTAR" ke nomor WA Fonnte,
 * server akan:
 * 1. Cari record wa_verifications yang cocok dengan nomor pengirim
 * 2. Tandai messageReceived = true
 * 3. Generate & kirim OTP sebagai BALASAN (bukan cold message!)
 * 4. Tandai otpSent = true
 *
 * Fonnte mengirim webhook dengan body (form-urlencoded atau JSON):
 *   sender: "6281234567890"
 *   message: "DAFTAR"
 *   (dan field lain yang tidak kita pakai)
 */
router.post("/webhooks/fonnte", async (req, res) => {
  try {
    const body = req.body ?? {};

    // Log raw body untuk debug — field apa saja yang Fonnte kirimkan
    logger.info({ rawBody: JSON.stringify(body).slice(0, 1000) }, "Fonnte webhook: raw POST body received");

    // Fonnte bisa kirim sebagai form-urlencoded atau JSON
    // Field yang mungkin: sender/from, message/text/pesan
    const sender = String(body.sender ?? body.from ?? body.pengirim ?? "").trim();
    const message = String(body.message ?? body.text ?? body.pesan ?? body.msg ?? "").trim();

    if (!sender) {
      logger.warn({ body: JSON.stringify(body).slice(0, 500) }, "Fonnte webhook: no sender");
      res.json({ status: true });
      return;
    }

    logger.info({ sender, message: message.slice(0, 100) }, "Fonnte webhook: incoming message");

    // Cek apakah pesan mengandung kata "DAFTAR" (case-insensitive)
    const isDaftar = /\bDAFTAR\b/i.test(message);
    if (!isDaftar) {
      // Pesan bukan untuk registrasi, abaikan
      logger.info({ sender }, "Fonnte webhook: message not a registration request, ignored");
      res.json({ status: true });
      return;
    }

    // Normalize nomor pengirim
    const normalized = normalizeWhatsapp(sender);
    const now = new Date();

    // Cari record wa_verifications yang belum expired dan belum terima pesan
    const [record] = await db
      .select()
      .from(waVerificationsTable)
      .where(
        and(
          eq(waVerificationsTable.whatsapp, normalized),
          eq(waVerificationsTable.messageReceived, false),
          gt(waVerificationsTable.expiresAt, now)
        )
      )
      .orderBy(waVerificationsTable.createdAt)
      .limit(1);

    if (!record) {
      logger.info({ sender: normalized }, "Fonnte webhook: no pending wa_verification found for sender");
      res.json({ status: true });
      return;
    }

    // Tandai pesan sudah diterima
    await db
      .update(waVerificationsTable)
      .set({ messageReceived: true })
      .where(eq(waVerificationsTable.id, record.id));

    // Kirim OTP sebagai BALASAN (ini yang membuat aman dari spam!)
    const otpResult = await sendOtp(normalized, "register");

    if (otpResult.success) {
      await db
        .update(waVerificationsTable)
        .set({ otpSent: true })
        .where(eq(waVerificationsTable.id, record.id));

      logger.info({ sender: normalized, token: record.token }, "Fonnte webhook: OTP sent as reply");
    } else {
      logger.error(
        { sender: normalized, error: otpResult.error },
        "Fonnte webhook: failed to send OTP reply"
      );
    }

    res.json({ status: true });
  } catch (err) {
    logger.error({ err }, "Fonnte webhook: unhandled error");
    // Selalu return 200 agar Fonnte tidak retry terus-menerus
    res.json({ status: true });
  }
});

export default router;

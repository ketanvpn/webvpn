import { Router } from "express";
import crypto from "crypto";
import { asyncHandler } from "../lib/async-handler";
import { db } from "@workspace/db";
import { waVerificationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { sendOtp, normalizeWhatsapp } from "../lib/fonnte";
import { logger } from "../lib/logger";
import { getSettingValue } from "./settings";

/**
 * Constant-time string comparison to prevent timing attacks on token verification.
 * Falls back to false if either value is empty.
 */
function safeTokenCompare(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

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
 * 1. Verifikasi token Fonnte (anti-spoofing)
 * 2. Cari record wa_verifications yang cocok dengan nomor pengirim
 * 3. Atomic update messageReceived = true (anti race condition)
 * 4. Generate & kirim OTP sebagai BALASAN (bukan cold message!)
 * 5. Tandai otpSent = true
 *
 * Fonnte mengirim webhook dengan body (form-urlencoded atau JSON):
 *   sender: "6281234567890"
 *   message: "DAFTAR"
 *   token: "fonnte_device_token"
 *   (dan field lain yang tidak kita pakai)
 */
router.post("/webhooks/fonnte", asyncHandler(async (req, res) => {
  try {
    const body = req.body ?? {};

    // Log webhook masuk — TANPA raw body (bisa berisi token sensitif)
    const sender = String(body.sender ?? body.from ?? body.pengirim ?? "").trim();
    logger.info(
      { sender: sender || "(empty)", hasToken: !!(body.token || body.device_token) },
      "Fonnte webhook: POST received"
    );

    // ─── Verifikasi Token Fonnte (fail-closed) ──────────────────────────────
    const incomingToken = String(body.token ?? body.device_token ?? "").trim();
    const storedToken = await getSettingValue("fonnteToken");

    if (!storedToken) {
      logger.error("Fonnte webhook: fonnteToken not configured — rejecting ALL requests (fail-closed)");
      res.status(503).json({ status: false, error: "Webhook not configured" });
      return;
    }

    if (!safeTokenCompare(incomingToken, storedToken)) {
      logger.warn(
        { hasToken: !!incomingToken },
        "Fonnte webhook: token missing or mismatch — rejected"
      );
      res.status(401).json({ status: false, error: "Invalid token" });
      return;
    }

    // Fonnte bisa kirim sebagai form-urlencoded atau JSON
    // Field yang mungkin: sender/from, message/text/pesan
    const message = String(body.message ?? body.text ?? body.pesan ?? body.msg ?? "").trim();

    if (!sender) {
      logger.warn("Fonnte webhook: no sender field in request");
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

    // ─── Atomic claim: SELECT + UPDATE dalam satu query ───────────────────
    // Ini mencegah race condition jika Fonnte mengirim webhook lebih dari 1x
    // (retry), karena hanya request pertama yang berhasil set messageReceived.
    const claimed = await db
      .update(waVerificationsTable)
      .set({ messageReceived: true })
      .where(
        and(
          eq(waVerificationsTable.whatsapp, normalized),
          eq(waVerificationsTable.messageReceived, false),
          gt(waVerificationsTable.expiresAt, now)
        )
      )
      .returning({ id: waVerificationsTable.id, token: waVerificationsTable.token });

    if (claimed.length === 0) {
      logger.info({ sender: normalized }, "Fonnte webhook: no pending wa_verification found (or already claimed)");
      res.json({ status: true });
      return;
    }

    const record = claimed[0];

    // Kirim OTP sebagai BALASAN (ini yang membuat aman dari spam!)
    const otpResult = await sendOtp(normalized, "register");

    if (otpResult.success) {
      await db
        .update(waVerificationsTable)
        .set({ otpSent: true })
        .where(eq(waVerificationsTable.id, record.id));

      logger.info({ sender: normalized, verificationId: record.id }, "Fonnte webhook: OTP sent as reply");
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
}));

export default router;

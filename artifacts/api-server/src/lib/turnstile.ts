import { logger } from "./logger";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(params: {
  token: string;
  remoteIp?: string;
}): Promise<{ ok: boolean; errors: string[] }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, errors: [] };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", params.token);
  if (params.remoteIp) body.set("remoteip", params.remoteIp);

  try {
    const resp = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await resp.json() as {
      success?: boolean;
      "error-codes"?: string[];
    };

    return {
      ok: data.success === true,
      errors: Array.isArray(data["error-codes"]) ? data["error-codes"] : [],
    };
  } catch (err) {
    // Secure default: fail CLOSED on verification errors.
    // Set TURNSTILE_FAIL_OPEN=true only if you explicitly want to allow logins when Cloudflare is unreachable.
    const failOpen = process.env.TURNSTILE_FAIL_OPEN === "true";
    logger.warn({ err, failOpen }, "Turnstile verification request failed");
    if (failOpen) {
      return { ok: true, errors: ["turnstile-unreachable-fail-open"] };
    }
    return { ok: false, errors: ["turnstile-unreachable"] };
  }
}

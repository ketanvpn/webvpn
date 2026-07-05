import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getClientIp } from "./lib/request-ip";
import { webhookGuard } from "./middlewares/webhook-guard";

const app: Express = express();

const trustedProxiesEnv = process.env.TRUSTED_PROXIES?.trim();
if (trustedProxiesEnv) {
  const trustedProxies = trustedProxiesEnv
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (trustedProxies.length > 0) {
    app.set("trust proxy", trustedProxies);
    logger.info({ trustedProxies }, "Trust proxy enabled with strict allowlist");
  } else {
    app.set("trust proxy", false);
    logger.info("Trust proxy disabled (empty TRUSTED_PROXIES)");
  }
} else {
  app.set("trust proxy", false);
  logger.info("Trust proxy disabled (socket IP mode)");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
          ip: getClientIp(req as any),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Batasi CORS ke domain produksi jika CORS_ORIGIN diset, fallback ke semua domain (untuk dev)
const allowedOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  origin: allowedOrigin
    ? (origin, callback) => {
        if (!origin || origin === allowedOrigin) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      }
    : true,
  credentials: true,
}));
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Webhook Guard ────────────────────────────────────────────────────────────
// Blokir akses langsung (bypass Nginx) ke endpoint non-webhook.
// Hanya aktif di production — di development semua diizinkan.
if (process.env.NODE_ENV === "production") {
  app.use(webhookGuard);
  logger.info("Webhook guard enabled (production mode)");
}

app.use("/api", router);

// ─── Global error handler ─────────────────────────────────────────────────────
// Catches any unhandled errors thrown (or passed via next(err)) in async routes.
// Without this, Express 4.x would silently hang the request.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Terjadi kesalahan pada server, silakan coba lagi." });
});

export default app;

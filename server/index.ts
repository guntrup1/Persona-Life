import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth } from "./auth";
import { connectMongoDB } from "./mongodb";
import { registerDataRoutes } from "./api-data";
import { registerAudioRoutes } from "./api-audio";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import mongoose from "mongoose";
import { startBot } from "./bot";

const app = express();
const httpServer = createServer(app);
// ── Helmet — безопасные HTTP заголовки ──
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 2000, // макс 2000 запросов с одного IP (SPA постоянно пингует /api/sync/init)
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов, попробуй позже" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // макс 10 попыток входа/регистрации за 15 минут
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много попыток входа, подожди 15 минут" },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // макс 3 запроса сброса пароля в час
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов сброса пароля, попробуй через час" },
});

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов, попробуй через час" },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Слишком много запросов, попробуй позже" },
});

// Global limiter applies only to API routes — static assets (JS/CSS bundles)
// from a single page reload must not count against the budget.
app.use("/api", globalLimiter);

// ── Ограничение размера тела запроса ──
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", forgotPasswordLimiter);
app.use("/api/auth/reset-password", forgotPasswordLimiter);
app.use("/api/auth/resend-verification", resendVerificationLimiter);
app.use("/api/auth/verify-email", verifyLimiter);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ── Защита от NoSQL инъекций ──
// Must run AFTER body parsing so it actually sees parsed request bodies.
app.use(mongoSanitize({
  replaceWith: "_",
  onSanitize: ({ req, key }) => {
    console.warn(`[security] Sanitized key "${key}" from ${req.ip}`);
  },
}));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  // Track response size without capturing body content (privacy + log size)
  let responseSize = 0;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    try {
      const serialized = JSON.stringify(bodyJson);
      responseSize = Buffer.byteLength(serialized, "utf8");
    } catch { /* ignore */ }
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const sizeLabel = responseSize > 0 ? ` ${(responseSize / 1024).toFixed(1)}KB` : "";
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms${sizeLabel}`);
    }
  });

  next();
});

(async () => {
  await connectMongoDB();
  app.set("trust proxy", 1);
  setupAuth(app);
  await registerRoutes(httpServer, app);

  // Setup user data endpoints
  registerDataRoutes(app);

  // Setup audio processing endpoints
  registerAudioRoutes(app);

  // ── Start Telegram bot ──
  if (process.env.USE_WEBHOOK !== "true") {
    startBot().catch(err => console.error("[bot] Start error:", err));
  } else {
    console.log("[bot] Long polling disabled (USE_WEBHOOK=true). Awaiting webhooks via Serverless.");
  }

  // ── Auto 2-way Google Calendar sync every 5 minutes ──
  const { pullAndSyncGoogleCalendar } = await import("./google-calendar");
  const { User } = await import("./mongodb");
  setInterval(async () => {
    try {
      const connectedUsers = await User.find({ googleCalendarConnected: true, googleRefreshToken: { $ne: null } }).select("_id").lean();
      for (const u of connectedUsers) {
        pullAndSyncGoogleCalendar(u._id.toString()).catch(() => {});
      }
    } catch (e) {
      console.error("[auto-sync] Google Calendar cron error:", e);
    }
  }, 5 * 60 * 1000); // every 5 minutes

  // ── TTL cleanup: ProcessedAudio older than 90 days (raw transcripts are the
  //     biggest documents; audio transcripts in notes are preserved in DayNote) ──
  const AUDIO_RETENTION_DAYS = 90;
  const cleanupOldAudio = async () => {
    try {
      const cutoff = new Date(Date.now() - AUDIO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const res = await mongoose.model("ProcessedAudio").deleteMany({ createdAt: { $lt: cutoff } });
      if (res.deletedCount > 0) {
        console.log(`[ttl] Deleted ${res.deletedCount} ProcessedAudio older than ${AUDIO_RETENTION_DAYS} days`);
      }
    } catch (e) {
      console.error("[ttl] ProcessedAudio cleanup error:", e);
    }
  };
  cleanupOldAudio(); // once at startup
  setInterval(cleanupOldAudio, 6 * 60 * 60 * 1000); // then every 6 hours

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Log the full error server-side but never leak internal details to clients
    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    const safeMessage = status >= 500
      ? "Внутренняя ошибка сервера"
      : (typeof err.message === "string" ? err.message : "Ошибка запроса");

    return res.status(status).json({ message: safeMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectMongo from "connect-mongo";
const MongoStore = (ConnectMongo as any).default || ConnectMongo;
import bcrypt from "bcryptjs";
import { z } from "zod";
import mongoose from "mongoose";
import { sanitizeBlobUrls } from "./url-safety";

// ── Brevo email helper ──
async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: "Trade Persona", email: process.env.BREVO_SENDER_EMAIL || "hermandmytro62@gmail.com" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Brevo error: ${err}`);
  }
}

// ── Zod схемы валидации ──
const registerSchema = z.object({
  lang: z.string().optional(),
  email: z.string()
    .email("Некорректный email")
    .min(5, "Email слишком короткий")
    .max(100, "Email слишком длинный")
    .toLowerCase(),
  password: z.string()
    .min(8, "Пароль должен быть не менее 8 символов")
    .max(100, "Пароль слишком длинный"),
});

const loginSchema = z.object({
  email: z.string().email("Некорректный email").toLowerCase(),
  password: z.string().min(1, "Пароль обязателен"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(32).max(128),
  password: z.string()
    .min(8, "Пароль должен быть не менее 8 символов")
    .max(100, "Пароль слишком длинный"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Некорректный email").toLowerCase(),
  lang: z.string().optional(),
});

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("[FATAL] SESSION_SECRET environment variable is required but not set. Set it in Render Dashboard → Environment.");
  }

  app.use(
    session({
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions",
      }),
      name: "persona.sid",
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );
}

declare module "express-session" {
  interface SessionData {
    userId: string;
    email: string;
    googleOAuthState: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Не авторизован" });
  }
  next();
}

import { syncTaskToGoogleCalendar, deleteGoogleCalendarEvent, pullAndSyncGoogleCalendar } from "./google-calendar";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { email, password, lang } = parsed.data;

    try {
      const existing = await mongoose.model("User").findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }

      const hash = await bcrypt.hash(password, 12);
      const crypto = require("crypto");
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const user = await mongoose.model("User").create({
        email: email.toLowerCase(),
        password_hash: hash,
        isVerified: false,
        verifyToken,
        verifyTokenExpires,
      });

      await mongoose.model("UserData").create({ userId: user._id, data: {} });

      // Отправляем письмо верификации через Brevo
      const verifyUrl = `${process.env.APP_URL || "https://persona-life.onrender.com"}/verify-email?token=${verifyToken}`;
      try {
        const isEn = lang === "en";
        const subject = isEn ? "Verify email — Persona Life" : "Подтверди email — Persona Life";
        const title = isEn ? "PERSONA LIFE" : "PERSONA LIFE";
        const desc = isEn ? "Verify your email to log in." : "Подтверди свой email чтобы войти в систему.";
        const btn = isEn ? "VERIFY EMAIL" : "ПОДТВЕРДИТЬ EMAIL";
        const footer = isEn ? "Link is valid for 24 hours. If you didn't register, ignore this email." : "Ссылка действует 24 часа. Если ты не регистрировался — просто проигнорируй письмо.";

        const spamNote = isEn ? "⚠️ If you don't see the email in your Inbox, please check your SPAM folder." : "⚠️ Если письма нет во «Входящих» — обязательно проверьте папку «СПАМ».";

        await sendEmail(
          user.email,
          subject,
          `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
            <h2 style="color:#E11D48;letter-spacing:0.2em;font-size:24px;">${title}</h2>
            <p style="color:#aaa;">${desc}</p>
            <a href="${verifyUrl}"
              style="display:inline-block;margin:24px 0;padding:12px 32px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;letter-spacing:0.1em;">
              ${btn}
            </a>
            <p style="color:#ffb703;font-size:13px;font-weight:bold;margin-top:16px;">${spamNote}</p>
            <p style="color:#666;font-size:12px;">${footer}</p>
          </div>
          `
        );
      } catch (emailErr) {
        console.error("Verify email send error:", emailErr);
        // Удаляем пользователя если письмо не отправилось
        await mongoose.model("User").findByIdAndDelete(user._id);
        await mongoose.model("UserData").deleteOne({ userId: user._id });
        return res.status(500).json({ message: "Не удалось отправить письмо подтверждения. Попробуй позже." });
      }

      return res.json({
        ok: true,
        message: "Аккаунт создан! Проверь почту и подтверди email. (Если письма нет во Входящих — проверь папку СПАМ).",
        needsVerification: true,
      });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // ── Per-account login lockout (in-memory) ──
  const loginAttempts = new Map<string, { count: number; until: number }>();
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const { email, password } = parsed.data;

    const locked = loginAttempts.get(email);
    if (locked && locked.until > Date.now()) {
      const minsLeft = Math.ceil((locked.until - Date.now()) / 60000);
      return res.status(429).json({ message: `Слишком много неудачных попыток. Попробуй через ${minsLeft} мин.` });
    }
    if (locked && locked.until <= Date.now()) loginAttempts.delete(email);

    try {
      const user = await mongoose.model("User").findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        const attempt = loginAttempts.get(email) || { count: 0, until: 0 };
        attempt.count += 1;
        if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
          attempt.until = Date.now() + LOCKOUT_MS;
          attempt.count = 0;
          loginAttempts.set(email, attempt);
          return res.status(429).json({ message: "Слишком много неудачных попыток. Подожди 15 минут." });
        }
        loginAttempts.set(email, attempt);
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      if (!user.isVerified) {
        return res.status(403).json({ message: "Подтверди email перед входом. Проверь почту." });
      }

      // Session fixation defense: issue a fresh session id on login
      req.session.regenerate(async (err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Ошибка сервера" });
        }
        req.session.userId = user._id.toString();
        req.session.email = user.email;
        loginAttempts.delete(email);

        const userData = await mongoose.model("UserData").findOne({ userId: user._id });
        const data = userData?.data || null;

        return res.json({ id: user._id, email: user.email, data });
      });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("persona.sid");
      return res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.json({ user: null });
    }
    try {
      const user = await mongoose.model("User").findById(req.session.userId).select("email");
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null });
      }
      return res.json({ user: { id: user._id, email: user.email } });
    } catch {
      return res.json({ user: null });
    }
  });

  // ── Lightweight version check endpoint (~50 bytes) ──
  // Clients poll this every 30s instead of fetching full data.
  // Full data is fetched only when revision changes.
  app.get("/api/user/data/version", requireAuth, async (req, res) => {
    try {
      const userData = await mongoose.model("UserData").findOne(
        { userId: req.session.userId },
        { updatedAt: 1, revision: 1, _id: 0 } // projection: only tiny fields
      ).lean();
      return res.json({
        updatedAt: (userData as any)?.updatedAt?.toISOString() ?? null,
        revision: (userData as any)?.revision ?? 0,
      });
    } catch (err) {
      console.error("Version check error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.get("/api/user/data", requireAuth, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate");
      res.set("Pragma", "no-cache");
      const userData = await mongoose.model("UserData").findOne({ userId: req.session.userId });
      return res.json({ data: userData?.data || null });
    } catch (err) {
      console.error("Get data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  const lastBackupTime = new Map<string, number>();
  const BACKUP_COOLDOWN = 10 * 60 * 1000;

  function sanitizeMongoInput(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data !== "object") return data;
    if (Array.isArray(data)) return data.map(sanitizeMongoInput);

    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      clean[key] = sanitizeMongoInput(val);
    }
    return clean;
  }

  function verifyDataIntegrity(existingData: any, incomingData: any): { safe: boolean; reason?: string } {
    if (!existingData || typeof existingData !== "object") return { safe: true };
    if (!incomingData || typeof incomingData !== "object") return { safe: false, reason: "Невалидный формат данных" };

    const existingTasks = Array.isArray(existingData.todayTasks) ? existingData.todayTasks.length : 0;
    const existingGoals = Array.isArray(existingData.goals) ? existingData.goals.length : 0;
    const existingNotes = Array.isArray(existingData.dayNotes) ? existingData.dayNotes.length : 0;

    const incomingTasks = Array.isArray(incomingData.todayTasks) ? incomingData.todayTasks.length : 0;
    const incomingGoals = Array.isArray(incomingData.goals) ? incomingData.goals.length : 0;
    const incomingNotes = Array.isArray(incomingData.dayNotes) ? incomingData.dayNotes.length : 0;

    const dbTotal = existingTasks + existingGoals + existingNotes;
    const incomingTotal = incomingTasks + incomingGoals + incomingNotes;

    if (dbTotal > 5 && incomingTotal === 0) {
      return {
        safe: false,
        reason: "Попытка записать пустые данные поверх существующих записей заблокирована для защиты БД."
      };
    }

    return { safe: true };
  }

  async function saveWithBackup(userId: string, data: any) {
    // Strip mongo operator keys, then blank out unsafe image URLs
    // (javascript:, data:, etc.) before persisting
    const cleanData = sanitizeBlobUrls(sanitizeMongoInput(data));
    const existing = await mongoose.model("UserData").findOne({ userId });

    if (existing?.data) {
      const integrity = verifyDataIntegrity(existing.data, cleanData);
      if (!integrity.safe) {
        console.warn(`[DATA INTEGRITY GUARD] Rejected save for user ${userId}: ${integrity.reason}`);
        throw new Error(integrity.reason || "Сбой проверки целостности данных");
      }

      const now = Date.now();
      const lastTime = lastBackupTime.get(userId) || 0;
      if (now - lastTime > BACKUP_COOLDOWN) {
        lastBackupTime.set(userId, now);
        const existingCopy = existing.data;
        setImmediate(async () => {
          try {
            const oldData = existingCopy as any;
            const hasContent = (oldData.todayTasks?.length > 0) || (oldData.dayNotes?.length > 0) ||
              (oldData.tradingNotes?.length > 0) || (oldData.goals?.length > 0);
            if (hasContent) {
              await mongoose.model("UserDataBackup").create({ userId, data: existingCopy });
              const backups = await mongoose.model("UserDataBackup").find({ userId }).sort({ createdAt: -1 }).skip(10);
              if (backups.length > 0) {
                await mongoose.model("UserDataBackup").deleteMany({ _id: { $in: backups.map((b: any) => b._id) } });
              }
            }
          } catch (err) {
            console.error("[ASYNC BACKUP ERROR]", err);
          }
        });
      }
    }

    await mongoose.model("UserData").findOneAndUpdate(
      { userId },
      { data: cleanData, updatedAt: new Date(), $inc: { revision: 1 } },
      { upsert: true }
    );
  }

  const MAX_DATA_SIZE_BYTES = 5 * 1024 * 1024; // 5MB hard limit per user document

  app.put("/api/user/data", requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data || typeof data !== "object") {
      return res.status(400).json({ message: "Нет данных" });
    }

    // Strict size guard — prevent payload bloat
    try {
      const serialized = JSON.stringify(data);
      if (Buffer.byteLength(serialized, "utf8") > MAX_DATA_SIZE_BYTES) {
        console.warn(`[DATA GUARD] Payload too large from user ${req.session.userId}: ${Buffer.byteLength(serialized, "utf8")} bytes`);
        return res.status(413).json({ message: "Данные превышают допустимый размер (5MB)" });
      }
    } catch {
      return res.status(400).json({ message: "Невалидный формат данных" });
    }

    try {
      await saveWithBackup(req.session.userId!, data);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Save data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // ── Google Calendar Sync endpoints (web) ──
  app.post("/api/calendar/sync-task", requireAuth, async (req, res) => {
    try {
      const task = req.body.task;
      if (!task || !task.id) return res.status(400).json({ message: "Нет данных задачи" });
      const userId = req.session.userId!;
      const eventId = await syncTaskToGoogleCalendar(userId, task);
      return res.json({ ok: true, googleCalendarEventId: eventId });
    } catch (err) {
      console.error("[calendar/sync-task]", err);
      return res.status(500).json({ ok: false, message: "Ошибка синхронизации" });
    }
  });

  app.post("/api/calendar/delete-event", requireAuth, async (req, res) => {
    try {
      const { googleCalendarEventId } = req.body;
      if (!googleCalendarEventId) return res.status(400).json({ message: "Нет eventId" });
      const userId = req.session.userId!;
      const ok = await deleteGoogleCalendarEvent(userId, googleCalendarEventId);
      return res.json({ ok });
    } catch (err) {
      console.error("[calendar/delete-event]", err);
      return res.status(500).json({ ok: false });
    }
  });

  app.post("/api/calendar/full-sync", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const result = await pullAndSyncGoogleCalendar(userId);
      return res.json({ ok: true, ...result });
    } catch (err) {
      console.error("[calendar/full-sync]", err);
      return res.status(500).json({ ok: false, message: "Ошибка двусторонней синхронизации" });
    }
  });

  app.post("/api/user/data-beacon", requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).end();

    try {
      await saveWithBackup(req.session.userId!, data);
    } catch (err) {
      console.error("Beacon save error:", err);
    }
    return res.status(204).end();
  });

  app.get("/api/user/export", requireAuth, async (req, res) => {
    try {
      const userData = await mongoose.model("UserData").findOne({ userId: req.session.userId });
      const data = userData?.data || {};
      res.setHeader("Content-Disposition", `attachment; filename="lifeos-backup-${new Date().toISOString().split("T")[0]}.json"`);
      res.setHeader("Content-Type", "application/json");
      return res.json({ data, exportedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Export error:", err);
      return res.status(500).json({ message: "Ошибка экспорта" });
    }
  });

  app.get("/api/user/backups", requireAuth, async (req, res) => {
    try {
      const backups = await mongoose.model("UserDataBackup").find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("_id createdAt");
      return res.json({ backups: backups.map((b: any) => ({ id: b._id, date: b.createdAt })) });
    } catch (err) {
      console.error("Backups list error:", err);
      return res.status(500).json({ message: "Ошибка" });
    }
  });

  app.post("/api/user/restore/:backupId", requireAuth, async (req, res) => {
    try {
      const backup = await mongoose.model("UserDataBackup").findOne({ _id: req.params.backupId, userId: req.session.userId });
      if (!backup) return res.status(404).json({ message: "Бэкап не найден" });
      await saveWithBackup(req.session.userId!, backup.data);
      return res.json({ ok: true, data: backup.data });
    } catch (err) {
      console.error("Restore error:", err);
      return res.status(500).json({ message: "Ошибка восстановления" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { email, lang } = parsed.data;

    try {
      const user = await mongoose.model("User").findOne({ email: email.toLowerCase() });
      if (!user) return res.json({ ok: true });

      const crypto = require("crypto");
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await mongoose.model("ResetToken").deleteMany({ userId: user._id });
      await mongoose.model("ResetToken").create({ userId: user._id, token, expiresAt });

      const resetUrl = `${process.env.APP_URL || "https://persona-life.onrender.com"}/reset-password?token=${token}`;

      const isEn = lang === "en";
      const subject = isEn ? "Password Reset — Persona Life" : "Сброс пароля — Persona Life";
      const title = isEn ? "Password Reset" : "Сброс пароля";
      const desc1 = isEn ? "You requested a password reset for Persona Life." : "Ты запросил сброс пароля для Persona Life.";
      const desc2 = isEn ? "Click the button below — the link is valid for 1 hour:" : "Нажми на кнопку ниже — ссылка действует 1 час:";
      const btn = isEn ? "Reset Password" : "Сбросить пароль";
      const footer = isEn ? "If you didn't request a reset, ignore this email." : "Если ты не запрашивал сброс — просто проигнорируй это письмо.";

      const spamNote = isEn ? "⚠️ If you don't see the email in your Inbox, please check your SPAM folder." : "⚠️ Если письма нет во «Входящих» — обязательно проверьте папку «СПАМ».";

      await sendEmail(
        user.email,
        subject,
        `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background:#0a0a0a; color:#fff; padding:32px;">
          <h2 style="color:#ef4444;">${title}</h2>
          <p style="color:#aaa;">${desc1}</p>
          <p style="color:#aaa;">${desc2}</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
            ${btn}
          </a>
          <p style="color:#ffb703;font-size:13px;font-weight:bold;margin-top:16px;">${spamNote}</p>
          <p style="color:#666;font-size:12px;margin-top:24px;">${footer}</p>
        </div>
        `
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });
    const { token, password } = parsed.data;

    try {
      const resetToken = await mongoose.model("ResetToken").findOne({ token, expiresAt: { $gt: new Date() } });
      if (!resetToken) return res.status(400).json({ message: "Ссылка недействительна или истекла" });

      const hash = await bcrypt.hash(password, 12);
      await mongoose.model("User").findByIdAndUpdate(resetToken.userId, { password_hash: hash });
      await mongoose.model("ResetToken").deleteMany({ userId: resetToken.userId });

      return res.json({ ok: true });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.get("/api/user/settings", requireAuth, async (req, res) => {
    try {
      let settings = await mongoose.model("UserSettings").findOne({ userId: req.session.userId })
        .select("-geminiApiKey -googleRefreshToken");
      if (!settings) {
        settings = await mongoose.model("UserSettings").create({ userId: req.session.userId });
      }
      return res.json({ settings });
    } catch (err) {
      console.error("Get settings error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.put("/api/user/settings", requireAuth, async (req, res) => {
    const { utcOffset, workStart, workEnd, restStart, restEnd, sleepStart, sleepEnd, tradingSessions, workDays, googleReminderMinutes } = req.body;
    try {
      const settings = await mongoose.model("UserSettings").findOneAndUpdate(
        { userId: req.session.userId },
        { utcOffset, workStart, workEnd, restStart, restEnd, sleepStart, sleepEnd, tradingSessions, workDays, googleReminderMinutes, updatedAt: new Date() },
        { upsert: true, returnDocument: "after" }
      );
      if (googleReminderMinutes !== undefined) {
        await mongoose.model("User").findByIdAndUpdate(req.session.userId, { googleReminderMinutes });
      }
      return res.json({ settings });
    } catch (err) {
      console.error("Save settings error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // Верификация email
app.get("/api/auth/verify-email", async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Неверный токен" });
    }
    try {
      // Сначала ищем пользователя по токену без проверки срока
      const user = await mongoose.model("User").findOne({ verifyToken: token });

      if (!user) {
        return res.status(400).json({ message: "Ссылка недействительна или уже использована" });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: "Email уже подтверждён" });
      }

      // Отдельно проверяем срок — чтобы фронт знал что именно произошло
      if (user.verifyTokenExpires && new Date() > user.verifyTokenExpires) {
        return res.status(400).json({ message: "Ссылка истекла", expired: true });
      }

      await mongoose.model("User").findByIdAndUpdate(user._id, {
        isVerified: true,
        verifyToken: null,
        verifyTokenExpires: null,
      });

      return res.json({ ok: true, message: "Email подтверждён" });
    } catch (err) {
      console.error("Verify email error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // Повторная отправка письма верификации
  app.post("/api/auth/resend-verification", async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Некорректный email" });
    const { email, lang } = parsed.data;
    try {
      const user = await mongoose.model("User").findOne({ email, isVerified: false });
      if (!user) return res.json({ ok: true });

      const crypto = require("crypto");
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // было 7 дней
      await mongoose.model("User").findByIdAndUpdate(user._id, { verifyToken, verifyTokenExpires });

      const verifyUrl = `${process.env.APP_URL || "https://persona-life.onrender.com"}/verify-email?token=${verifyToken}`;
      const isEn = lang === "en";
      const subject = isEn ? "Verify email — Persona Life" : "Подтвердить email — Persona Life";
      const title = isEn ? "PERSONA LIFE" : "PERSONA LIFE";
      const desc = isEn ? "Click the button to verify your email:" : "Нажми кнопку чтобы подтвердить email:";
      const btn = isEn ? "VERIFY" : "ПОДТВЕРДИТЬ";
      const footer = isEn ? "Link is valid for 24 hours." : "Ссылка действует 24 часа.";

      const spamNote = isEn ? "⚠️ If you don't see the email in your Inbox, please check your SPAM folder." : "⚠️ Если письма нет во «Входящих» — обязательно проверьте папку «СПАМ».";

      await sendEmail(
        user.email,
        subject,
        `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;">
          <h2 style="color:#E11D48;">${title}</h2>
          <p style="color:#aaa;">${desc}</p>
          <a href="${verifyUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#E11D48;color:#fff;text-decoration:none;font-weight:bold;">
            ${btn}
          </a>
          <p style="color:#ffb703;font-size:13px;font-weight:bold;margin-top:16px;">${spamNote}</p>
          <p style="color:#666;font-size:12px;">${footer}</p>
        </div>
        `
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("Resend verification error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // ── Удаление аккаунта (GDPR / полная очистка данных) ──
  app.delete("/api/user/delete-account", requireAuth, async (req, res) => {
    const userId = req.session.userId;
    try {
      const collectionNames = [
        "UserData", "UserDataBackup", "UserSettings", "ResetToken",
        "Task", "Goal", "DayNote", "TradingNote", "DailyBias",
        "FocusSession", "RoutineTemplate", "Simulation",
        "BrainstormSession", "ProcessedAudio",
      ];
      for (const name of collectionNames) {
        const model = mongoose.model(name);
        if (model && typeof model.deleteMany === "function") {
          await model.deleteMany({ userId });
        }
      }
      await mongoose.model("User").findByIdAndDelete(userId);

      req.session.destroy(() => {
        res.clearCookie("persona.sid");
        console.log(`[account] Deleted account ${userId}`);
        return res.json({ ok: true });
      });
    } catch (err) {
      console.error("Delete account error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });
}

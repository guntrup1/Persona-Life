import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectMongo from "connect-mongo";
const MongoStore = (ConnectMongo as any).default || ConnectMongo;
import bcrypt from "bcryptjs";
import { User, UserData, UserDataBackup, ResetToken, UserSettings } from "./mongodb";

export function setupAuth(app: Express) {
  app.use(
    session({
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: "sessions",
      }),
      secret: process.env.SESSION_SECRET || "lifeos-secret-key",
      resave: false,
      saveUninitialized: false,
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
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Не авторизован" });
  }
  next();
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email и пароль обязательны" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Пароль должен быть не менее 6 символов" });
    }

    try {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }

      const hash = await bcrypt.hash(password, 12);
      const user = await User.create({
        email: email.toLowerCase(),
        password_hash: hash,
      });

      await UserData.create({ userId: user._id, data: {} });

      req.session.userId = user._id.toString();
      req.session.email = user.email;

      return res.json({ id: user._id, email: user.email });
    } catch (err) {
      console.error("Register error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email и пароль обязательны" });
    }

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      req.session.userId = user._id.toString();
      req.session.email = user.email;

      const userData = await UserData.findOne({ userId: user._id });
      const data = userData?.data || null;

      return res.json({ id: user._id, email: user.email, data });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      return res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) {
      return res.json({ user: null });
    }
    try {
      const user = await User.findById(req.session.userId).select("email");
      if (!user) {
        req.session.destroy(() => {});
        return res.json({ user: null });
      }
      return res.json({ user: { id: user._id, email: user.email } });
    } catch {
      return res.json({ user: null });
    }
  });

  app.get("/api/user/data", requireAuth, async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    const userData = await UserData.findOne({ userId: req.session.userId });
    return res.json({ data: userData?.data || null });
    } catch (err) {
      console.error("Get data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  const lastBackupTime = new Map<string, number>();
  const BACKUP_COOLDOWN = 10 * 60 * 1000;

  async function saveWithBackup(userId: string, data: any) {
    const now = Date.now();
    const lastTime = lastBackupTime.get(userId) || 0;
    const shouldBackup = (now - lastTime) > BACKUP_COOLDOWN;

    if (shouldBackup) {
      const existing = await UserData.findOne({ userId });
      if (existing?.data && typeof existing.data === "object") {
        const oldData = existing.data as any;
        const hasContent = (oldData.todayTasks?.length > 0) || (oldData.dayNotes?.length > 0) ||
          (oldData.tradingNotes?.length > 0) || (oldData.goals?.length > 0);
        if (hasContent) {
          await UserDataBackup.create({ userId, data: existing.data });
          lastBackupTime.set(userId, now);
          const backups = await UserDataBackup.find({ userId }).sort({ createdAt: -1 }).skip(10);
          if (backups.length > 0) {
            await UserDataBackup.deleteMany({ _id: { $in: backups.map(b => b._id) } });
          }
        }
      }
    }

    await UserData.findOneAndUpdate(
      { userId },
      { data, updatedAt: new Date() },
      { upsert: true }
    );
  }

  app.put("/api/user/data", requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: "Нет данных" });

    try {
      await saveWithBackup(req.session.userId!, data);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Save data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
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
      const userData = await UserData.findOne({ userId: req.session.userId });
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
      const backups = await UserDataBackup.find({ userId: req.session.userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("_id createdAt");
      return res.json({ backups: backups.map(b => ({ id: b._id, date: b.createdAt })) });
    } catch (err) {
      console.error("Backups list error:", err);
      return res.status(500).json({ message: "Ошибка" });
    }
  });

  app.post("/api/user/restore/:backupId", requireAuth, async (req, res) => {
    try {
      const backup = await UserDataBackup.findOne({ _id: req.params.backupId, userId: req.session.userId });
      if (!backup) return res.status(404).json({ message: "Бэкап не найден" });
      await saveWithBackup(req.session.userId!, backup.data);
      return res.json({ ok: true, data: backup.data });
    } catch (err) {
      console.error("Restore error:", err);
      return res.status(500).json({ message: "Ошибка восстановления" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email обязателен" });

    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.json({ ok: true });

      const token = require("crypto").randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await ResetToken.deleteMany({ userId: user._id });
      await ResetToken.create({ userId: user._id, token, expiresAt });

      const resetUrl = `${process.env.APP_URL || "https://persona-life.onrender.com"}/reset-password?token=${token}`;

      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Persona Life <onboarding@resend.dev>",
        to: user.email,
        subject: "Сброс пароля — Persona Life",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Сброс пароля</h2>
            <p>Ты запросил сброс пароля для Persona Life.</p>
            <p>Нажми на кнопку ниже — ссылка действует 1 час:</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">
              Сбросить пароль
            </a>
            <p style="color:#888;font-size:12px;margin-top:24px;">Если ты не запрашивал сброс — просто проигнорируй это письмо.</p>
          </div>
        `,
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Токен и пароль обязательны" });
    if (password.length < 6) return res.status(400).json({ message: "Пароль должен быть не менее 6 символов" });

    try {
      const resetToken = await ResetToken.findOne({ token, expiresAt: { $gt: new Date() } });
      if (!resetToken) return res.status(400).json({ message: "Ссылка недействительна или истекла" });

      const hash = await bcrypt.hash(password, 12);
      await User.findByIdAndUpdate(resetToken.userId, { password_hash: hash });
      await ResetToken.deleteMany({ userId: resetToken.userId });

      return res.json({ ok: true });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.get("/api/user/settings", requireAuth, async (req, res) => {
    try {
      let settings = await UserSettings.findOne({ userId: req.session.userId });
      if (!settings) {
        settings = await UserSettings.create({ userId: req.session.userId });
      }
      return res.json({ settings });
    } catch (err) {
      console.error("Get settings error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.put("/api/user/settings", requireAuth, async (req, res) => {
    const { utcOffset, workStart, workEnd, restStart, restEnd, sleepStart, sleepEnd } = req.body;
    try {
      const settings = await UserSettings.findOneAndUpdate(
        { userId: req.session.userId },
        { utcOffset, workStart, workEnd, restStart, restEnd, sleepStart, sleepEnd, updatedAt: new Date() },
        { upsert: true, new: true }
      );
      return res.json({ settings });
    } catch (err) {
      console.error("Save settings error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });
}

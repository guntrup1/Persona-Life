import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import bcrypt from "bcryptjs";
import { User, UserData } from "./mongodb";

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
      const userData = await UserData.findOne({ userId: req.session.userId });
      return res.json({ data: userData?.data || null });
    } catch (err) {
      console.error("Get data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.put("/api/user/data", requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: "Нет данных" });

    try {
      await UserData.findOneAndUpdate(
        { userId: req.session.userId },
        { data, updatedAt: new Date() },
        { upsert: true }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("Save data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });
}

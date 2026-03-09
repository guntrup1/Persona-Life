import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const PgSession = connectPgSimple(session);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export function setupAuth(app: Express) {
  app.use(
    session({
      store: new PgSession({ pool, tableName: "session" }),
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
    userId: number;
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
      const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: "Пользователь с таким email уже существует" });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
        [email.toLowerCase(), hash]
      );
      const user = result.rows[0];

      await pool.query("INSERT INTO user_data (user_id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
        user.id,
        JSON.stringify({}),
      ]);

      req.session.userId = user.id;
      req.session.email = user.email;

      return res.json({ id: user.id, email: user.email });
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
      const result = await pool.query(
        "SELECT id, email, password_hash FROM users WHERE email = $1",
        [email.toLowerCase()]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Неверный email или пароль" });
      }

      req.session.userId = user.id;
      req.session.email = user.email;

      const dataResult = await pool.query("SELECT data FROM user_data WHERE user_id = $1", [user.id]);
      const data = dataResult.rows[0]?.data || null;

      return res.json({ id: user.id, email: user.email, data });
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
      const result = await pool.query("SELECT id, email FROM users WHERE id = $1", [req.session.userId]);
      if (result.rows.length === 0) {
        req.session.destroy(() => {});
        return res.json({ user: null });
      }
      return res.json({ user: result.rows[0] });
    } catch {
      return res.json({ user: null });
    }
  });

  app.get("/api/user/data", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("SELECT data FROM user_data WHERE user_id = $1", [req.session.userId]);
      return res.json({ data: result.rows[0]?.data || null });
    } catch (err) {
      console.error("Get data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.put("/api/user/data", requireAuth, async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: "Нет данных" });

    try {
      await pool.query(
        `INSERT INTO user_data (user_id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = NOW()`,
        [req.session.userId, JSON.stringify(data)]
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("Save data error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });
}

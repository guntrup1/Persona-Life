import type { Express } from "express";
import { requireAuth } from "./auth";
import { User } from "./mongodb";
import crypto from "crypto";

export function registerTelegramRoutes(app: Express) {
  // ── Generate link token ──
  app.post("/api/telegram/link", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId;

      // Check if already linked
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });

      if (user.telegramId) {
        return res.status(400).json({
          message: "Telegram уже привязан",
          linked: true,
          telegramId: user.telegramId,
        });
      }

      // Generate one-time token (expires in 10 minutes)
      const token = crypto.randomBytes(16).toString("hex");
      const expires = new Date(Date.now() + 10 * 60 * 1000);

      await User.findByIdAndUpdate(userId, {
        telegramLinkToken: token,
        telegramLinkExpires: expires,
      });

      const botUsername = "Personedge_bot";
      const link = `https://t.me/${botUsername}?start=${token}`;

      return res.json({ ok: true, link, expiresAt: expires.toISOString() });
    } catch (err) {
      console.error("[telegram] Link token error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // ── Check link status ──
  app.get("/api/telegram/status", requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.session.userId).select("telegramId");
      return res.json({
        linked: !!user?.telegramId,
        telegramId: user?.telegramId || null,
      });
    } catch (err) {
      console.error("[telegram] Status error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // ── Unlink Telegram ──
  app.delete("/api/telegram/unlink", requireAuth, async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.session.userId, {
        telegramId: null,
        telegramLinkToken: null,
        telegramLinkExpires: null,
      });
      return res.json({ ok: true });
    } catch (err) {
      console.error("[telegram] Unlink error:", err);
      return res.status(500).json({ message: "Ошибка сервера" });
    }
  });
}

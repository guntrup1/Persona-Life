import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-center">
          Забыл пароль
        </h1>
        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Если аккаунт с таким email существует — письмо отправлено. Проверь почту.
            </p>
            <Link href="/">
              <Button variant="outline" className="w-full">Вернуться</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="Твой email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Отправляем..." : "Отправить ссылку"}
            </Button>
            <Link href="/">
              <Button variant="ghost" className="w-full text-muted-foreground">Назад</Button>
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}

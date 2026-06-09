import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const { t, lang } = useI18n();
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
        body: JSON.stringify({ email, lang }),
      });
      setSent(true);
    } catch {
      setError(t.authPages.connError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-center">
          {t.authPages?.forgotTitle?.toUpperCase() || "ЗАБЫЛ ПАРОЛЬ"}
        </h1>
        {sent ? (
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {t.authPages?.forgotSent || "Если аккаунт с таким email существует — письмо отправлено."}
            </p>
            <Link href="/">
              <Button variant="outline" className="w-full">{t.authPages.back}</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder={t.authPages.emailPlaceholder}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t.authPages.sending : t.authPages.sendLink}
            </Button>
            <Link href="/">
              <Button variant="ghost" className="w-full text-muted-foreground">{t.authPages.backBtn}</Button>
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}

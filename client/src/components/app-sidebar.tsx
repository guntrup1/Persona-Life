import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem,
  SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, TrendingUp, Lightbulb, Newspaper, CalendarDays,
  LogOut, Download, Settings, MessageSquarePlus, Send, X,
} from "lucide-react";
import { useStore, getUserTime, loadUserSettings, getMarketSession, getLevelFromXP } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, memo } from "react";
import { useToast } from "@/hooks/use-toast";

const SidebarClock = memo(function SidebarClock() {
  const [now, setNow] = useState(getUserTime());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(getUserTime());
      setSession(getMarketSession());
    }, 1000);
    const onSettings = () => {
      setNow(getUserTime());
      setSession(getMarketSession());
    };
    window.addEventListener("settingsUpdated", onSettings);
    return () => { clearInterval(id); window.removeEventListener("settingsUpdated", onSettings); };
  }, []);

  const utcOffset = loadUserSettings().utcOffset;
  const utcLabel = utcOffset >= 0 ? `UTC+${utcOffset}` : `UTC${utcOffset}`;
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-w-0">
      <div className="text-muted-foreground font-mono truncate text-[10px]">{timeStr} {utcLabel}</div>
      <div className={`font-display font-bold truncate text-xs ${session.color}`}>{session.name}</div>
    </div>
  );
});

const navItems = [
  { title: "Главная",    url: "/",         icon: LayoutDashboard, testId: "nav-hub" },
  { title: "Задачи",     url: "/tasks",    icon: CheckSquare,     testId: "nav-tasks" },
  { title: "Цели",       url: "/goals",    icon: Target,          testId: "nav-goals" },
  { title: "Фокус",      url: "/timer",    icon: Timer,           testId: "nav-timer" },
  { title: "Статистика", url: "/stats",    icon: BarChart3,       testId: "nav-stats" },
  { title: "Трейдинг",   url: "/notes",    icon: TrendingUp,      testId: "nav-notes" },
  { title: "Идеи",       url: "/ideas",    icon: Lightbulb,       testId: "nav-ideas" },
  { title: "Новости",    url: "/news",     icon: Newspaper,       testId: "nav-news" },
  { title: "Календарь",  url: "/calendar", icon: CalendarDays,    testId: "nav-calendar" },
  { title: "Настройки",  url: "/settings", icon: Settings,        testId: "nav-settings" },
];

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, email: user?.email }),
      });
      if (res.ok) {
        toast({ title: "Фидбек отправлен!", description: "Спасибо за обратную связь." });
        onClose();
      } else {
        toast({ title: "Ошибка", description: "Не удалось отправить. Попробуй позже.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Ошибка", description: "Нет соединения.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease-out" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md bg-card border border-border p-5 space-y-4"
        style={{
          clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))",
          animation: "slideUp 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm uppercase tracking-widest text-foreground">Обратная связь</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Предложения, баги, идеи — всё принимается</p>
          </div>
          <button
            onClick={onClose}
            style={{ clipPath: "none", padding: "6px", background: "transparent", border: "none", color: "hsl(var(--muted-foreground))", cursor: "pointer" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напиши что думаешь..."
          className="w-full h-32 bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground p-3 resize-none focus:outline-none focus:border-primary transition-colors"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
        />

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Ctrl+Enter для отправки</span>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-display uppercase tracking-wider disabled:opacity-40 hover:brightness-110 active:scale-95 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useStore();
  const { user, logout } = useAuth();
  const { level, xpInLevel, xpForNext } = getLevelFromXP(state.xp.totalXP);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}

      <Sidebar>
        {/* ── Логотип ── */}
        <SidebarHeader className="px-3 py-3 border-b border-sidebar-border flex-shrink-0 overflow-hidden">
          <Link href="/" data-testid="link-logo-home">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div
                className="w-9 h-9 bg-primary flex items-center justify-center flex-shrink-0 p5-glow-sm transition-all group-hover:p5-glow"
                style={{ clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))" }}
              >
                <span className="font-p5 text-white text-sm font-bold leading-none">TP</span>
              </div>
              <div className="min-w-0">
                <div className="font-p5 text-base text-foreground tracking-widest truncate leading-none animate-p5-flicker" style={{ letterSpacing: "0.2em" }}>
                  TRADE
                </div>
                <div className="font-p5 text-primary text-xs tracking-widest truncate leading-none" style={{ letterSpacing: "0.25em" }}>
                  PERSONA
                </div>
              </div>
            </div>
          </Link>
        </SidebarHeader>

        {/* ── Навигация ── */}
        <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden py-2">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5 px-1">
                {navItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <Link href={item.url} data-testid={item.testId} style={{ display: "block", textDecoration: "none" }}>
                        <div className={`sidebar-nav-item ${isActive ? "sidebar-nav-active" : "sidebar-nav-idle"}`}>
                          {isActive && <div className="sidebar-nav-line" />}
                          <item.icon className="sidebar-nav-icon" />
                          <span className="sidebar-nav-label">{item.title}</span>
                          {isActive && <div className="sidebar-nav-dot" />}
                        </div>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Футер ── */}
        <SidebarFooter className="border-t border-sidebar-border flex-shrink-0 p-3 space-y-2 overflow-hidden">
          {/* XP бар */}
          <div className="space-y-1 overflow-hidden">
            <div className="flex items-center justify-between gap-1">
              <span className="font-display text-[10px] text-muted-foreground uppercase tracking-wider">Ур. {level}</span>
              <span className="font-mono text-[10px] text-primary">{xpInLevel}/{xpForNext}</span>
            </div>
            <div className="w-full h-1.5 bg-muted overflow-hidden relative">
              <div
                className="h-full bg-primary transition-all duration-700 xp-bar-shine"
                style={{
                  width: `${Math.round((xpInLevel / xpForNext) * 100)}%`,
                  clipPath: "polygon(0 0, calc(100% - 2px) 0, 100% 100%, 0 100%)"
                }}
              />
            </div>
          </div>

          {/* Часы + стрик */}
          <div className="grid grid-cols-2 gap-1 text-[10px] overflow-hidden">
            <SidebarClock />
            <div className="text-right min-w-0">
              <div className="text-muted-foreground font-mono truncate text-[10px]">Стрик</div>
              <div className="font-mono font-bold text-primary truncate">{state.streak.currentStreak}д</div>
            </div>
          </div>

          {/* Кнопка фидбека */}
          <button
            onClick={() => setFeedbackOpen(true)}
            className="sidebar-feedback-btn"
            data-sidebar="true"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Обратная связь</span>
          </button>

          {/* Пользователь */}
          {user && (
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-sidebar-border overflow-hidden">
              <span className="text-[10px] text-muted-foreground font-mono truncate flex-1" data-testid="text-user-email">
                {user.email}
              </span>
              <a href="/api/user/export" className="flex-shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors" title="Экспорт данных" data-testid="button-export">
                <Download className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={logout}
                data-sidebar="true"
                className="flex-shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
                title="Выйти"
                data-testid="button-logout"
                style={{ clipPath: "none", background: "transparent", border: "none" }}
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import HubPage from "@/pages/hub";
import TasksPage from "@/pages/tasks";
import GoalsPage from "@/pages/goals";
import TimerPage from "@/pages/timer";
import StatsPage from "@/pages/stats";
import NotesPage from "@/pages/notes";
import IdeasPage from "@/pages/ideas";
import NewsPage from "@/pages/news";
import CalendarPage from "@/pages/calendar-page";
import LoginPage from "@/pages/login";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import SettingsPage from "@/pages/settings";
import VerifyEmailPage from "@/pages/verify-email";
import { AuthProvider, useAuth } from "@/lib/auth";
import { loadFromServerData, useStore, getTodayDate, syncFromServer, onSyncResult, type NoteType } from "@/lib/store";
import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, RefreshCw, AlertTriangle, Menu, X,
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, Newspaper, CalendarDays, LogOut, Lightbulb, TrendingUp, Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HubPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/goals" component={GoalsPage} />
      <Route path="/timer" component={TimerPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/ideas" component={IdeasPage} />
      <Route path="/news" component={NewsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function QuickNoteButton() {
  const { actions } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("note");
  const { toast } = useToast();

  const handleAdd = () => {
    if (!text.trim()) return;
    actions.addDayNote(getTodayDate(), text, noteType, noteType === "idea" ? title : undefined);
    setText("");
    setTitle("");
    setNoteType("note");
    setOpen(false);
    toast({ title: noteType === "idea" ? "Идея добавлена" : "Заметка добавлена" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0" data-testid="button-quick-note">
          <FileText className="w-[18px] h-[18px] text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{noteType === "idea" ? "Новая идея" : "Заметка дня"}</DialogTitle>
          <DialogDescription className="sr-only">Добавить заметку или идею</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setNoteType("note")}
              className={`flex-1 py-2 rounded-lg text-xs font-display uppercase tracking-wider transition-colors ${noteType === "note" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid="button-type-note"
            >
              Заметка
            </button>
            <button
              onClick={() => setNoteType("idea")}
              className={`flex-1 py-2 rounded-lg text-xs font-display uppercase tracking-wider transition-colors ${noteType === "idea" ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid="button-type-idea"
            >
              Идея
            </button>
          </div>
          {noteType === "idea" && (
            <Input
              placeholder="Заголовок идеи (опционально)"
              className="rounded-xl"
              value={title}
              onChange={e => setTitle(e.target.value)}
              data-testid="input-quick-note-title"
            />
          )}
          <Textarea
            placeholder={noteType === "idea" ? "Опиши свою идею..." : "Что хочешь записать?"}
            className="min-h-[100px] resize-none rounded-xl"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
            autoFocus
            data-testid="input-quick-note"
          />
          <Button onClick={handleAdd} disabled={!text.trim()} className="w-full rounded-full font-display" data-testid="button-quick-note-submit">
            {noteType === "idea" ? "Добавить идею" : "Добавить заметку"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const poll = async () => { await syncFromServer(); };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return onSyncResult((ok) => {
      if (ok) {
        const { dismiss } = toast({ title: "Сохранено" });
        setTimeout(() => dismiss(), 1500);
      }
    });
  }, [toast]);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await syncFromServer();
    setSyncing(false);
    toast({ title: ok ? "Синхронизировано" : "Нет соединения" });
  };

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
      data-testid="button-sync"
    >
      <RefreshCw className={`w-[18px] h-[18px] ${syncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
    </button>
  );
}

function NewsIndicator() {
  const { data: newsData } = useQuery<{ items: { title: string; currency: string; impact: string; time: string; day: string }[]; todayStr: string; nextStr: string }>({
    queryKey: ["/api/news"],
    staleTime: Infinity,
    select: (raw: unknown) => {
      if (Array.isArray(raw)) return { items: raw as { title: string; currency: string; impact: string; time: string; day: string }[], todayStr: "", nextStr: "" };
      return raw as { items: { title: string; currency: string; impact: string; time: string; day: string }[]; todayStr: string; nextStr: string };
    },
  });

  const todayHighNews = newsData?.items?.filter(n => n.day === "today" && n.impact === "High") || [];
  const nextHighNews = newsData?.items?.filter(n => n.day !== "today" && n.impact === "High") || [];
  const nextDateStr = newsData?.nextStr || "";

  const formatNextDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };

  if (todayHighNews.length > 0) {
    return (
      <Link href="/news" data-testid="header-news-block">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="font-display text-xs text-red-400 font-semibold whitespace-nowrap">
            {todayHighNews.length} {todayHighNews.length === 1 ? "новость" : todayHighNews.length < 5 ? "новости" : "новостей"}
          </span>
          <div className="hidden sm:flex items-center gap-1.5 overflow-hidden">
            {todayHighNews.slice(0, 2).map((n, i) => (
              <span key={i} className="font-mono text-[10px] text-muted-foreground whitespace-nowrap truncate max-w-[120px]">
                {n.time} {n.currency}
              </span>
            ))}
            {todayHighNews.length > 2 && <span className="font-mono text-[10px] text-muted-foreground">+{todayHighNews.length - 2}</span>}
          </div>
        </div>
      </Link>
    );
  }

  if (nextHighNews.length > 0 && nextDateStr) {
    return (
      <Link href="/news" data-testid="header-news-block">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer">
          <Newspaper className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-display text-xs text-muted-foreground whitespace-nowrap">
            Новости {formatNextDate(nextDateStr)}
          </span>
          <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">
            {nextHighNews.length} шт.
          </span>
        </div>
      </Link>
    );
  }

  return null;
}

const mobileNavItems = [
  { title: "Главная", url: "/", icon: LayoutDashboard },
  { title: "Задачи", url: "/tasks", icon: CheckSquare },
  { title: "Цели", url: "/goals", icon: Target },
  { title: "Фокус", url: "/timer", icon: Timer },
  { title: "Статистика", url: "/stats", icon: BarChart3 },
  { title: "Трейдинг", url: "/notes", icon: TrendingUp },
  { title: "Идеи", url: "/ideas", icon: Lightbulb },
  { title: "Новости", url: "/news", icon: Newspaper },
  { title: "Календарь", url: "/calendar", icon: CalendarDays },
  { title: "Настройки", url: "/settings", icon: Settings },
];

function MobileNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();

  useEffect(() => {
    setOpen(false);
  }, [location]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
        data-testid="button-mobile-menu"
      >
        {open ? <X className="w-5 h-5 text-foreground" /> : <Menu className="w-5 h-5 text-foreground" />}
      </button>

      {open && (
        <div className="fixed inset-0 top-0 left-0 w-full h-full bg-background z-[60] flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-display text-sm font-bold uppercase tracking-widest text-foreground">Меню</span>
            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors"
              data-testid="button-mobile-menu-close"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>
          <nav className="flex-1 flex flex-col py-4 px-2 gap-1">
            {mobileNavItems.map(item => {
              const isActive = location === item.url;
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  data-testid={`mobile-nav-${item.title.toLowerCase()}`}
                >
                  <div className={`flex items-center gap-4 px-5 py-3.5 rounded-xl transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"}`}>
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-display text-base tracking-wide ${isActive ? "font-semibold" : ""}`}>{item.title}</span>
                    {isActive && <div className="ml-auto w-1.5 h-5 bg-primary rounded-full" />}
                  </div>
                </Link>
              );
            })}
            <div className="mt-auto border-t border-border pt-3 mx-2">
              <button
                onClick={logout}
                className="flex items-center gap-4 px-5 py-3.5 w-full text-left text-red-400 hover:bg-muted/50 transition-colors rounded-xl"
                data-testid="button-mobile-logout"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span className="font-display text-base tracking-wide">Выйти</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  useEffect(() => {
    const seen = localStorage.getItem("tp_seen_landing");
    if (!seen && !user && !loading) {
      localStorage.setItem("tp_seen_landing", "1");
      window.location.href = "/landing.html";
    }
  }, [user, loading]);
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🎭</div>
          <p className="font-display text-sm text-muted-foreground uppercase tracking-widest">Загрузка...</p>
        </div>
      </div>
    );
  }

  const [location] = useLocation();

  if (!user) {
    if (location === "/forgot-password") return <ForgotPasswordPage />;
    if (location.startsWith("/reset-password")) return <ResetPasswordPage />;
    if (location.startsWith("/verify-email")) return <VerifyEmailPage />;
    return <LoginPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "13rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <header className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border flex-shrink-0 bg-background sticky top-0 z-50 overflow-hidden">
        {/* P5 красная полоса сверху */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary p5-glow-sm" />
      
        {/* P5 диагональный акцент слева */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary hidden md:block"
          style={{ clipPath: "polygon(0 0, 100% 15%, 100% 85%, 0 100%)" }}
        />
      
        <div className="md:hidden">
          <MobileNav />
        </div>
      
        <div className="hidden md:block">
          <SidebarTrigger
            data-testid="button-sidebar-toggle"
            className="text-muted-foreground h-9 w-9 flex-shrink-0 hover:text-primary transition-colors"
          />
        </div>
      
        {/* Название в хедере для мобилки */}
        {/* Пустой flex-1 для правильного выравнивания на мобилке */}
        <div className="md:hidden flex-1" />
      
        <div className="flex items-center gap-1 ml-auto">
          <NewsIndicator />
          <SyncButton />
          <QuickNoteButton />
          <Link href="/settings">
            <button
              className="h-9 w-9 flex items-center justify-center hover:text-primary transition-colors flex-shrink-0"
              data-testid="button-settings"
            >
              <Settings className="w-[18px] h-[18px] text-muted-foreground hover:text-primary transition-colors" />
            </button>
          </Link>
        </div>
      </header>

          <main className="flex-1 overflow-auto" style={{ contain: "paint layout" }}>
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  const handleLogin = useCallback((data: unknown) => {
    if (data && typeof data === "object" && Object.keys(data as object).length > 2) {
      loadFromServerData(data as Parameters<typeof loadFromServerData>[0]);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider onLogin={handleLogin}>
          <AppShell />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

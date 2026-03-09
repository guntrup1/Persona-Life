import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import HubPage from "@/pages/hub";
import TasksPage from "@/pages/tasks";
import GoalsPage from "@/pages/goals";
import TimerPage from "@/pages/timer";
import StatsPage from "@/pages/stats";
import NotesPage from "@/pages/notes";
import NewsPage from "@/pages/news";
import CalendarPage from "@/pages/calendar-page";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/lib/auth";
import { loadFromServerData, useStore, getTodayDate, syncFromServer } from "@/lib/store";
import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, RefreshCw, AlertTriangle, Menu, X, Zap,
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, Newspaper, CalendarDays, LogOut,
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
      <Route path="/news" component={NewsPage} />
      <Route path="/calendar" component={CalendarPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function QuickNoteButton() {
  const { actions } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { toast } = useToast();

  const handleAdd = () => {
    if (!text.trim()) return;
    actions.addDayNote(getTodayDate(), text);
    setText("");
    setOpen(false);
    toast({ title: "Заметка добавлена" });
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
          <DialogTitle className="font-display">Заметка дня</DialogTitle>
          <DialogDescription className="sr-only">Добавить заметку</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Textarea
            placeholder="Что хочешь записать?"
            className="min-h-[100px] resize-none rounded-xl"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
            autoFocus
            data-testid="input-quick-note"
          />
          <Button onClick={handleAdd} disabled={!text.trim()} className="w-full rounded-full font-display" data-testid="button-quick-note-submit">
            Добавить заметку
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

  const todayNews = newsData?.items?.filter(n => n.day === "today") || [];
  const [open, setOpen] = useState(false);

  if (todayNews.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0" data-testid="button-news-indicator">
          <AlertTriangle className="w-[18px] h-[18px] text-red-400" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {todayNews.length}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Важные новости сегодня
          </DialogTitle>
          <DialogDescription className="sr-only">Список важных экономических новостей</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {todayNews.map((n, i) => (
            <div key={i} className="flex items-start gap-3 text-sm border-l-2 border-red-500 pl-3 py-1.5">
              <span className="font-mono text-muted-foreground whitespace-nowrap flex-shrink-0 text-xs">{n.time}</span>
              <span className="font-display text-foreground leading-snug">{n.title}</span>
              <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{n.currency}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const mobileNavItems = [
  { title: "Главная", url: "/", icon: LayoutDashboard },
  { title: "Задачи", url: "/tasks", icon: CheckSquare },
  { title: "Цели", url: "/goals", icon: Target },
  { title: "Фокус", url: "/timer", icon: Timer },
  { title: "Статистика", url: "/stats", icon: BarChart3 },
  { title: "Заметки", url: "/notes", icon: FileText },
  { title: "Новости", url: "/news", icon: Newspaper },
  { title: "Календарь", url: "/calendar", icon: CalendarDays },
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
        <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-card-border rounded-2xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="py-2">
            {mobileNavItems.map(item => {
              const isActive = location === item.url;
              return (
                <Link
                  key={item.url}
                  href={item.url}
                  data-testid={`mobile-nav-${item.title.toLowerCase()}`}
                >
                  <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"}`}>
                    <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-display text-sm tracking-wide ${isActive ? "font-semibold" : ""}`}>{item.title}</span>
                    {isActive && <div className="ml-auto w-1.5 h-4 bg-primary rounded-full" />}
                  </div>
                </Link>
              );
            })}
            <div className="border-t border-card-border mt-1 pt-1">
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-red-400 hover:bg-muted/50 transition-colors"
                data-testid="button-mobile-logout"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="font-display text-sm tracking-wide">Выйти</span>
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

  if (!user) {
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
          <header className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border flex-shrink-0 bg-background sticky top-0 z-50">
            <div className="md:hidden">
              <MobileNav />
            </div>

            <div className="hidden md:block">
              <SidebarTrigger
                data-testid="button-sidebar-toggle"
                className="text-muted-foreground h-9 w-9 flex-shrink-0"
              />
            </div>

            <Link href="/" data-testid="link-logo-home">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-display text-xs text-muted-foreground tracking-widest uppercase truncate">
                  Life OS
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-1 ml-auto">
              <NewsIndicator />
              <SyncButton />
              <QuickNoteButton />
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

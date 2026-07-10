import React from 'react';
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
import { I18nProvider, useI18n, LangToggle } from "@/lib/i18n";
import { loadFromServerData, useStore, getTodayDate, syncFromServer, onSyncResult, type NoteType } from "@/lib/store";
import { useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, RefreshCw, AlertTriangle, Menu, X,
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, Newspaper, CalendarDays, LogOut, Lightbulb, TrendingUp, Settings,
  ChevronLeft, ChevronRight,
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
  const { t } = useI18n();
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
    toast({ title: noteType === "idea" ? t.ideaAdded : t.noteAdded });
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
          <DialogTitle className="font-display">{noteType === "idea" ? t.quickIdea : t.quickNote}</DialogTitle>
          <DialogDescription className="sr-only">Add note or idea</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setNoteType("note")}
              className={`flex-1 py-2 rounded-lg text-xs font-display uppercase tracking-wider transition-colors ${noteType === "note" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid="button-type-note"
            >
              {t.noteType}
            </button>
            <button
              onClick={() => setNoteType("idea")}
              className={`flex-1 py-2 rounded-lg text-xs font-display uppercase tracking-wider transition-colors ${noteType === "idea" ? "bg-yellow-500 text-black" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid="button-type-idea"
            >
              {t.ideaType}
            </button>
          </div>
          {noteType === "idea" && (
            <Input
              placeholder={t.ideaTitle}
              className="rounded-xl"
              value={title}
              onChange={e => setTitle(e.target.value)}
              data-testid="input-quick-note-title"
            />
          )}
          <Textarea
            placeholder={noteType === "idea" ? t.ideaPlaceholder : t.notePlaceholder}
            className="min-h-[100px] resize-none rounded-xl"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
            autoFocus
            data-testid="input-quick-note"
          />
          <Button onClick={handleAdd} disabled={!text.trim()} className="w-full rounded-full font-display" data-testid="button-quick-note-submit">
            {noteType === "idea" ? t.addIdea : t.addNote}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  // For toasts that are triggered outside of React context, we might need a workaround, 
  // but here we can just use the hook.
  const { t } = useI18n();

  useEffect(() => {
    const poll = async () => { await syncFromServer(); };
    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const unsub = onSyncResult((_ok) => {
      // NOTE: Here t is captured in closure, might be slightly stale if language changes rapidly, but it's fine
    });
    return () => { unsub(); };
  }, []); // removed toast dependency to avoid re-binding

  // Handle manual sync result messages
  useEffect(() => {
    const unsub = onSyncResult((ok) => {
      if (ok) {
        const { dismiss } = toast({ title: "✔" });
        setTimeout(() => dismiss(), 1500);
      }
    });
    return () => { unsub(); };
  }, [toast]);

  const handleSync = async () => {
    setSyncing(true);
    const ok = await syncFromServer();
    setSyncing(false);
    toast({ title: ok ? t.synced : t.noConnection });
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
  const { t, lang } = useI18n();
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
    return d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short" });
  };

  if (todayHighNews.length > 0) {
    return (
      <Link href="/news" data-testid="header-news-block">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors cursor-pointer">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <span className="font-display text-xs text-red-400 font-semibold whitespace-nowrap">
            {t.newsToday(todayHighNews.length)}
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
            {t.newsNext(formatNextDate(nextDateStr))}
          </span>
          <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">
            {t.newsPcs(nextHighNews.length)}
          </span>
        </div>
      </Link>
    );
  }

  return null;
}

const mobileNavItems = [
  { id: "home", url: "/", icon: LayoutDashboard },
  { id: "tasks", url: "/tasks", icon: CheckSquare },
  { id: "goals", url: "/goals", icon: Target },
  { id: "timer", url: "/timer", icon: Timer },
  { id: "stats", url: "/stats", icon: BarChart3 },
  { id: "trading", url: "/notes", icon: TrendingUp },
  { id: "ideas", url: "/ideas", icon: Lightbulb },
  { id: "news", url: "/news", icon: Newspaper },
  { id: "calendar", url: "/calendar", icon: CalendarDays },
  { id: "settings", url: "/settings", icon: Settings },
] as const;

function MobileNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const { logout } = useAuth();
  const { t } = useI18n();

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
            <span className="font-display text-sm font-bold uppercase tracking-widest text-foreground">{t.menu}</span>
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
                  data-testid={`mobile-nav-${item.id}`}
                >
                  <div className={`flex items-center gap-4 px-5 py-3.5 rounded-xl transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"}`}>
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`font-display text-base tracking-wide ${isActive ? "font-semibold" : ""}`}>{t.nav[item.id as keyof typeof t.nav]}</span>
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
                <span className="font-display text-base tracking-wide">{t.logout}</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}


// ─── Welcome Popup ─────────────────────────────────────────────────────────

const WELCOME_KEY = "tp_welcome_v1";

function WelcomePopup() {
  const { t } = useI18n();
  const [visible, setVisible] = React.useState(false);
  const [slide, setSlide] = React.useState(0);
  const [fading, setFading] = React.useState(false);
  const [dir, setDir] = React.useState<"l"|"r">("r");

  const welcomeSlides = [
    {
      icon: "👋", title: t.welcome.slide1Title,
      body: () => (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed"><span className="text-foreground font-semibold">Trade Persona</span> — {t.welcome.slide1P1.replace("Trade Persona — ", "").replace("Trade Persona is your trader operating system.", "is your trader operating system.")}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{t.welcome.slide1P2}</p>
          <div className="p-3 border border-primary/20 bg-primary/5 text-xs font-mono text-primary/80 leading-relaxed">{t.welcome.slide1Warn}</div>
          <div className="p-3 border border-yellow-500/20 bg-yellow-500/5 text-xs font-mono text-yellow-400/80 leading-relaxed">{t.welcome.slide1Note}</div>
        </div>
      ),
    },
    {
      icon: "🎯", title: t.welcome.slide2Title,
      body: () => (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground leading-relaxed">{t.welcome.slide2P1}</p>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">✅</span><p className="text-xs text-muted-foreground">{t.welcome.slide2T1}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">⭐</span><p className="text-xs text-muted-foreground">{t.welcome.slide2T2}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">📝</span><p className="text-xs text-muted-foreground">{t.welcome.slide2T3}</p></div>
        </div>
      ),
    },
    {
      icon: "📊", title: t.welcome.slide3Title,
      body: () => (
        <div className="space-y-2">
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">📈</span><p className="text-xs text-muted-foreground">{t.welcome.slide3T1}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">📰</span><p className="text-xs text-muted-foreground">{t.welcome.slide3T2}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">📊</span><p className="text-xs text-muted-foreground">{t.welcome.slide3T3}</p></div>
        </div>
      ),
    },
    {
      icon: "⏱", title: t.welcome.slide4Title,
      body: () => (
        <div className="space-y-2">
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">⏱</span><p className="text-xs text-muted-foreground">{t.welcome.slide4T1}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">💡</span><p className="text-xs text-muted-foreground">{t.welcome.slide4T2}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">⚙️</span><p className="text-xs text-muted-foreground">{t.welcome.slide4T3}</p></div>
          <div className="flex gap-2 items-start"><span className="text-primary text-xs shrink-0 mt-0.5">💬</span><p className="text-xs text-muted-foreground">{t.welcome.slide4T4}</p></div>
        </div>
      ),
    },
  ];

  React.useEffect(() => {
    if (!localStorage.getItem(WELCOME_KEY)) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const close = () => { localStorage.setItem(WELCOME_KEY, "1"); setVisible(false); };
  const goTo = (n: number, d: "l"|"r") => {
    if (fading) return;
    setDir(d); setFading(true);
    setTimeout(() => { setSlide(n); setFading(false); }, 160);
  };
  const prev = () => slide > 0 && goTo(slide - 1, "l");
  const next = () => slide < welcomeSlides.length - 1 ? goTo(slide + 1, "r") : close();

  if (!visible) return null;
  const cur = welcomeSlides[slide];

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/75" style={{ backdropFilter: "blur(6px)" }} onClick={close} />
      <div className="fixed inset-0 z-[501] flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-card border border-border relative pointer-events-auto" style={{ clipPath: "polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))" }}>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" style={{ boxShadow: "0 0 8px rgba(225,29,72,0.6)" }} />
          <div className="absolute top-0 right-0 w-4 h-4 bg-primary" style={{ clipPath: "polygon(0 0,100% 0,100% 100%)" }} />
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{cur.icon}</span>
              <div>
                <div className="font-display text-sm font-bold uppercase tracking-widest">{cur.title}</div>
                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{slide + 1} / {welcomeSlides.length}</div>
              </div>
            </div>
            <button onClick={close} style={{ clipPath:"none", background:"transparent", border:"none", cursor:"pointer", padding:"4px" }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5 px-6 pt-4">
            {welcomeSlides.map((_,i) => (
              <button key={i} onClick={() => goTo(i, i>slide?"r":"l")} style={{ height:"3px", flex:1, background: i===slide?"hsl(var(--primary))":"hsl(var(--border))", border:"none", clipPath:"none", cursor:"pointer", transition:"background 0.2s", boxShadow: i===slide?"0 0 6px rgba(225,29,72,0.5)":"none" }} />
            ))}
          </div>
          <div className="px-6 py-5 min-h-[200px]" style={{ opacity: fading?0:1, transform: fading?`translateX(${dir==="r"?"16px":"-16px"})`:"translateX(0)", transition:"opacity 0.16s,transform 0.16s" }}>
            {cur.body()}
          </div>
          <div className="flex items-center justify-between px-6 pb-5">
            <button onClick={prev} disabled={slide===0} style={{ background:"transparent", border:"none", clipPath:"none", cursor:"pointer" }} className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft className="w-3.5 h-3.5" /> {t.welcome.back}
            </button>
            <button onClick={next} className="flex items-center gap-2 px-5 py-2 bg-primary text-white font-display text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
              {slide < welcomeSlides.length-1 ? <><span>{t.welcome.next}</span><ChevronRight className="w-3.5 h-3.5" /></> : t.welcome.start}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-bounce">🎭</div>
          <p className="font-display text-sm text-muted-foreground uppercase tracking-widest">{t.loading}</p>
        </div>
      </div>
    );
  }

if (!user) {
  const path = window.location.pathname;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;
  if (path === "/verify-email") return <VerifyEmailPage />;
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
          <LangToggle className="hidden sm:flex" />
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
            <WelcomePopup />
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
      loadFromServerData(data as Parameters<typeof loadFromServerData>[0], true);
    }
  }, []);

  // Global smooth wheel scroll logic
  useEffect(() => {
    let targetY = 0;
    let currentY = 0;
    let activeElement: HTMLElement | null = null;
    let animationFrameId: number | null = null;

    const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      if (node === null) return null;
      if (node === document.body || node === document.documentElement) {
        return document.documentElement;
      }
      const overflowY = window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';
      const canScroll = node.scrollHeight > node.clientHeight;
      if (isScrollable && canScroll) {
        return node;
      }
      return getScrollParent(node.parentElement);
    };

    const smoothScroll = () => {
      if (!activeElement) return;
      const ease = 0.16; // Much more responsive initial catch-up with smooth rubbery deceleration
      const diff = targetY - currentY;

      if (Math.abs(diff) < 0.5) {
        activeElement.scrollTop = targetY;
        animationFrameId = null;
        activeElement = null;
        return;
      }

      currentY += diff * ease;
      activeElement.scrollTop = Math.round(currentY);
      animationFrameId = requestAnimationFrame(smoothScroll);
    };

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      // Skip textareas, inputs, editable content, pinch zoom, or horizontal scroll
      if (
        target.tagName === "TEXTAREA" || 
        target.tagName === "INPUT" || 
        target.isContentEditable ||
        e.ctrlKey || 
        e.shiftKey
      ) {
        return;
      }

      // Detect trackpads/smooth mice (fractional scrolling or very small deltas)
      // to let browser handle them natively with full high-refresh-rate hardware acceleration.
      const isTrackpad = Math.abs(e.deltaY) < 30 || (e.deltaY % 1 !== 0);
      if (isTrackpad) {
        return;
      }

      const scrollParent = getScrollParent(target);
      if (!scrollParent) return;

      e.preventDefault();

      if (activeElement !== scrollParent) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        activeElement = scrollParent;
        currentY = scrollParent.scrollTop;
        targetY = scrollParent.scrollTop;
      }

      const maxScroll = scrollParent.scrollHeight - scrollParent.clientHeight;
      // Responsive scroll multiplier
      targetY = Math.max(0, Math.min(maxScroll, targetY + e.deltaY * 1.05));

      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(smoothScroll);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <AuthProvider onLogin={handleLogin}>
            <AppShell />
            <Toaster />
          </AuthProvider>
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

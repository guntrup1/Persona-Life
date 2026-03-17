import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, CheckSquare, Target, Timer,
  BarChart3, TrendingUp, Lightbulb, Newspaper, CalendarDays, LogOut, Download, Settings,
} from "lucide-react";
import { useStore, getUserTime, loadUserSettings, getMarketSession, getLevelFromXP } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, memo } from "react";

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

export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useStore();
  const { user, logout } = useAuth();
  const { level, xpInLevel, xpForNext } = getLevelFromXP(state.xp.totalXP);

  return (
    <Sidebar>
      {/* ── Логотип ── */}
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border flex-shrink-0 overflow-hidden">
        <Link href="/" data-testid="link-logo-home">
          <div className="flex items-center gap-2 cursor-pointer group">
            {/* P5-скошенный логотип */}
            <div
              className="w-9 h-9 bg-primary flex items-center justify-center flex-shrink-0 p5-glow-sm transition-all group-hover:p5-glow"
              style={{ clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))" }}
            >
              <span className="font-p5 text-white text-sm font-bold leading-none">TP</span>
            </div>
            <div className="min-w-0">
              <div
                className="font-p5 text-base text-foreground tracking-widest truncate leading-none animate-p5-flicker"
                style={{ letterSpacing: "0.2em" }}
              >
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
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={item.testId}>
                      <Link href={item.url}>
                        <div className={`flex items-center gap-3 w-full px-3 py-2 transition-all duration-150 relative ${
                            isActive
                              ? "bg-primary text-white"
                              : "text-sidebar-foreground hover:bg-primary/10 hover:text-primary"
                          }`}
                          style={isActive ? {
                            clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)"
                          } : {}} >
                          {/* Левая красная полоса для активного */}
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/80" />
                          )}
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-display text-xs tracking-widest uppercase truncate font-bold">
                            {item.title}
                          </span>
                          {isActive && (
                            <div className="ml-auto w-1 h-3 bg-white/60 flex-shrink-0" />
                          )}
                        </div>
                      </Link>
                    </SidebarMenuButton>
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
              className="h-full bg-primary transition-all duration-500 relative xp-bar-shine"
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

        {/* Пользователь */}
        {user && (
          <div className="flex items-center justify-between gap-1 pt-1 border-t border-sidebar-border overflow-hidden">
            <span className="text-[10px] text-muted-foreground font-mono truncate flex-1" data-testid="text-user-email">
              {user.email}
            </span>
            
              <a href="/api/user/export" className="flex-shrink-0 p-1 text-muted-foreground hover:text-primary transition-colors" title="Экспорт данных" data-testid="button-export"><Download className="w-3.5 h-3.5" /></a>
            <button
              onClick={logout}
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
              title="Выйти"
              data-testid="button-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
